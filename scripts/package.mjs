#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  utimes,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import {
  assertOpenAiSkillsOnlyEntries,
  assertOpenAiSkillsOnlyManifest,
  createOpenAiSkillsOnlyManifest,
  manifestAssetPaths,
  OPENAI_MANIFEST_PATH,
} from './openai.mjs';
import { verifyPublicPlugin } from './verify.mjs';

const execFileAsync = promisify(execFile);

const exists = async (target) => {
  try {
    await lstat(target);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
};

const assertSafeArchivePath = (pluginRoot, archivePath) => {
  if (archivePath === path.parse(archivePath).root) {
    throw new Error(`Refusing unsafe plugin archive path: ${archivePath}`);
  }
  const relative = path.relative(pluginRoot, archivePath);
  if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..')) {
    throw new Error('The plugin archive must be outside the plugin root it packages');
  }
};

const archiveEntries = async (archivePath) => {
  const { stdout } = await execFileAsync('unzip', ['-Z1', archivePath], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout.split(/\r?\n/u).filter(Boolean);
};

const listTreeFiles = async (directory, prefix = '') => {
  const files = [];
  for (const entry of (await readdir(directory, { withFileTypes: true }))
    .sort((left, right) => left.name.localeCompare(right.name, 'en'))) {
    if (entry.name === '.git') continue;
    const target = path.join(directory, entry.name);
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...await listTreeFiles(target, relative));
      continue;
    }
    const metadata = await lstat(target);
    if (!metadata.isFile()) throw new Error(`Plugin tree member is not a regular file: ${target}`);
    if (metadata.size > 100 * 1024 * 1024) {
      throw new Error(`Plugin archive member exceeds 100 MiB: ${target}`);
    }
    files.push({ bytes: metadata.size, relative });
  }
  return files;
};

const STABLE_ARCHIVE_TIME = new Date('2000-01-01T00:00:00.000Z');

const prepareDeterministicTree = async (root, files) => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), '12ui-plugin-archive-'));
  const staging = path.join(temporaryRoot, 'plugin');
  await cp(root, staging, { recursive: true });
  await Promise.all(files.map(({ relative }) => utimes(
    path.join(staging, relative),
    STABLE_ARCHIVE_TIME,
    STABLE_ARCHIVE_TIME,
  )));
  return { staging, temporaryRoot };
};

