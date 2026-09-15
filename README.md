# 12ui Design plugin

Public, installable distribution of the `12ui-design` skill and API contracts. Its shared skill uses the capability-checked
`12ui` CLI for local execution. The hosted service and documentation live at [12ui.com](https://12ui.com/).

This repository is generated from the private 12ui implementation at the exact
`@12ui/design` release revision. Version **0.2.70** matches the npm package.

## Install as a Codex plugin

Add this repository as the `12ui-plugin` marketplace, then install the
`12ui-design` plugin from it:

```bash
codex plugin marketplace add just-every/12ui-plugin
codex plugin add 12ui-design@12ui-plugin
```

The marketplace metadata is generated at
[`/.agents/plugins/marketplace.json`](./.agents/plugins/marketplace.json), and
the plugin manifest is at
[`/.codex-plugin/plugin.json`](./.codex-plugin/plugin.json).

## Install across supported agents

The cross-agent installer supports Codex, Claude Code, Grok, Cursor,
Antigravity, and GitHub Copilot:

```bash
npx -y @12ui/design skill install
```

That installer places only `12ui-design`; recognized historical `design`
bundles are retired, while locally modified copies are preserved.

## Manual directory upload

Each GitHub release attaches `12ui-design-0.2.70.zip`, a validated
skills-only plugin archive with the manifest and skill at the archive root.
The archive places the shared skill at `skills/12ui-design/`; execution lives in the matching CLI.
It is suitable for the OpenAI Plugins Directory manual upload flow.

## Skill

[`12ui-design`](./skills/12ui-design/SKILL.md) is installed byte-identically for every supported client. The CLI selects execution engines.

## Public API contracts

- [`convert-v1.openapi.yaml`](./docs/convert-v1.openapi.yaml)
- [`create-v1.openapi.yaml`](./docs/create-v1.openapi.yaml)
- [`corpus-v1.openapi.yaml`](./docs/corpus-v1.openapi.yaml)
- [`CONVERSION_PACKAGES.md`](./docs/CONVERSION_PACKAGES.md)
- [`EXPORT_FORMATS.md`](./docs/EXPORT_FORMATS.md)

Draft, corpus, and branch image generation use the public `https://12ui.com`
API. Codex conversion and existing-application edits use `12ui convert` and
`12ui improve --apply` with an authenticated Codex CLI. Check `12ui capabilities`
for local conversion, project apply, and export support before execution. For a new local run, image execution defaults to external when `OPENAI_API_KEY` is
available, otherwise native through Codex account access. Explicit choices and
saved runs keep their backend; external requires the separate key before inference. Native output formats remain explicit API features. Branch execution uses the CLI engine selection for conversion. Local React export is
full-page JSX, not application behavior. Credentials are never included in this
repository.

The approved light and dark 512px PNG artwork in [`assets/`](./assets/) is
copied byte-for-byte for every generated release. Use
[`DIRECTORY-LISTING.md`](./DIRECTORY-LISTING.md) for the full-bundle manual
submission fields, including its dark-composer selection.

## Provenance

Every release is generated from a fixed allowlist, validated for exact skill,
icon, manifest, marketplace, and contract parity, packaged as a zip, tagged
`design-v0.2.70`, and published only after the matching npm release
completes. Do not edit generated files directly; changes must originate in the
12ui release source.
