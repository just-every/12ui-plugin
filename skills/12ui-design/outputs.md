# Outputs and execution

LayerDoc, fixed HTML, SVG, PSD, PPTX, and Sketch come from a hosted conversion of the original source image, never from local HTML:

    12ui convert <source-image> --output layerdoc|html_fixed|svg|psd|pptx|sketch

Derive more formats from that conversion's ID without converting again:

    12ui convert <conversion-id> --output html_fixed,svg,pdf --out-dir <dir>

Local runs use native images through the person's Codex sign-in by default; external images run only with `--image-backend external`, which uses the person's own `OPENAI_API_KEY`; pass it only when they ask.
