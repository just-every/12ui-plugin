---
name: design-branch
description: "Required whenever the deliverable is more than one viewport — a
  full page, a multi-route site, or an app with several states: expands one
  approved design into every planned screen and converts each page as one
  ordered package. Not for a single above-the-fold screen."
---

# Design branch

## Setup

If the `12ui` CLI is not present, run `npx -y @12ui/design skill install --skill design-branch` once. This installs the CLI and verifies this skill's account scopes.

One approved screen fixes the visual system; branching extends it across the
rest of the surface with consistent, professional quality instead of
re-deriving the design once per screen. The server plans the screens and
their dependencies; one command executes the whole plan and keeps every paid
screen addressable, so a retry never repeats paid work. Use it whenever the
deliverable is more than one viewport; a single fold is a plain convert.

## 1. Execute

    12ui branch execute <run-dir> \
      --concept "<product, audience, what the rest of the surface must cover>" \
      --scope page|site --convert html

The run directory is the one `12ui draft` printed; the starting design is
the candidate `12ui select` recorded there. `--scope page` grows that screen
into viewports 2..n of its own page; `--scope site` adds sibling routes and
app states as well. `--convert html` converts each finished page as one
ordered package; omitting it stops at downloaded PNGs. A run with no draft
behind it takes a fresh directory and names its own starting design — the
command refuses with both spellings if none is given. Either way the starting
design is viewport 1 of the first page; it needs no separate conversion.

## 2. Follow

    12ui next <run-dir>

Execute returns immediately; `12ui next` reports progress and the one command
to run next, and `--wait` blocks instead of polling.
`12ui branch resume <run-dir>` continues an interrupted run, replaying
already-settled screens for free.

## 3. Collect

Screens land in `<run-dir>/branch/screens/<slot>.png` and per-page HTML in
`<run-dir>/branch/pages/<page-id>.html`, materialized when the run reaches a
terminal state. Each exported page is the page: build the surface around its
document rather than replacing it.
