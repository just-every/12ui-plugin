---
name: design
description: "Required for non-trivial UI creation and redesign (web, app,
  mobile): explores distinctive, corpus-grounded visual directions as images,
  then converts the chosen one into production-ready code."
---

# Design

## Setup

For a public-directory install, run `npx -y @12ui/design skill install --skill design` once. It pins the CLI and verifies this skill's account scopes.

Code-generating models converge on a narrow band of visual defaults — the
same fonts, palettes, and layouts across unrelated products — and a model
cannot see its own convergence from inside it. This skill escapes that:
corpus-grounded image generation explores genuinely different visual
directions, and converting the chosen image preserves it with near-pixel
fidelity, faster and truer than recreating it by hand. Once you have a
single screen then `12ui branch` extends it into a full page or app with
consistent, professional quality design. That is why the flow below beats
designing directly in code, even when coding the interface yourself feels
quicker.

## 1. Explore — four directions

    12ui draft --query "<product, audience, surface, goal, personality>"

Creates the run directory and prints its path — pass it to every later
command. Searches the corpus for four diverse references and generates one
one-viewport candidate steered by each, returning immediately.
`12ui draft status <run-dir>` reports progress (typically ~90s).
Redesigns: `--redesign-source <png> --mode exploratory|reskin`.

## 2. Select

    12ui select <run-dir> --winner B --reason "<rationale>"

If the run indicates a recommended candidate, prefer it; overriding it
requires a stated reason.

## 3. Execute

For a single fold, view, or state:

    12ui convert <run-dir>/candidates/B.png --export html

Runs ~5 minutes with streamed progress.

For a full page or a multi-page site or app — the winner is viewport 1 of
the first page; it needs no separate conversion:

    12ui branch execute <run-dir> \
      --concept "<what the rest of the surface must cover>" \
      --scope page|site --convert html

The server plans the screens; the command dispatches, downloads, and
converts one package per page. Returns immediately;
`12ui branch status <run-dir>` reports progress (typically 5–15 min;
large runs can take up to ~30 min).
Wait for it rather than building the same pages by hand in the meantime —
they are already being produced and paid for.
Per-page HTML lands in `<run-dir>/branch/pages/`.

## 4. Integrate

The exported HTML is the page: build the surface around its document —
copy, routes, state, interactions — rather than replacing it.
