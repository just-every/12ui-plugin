import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILLS = ['12ui-design'];
const DOCS = [
  'CONVERSION_PACKAGES.md',
  'EXPORT_FORMATS.md',
  'convert-v1.openapi.yaml',
  'corpus-v1.openapi.yaml',
  'create-v1.openapi.yaml',
];
const ROOT_FILES = [
  '.agents',
  '.claude-plugin',
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

const ASSET_SHA256 = {
  '12ui-icon.png': '6d5eb49160bef49d7aba4755195634f0f7f4eeeaecf50e19397a75d8c258913b',
  '12ui-icon.svg': '4d61e1cbcbd2935963df3b477a0997e01462cf197ae3055e088d01e86162f0b7',
};

// Owner-selected directory screenshots, 2026-08-22. 1600x1000 PNG each.
const SCREENSHOT_SHA256 = {
  'screenshot-1.png': 'ee05cfc8cd2fa325b29b8b83e65c63f38c92e5a7d86d44ec453b4e1cf1c462c4',
  'screenshot-2.png': 'b0a42ad54d8cb7a351714ca6551ebe78233b87cf0320bf28ff7c35171016d543',
  'screenshot-3.png': '5650a063066f6c3129afc87b09ef01782317e1999793ea426bf9609839eb18b3',
  'screenshot-4.png': 'd84584b1f3a90aeb81d44849300e3a740623b88865d6264e9fd800b800a6127e',
};

// Retina-resolution directory screenshots; the grid is scaled to stay under the 5MB asset cap.
const SCREENSHOT_DIMENSIONS = {
  'screenshot-1.png': [2880, 1800],
  'screenshot-2.png': [3200, 2000],
  'screenshot-3.png': [3200, 2000],
  'screenshot-4.png': [3200, 2000],
};

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
  assert.deepEqual(await readdir(path.join(root, '.claude-plugin')), ['plugin.json']);
  assert.deepEqual(await readdir(path.join(root, '.codex-plugin')), ['plugin.json']);
  assert.deepEqual(await readdir(path.join(root, '.agents')), ['plugins']);
  assert.deepEqual(await readdir(path.join(root, '.agents', 'plugins')), ['marketplace.json']);
  assert.deepEqual(
    sorted(await readdir(path.join(root, 'assets'))),
    sorted([...Object.keys(ASSET_SHA256), 'screenshots']),
  );
  assert.deepEqual(
    sorted(await readdir(path.join(root, 'assets', 'screenshots'))),
    sorted(Object.keys(SCREENSHOT_SHA256)),
  );
  assert.deepEqual(sorted(await readdir(path.join(root, 'docs'))), DOCS);
  assert.deepEqual(sorted(await readdir(path.join(root, 'skills'))), sorted(SKILLS));

  const packageManifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const plugin = JSON.parse(await readFile(path.join(root, '.codex-plugin/plugin.json'), 'utf8'));
  const marketplace = JSON.parse(await readFile(
    path.join(root, '.agents/plugins/marketplace.json'),
    'utf8',
  ));
  assert.equal(plugin.name, '12ui-design');
  assert.match(plugin.name, /^[A-Za-z0-9][A-Za-z0-9_-]*$/u);
  assert.ok(plugin.name.length <= 64);
  assert.equal(plugin.version, packageManifest.version);
  assert.match(plugin.version, /^\d+\.\d+\.\d+$/u);
  assert.ok(plugin.version.length <= 64);
  assert.ok(plugin.description.length > 0 && plugin.description.length <= 1024);
  assert.equal(plugin.author.name, 'Just Every');
  assert.equal(plugin.repository, 'https://github.com/just-every/12ui-plugin');
  assert.equal(plugin.skills, './skills/');
  assert.equal(plugin.mcpServers, undefined);
  assert.equal(plugin.apps, undefined);
  assert.equal(plugin.interface.developerName, 'Just Every');
  assert.equal(plugin.interface.displayName, '12ui Design');
  assert.ok(plugin.interface.displayName.length <= 30);
  assert.equal(plugin.interface.shortDescription, 'Design interfaces from images');
  assert.ok(plugin.interface.shortDescription.length <= 30);
  assert.doesNotMatch(plugin.interface.shortDescription, /[\r\n]/u);
  assert.ok(plugin.interface.longDescription.length > 0);
  assert.ok(plugin.interface.longDescription.length <= 4000);
  assert.ok(plugin.interface.developerName.length <= 80);
  assert.ok(CATEGORIES.has(plugin.interface.category));
  assert.equal(plugin.interface.category, 'Creativity');
  assert.ok(plugin.interface.capabilities.length <= 20);
  for (const capability of plugin.interface.capabilities) {
    assert.ok(capability.length > 0 && capability.length <= 120);
  }
  assert.ok(Array.isArray(plugin.interface.defaultPrompt));
  assert.ok(plugin.interface.defaultPrompt.length > 0 && plugin.interface.defaultPrompt.length <= 3);
  assert.equal(new Set(plugin.interface.defaultPrompt).size, plugin.interface.defaultPrompt.length);
  for (const prompt of plugin.interface.defaultPrompt) {
    assert.ok(prompt.length > 0 && prompt.length <= 128);
    assert.doesNotMatch(prompt, /[\r\n]/u);
    assert.doesNotMatch(prompt, /@[A-Za-z0-9_-]+/u);
  }
  for (const field of [
    'websiteURL', 'privacyPolicyURL', 'termsOfServiceURL',
  ]) {
    const url = new URL(plugin.interface[field]);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.username, '');
    assert.equal(url.password, '');
    assert.ok(plugin.interface[field].length <= 1024);
  }
  assert.match(plugin.interface.brandColor, /^#[0-9A-Fa-f]{6}$/u);
  assert.equal(plugin.interface.brandColor, '#0F172A');
  assert.equal(plugin.interface.composerIcon, './assets/12ui-icon.png');
  assert.equal(plugin.interface.logo, './assets/12ui-icon.svg');
  assert.deepEqual(
    plugin.interface.screenshots,
    Object.keys(SCREENSHOT_SHA256).sort().map((name) => `./assets/screenshots/${name}`),
  );

  const claude = JSON.parse(await readFile(path.join(root, '.claude-plugin/plugin.json'), 'utf8'));
  assert.equal(claude.name, '12ui-design');
  assert.equal(claude.displayName, '12ui Design');
  assert.equal(claude.version, packageManifest.version);
  assert.equal(claude.skills, './skills/');
  assert.equal(claude.repository, 'https://github.com/just-every/12ui-plugin');
  assert.equal(claude.interface, undefined);
  assert.equal(claude.keywords.includes('codex'), false);

  assert.deepEqual(marketplace, {
    name: '12ui-plugin',
    interface: { displayName: '12ui Plugin' },
    plugins: [{
      name: '12ui-design',
      source: { source: 'local', path: './' },
      policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
      category: 'Creativity',
    }],
  });

  const readAsset = async (name) => {
    const bytes = await readFile(path.join(root, 'assets', name));
    assert.ok(bytes.byteLength <= 5 * 1024 * 1024);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), ASSET_SHA256[name]);
    return bytes;
  };
  for (const [name, digest] of Object.entries(SCREENSHOT_SHA256)) {
    const bytes = await readFile(path.join(root, 'assets', 'screenshots', name));
    assert.ok(bytes.byteLength <= 5 * 1024 * 1024);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), digest);
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(bytes.readUInt32BE(16), SCREENSHOT_DIMENSIONS[name][0]);
    assert.equal(bytes.readUInt32BE(20), SCREENSHOT_DIMENSIONS[name][1]);
  }
  const png = await readAsset('12ui-icon.png');
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.readUInt32BE(16), 512);
  assert.equal(png.readUInt32BE(20), 512);
  const svg = (await readAsset('12ui-icon.svg')).toString('utf8');
  assert.match(svg, /<svg\b[^>]*\bviewBox="0 0 610 610"/u);

  for (const skill of SKILLS) {
    const directory = path.join(root, 'skills', skill);
    assert.deepEqual(sorted(await readdir(directory)), [
      'SKILL.md', 'agents', 'inspire.md',
    ]);
    const source = await readFile(path.join(directory, 'SKILL.md'), 'utf8');
    assert.match(source, new RegExp(`^name: ${skill}$`, 'mu'));
    assert.match(
      source,
      /npx -y @12ui\/design cli install/u,
    );
    assert.ok(`${plugin.name}:${skill}`.length <= 64);
    const agent = await readFile(path.join(directory, 'agents/openai.yaml'), 'utf8');
    assert.match(agent, /^interface:\n/mu);
    assert.match(agent, /^  display_name: "12ui Design"$/mu);
    assert.match(agent, /^  short_description: ".+"$/mu);
    assert.match(agent, /^  default_prompt: "Use \$12ui-design\b.+"$/mu);
  }

  const readme = await readFile(path.join(root, 'README.md'), 'utf8');
  assert.match(readme, /codex plugin marketplace add just-every\/12ui-plugin/u);
  assert.match(readme, /codex plugin add 12ui-design@12ui-plugin/u);
  assert.doesNotMatch(readme, /just-every\/plugins|12ui-design@just-every/u);
  assert.match(readme, /skills\/12ui-design\/SKILL\.md/u);

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
