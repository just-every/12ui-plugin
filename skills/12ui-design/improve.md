# Improve an existing interface

Use `improve` to make one existing interface better or pull a built page back to an approved design. It emits a target and implementation kit; it never edits the owning repository.

Generating a design is two commands, not one: the first draws candidates and stops, you look at them, and `--pick <slot>` finishes the run. Bringing your own design with `--target` is one command.

## Modes

For a live page, pass its URL. The CLI captures the page and extracts a selector-verified DOM document in one local browser context. The plan maps design changes into the page's own selectors.

    12ui improve <url>

For a screenshot, pass PNG, JPEG, or WebP. The kit is unanchored by default. Add `--plan-source-convert` only when a paid source conversion is worth a LayerDoc-to-LayerDoc comparison.

    12ui improve <image.png> --plan-source-convert

Use `--target` to align or restore a live page to an existing design. A target image skips draft and pick, then buys one fused target conversion. A `*.layerdoc.json` target skips conversion too, so target preparation is free.

    12ui improve <url> --target <image.png|layerdoc.json>

## What to keep

`--retain` sets what the run holds from the live page, in the four facets the service understands. It leads the concept, so the brief you give is what the design answers.

| facet | held | freed |
| --- | --- | --- |
| `layout` | section order and positions stay | the page is laid out again from scratch |
| `content` | the same words, data and controls | the words may be rewritten and re-sequenced |
| `assets` | the logo, wordmark and brand imagery | the brand may be replaced |
| `style` | the existing palette, typography and texture | a new visual system |

The default is `assets,content`: keep the brand and the words, rework the layout and the visual system.

    12ui improve <url> --retain assets,content --direction "<detailed style-anchored direction>"
    12ui improve <url> --retain layout,content,assets

No combination licenses inventing a product fact. With `content` held the page says the same things; with `content` freed the words may be rewritten but every claim, number, offer, and control it states must still be present and true. The /improve page exposes the same four facets as Keep layout, Keep copy, Keep brand, and Keep style.

## Direction

Use `--direction` to steer generation. Give detailed, style-anchored direction: state the intended hierarchy, rhythm, typography, surfaces, color, controls, and mood. Detailed direction beat vague criticism in the measured prompt pass.

`--direction` accepts at most 600 characters, and the CLI refuses a longer one before anything is captured, drawn, or bought. That is not the 1485-character concept limit the `--concept` flags carry: improve sends a 1485-character concept and reserves 885 of it for the retain mandates `--retain` selects and the no-invention clause it always sends, so 600 is what the flag has left. The reservation is the LONGEST assembly of those mandates, so a brief accepted under one `--retain` set is accepted under every other. Compose within 600 rather than trimming after a refusal; the refusal names the limit, what was written, and how much to cut.

Never name emptiness or thin content as a defect. Models fabricate UI to fill it. The default concept already says to keep all real content, data, and controls and invent nothing.

## Candidates and picking

Generate several real alternatives with `--candidates` (2 to 16, default 4); inspect them, then select one with `--pick`. The floor is 2 because a draft draws alternatives to choose between — to work from a single design you already have, pass `--target` instead, which skips draft and pick.

`--pick` has no default. Run without it and the command stops after the draw, prints where the candidates are and the exact command that continues, and buys no conversion — converting a candidate nobody chose spends money on a guess, and a conversion cannot be cancelled once it starts. Two commands, and you look at the PNGs in between:

    12ui improve <url> --out-dir <kit-dir>
    12ui improve <url> --out-dir <kit-dir> --from pick --pick B

Pass `--pick` up front only when the choice is already made (a scripted run that takes whatever the draw gives). The kit keeps every candidate, so re-picking never buys capture or draft again:

    12ui improve <url> --out-dir <kit-dir> --from pick --pick C

Picking is free. The new winner still needs its target conversion and plan; their stable keys replay any already-settled work instead of buying it twice. Re-picking does discard the conversion the old winner paid for: there is no cancel, so that conversion keeps running and keeps billing, and its id is recorded in `improve.json` under `abandonedConversions` and shown in the kit's README.

### Buying again: `--fresh` vs `--redraw`

`--fresh` re-buys **one conversion of the same settled winner** under a new idempotency key, records the abandoned conversion identity, and leaves capture, draft and pick untouched. It is for a stuck conversion of a design you still want.

