import assert from 'node:assert/strict';
import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILLS = ['design'];
const DOCS = [
  'CONVERSION_PACKAGES.md',
  'EXPORT_FORMATS.md',
  'convert-v1.openapi.yaml',
  'corpus-v1.openapi.yaml',
  'create-v1.openapi.yaml',
];
const ROOT_FILES = [
  '.codex-plugin',
  '.gitignore',
  'LICENSE',
  'README.md',
  'SECURITY.md',
  'assets',
  'docs',
  'package.json',
  'scripts',
  'skills',
];

const sorted = (values) => [...values].sort();
const uppercaseBrand = ['12', 'UI'].join('');
const protocolNames = [
  `X-${uppercaseBrand}-Public-Preview`,
  `X-${uppercaseBrand}-Public-Visitor`,
];

export async function verifyPublicPlugin(rootDirectory) {
  const root = path.resolve(rootDirectory);
  const rootEntries = (await readdir(root)).filter((name) => name !== '.git');
  assert.deepEqual(sorted(rootEntries), ROOT_FILES);
  assert.deepEqual(sorted(await readdir(path.join(root, 'docs'))), DOCS);
  assert.deepEqual(sorted(await readdir(path.join(root, 'skills'))), sorted(SKILLS));

  const packageManifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const plugin = JSON.parse(await readFile(path.join(root, '.codex-plugin/plugin.json'), 'utf8'));
  assert.equal(plugin.name, '12ui-design');
  assert.equal(plugin.version, packageManifest.version);
  assert.match(plugin.version, /^\d+\.\d+\.\d+$/u);
  assert.equal(plugin.repository, 'https://github.com/just-every/12ui-plugin');
  assert.equal(plugin.skills, './skills/');
  assert.equal(plugin.interface.developerName, 'Just Every');
  assert.equal(plugin.interface.displayName, '12ui Design');
  assert.ok(Array.isArray(plugin.interface.defaultPrompt));
  assert.ok(plugin.interface.defaultPrompt.length > 0 && plugin.interface.defaultPrompt.length <= 3);

  for (const skill of SKILLS) {
    const directory = path.join(root, 'skills', skill);
    assert.deepEqual(sorted(await readdir(directory)), ['SKILL.md', 'agents', 'assets']);
    const source = await readFile(path.join(directory, 'SKILL.md'), 'utf8');
    assert.match(source, new RegExp(`^name: ${skill}$`, 'mu'));
    assert.match(
      source,
      new RegExp(`npx -y @12ui/design skill install --skill ${skill}`, 'u'),
    );
  }

  const files = [];
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const target = path.join(directory, entry.name);
      const metadata = await lstat(target);
      assert.equal(metadata.isSymbolicLink(), false, `public plugin contains symlink: ${target}`);
      if (entry.isDirectory()) await visit(target);
      else files.push(target);
    }
  };
  await visit(root);
  for (const file of files) {
    if (/\.(?:png)$/u.test(file)) continue;
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(
      source,
      /github\.com\/just-every\/12ui(?!-plugin)(?:[/?#]|$)/u,
      `private repository link in ${file}`,
    );
    const branding = protocolNames.reduce(
      (value, protocolName) => value.replaceAll(protocolName, ''),
      source,
    );
    assert.equal(
      branding.includes(uppercaseBrand),
      false,
      `uppercase 12ui branding in ${file}`,
    );
  }
  return { fileCount: files.length, version: plugin.version };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ?? '.';
  const result = await verifyPublicPlugin(root);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
