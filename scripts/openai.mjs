import assert from 'node:assert/strict';

export const OPENAI_MANIFEST_PATH = '.codex-plugin/plugin.json';
export const OPENAI_SKILLS_PATH = 'skills/';
export const OPENAI_ASSETS_PATH = 'assets/';
export const OPENAI_ICON_ASSET_PREFIX = 'assets/12ui-icon';

const archiveAssetPath = (value) => {
  if (typeof value !== 'string') return undefined;
  const relative = value.startsWith('./') ? value.slice(2) : value;
  if (!relative.startsWith(OPENAI_ASSETS_PATH)) return undefined;
  if (
    relative.includes('\\')
    || relative.startsWith('/')
    || relative.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    throw new Error(`Unsafe manifest asset path: ${value}`);
  }
  return relative;
};

export const manifestAssetPaths = (value, paths = new Set()) => {
  const assetPath = archiveAssetPath(value);
  if (assetPath) paths.add(assetPath);
  if (Array.isArray(value)) {
    for (const item of value) manifestAssetPaths(item, paths);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) manifestAssetPaths(item, paths);
  }
  return paths;
};

export const openAiArchiveEntryAllowed = (entry, manifest) =>
  entry === OPENAI_MANIFEST_PATH
  || entry.startsWith(OPENAI_SKILLS_PATH)
  || entry.startsWith(OPENAI_ICON_ASSET_PREFIX)
  || manifestAssetPaths(manifest).has(entry);

// OpenAI skills-only ZIP uploads reject mcpServers and apps (submission-errors
// entries mcp_configuration_excluded and app_configuration_excluded). Keep all
// remaining manifest data, except the separately rejected interface.screenshots.
export const createOpenAiSkillsOnlyManifest = (pluginManifest) => {
  const manifest = JSON.parse(JSON.stringify(pluginManifest));
  manifest.skills = './skills/';
  delete manifest.mcpServers;
  delete manifest.apps;

  if (manifest.interface) delete manifest.interface.screenshots;

  return manifest;
};

export const assertOpenAiSkillsOnlyManifest = (manifest) => {
  assert.equal(manifest.skills, './skills/');
  assert.equal(manifest.mcpServers, undefined);
  assert.equal(manifest.apps, undefined);
  assert.ok(manifest.interface && typeof manifest.interface === 'object');
  assert.equal(manifest.interface.screenshots, undefined);
};

export const assertOpenAiSkillsOnlyEntries = (entries, manifest) => {
  assert.ok(entries.includes(OPENAI_MANIFEST_PATH));
  assert.ok(
    entries.some((entry) => /^skills\/[^/]+\/SKILL\.md$/u.test(entry)),
    'OpenAI skills-only archive must contain a direct skill manifest',
  );
  assert.equal(entries.some(entry => /^skills\/12ui-design\/(runtime|scripts)(?:\/|$)/u.test(entry)), false,
    'OpenAI Codex skill must contain instructions only');
  for (const entry of entries) {
    assert.ok(openAiArchiveEntryAllowed(entry, manifest), `OpenAI archive member is not allowed: ${entry}`);
  }
  for (const asset of manifestAssetPaths(manifest)) {
    assert.ok(entries.includes(asset), `OpenAI archive is missing manifest asset: ${asset}`);
  }
};