`--redraw` re-buys **the whole draw**: it discards draft, pick, convert and plan, moves `candidates/` aside to `candidates.previous/`, and draws new candidates. It costs a full draft, so use it only when none of the candidates is worth picking.

    12ui improve <url> --out-dir <kit-dir> --redraw --direction "<new direction>"

`--redraw` is the one flag allowed to change what the draw is: `--direction`, `--candidates` and `--retain` may differ from what the kit recorded, and the new values are written down before the draft runs. Every other flag still has to match the record. Any conversion the redraw discards is appended to `abandonedConversions`, because it keeps running and keeps billing.

## Kit

- `improve.json` records inputs, stage settlements, price ceilings, service identities, and replay counts.
- `capture/` and `current.domdoc.json` hold the URL screenshot and selector-verified DOM extraction. Screenshot mode keeps `source.png` instead.
- `candidates/` keeps every generated option. `winner.png` is the explicit selection or supplied target image.
- `target/` holds the target LayerDoc, responsive HTML when generated, and extracted assets.
- If responsive HTML fails or reaches the improve deadline, the kit warns that its free HTML fallback is fixed-layout and still continues to the LayerDoc-based plan. That run also writes `plan/STALL.md` and says so in its summary and README status: it is a recovered run, not a clean one.
- `plan/` holds the selector diff, annotated implementation plan, `token-patch.css`, and added-element specs or assets.
- `token-patch.css` never imports a font over the network. When the design uses a Google font, the patch declares it as a comment and a CSS custom property named for the family, and the plan and README name the family under "Fonts": load it the way the repository already loads fonts — self-host it, or add it to the existing loader — or keep the current family and skip that token.

URL plans pass only with at least 60% plausible DOM-side coverage after content, spatial, and neighbour matching. If the gate blocks, use `plan/GATE.md` to inspect the mismatch. The target HTML and LayerDoc remain a sidecar source of truth, but do not treat an unsafe selector mapping as an inline patch.

## Using the kit

A kit whose `pick` stage reads INCOMPLETE is a drafts-only kit. The CLI stops after the draw by design: it converted nothing and exited 0. Inspect the candidate PNGs in `candidates/`, then run the pick. The pick is mandatory — always run it, and the run's last line prints the exact command under `Next:`:

    12ui improve <url> --out-dir <kit> --from pick --pick <slot>

Convert and plan run from there. Exit code 0 with an INCOMPLETE kit means nothing has been picked yet, not that the run failed. Never work around the checkpoint by approximating the design in CSS.

Read `README.md` first. It carries the run's honest status, the assets table for this kit, and the recovery commands when a stage did not settle. The table's ship column is the instruction: copy the files marked ship, keep one of any alternate resolution, and read the references without shipping them.

A kit written inside the repository is local audit evidence, not source: when `--out-dir` sits under a `.improve/` directory in a git working tree the CLI appends a `.improve/` rule to the repository root `.gitignore` if nothing ignores it already, and for any other in-repo out-dir it prints one line telling you to ignore that path before committing — never commit the kit.

Plates and cutouts arrive at full resolution and run over a megabyte. Pick one resolution per layer and optimise the PNG — or convert it to WebP where the repository already uses one — before committing, keeping the filename stem so the plan still matches.

### Asset roles

- clean plate (`clean-N`): the backdrop with the foreground artwork removed. Use it as the background layer, at full strength. A conversion can emit several: only the base plate is the page's background, and the README marks every other one an alternate backdrop — use it only if you omit the layer it removed as well.
- cutout (`cutout-N`): the foreground artwork as an alpha PNG. This is the imagery. Copy it into the repo and place it at its bounds; never redraw it in CSS.
- upscaled plate / upscaled region (`upscaled-*`): a higher-resolution copy of a plate or region for crisp rendering; pick one resolution, do not ship both.
- source crop (`crop-N`): the layer cropped straight out of the source image; prefer that layer's cutout when one exists.
- `winner.png`: the whole design; the reference for every visual decision.

### Raster first

When the target LayerDoc declares a raster layer, copy its file into the repository and reference it. Never approximate an existing asset with CSS. A hero can be a single plate or a single cutout, and the plan lists them before tokens for that reason. Keep any scrim light — at most 35% opacity — and state in your report why one is used.

### When a stage stalls

