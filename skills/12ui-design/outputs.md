# Outputs and execution

Use `12ui capabilities` and `12ui <command> --help` for the installed CLI's supported inputs, outputs, and engine choices. The caller may be Codex, Claude, or another supported client; the CLI owns execution setup, selection, cost reporting, and recovery. Do not locate skill runtime scripts or assemble a separate authentication/capture handoff.

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

`--engine auto|codex|api` controls conversion execution when needed; auto is the default. For supported new conversions, auto selects ready local Codex regardless of the calling client; otherwise it selects API before starting, while saved runs keep their recorded engine. Branch image generation and optional prototype interaction labelling remain hosted even when conversion is local. Image execution is independent: before a new local run, the CLI selects external images when `OPENAI_API_KEY` is available, otherwise native images through Codex account access. An explicit image backend or saved run keeps its choice; explicit external images require the separate key before inference starts. Native does not imply zero cost or a known underlying image model. Project apply requires a ready Codex engine; without it, use the implementation-kit path and apply the plan in the calling coding client. Keep run records and use their status/recovery commands instead of restarting uncertain paid work.