const packageArchive = async ({ archive, files, staging }) => {
  await execFileAsync('zip', ['-X', '-q', archive, ...files.map(({ relative }) => relative)], {
    cwd: staging,
    encoding: 'utf8',
    env: { ...process.env, TZ: 'UTC' },
    maxBuffer: 10 * 1024 * 1024,
  });
  await execFileAsync('unzip', ['-t', archive], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
};

const archiveResult = async ({ archive, entries, files, version }) => {
  const bytes = await readFile(archive);
  if (bytes.byteLength > 100 * 1024 * 1024) {
    throw new Error(`Plugin archive is ${bytes.byteLength} bytes; compressed limit is 100 MiB`);
  }
  return {
    archive,
    bytes: bytes.byteLength,
    entryCount: entries.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    uncompressedBytes: files.reduce((total, file) => total + file.bytes, 0),
    version,
  };
};

export async function verifyOpenAiSkillsOnlyArchive(archivePath) {
  const archive = path.resolve(archivePath);
  const entries = await archiveEntries(archive);
  const { stdout } = await execFileAsync('unzip', ['-p', archive, OPENAI_MANIFEST_PATH], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  const manifest = JSON.parse(stdout);
  assertOpenAiSkillsOnlyManifest(manifest);
  assertOpenAiSkillsOnlyEntries(entries, manifest);
  return { archive, entries, manifest };
}

const copyOpenAiAsset = async ({ root, staging, relative }) => {
  const source = path.resolve(root, relative);
  const rootPrefix = `${root}${path.sep}`;
  if (!source.startsWith(rootPrefix)) {
    throw new Error(`OpenAI manifest asset is outside the plugin root: ${relative}`);
  }
  const metadata = await lstat(source);
  if (!metadata.isFile()) throw new Error(`OpenAI manifest asset is not a regular file: ${relative}`);
  const target = path.join(staging, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target, { errorOnExist: true });
};

const openAiAssetEntries = async ({ root, manifest }) => {
  const referenced = manifestAssetPaths(manifest);
  const assetDirectory = path.join(root, 'assets');
  if (await exists(assetDirectory)) {
    const iconAssets = await listTreeFiles(assetDirectory);
    for (const asset of iconAssets) {
      const relative = `assets/${asset.relative}`;
      if (relative.startsWith('assets/12ui-icon')) referenced.add(relative);
    }
  }
  return [...referenced].sort((left, right) => left.localeCompare(right, 'en'));
};

export async function packagePublicPlugin(pluginDirectory, outputArchive) {
  const root = path.resolve(pluginDirectory);
  const verified = await verifyPublicPlugin(root);
  const files = await listTreeFiles(root);
  const uncompressedBytes = files.reduce((total, file) => total + file.bytes, 0);
  if (uncompressedBytes > 512 * 1024 * 1024) {
    throw new Error(`Plugin tree is ${uncompressedBytes} bytes; extracted limit is 512 MiB`);
  }
  const archive = path.resolve(
    outputArchive ?? path.join(path.dirname(root), `12ui-design-${verified.version}.zip`),
  );
  assertSafeArchivePath(root, archive);
  if (await exists(archive)) throw new Error(`Refusing to overwrite existing plugin archive: ${archive}`);
  await mkdir(path.dirname(archive), { recursive: true });

  let temporaryRoot;
  try {
    const prepared = await prepareDeterministicTree(root, files);
    temporaryRoot = prepared.temporaryRoot;
    await packageArchive({ archive, files, staging: prepared.staging });
    const entries = await archiveEntries(archive);
    if (entries.length === 0) throw new Error('Plugin archive is empty');
    if (entries.length > 5000) throw new Error(`Plugin archive has ${entries.length} entries; limit is 5000`);
    const normalizedEntries = new Set();
    for (const entry of entries) {
      const segments = entry.split('/');
      if (
        entry.startsWith('/')
        || entry.includes('\\')
        || entry.trim() !== entry
        || segments.includes('')
        || segments.includes('..')
        || segments.length > 20
        || Buffer.byteLength(entry, 'utf8') > 240
      ) {
        throw new Error(`Unsafe plugin archive entry: ${entry}`);
      }
      const normalized = entry.normalize('NFC').toLowerCase();
      if (normalizedEntries.has(normalized)) {
        throw new Error(`Duplicate or normalization-colliding plugin archive entry: ${entry}`);
      }
      normalizedEntries.add(normalized);
    }
    for (const entry of entries) {
      if (entries.some((candidate) => candidate.startsWith(`${entry}/`))) {
        throw new Error(`Plugin archive path is both a file and directory: ${entry}`);
      }
    }
    if (!entries.includes('.codex-plugin/plugin.json')) {
      throw new Error('Plugin archive is missing .codex-plugin/plugin.json at its root');
    }
    if (!entries.includes('skills/12ui-design/SKILL.md')) {
      throw new Error('Plugin archive is missing skills/12ui-design/SKILL.md at its root');
    }
    if (entries.some((entry) => entry === '.git' || entry.startsWith('.git/'))) {
      throw new Error('Plugin archive contains a git directory');
    }
    return archiveResult({ archive, entries, files, version: verified.version });
  } catch (error) {
    await rm(archive, { force: true });
    throw error;
  } finally {
    if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
  }
}

export async function packageOpenAiSkillsOnlyPlugin(pluginDirectory, outputArchive) {
  const root = path.resolve(pluginDirectory);
  const verified = await verifyPublicPlugin(root);
  const archive = path.resolve(
    outputArchive ?? path.join(path.dirname(root), `12ui-design-${verified.version}-openai.zip`),
  );
  assertSafeArchivePath(root, archive);
  if (await exists(archive)) throw new Error(`Refusing to overwrite existing plugin archive: ${archive}`);
  await mkdir(path.dirname(archive), { recursive: true });

  let temporaryRoot;
  try {
    temporaryRoot = await mkdtemp(path.join(os.tmpdir(), '12ui-openai-plugin-archive-'));
    const staging = path.join(temporaryRoot, 'plugin');
    await Promise.all([
      cp(path.join(root, 'skills'), path.join(staging, 'skills'), {
        recursive: true,
        errorOnExist: true,
      }),
      mkdir(path.join(staging, '.codex-plugin'), { recursive: true }),
    ]);
    const sourceManifest = JSON.parse(await readFile(path.join(root, OPENAI_MANIFEST_PATH), 'utf8'));
    const manifest = createOpenAiSkillsOnlyManifest(sourceManifest);
    assertOpenAiSkillsOnlyManifest(manifest);
    const assets = await openAiAssetEntries({ root, manifest });
    await Promise.all([
      writeFile(
        path.join(staging, OPENAI_MANIFEST_PATH),
        `${JSON.stringify(manifest, null, 2)}\n`,
      ),
      ...assets.map((relative) => copyOpenAiAsset({ root, staging, relative })),
    ]);

    const files = await listTreeFiles(staging);
    const uncompressedBytes = files.reduce((total, file) => total + file.bytes, 0);
    if (uncompressedBytes > 512 * 1024 * 1024) {
      throw new Error(`OpenAI plugin tree is ${uncompressedBytes} bytes; extracted limit is 512 MiB`);
    }
    await Promise.all(files.map(({ relative }) => utimes(
      path.join(staging, relative),
      STABLE_ARCHIVE_TIME,
      STABLE_ARCHIVE_TIME,
    )));
    await packageArchive({ archive, files, staging });
    const { entries } = await verifyOpenAiSkillsOnlyArchive(archive);
    return archiveResult({ archive, entries, files, version: verified.version });
  } catch (error) {
    await rm(archive, { force: true });
    throw error;
  } finally {
    if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ?? '.';
  const openAiOnly = process.argv[4] === '--openai';
  if (process.argv[4] && !openAiOnly) {
    throw new Error('Usage: node scripts/public-plugin/package.mjs <plugin-root> [archive] [--openai]');
  }
  const result = openAiOnly
    ? await packageOpenAiSkillsOnlyPlugin(root, process.argv[3])
    : await packagePublicPlugin(root, process.argv[3]);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