Wait to the no-progress bound the CLI prints; never stop a conversion that is still publishing a live service stage or active lane. `--convert-stall-seconds` bounds each hosted wait the convert stage makes, including the free fixed-layout derivation, only when no new live status or progress is observed. It defaults to 960s (16m) for standard and pro — 20% above the measured 655/642/796s tall-landing walls, rounded to a minute, and four times the 240s standard typical — and 300s for fast. At a true no-progress bound the CLI buys nothing. It either derives fixed-layout HTML free from a LayerDoc that did land, or — when nothing landed and there is nothing to derive — stops and hands the conversion back by id, because that conversion is still running, still billing, and cannot be cancelled. The wait is not silent: a `[wait]` line every minute names the elapsed time, the no-progress bound, the conversion id, and the service stage.

A fixed-layout fallback still finishes the kit and still writes `plan/STALL.md`, which names what stalled, how long it waited, and the `12ui resume <conversion-id> --out-dir <kit>/target` that collects `winner.html` when the original responsive export completes. The plan remains based on the fixed-layout fallback; collection does not silently recast it as responsive. `resume` recovers an existing purchase and buys nothing. Do not re-run improve to chase a responsive target.

One operator command dispatches at most one conversion, on every model. Resuming with `--from convert` rebuilds the same idempotency key, so it re-attaches to the conversion the kit already bought however many times you run it, and `12ui resume <conversion-id> --out-dir <kit>/target` collects that conversion directly once it finishes. `--fresh` is the only way to buy another, and it is you asking. Every conversion the kit dispatches is priced in `improve.json` before it starts, under `conversionAttempts` and `stages.convert`, so the kit can state its own spend even when nothing settled.

Past that, `plan/STALL.md` names the stage, the hosted run, any abandoned conversions, and the recovery, each command annotated with what it spends:

    12ui improve <same input> --out-dir <kit> --from convert  # resumes; settled stages replay
    12ui convert <kit>/winner.png --output html               # buys one conversion
    12ui improve <url> --target <kit>/winner.png              # buys one fused target conversion

The third form is offered for a URL input only. Once the LayerDoc exists, carry its raster layers as real assets — copy the files and reference them. Do not approximate the design's layout or text in CSS from the PNG while a stage is incomplete; resume or convert first. The README and `STALL.md` print that one sentence, so an incomplete kit cannot tell you two things.

`plan/STALL.md` has a lifecycle: the CLI writes it at its own bound as well as on a signal, and a later run that settles the stage REPLACES it with a short resolved note naming when the kit stalled and when it settled. A file saying INCOMPLETE beside a README saying settled is not a state this kit can be in; read the README for status either way.

A stopped run writes the same `STALL.md` and README as a stalled one, at whatever stage it had reached (a signal that arrives after the last requested stage settled writes no `STALL.md` — that run is complete), and closes the kit's `journal.jsonl` with a terminal event naming the stop or the stall. `12ui next <kit>` reads that event and still reports the hosted run as live, because it is: stopping the CLI does not stop the conversion, and there is no cancel — a conversion nobody collects runs to completion and bills. `abandonedConversions` in `improve.json` lists the conversions YOU walked away from — a re-pick, a redraw, a `--fresh`; the CLI never adds one of its own. A conversion a stopped or stalled run was still waiting on is not abandoned: every dispatch writes its idempotency key to `conversionAttempts` before it happens, so `STALL.md` names the run the resume attaches to and `--from convert` re-attaches to it instead of buying another. SIGKILL is the exception: it runs no handler, so the kit is not written and the journal's last progress line is the record.

### When the coverage gate blocks

`plan/GATE.md` replaces `plan-annotated.md` and `token-patch.css` when the captured page and the target are too far apart to anchor. Nothing is missing: the target, its assets, and the raster layers to carry are all still in the kit, and `GATE.md` lists them. Read it, carry the raster layers, and re-capture the page in the state the target depicts before asking for an anchored plan again.

### Fidelity self-check

Before committing, screenshot the page and put it beside `winner.png`. Health checks — legibility, console, tests — do not answer whether the design landed.

### Never discard

`winner.png`; every cutout and plate the assets table names; all real content, data, controls, routes, and tests.

## Replay and pricing

Stages run capture, draft, pick, convert, then plan. Resume with `--from` and `--to`; settled stages replay and never buy again. Run `--dry-run` first for a zero-network, per-stage ceiling.

Current ceilings are $0.001 for corpus search, $0.001 for the hosted plan, $0.06 per draft candidate, $0.05/$0.45/$0.90 for fast/standard/pro conversion, and $0.10 for the standard responsive export. Target LayerDoc preparation is free. Local capture, pick, DOM matching, gate, and annotation are free.

