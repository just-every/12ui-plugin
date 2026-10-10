# 12ui Design

Open a Design workspace in Claude Code: a pane that shows design options for an app or a website as images. Select the one you like, ask for more options, ask for a change to an option with a note, and hand an option off to be built.

Your agent runs the 12ui command line once per request, which draws every option at once with your own Codex sign-in and image generation, and adds each option to the workspace as it finishes. Your agent never draws in the conversation. Drawing, editing, branching and Build this need no 12ui account: branching plans and draws the new screens with your own Codex too, and a workspace is reached through a private handle held in your session. Images are stored for up to 30 days and removed after 14 days without use.

Works in Claude Code on a computer with Node.js; your agent installs the 12ui command line once. Drawing needs Codex signed in with ChatGPT on the same computer; without it nothing is drawn and each option shows the reason. The pane needs Claude Code 2.1.287 or later, in the terminal or the Desktop app's Code tab. The draw command reaches design.12ui.com, and Claude Code asks you to approve it.

Version 0.2.128. Install with `claude plugin marketplace add just-every/12ui-plugin`, then `claude plugin install 12ui-design@12ui-plugin`.

## Requirements

- Claude Code in the terminal or in the Desktop app's Code tab, with Node.js. The agent installs the 12ui command line once with `npx -y @12ui/design cli install`.
- The pane needs Claude Code 2.1.287 or later.
- Drawing needs Codex signed in with ChatGPT on the same computer.
- Branch also runs on your own Codex: with Codex signed in with ChatGPT it plans and draws the new screens there and needs no 12ui account.
- Draft, hosted conversion and the hosted branch service (used when Codex is not ready) need a 12ui account (`12ui auth login`).

## What this plugin runs, sends and fetches

- **Skill** (`12ui-design`). It runs `npx -y @12ui/design cli install` once, from npm and unpinned, then `12ui` commands. Those commands reach https://12ui.com (hosted draft, branch, conversion, the design corpus and improve kits) and https://design.12ui.com (workspace plans, image upload and download), and run `codex exec` locally when Codex is ready. The skill also saves one workspace image from design.12ui.com.
- **MCP server** `https://design.12ui.com/mcp`: anonymous. It stores the brief and images; images are kept up to 30 days and removed after 14 days without use.
- **Mod** (the Design workspace pane, Claude Code 2.1.287 or later). It reaches only https://design.12ui.com/mcp; "What the mod does" below says exactly what it reads, sends and submits.

## What the mod does

The mod is the Design workspace pane. It runs inside Claude Code as plain readable source in `hooks/`.

- **The one host it contacts:** `https://design.12ui.com/mcp`, this plugin's own MCP server. The address is written as fixed text at the mod's one network call, and the request cannot be sent anywhere else.
- **What it reads:** the results of this plugin's own two tools, `design_slate_create` and `design_slate_show`, for the workspace handle, and what you click and type in the pane. It reads nothing else from the conversation. The one file it reads is the picture whose path you type in the Sketches tab, when you press Add.
- **What it sends,** to that host only, and never any conversation text:

  - the workspace handle, and the option, version, reference and request ids the pane shows
  - your picks and which button you pressed (new options, more like an option, an edit, a simplify, a retry, a branch, Build this, Continue, Keep)
  - the picture file you add as your own sketch in the Sketches tab (a JPEG, PNG or WebP of at most 300 KiB, read from the path you type), and which of your sketches you remove
  - the words you type in the pane (the design prompt, an edit note, branch page names)

