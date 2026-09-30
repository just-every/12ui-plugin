# Outputs and execution

Use the [persistent session workflow](session.md) for new work inside a capable coding session. Its operations keep prompts, inputs, provider decisions, results and recovery state locally. It does not imply that every output format has a local executor. Inspect actual session tools and the installed CLI capabilities before preparing an output contract.

The following table and commands describe the existing conversion/export runtime, which remains an explicitly selected alternative. Do not substitute its older automatic engine selection for the workflow service's explicit provider funding policy. Never silently replace a failed local operation with a hosted purchase.

| Requested result | Input and boundary |
| --- | --- |
| Editable HTML/CSS and assets | Convert the approved image to `html`. Local HTML is complete without a LayerDoc. |
| Assets, PNG, JPG, WebP, PDF, React | Convert a completed local run or output directory to one requested format. Raster and PDF use a browser; React is whole-page JSX, CSS, and assets, not a behavior-complete application. |
| LayerDoc, fixed HTML, SVG, PSD, PPTX, Sketch | Requires native LayerDoc conversion or a compatible hosted conversion identity. Local HTML cannot be relabeled as LayerDoc. |
| Continuous pages and application states | Branch owns page/state grouping and prototype assembly. Follow its supported conversion path and inspect the resulting mapping. |

When a native design deliverable is requested up front:

    12ui convert <source-image> --output layerdoc|html_fixed|svg|psd|pptx|sketch

Reuse a compatible hosted conversion for further native derivations:

    12ui convert <conversion-id> --output html_fixed,svg,pdf --out-dir <dir> --idempotency-key <stable-key>

A new LayerDoc requirement after local conversion is a new operation on the original source, not an export of edited local HTML. Keep that distinction explicit and follow the CLI's supported next command. Never silently replace a failed local operation with a hosted purchase.

For the legacy conversion commands only, `--engine auto|codex|api` controls execution; auto is the default. For supported new conversions, auto selects ready local Codex regardless of the calling client; otherwise it selects API before starting, while saved runs keep their recorded engine. Branch image generation and optional prototype interaction labelling remain hosted even when conversion is local. Image execution is independent: before a new local run, the CLI selects external images when `OPENAI_API_KEY` is available, otherwise native images through Codex account access. An explicit image backend or saved run keeps its choice; explicit external images require the separate key before inference starts. Native does not imply zero cost or a known underlying image model. Legacy project apply requires a ready Codex engine. In a capable session, prepare a code operation and edit the actual project directly; use a hosted implementation kit only when that route and its spend are authorized. Keep run records and use their status/recovery commands instead of restarting uncertain paid work.

For local HTML conversion, omit the API-only options `--model`, `--width`, `--responsive-quality`, `--origin`, `--api-key`, and `--idempotency-key`. Local work is identified by its saved run directory and receipt; recover it with `12ui resume <local-run-dir>`.

## Explicit legacy draft and branch

These commands retain the older hosted image orchestration and its own run records. Use them only when the user has selected or authorized that service route; native session generation is the default described in the main skill.

Use `12ui <command> --help` for an installed legacy command's options. Existing local conversion and deterministic derivatives remain available:

    12ui convert <source-image> --output html --engine codex --out-dir <run-dir>
    12ui convert <run-dir-or-output-dir> --output assets|png|jpg|webp|pdf|react --out-dir <dir>

    12ui draft --concept "<product, audience, surface, goal, personality>" --corpus-query "<surface, layout, typography, imagery, palette; 400 chars max>" --candidates 4
    12ui branch execute --start <image.png> --scope page|site --convert html --prototype --concept "<remaining pages or states>"
    12ui next <run-dir> --wait
    12ui branch resume <run-dir>
    12ui prototype <run-dir>

Standalone `prototype` defaults to `--labels none`: local deterministic assembly without a 12ui account. Use `--labels workflow --workspace <workspace>` to prepare exact DOM-bound label operations, execute/register them through the session workflow, then repeat the same command to build. [session.md](session.md) covers its pending state and provenance. Use `--labels 12ui` only with authorization for hosted per-screen interaction labeling. Generic image `workflow labels` annotations are a separate schema and cannot replace exact prototype actions.

Keep the chosen source and page/state mapping. Retain the foreground process for legacy local conversions; if it reports needs-reconciliation, preserve the run rather than starting the same work again. Optional polish requires a requested design improvement.
