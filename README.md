# 12ui Design

Public, installable distribution of the 12ui design skill and its API
contracts. The hosted service and documentation live at [12ui.com](https://12ui.com/).

This repository is generated from the private 12ui implementation at the exact
`@12ui/design` release revision. Version **0.2.25** matches the npm package.

## Install

The cross-agent installer supports Codex, Claude Code, Grok, Cursor,
Antigravity, and GitHub Copilot:

```bash
npx -y @12ui/design skill install
```

For Codex plugin distribution through the Just Every marketplace:

```bash
codex plugin marketplace add just-every/plugins
codex plugin add 12ui-design@just-every
```

Skill directories may also index or install the individual folders under
[`skills/`](./skills/). Each skill includes the one-time CLI and account setup
command needed by a directory-only install.

## Skills

- [`design`](./skills/design/SKILL.md) — explore, choose, expand, convert, and integrate a distinctive interface.

## Public API contracts

- [`convert-v1.openapi.yaml`](./docs/convert-v1.openapi.yaml)
- [`create-v1.openapi.yaml`](./docs/create-v1.openapi.yaml)
- [`corpus-v1.openapi.yaml`](./docs/corpus-v1.openapi.yaml)
- [`CONVERSION_PACKAGES.md`](./docs/CONVERSION_PACKAGES.md)
- [`EXPORT_FORMATS.md`](./docs/EXPORT_FORMATS.md)

The skills use the public `https://12ui.com` API. Authentication is established
by the installer and stored locally; credentials are never included in this
repository.

## Provenance

Every release is generated from a fixed allowlist, validated for exact skill
and contract parity, tagged `design-v0.2.25`, and published only after the
matching npm release completes. Do not edit generated files directly; changes
must originate in the 12ui release source.
