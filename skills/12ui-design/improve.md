# Improve an existing interface

Use `improve` to make one existing interface better or pull a built page back to an approved design. It emits a target and implementation kit; it never edits the owning repository.

## Modes

For a live page, pass its URL. The CLI captures the page and extracts a selector-verified DOM document in one local browser context. The plan maps design changes into the page's own selectors.

    12ui improve <url>

For a screenshot, pass PNG, JPEG, or WebP. The kit is unanchored by default. Add `--plan-source-convert` only when a paid source conversion is worth a LayerDoc-to-LayerDoc comparison.

    12ui improve <image.png> --plan-source-convert

Use `--target` to align or restore a live page to an existing design. A target image skips draft and pick, then buys one fused target conversion. A `*.layerdoc.json` target skips conversion too, so target preparation is free.

    12ui improve <url> --target <image.png|layerdoc.json>

## Direction

Use `--direction` to steer generation. Give detailed, style-anchored direction: state the intended hierarchy, rhythm, typography, surfaces, color, controls, and mood. Detailed direction beat vague criticism in the measured prompt pass.

Never name emptiness or thin content as a defect. Models fabricate UI to fill it. The default concept already says to keep all real content, data, and controls and invent nothing.

## Candidates and picking

Generate several real alternatives with `--candidates`; inspect them, then select one with `--pick`. The default is four candidates and pick A.

    12ui improve <url> --candidates 4 --pick B --out-dir <kit-dir>

The kit keeps every candidate. Re-pick without buying capture or draft again:

    12ui improve <url> --out-dir <kit-dir> --from pick --pick C

Picking is free. The new winner still needs its target conversion and plan; their stable keys replay any already-settled work instead of buying it twice.

## Kit

- `improve.json` records inputs, stage settlements, price ceilings, service identities, and replay counts.
- `capture/` and `current.domdoc.json` hold the URL screenshot and selector-verified DOM extraction. Screenshot mode keeps `source.png` instead.
- `candidates/` keeps every generated option. `winner.png` is the explicit selection or supplied target image.
- `target/` holds the target LayerDoc, responsive HTML when generated, and extracted assets.
- `plan/` holds the selector diff, annotated implementation plan, `token-patch.css`, and added-element specs or assets.

URL plans pass only with at least 60% plausible DOM-side coverage after content, spatial, and neighbour matching. If the gate blocks, use `plan/GATE.md` to inspect the mismatch. The target HTML and LayerDoc remain a sidecar source of truth, but do not treat an unsafe selector mapping as an inline patch.

## Replay and pricing

Stages run capture, draft, pick, convert, then plan. Resume with `--from` and `--to`; settled stages replay and never buy again. Run `--dry-run` first for a zero-network, per-stage ceiling.

Current ceilings are $0.001 for corpus search, $0.001 for the hosted plan, $0.06 per draft candidate, $0.05/$0.45/$0.90 for fast/standard/pro conversion, and $0.10 for the standard responsive export. Target LayerDoc preparation is free. Local capture, pick, DOM matching, gate, and annotation are free.

## Workflow patterns

### Improve in place

Run against the existing page with no reference. State the intended style precisely, inspect the candidates, then apply the selector-anchored plan in the owning repository.

    12ui improve <url> --direction "<detailed style-anchored direction>" --repo <repo> --out-dir <kit-dir>

### Restore after build

After draft, convert, and build, use the original winner image or LayerDoc as the target when coding has degraded the design. Run against the build URL. The result is a minimal-delta plan in the build's own selectors, pulling it back inline without disrupting the working build. The coverage gate blocks when drift is no longer safely mappable.

    12ui improve <build-url> --target <original-winner.png|original.layerdoc.json> --repo <repo> --out-dir <restore-kit>

### Parallel build

Recommended: start draft, pick a direction, then start conversion while the coding model begins its build from the picked image. Model builds usually recover the general pieces, not the design's pixel fidelity. When both are ready, align the running build to the original winner or converted LayerDoc.

    12ui improve <build-url> --target <picked-image.png|converted.layerdoc.json> --repo <repo> --out-dir <convergence-kit>

Convergence depends on the build retaining the design's rough structure. Trust the coverage gate: a block means the build drifted too far for a safe inline selector plan.