## Whole-site polish

Use site scope to carry one accepted root design across a live site's key pages. It accepts URL input only: the root is captured and improved as usual, then its accepted winner becomes the visual-system reference for each captured current page. The model receives the current page and accepted root as distinct references; by default, the current page comes first so its structure and content remain the editing anchor.

    12ui improve <url> --scope site --direction "<detailed style-anchored direction>" --out-dir <kit-dir>

`--pages` caps free one-hop discovery, including the root, from 2 to 8 pages (default 5). Repeat `--page <url>` to replace discovery with explicit same-origin pages. `--page-concurrency` controls 1–10 simultaneous page conversions (default 3). `--reference-order current-first|root-first` records which image order was sent; the default is `current-first`.

Site scope runs seven stages: `capture → draft → pick → branch → convert → plan → site`. Capture uses one browser and one context for the root and every page. Draft and pick remain root-only. Branch produces one polished image for each non-root page from the accepted root and that page's current screen; the root is never sent as a branch screen. Convert writes the root target once, then one converted target for every non-root page. If responsive HTML is unavailable for the root or any page, that LayerDoc still drives its plan; the kit records the gap and includes free fixed-layout HTML when derivation succeeds. Plan creates a DOM-anchored plan for the root and every non-root page; a blocked page writes `GATE.md` but does not block the rest of the site. The final site stage rolls those plans up, with the root listed as `root`.

The site kit has this exact shape:

```text
<out-dir>/
  improve.json                         # v2 record
  capture/source.png  current.domdoc.json  candidates/  winner.png  target/  plan/   # root, as today
  pages/<id>/capture/source.png
  pages/<id>/current.domdoc.json
  pages/<id>/polished.png              # branch output
  pages/<id>/target/polished.layerdoc.json (+.assets)  polished.html or derived.fixed.html when available (+.assets)
  pages/<id>/plan/{diff.json,changes.md,plan-annotated.md,token-patch.css,assets/ | GATE.md}
  site-plan/{tokens.css,shared-shell.md,pages.md,APPLY.md}
  README.md
```

`site-plan/tokens.css` deduplicates token patches and records conflicts, while `shared-shell.md` lists recurring header, navigation, sidebar, or footer changes once with their pages. `pages.md` reports every page's URL, gate, coverage, delta counts, polished image, and target HTML. `APPLY.md` is the coding-model brief: apply tokens through the repository theme entry point, apply shared shell changes once, then apply page residue in order and added-element specs with their assets. It also requires no invention, no dead controls, no hardcoded identity, and configurable data to remain configurable; `--repo` file hints are folded in when supplied.

The kit does not apply code. Apply `APPLY.md`, then run `12ui improve <url> --scope site --out-dir <kit> --recheck`. Recheck reuses the existing kit, opens one browser/context for the root and every site page, and writes `recheck/<n>/pages/<id>/` captures and plans plus `recheck/<n>/report.md`; it never replays settled stages or buys work. Use the report's before→after coverage and matched/added/removed counts to decide whether another focused implementation turn is warranted. Pages without a kept target are captured and reported as unavailable rather than blocking the other pages.

## Workflow patterns

### Improve in place

Run against the existing page with no reference. State the intended style precisely. The first command stops at the draw; look at the candidate PNGs, then pick one and let it finish, and apply the selector-anchored plan in the owning repository.

    12ui improve <url> --direction "<detailed style-anchored direction>" --repo <repo> --out-dir <kit-dir>
    12ui improve <url> --repo <repo> --out-dir <kit-dir> --from pick --pick <slot>

### Restore after build

After draft, convert, and build, use the original winner image or LayerDoc as the target when coding has degraded the design. Run against the build URL. The result is a minimal-delta plan in the build's own selectors, pulling it back inline without disrupting the working build. The coverage gate blocks when drift is no longer safely mappable.

    12ui improve <build-url> --target <original-winner.png|original.layerdoc.json> --repo <repo> --out-dir <restore-kit>

### Parallel build

Recommended: start draft, pick a direction, then start conversion while the coding model begins its build from the picked image. Model builds usually recover the general pieces, not the design's pixel fidelity. When both are ready, align the running build to the original winner or converted LayerDoc.

    12ui improve <build-url> --target <picked-image.png|converted.layerdoc.json> --repo <repo> --out-dir <convergence-kit>

Convergence depends on the build retaining the design's rough structure. Trust the coverage gate: a block means the build drifted too far for a safe inline selector plan.
