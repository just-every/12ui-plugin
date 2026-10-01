import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILLS = ['12ui-design'];

/** The owner-approved icon artwork, byte for byte. */
const ICON_SHA256 = {
  '12ui-icon.png': 'f029b27b26f732d78414f5095bcfa3b3397f73dbe1d1b2ff185530a21ec36627',
  '12ui-icon-dark.png': '2885defa809b2fcfd51c026e71516ef32a04d003521e5b0bc95571878a4bacc5',
};

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const MAX_ASSET_BYTES = 5 * 1024 * 1024;

const CATEGORIES = new Set([
  'Productivity',
  'Creativity',
  'Developer Tools',
  'Business & Operations',
  'Data & Analytics',
  'Communication',
  'Education & Research',
  'Security',
  'Finance',
  'Healthcare',
  'Travel',
  'Entertainment',
  'Other',
]);

/**
 * The public plugin against OpenAI's documented plugin rules (name, version, field lengths and formats, https URLs,
 * images, the skill's front matter and agent metadata, no symlinks), plus three of its own: the plugin name (another
 * name is another plugin), the approved icon artwork, and the skill folder named after its skill.
 */
export async function verifyPublicPlugin(rootDirectory) {
  const root = path.resolve(rootDirectory);
  const packageManifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const plugin = JSON.parse(await readFile(path.join(root, '.codex-plugin/plugin.json'), 'utf8'));
  assert.equal(plugin.name, '12ui-design');
  assert.match(plugin.name, /^[A-Za-z0-9][A-Za-z0-9_-]*$/u);
  assert.ok(plugin.name.length <= 64);
  assert.equal(plugin.version, packageManifest.version);
  assert.match(plugin.version, /^\d+\.\d+\.\d+$/u);
  assert.ok(plugin.version.length <= 64);
  assert.ok(plugin.description.length <= 1024);
  assert.equal(plugin.skills, './skills/');
  if (plugin.apps !== undefined) {
    assert.equal(plugin.apps, './.app.json');
    const appManifest = JSON.parse(await readFile(path.join(root, '.app.json'), 'utf8'));
    assert.deepEqual(Object.keys(appManifest), ['apps']);
    assert.deepEqual(Object.keys(appManifest.apps), ['12ui']);
    assert.match(appManifest.apps['12ui'].id, /^plugin_asdk_app_[A-Za-z0-9_-]+$/u);
  }
  assert.ok(plugin.interface.displayName.length <= 30);
  assert.ok(plugin.interface.shortDescription.length <= 30);
  assert.doesNotMatch(plugin.interface.shortDescription, /[\r\n]/u);
  assert.ok(plugin.interface.longDescription.length <= 4000);
  assert.ok(plugin.interface.developerName.length <= 80);
  // OpenAI's listing-metadata table (plugins/deploy/submission): `category` is "Required"; `capabilities` is "Required in
  // the Codex format; use [] if there are none". .codex-plugin/plugin.json is the Codex format.
  assert.ok(CATEGORIES.has(plugin.interface.category), 'interface.category is required and must be a supported category');
  assert.ok(Array.isArray(plugin.interface.capabilities), 'interface.capabilities is required in the Codex format (use [] if there are none)');
  assert.ok(plugin.interface.capabilities.length <= 20);
  for (const capability of plugin.interface.capabilities) {
    assert.ok(capability.length > 0 && capability.length <= 120);
  }
  if (plugin.interface.defaultPrompt !== undefined) {
    assert.ok(Array.isArray(plugin.interface.defaultPrompt));
    assert.ok(plugin.interface.defaultPrompt.length <= 3);
    assert.equal(new Set(plugin.interface.defaultPrompt).size, plugin.interface.defaultPrompt.length);
    for (const prompt of plugin.interface.defaultPrompt) {
      assert.ok(prompt.length > 0 && prompt.length <= 128);
      assert.doesNotMatch(prompt, /[\r\n]/u);
      assert.doesNotMatch(prompt, /@[A-Za-z0-9_-]+/u);
    }
  }
  for (const field of ['websiteURL', 'privacyPolicyURL', 'termsOfServiceURL']) {
    if (plugin.interface[field] === undefined) continue;
    const url = new URL(plugin.interface[field]);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.username, '');
    assert.equal(url.password, '');
    assert.ok(plugin.interface[field].length <= 1024);
  }
  if (plugin.interface.brandColor !== undefined) assert.match(plugin.interface.brandColor, /^#[0-9A-Fa-f]{6}$/u);

  const claude = JSON.parse(await readFile(path.join(root, '.claude-plugin/plugin.json'), 'utf8'));
  assert.equal(claude.name, '12ui-design');
  assert.equal(claude.version, packageManifest.version);

  // Every image the manifest names exists, is a PNG within the size limit, and the icons are the approved artwork.
  const images = [
    plugin.interface.composerIcon,
    plugin.interface.logo,
    plugin.interface.logoDark,
    ...(plugin.interface.screenshots ?? []),
  ].filter((value) => value !== undefined);
  for (const reference of new Set(images)) {
    assert.ok(reference.startsWith('./assets/'), `${reference} must be a ./assets/ path`);
    const bytes = await readFile(path.join(root, reference));
    assert.ok(bytes.byteLength <= MAX_ASSET_BYTES, `${reference} exceeds 5 MiB`);
    assert.deepEqual([...bytes.subarray(0, 8)], PNG_SIGNATURE, `${reference} is not a PNG`);
  }
  for (const [name, digest] of Object.entries(ICON_SHA256)) {
    const bytes = await readFile(path.join(root, 'assets', name));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), digest, `assets/${name} differs from the approved artwork`);
  }

  for (const skill of SKILLS) {
    const directory = path.join(root, 'skills', skill);
    const source = await readFile(path.join(directory, 'SKILL.md'), 'utf8');
    assert.match(source, new RegExp(`^name: ${skill}$`, 'mu'));
    assert.ok(`${plugin.name}:${skill}`.length <= 64);
    const agent = await readFile(path.join(directory, 'agents/openai.yaml'), 'utf8');
    assert.match(agent, /^interface:\n/mu);
    assert.match(agent, /^  display_name: ".+"$/mu);
    assert.match(agent, /^  short_description: ".+"$/mu);
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
  return { fileCount: files.length, version: plugin.version };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ?? '.';
  const result = await verifyPublicPlugin(root);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