- **The prompts it submits:** after you click in the pane, one line telling Claude what you did, exactly one of these (`{label}` is an option's letter, `{request}` and `{handle}` are ids). Your own words are never put in a prompt; Claude reads them from the workspace.

  - `The user asked for new options in the Design workspace (request {request}, runDir {handle}). Please confirm it with design.slate.data, then carry it out.`
  - `The user asked for more like {label} in the Design workspace (request {request}, runDir {handle}). Please confirm it with design.slate.data, then carry it out.`
  - `The user asked to edit {label} in the Design workspace (request {request}, runDir {handle}). Please confirm it with design.slate.data, then carry it out.`
  - `The user asked to simplify {label} in the Design workspace (request {request}, runDir {handle}). Please confirm it with design.slate.data, then carry it out.`
  - `The user asked to draw option {label} again in the Design workspace (request {request}, runDir {handle}). Please confirm it with design.slate.data, then carry it out.`
  - `The user asked for more options of one group in the Design workspace (request {request}, runDir {handle}). Please confirm it with design.slate.data, then carry it out.`
  - `The user asked for the full page of {label} in the Design workspace (request {request}, runDir {handle}). Please confirm it with design.slate.data, then carry it out.`
  - `The user asked for more pages of {label} in the Design workspace (request {request}, runDir {handle}). Please confirm it with design.slate.data, then carry it out.`
  - `The user chose design {label} to build in the Design workspace (runDir {handle}). Please read its selection with design.slate.data, then build that design as the user's request asks.`

- **What it never does:** it reads no credentials, keys, environment or settings, no file but the one picture you name in the Sketches tab, runs no commands or processes, calls no model and touches no other tool's calls.

Hooks it registers, each with what it is for:

- `tool.call{tool=mcp__plugin_12ui-design_12ui-workspace__design_slate_create|mcp__plugin_12ui-design_12ui-workspace__design_slate_show}`: observes only this plugin's own create and show tools: reads the workspace handle from the result and opens the pane; it never changes or blocks the call, and reads nothing else
- `ui.render{component=Pane}`: draws the Design workspace pane and passes every other plugin's pane on untouched
- `ui.render{component=AbovePrompt}`: while the pane waits for room on a narrow terminal, shows one line with an Open button above the prompt; otherwise passes on untouched

Calls it makes, each with its purpose:

- `$.clock.after`: schedules the next workspace refresh, the follow-up check after a click, and one redraw for pictures that land together or for what changed during your presses
- `$.clock.now`: reads the time to pace the workspace refreshes and redraws, and to refresh when the start countdown ends
- `$.fs.read`: reads the one picture file whose path you type in the Sketches tab when you press Add, to send it as your own sketch; it reads no other file
- `$.http.fetch`: reads the workspace and records your clicks at https://design.12ui.com/mcp
- `$.prompt.submit`: tells Claude, in one fixed line, what you clicked in the pane (new options, more like an option, an edit, a simplify, a retry, a branch, Build this); never your own words
- `$.ui.blit`: asks whether the terminal shows pictures, to switch to colour cells where it cannot
- `$.ui.invalidate`: redraws the pane when the workspace changes
- `$.ui.log`: writes diagnostic lines to Claude Code's debug log
- `$.ui.open`: opens the Design workspace pane, and again when you press Open above the prompt
- `$.ui.panes`: checks whether the Design workspace pane is still open, and stops polling once you have closed it
- `$.ui.resolve`: reads the elements the surface draws with
- `$.ui.toast`: says the workspace is ready when the terminal is too narrow to show the pane

## Example prompts

- "Open a Design workspace for my app idea."
- "Show me design options for a fitness app home screen."
- "Explore looks for my landing page in a Design workspace."

## Troubleshooting

- No pane: Claude Code is older than 2.1.287, mods are turned off, or the session is the VS Code panel, `claude -p` or Chat.
- "Codex on this Mac is not signed in. Nothing was drawn.": that is the 12ui command line's own message. Sign in to Codex with ChatGPT on the same computer.
- "can't reach design.12ui.com": your organization's network policy blocks the host.
- "The Design workspace can't reach design.12ui.com: … nonessential network traffic is disabled": Claude Code refuses the pane's web requests while `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` is set.
- The pane waits on a narrow terminal: press Open above the prompt. To open a workspace again, ask Claude to show it.

## Privacy and support

- Privacy policy: https://12ui.com/privacy
- Terms of service: https://12ui.com/terms
- Support: https://12ui.com/contact
- Security reports: see SECURITY.md at the root of the repository.

## Dependencies

| Name | Version | License | Source |
| --- | --- | --- | --- |
| jpeg-js decoder | 0.4.4 | Apache-2.0 (file header); BSD-3-Clause (package) | https://github.com/jpeg-js/jpeg-js |

## Codex plugin

The `12ui-design` skill as a Codex plugin. The skill uses the `12ui` command
line for local work. The hosted service and its documentation live at
[12ui.com](https://12ui.com/).

This repository is generated from the private 12ui implementation at the exact
`@12ui/design` release revision. Version **0.2.128** matches the npm package.

### Install as a Codex plugin

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

### Install across supported agents

The cross-agent installer supports Codex, Claude Code, Grok, Cursor,
Antigravity, and GitHub Copilot:

```bash
npx -y @12ui/design skill install
```

That installer places only `12ui-design`; recognized historical `design`
bundles are retired, while locally modified copies are preserved.

### Skill

[`12ui-design`](./skills/12ui-design/SKILL.md) is installed byte-identically
for every supported client. Run `12ui capabilities` to see what the installed
command line supports before a run.

### Documentation

- Command line: [12ui.com/cli](https://12ui.com/cli)
- Skill: [12ui.com/skill](https://12ui.com/skill)
- API: [12ui.com/api](https://12ui.com/api)

### Manual directory upload

Each GitHub release attaches `12ui-design-0.2.128.zip`, the validated
plugin with the manifest and skill at the archive root, and
`12ui-design-0.2.128-openai.zip`, its skills-only form for the OpenAI
Plugins Directory manual upload flow.

### Provenance

Every release is generated from a fixed allowlist, validated for exact skill,
icon, manifest, and marketplace parity, packaged as a zip, tagged
`design-v0.2.128`, and published only after the matching npm release
completes. Do not edit generated files directly; changes must originate in the
12ui release source.

## License

MIT. See LICENSE.
