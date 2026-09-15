---
name: 12ui-design
description: "Design interfaces with 12ui, expand an approved screen into pages or app states, convert design images into editable code and assets, and improve existing applications. Use for non-trivial UI creation, image-to-code, and visual redesign."
---

# 12ui Design

If the `12ui` CLI is not present, run `npx -y @12ui/design cli install` once.

The workflow uses image models and corpus-grounded generation to explore visual hierarchy, composition, typography, and distinct design directions. Expand the selected direction, convert it into editable code and assets, then integrate the requested functionality.

Start where you already are: a finished design image goes to §3, an existing interface that should get better to §6, a rough concept to §1, and reference imagery as the deliverable to §5. Each command prints the next, and `12ui <command> --help` prints its flags and choices. The same workflow applies in every supported coding client; the CLI selects and checks the execution engine. Read [outputs.md](outputs.md) only for output boundaries or engine-specific requirements.

## 1. Draft

The draft command uses relevant concepts from the design corpus as starting points for UI candidates. Keep the full design brief in `--concept`; optionally write a separate concise visual caption in `--corpus-query` (or `--corpus-query @file`) for reference retrieval, preserving style details wherever they appear in the brief. Hedge caption generation accepts at most 400 characters after whitespace normalization. Longer queries automatically use balanced retrieval with the complete query and a recorded explanation; a short separate caption keeps hedge retrieval. The CLI owns retrieval, downloads, candidate generation, and resumable identities.

    12ui draft --concept "<product, audience, surface, goal, personality>" --corpus-query "<surface, layout, typography, imagery, palette; 400 chars max>" --candidates 4

Prefer 4 or more candidates. Add `--reference <path-or-url>` to carry an existing interface's style into a new page; it retains style and excludes layout, content, and assets by default. Use `--retain layout` only when source geometry should be preserved.

Inspect the real candidate images before continuing. Choose the strongest direction—or present the meaningful choice when the user is involved—rather than averaging them into a generic compromise.

Draft dispatches in the foreground, then generation continues server-side. Run `12ui next <run-dir> --wait` to collect the real images. Keep the recorded run and follow the CLI's continuation instructions.

Only if needed, read [inspire.md](inspire.md) for direct corpus search.

## 2. Branch

When the deliverable needs more than one viewport—a full page, a multi-route site, or several app states—expand the approved design rather than re-deriving it per screen.

    12ui branch execute --start <image.png> --scope page|site --convert html --prototype --concept "<what the rest of the surface must cover>"

`--scope page` grows the approved screen into its page; `--scope site` adds sibling routes and app states. Ordered `web_page` viewports belong to one continuous page. Complete application states belong to separate pages; recurring shells must not be stacked into one long document. Inspect the returned page/state mapping and any omitted screens.

    12ui next <run-dir> --wait

Execute stays in the foreground through its work; `next` can report progress from a second shell. `12ui branch resume <run-dir>` continues the recorded run. Avoid independently rebuilding pages while that conversion is running. Screens land in `<run-dir>/branch/screens/`; converted pages land in `<run-dir>/branch/pages/`.

Use `--prototype` with `--convert html` for a clickable baseline in `<run-dir>/branch/prototype/`. Inspect navigation, shared shells, and any holding pages. Generated interactions do not replace the application's real data and behavior.

Add `--polish` only when the user wants the optional design-improvement pass. For an already converted branch:

    12ui prototype <run-dir>

The same opt-in is available as `12ui prototype <run-dir> --polish`.

## 3. Convert

For a single approved image, convert directly rather than branching.

    12ui convert <source-image> --output html --out-dir <run-dir>

Keep `convert` running in the foreground until it exits. If the client returns a running shell or background task handle, keep waiting on that same handle; use `12ui next <run-dir> --wait` to observe progress while the original process stays alive. Local conversion runs in that process, so ending the client session with work still in flight can interrupt a dispatched model call. Do not deliver a final response until the command has exited and the saved run reports a terminal result. If it reports `needs-reconciliation`, preserve the run and report that state; do not start a fresh conversion or treat `resume` as permission to repeat uncertain paid work.

Use the returned editable HTML/CSS and assets as the implementation baseline. Derive another supported output from the saved run or its output directory:

    12ui convert <run-dir-or-output-dir> --output assets|png|jpg|webp|pdf|react --out-dir <dir>

LayerDoc is optional. Native design formats and hosted conversion-ID derivations have different requirements; consult [outputs.md](outputs.md) when those are requested. Keep the run and follow `12ui next <run-dir>` or `12ui resume <run-dir>` for status and recovery.

## 4. Integrate and close

Integrate the converted code and real assets into the owning project. Preserve its framework, routes, data, controls, and tests. For multi-screen HTML, use the generated prototype as the routing and interaction baseline before wiring application behavior.

After functionality and content are in place, inspect the real browser against each page or state's original approved image. That image remains the visual authority; a derived document or top-viewport screenshot does not prove alignment for lower regions or other states. Check relevant widths and transitions.

Correct concrete observed mismatches in the owning source and re-render. Preserve paid assets and the requested behavior and content. When the CLI provides project apply, use it for focused alignment with the approved image:

    12ui improve <implemented-url> --target <approved-screen.png> --repo <repo> --apply --out-dir <directory-outside-repo>

If project apply is unavailable, omit `--apply` to obtain the existing implementation kit and apply its plan in the owning project. Use the result's source diff, build/test evidence, and browser rendering to verify completion. Do not impose a broad model repair loop when focused normalization suffices or the implementation already matches. Read [improve.md](improve.md) for project apply, hosted kits, and continuous-page coverage.

Deliver openable code, assets, and observed limitations. State when rendering or application behavior remains unverified.

## 5. Search

Use this when reference imagery itself is the deliverable.

    12ui corpus inspire --query "<product, audience, surface, goal, personality>" --out-dir <directory> --count 4 --reference-image <image.png>

Read [inspire.md](inspire.md) for search modes, ranked manifest order, and interrupted-search recovery.

## 6. Improve

Use Improve for an existing interface, Draft for a new first viewport, and Branch to extend an accepted design. With project apply available, let the CLI edit the actual application:

    12ui improve <url> --repo <repo> --apply --out-dir <directory-outside-repo>

Without `--target`, the command drafts candidates and stops for a choice. Inspect the PNGs, choose the strongest fit, then continue the same run:

    12ui improve <url> --repo <repo> --apply --out-dir <directory-outside-repo> --from pick --pick <slot>

With an approved target, use §4's command to skip drafting. Without `--apply`, Improve retains its implementation-kit workflow for URL or image input; read the kit README and apply its plan to the project yourself.

Only if needed, read [improve.md](improve.md) for controls, target preparation, site work, and kit use.

The pick is mandatory when generating candidates. Exit code 0 with an INCOMPLETE kit means nothing has been picked yet, not that the run failed. Never work around the checkpoint by approximating the design in CSS.
