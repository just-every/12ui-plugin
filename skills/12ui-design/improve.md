# Improve an existing interface

Use Improve to redesign an existing interface or align a built page with its original approved image. `--apply` edits the actual repository; omitting it produces the existing implementation kit for you to apply.

## Apply to the project

For a chosen design:

    12ui improve <url> --target <approved.png> --repo <repo> --apply --out-dir <directory-outside-repo>

The CLI captures the current URL and supplies current and target imagery to the project executor. Retain the project's framework, routes, data, controls, and assets. Target images may abbreviate real content or omit controls; preserve those unless their removal was requested.

Local apply supports page scope and PNG/JPEG/WebP targets. Keep an explicit run directory outside the source repository, or omit it to use the CLI's default. The capture/draft/pick stages are available before apply; hosted branch/site/convert/plan stage controls do not apply to this mode.

For a new direction, omit the target and inspect the generated candidates before choosing:

    12ui improve <url> --repo <repo> --apply --out-dir <directory-outside-repo> --direction "<specific visual direction>"
    12ui improve <url> --repo <repo> --apply --out-dir <directory-outside-repo> --from pick --pick B

Inspect the source diff and run the affected build/tests. Render the actual route at the source viewport and a narrower width, including relevant state transitions. Correct observed defects in the owning source and render again; a successful process exit is not visual or behavioral proof. Keep the run and follow its status and recovery instructions.

## What to keep

`--retain` controls what candidate generation holds from the existing interface:

| Facet | Held | Freed |
| --- | --- | --- |
| `layout` | Section order and positions | Layout may change |
| `content` | Words, data, and controls | Wording and sequence may change |
| `assets` | Logo, wordmark, and brand imagery | Brand imagery may change |
| `style` | Palette, typography, and texture | Visual system may change |

The default is `assets,content`: keep the brand and words while exploring layout and visual style. Add layout only when preserving geometry is part of the intended change.

    12ui improve <url> --retain assets,content --direction "<specific visual direction>"
    12ui improve <url> --retain layout,content,assets

No combination licenses inventing a product fact. Preserve real claims, numbers, offers, data, and controls. Do not describe sparse real content as a defect to fill with inventions. Leave at least one facet free so generation has a meaningful change to make.

Use `--direction` for concrete hierarchy, typography, surfaces, color, controls, and mood. Concept and direction text have no character limit. `--candidates` accepts 2–16 and defaults to four; an already approved image uses `--target` instead.

## Hosted implementation kits

Without `--apply`, URL input produces a DOM-anchored implementation kit; image input produces an unanchored kit. An image target skips draft and pick. A compatible LayerDoc target can reuse native structure for kit planning, but the original approved image remains the visual authority.

    12ui improve <url> --target <image.png|layerdoc.json> --repo <repo> --out-dir <kit>
    12ui improve <image.png> --plan-source-convert

Use `--plan-source-convert` only when the extra source conversion is useful for the image-input plan. For a new direction, the kit stops after drawing candidates:

    12ui improve <url> --out-dir <kit>
    12ui improve <url> --out-dir <kit> --from pick --pick B

Read the kit README for status, assets, plan location, and recovery. A pending pick is an expected pause, not completion. `--redraw` requests new candidates when none are suitable; `--fresh` requests another conversion of the same winner. These are new work, so use them only when that change is intended and follow the CLI's accounting rather than treating them as ordinary resume.

    12ui improve <url> --out-dir <kit> --redraw --direction "<new visual direction>"

The kit does not edit code. Apply the plan in the owning source. If its selector mapping is blocked, inspect `plan/GATE.md`, retain the target assets, and capture the actual state the target depicts before requesting another mapping. Do not apply unsafe selector patches or silently treat fixed-layout output as responsive. The kit's README and recovery command report the available artifacts.

### Assets and typography

Use the kit asset table: ship files marked for shipping, keep one resolution of each asset, and keep reference images as references. Optimise large PNGs or use the repository's existing WebP flow while retaining stems used by the plan.

- Clean plates are backgrounds with removed foreground artwork. Alternate plates are alternatives, not extra layers to stack.
- Cutouts are real foreground imagery with transparency. Copy and position them rather than approximating them in CSS.
- Upscaled files are higher-resolution alternatives; do not ship both resolutions unnecessarily.
- Source crops preserve original pixels; prefer a supplied cutout when transparent foreground imagery is needed.

Load identified fonts through the repository's existing font mechanism. Inspect overlays and scrims against the source so they do not obscure the artwork. Preserve the original winner, real assets, application data, controls, routes, and tests. Keep bulky kit audit output outside committed application source.

## Whole-site kits

Site scope carries an accepted root design across the site's pages. It is a hosted kit workflow, not local `--apply`:

    12ui improve <url> --scope site --direction "<specific visual direction>" --out-dir <kit>

The accepted root supplies the visual system; each current page remains its own content and structure reference. Read the site roll-up's `APPLY.md`, apply shared shell/theme changes once, then each page's remaining changes. Inspect every target and any page whose mapping is blocked.

After applying a settled site kit:

    12ui improve <url> --scope site --out-dir <kit> --recheck

Recheck reports the existing kit's pages against its kept targets. Use the evidence to decide whether a focused correction is needed. See command help for page selection and concurrency controls.

## Align after integration

Compare each distinct page or state with its original approved image after requested functionality and content are present. A continuous Branch page may keep ordered approved viewport PNGs without one full-page image. Review each corresponding rendered region against those originals; a top viewport does not prove the lower page. Do not fabricate a new target through redraw or site branching to make an existing mismatch disappear.

For a concrete mismatch, use a focused source edit or project apply with the matching original target. Preserve intended content and behavior, then re-render relevant widths and transitions. No mandatory broad LLM repair pass or repeated conversion is required to close an implementation that already matches.

The pick is mandatory when generating candidates. Exit code 0 with an INCOMPLETE kit means nothing has been picked yet, not that the run failed. Never work around the checkpoint by approximating the design in CSS.
