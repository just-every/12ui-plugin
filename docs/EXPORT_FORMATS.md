# Conversion export formats

`POST /api/v1/convert` accepts either a static PNG, JPEG, or WebP in `file`, or
a public LayerDoc v2 JSON document in `layerdoc`. Both input kinds support every
output. LayerDoc-to-LayerDoc requests canonically republish the document and
its owned artifacts without repeating image extraction.

| `output` | Result `Accept` media type | Download | Layout |
|---|---|---|---|
| `layerdoc` | `application/vnd.12ui.layerdoc+json;version=2` | `.layerdoc.json` | Canonical semantic layer tree |
| `html` | `text/html;profile="12ui-responsive-v1"` | `.html` | Fixed canvases: one per admitted width band with `responsive_quality`/`breakpoints`, otherwise a single canvas identical to `html_fixed` |
| `html_fixed` | `text/html;profile="12ui-fixed-v1"` | `.html` | Pixel-exact flow-authored geometry; whole canvas scales below native width |
| `svg` | `image/svg+xml` | `.svg` | Fixed anchor canvas |
| `png` | `image/png` | `.png` | Fixed anchor canvas, lossless raster with alpha |
| `jpg` | `image/jpeg` | `.jpg` | Fixed anchor canvas, quality 92 with white matte |
| `webp` | `image/webp` | `.webp` | Fixed anchor canvas, quality 92 with alpha |
| `pdf` | `application/pdf` | `.pdf` | Fixed anchor canvas |
| `psd` | `image/vnd.adobe.photoshop` | `.psd` | Fixed anchor canvas |
| `pptx` | `application/vnd.openxmlformats-officedocument.presentationml.presentation` | `.pptx` | Fixed anchor canvas on one slide |
| `sketch` | `application/zip` | `.sketch` | Fixed anchor canvas on one page and artboard |
| `web_project` | `application/vnd.12ui.web-project+zip;version=1` | `.web-project.zip` | Responsive web source project |
| `app_project` | `application/vnd.12ui.app-project+zip;version=1` | `.app-project.zip` | Responsive native or cross-platform app source project |

The Download column is the canonical `filenameSuffix`, shown with the leading
dot used when it is appended to a conversion name. The suffix itself never
contains a leading dot. `extension` describes the physical result or container,
so both project formats have `extension: "zip"` while retaining the distinct
`web-project.zip` and `app-project.zip` download suffixes.

`html_fixed` is the deterministic pixel-exact HTML product: the compiler's
semantic container tree plus one flow-exact geometry stylesheet
(`packages/layerdoc/src/html/fixed-layout.ts` — flex stacks with arithmetic
margins/padding where children stack cleanly, absolute positioning only for
genuine overlap, handover-grade ids derived from group paths). It is also the
page representation static site packages publish (`manifest.site` accepts
`output: html` or `html_fixed`).

`html` is the same emission under a different name and a different media type
whenever the request bought no `responsive_quality` and no package
`breakpoints` — the two documents are byte-identical for the same design, and a
worker fixture pins that identity. Buying a quality adds bands: one
independently converted fixed canvas per admitted width, mutually exclusive, so
exactly one is displayed at any viewport width. The reflowing `balanced` flow
compiler was retired from the HTML lane in `layerdoc-worker-v172`; it survives
only behind `web_project`, where the deliverable is source a developer edits and
reflow is the point.

The eight fixed exports do not pass through the responsive HTML flow compiler.
They share a normalized export scene derived directly from LayerDoc: canvas
geometry, semantic group paths, global paint order, editable text, resolved
surfaces, and materialized raster assets. The anchor canvas defines the visible
output bounds, invalid or unsupported paint values are normalized to explicit
safe values, and raster inputs are decoded to a consistent pixel representation
before encoding. Layer ids and `z` remain canonical; the effective paint order
also applies the reference renderer's one reconstruction exception, moving an
overlapped text/control leaf above a higher-`z` raster so declared text remains
visible. A fixed export either succeeds as a valid format or records an explicit
failure; the service does not substitute a flattened screenshot or a different
output format.

Buffered encoders are protected by explicit decoded-pixel and format working-
set budgets. A document above those budgets terminates with
`export_too_complex`; it is never silently downscaled or flattened.

## Responsive bundle representation (retired)

This representation is retired and draining. It was produced by the responsive
binding/transplant tier, and when the responsive lane inverted to per-anchor
ordinary conversions plus deterministic band assembly (pipeline v171,
2026-08-06) the bundle builder was deleted along with the rest of that tier.

What that means for a caller:

- No conversion created from v171 onward publishes a bundle. Every request for
  `application/zip;profile="12ui-responsive-bundle-v1"` answers `406`, including
  a bare `Accept: application/zip` on a responsive HTML run, which negotiation
  still resolves to this representation.
- Runs that succeeded before v171 keep serving their stored archive, unchanged
  and fully verified, until the artifact retention window expires. After that
  the representation answers `406` unconditionally.
- Nothing else about negotiation changed, and
  `text/html;profile="12ui-responsive-v1"` still returns the single document.

Do not build new clients against it. No shipped 12ui client requests it.

| Accept | Download | Contents |
|---|---|---|
| `application/zip;profile="12ui-responsive-bundle-v1"` | `12ui-responsive-{id}.zip` | `index.html`, `assets/<role>-<digest16>.<ext>`, `bundle-manifest.json` |

For a retained archive, the guarantees it was written under still hold. Assets
are the registered artifact bytes verbatim — nothing was re-encoded,
recompressed, or resampled at export time, so a bundle can never be lower
fidelity than its single document. The archive is deterministic: stored
(uncompressed) entries, code-point path order, and a fixed timestamp, so
identical inputs produced identical bytes. It was written by the same
`createDeterministicSiteArchive` that produces the conversion-package
static-site archive, so the two share one ZIP32 layout by construction.

The bundle existed for per-band asset resolution: a single document embeds one
artifact per raster slot, so band-fit selection had to master every slot for the
widest device box that slot was painted into anywhere, and separate files
removed that constraint. That concern did not disappear with the builder — band
arbitration now lives in `workers/api/src/conversion/responsiveAnchorBandPlan.ts`
and is still the single source of each band's bounds for the live lane's asset
selection.

Standalone HTML embeds every verified raster once in an inert JSON payload.
Its only executable code is a fixed, integrity-pinned hydrator that decodes the
payload into short Blob URLs and applies them through validated CSS custom
properties; it contains no generated, user-authored, or application business
script. The hosted preview permits only that exact script hash and runs it in an
`allow-scripts` iframe without `allow-same-origin`, preserving an opaque origin;
only the canonical Google Fonts stylesheet/font hosts are additionally allowed.

## Project bundles

`web_project` executes the same canonical responsive presentation renderer as
standalone HTML, directly from the validated LayerDoc and responsive FlowPlan.
Framework adapters change component syntax, action binding, and project
scaffolding only; they do not independently reinterpret layout or paint.
`app_project` compiles the same inputs to a renderer-neutral adaptive project
IR for native layout primitives. Neither path parses or translates the final
HTML string. Every project ZIP is deterministic and contains:

- Target-specific source and build configuration for the exact requested profile.
- Vendored, content-addressed raster assets; web projects expose them through
  the stable `/assets/<sha256>.<ext>` runtime namespace and generated source
  does not depend on signed URLs.
- `12ui-project.json`, including the generator revision, canonical profile,
  entrypoints, file media types, byte sizes, and SHA-256 hashes.
- `generation-report.json` with build commands, warnings, and unresolved behavior.
- `interactions.json` with every visual control that needs an application callback.
- `README.md` with target-specific build and integration instructions.

The generator never invents navigation, network calls, or business behavior.
Buttons and links whose intent is not present in the source become explicit
callback/action contracts and are recorded in both reports.

The `profile` multipart field is required for project outputs, forbidden for
all other outputs, and has exactly these fields:

```json
{
  "version": 1,
  "framework": "react",
  "styling": "tailwind",
  "language": "typescript",
  "packaging": "project"
}
```

### Web profiles

| Framework | Styling | Language | Packaging |
|---|---|---|---|
| `html` | `css`, `scss`, `tailwind`, `bootstrap` | `javascript` | `component`, `page`, `project` |
| `react` | `css`, `scss`, `css_modules`, `tailwind`, `bootstrap`, `mui`, `chakra`, `antd`, `shadcn` | `javascript`, `typescript` | `component`, `page`, `project` |
| `next` | `css`, `scss`, `css_modules`, `tailwind`, `bootstrap`, `mui`, `chakra`, `antd`, `shadcn` | `javascript`, `typescript` | `page`, `project` |
| `vue` | `css`, `scss`, `tailwind`, `bootstrap` | `javascript`, `typescript` | `component`, `page`, `project` |
| `nuxt` | `css`, `scss`, `tailwind`, `bootstrap` | `javascript`, `typescript` | `page`, `project` |
| `svelte` | `css`, `scss`, `tailwind`, `bootstrap` | `javascript`, `typescript` | `component`, `page`, `project` |
| `sveltekit` | `css`, `scss`, `tailwind`, `bootstrap` | `javascript`, `typescript` | `page`, `project` |
| `angular` | `css`, `scss`, `tailwind`, `bootstrap` | `typescript` | `component`, `page`, `project` |
| `astro` | `css`, `scss`, `tailwind`, `bootstrap` | `javascript`, `typescript` | `component`, `page`, `project` |
| `lit` | `css`, `scss` | `javascript`, `typescript` | `component`, `page`, `project` |

`component` contains reusable target component source, styling, assets, and the
interaction boundary without claiming an application route. `page` adds the
framework's page or route entrypoint. `project` adds the runnable application
scaffold and build configuration. Next, Nuxt, and SvelteKit deliberately expose
only `page` and `project`; every other web target exposes all three modes.

Framework-native styling profiles emit the selected system's real dependencies,
configuration, and integration boundary. The canonical responsive presentation
continues to own geometry and paint so CSS, SCSS, Tailwind, Bootstrap, Material
UI, Chakra UI, Ant Design, and shadcn/ui profiles render the same design at the
anchor canvas and responsive widths. Provider setup is included where the
system supports it as an opt-in host integration module, but providers and
library component defaults are not applied around the canonical screen because
their global resets would restyle the converted design.

### App profiles

| Framework | Styling | Language | Packaging |
|---|---|---|---|
| `expo` | `native` | `typescript` | `screen`, `project` |
| `react_native` | `native` | `typescript` | `screen`, `project` |
| `flutter` | `native` | `dart` | `screen`, `project` |
| `ionic_capacitor` | `css` | `typescript` | `screen`, `project` |
| `swiftui` | `native` | `swift` | `screen`, `project` |
| `uikit` | `native` | `swift` | `screen`, `project` |
| `jetpack_compose` | `native` | `kotlin` | `screen`, `project` |
| `android_views` | `native` | `kotlin` | `screen`, `project` |
| `compose_multiplatform` | `native` | `kotlin` | `screen`, `project` |

`screen` packages the generated screen, assets, typed callback boundary, and
integration metadata for an existing app. `project` adds the runnable target
scaffold and build configuration. The shared project IR keeps each node's exact
source frame separate from its responsive flow style. Every target renders the
source coordinate system at and above the anchor width. Fixed compositions
scale that complete canvas, including text and nested assets, below the anchor;
responsive compositions switch to the declared target-native flow rules below
it. The targets are not web views, except for the explicitly web-based Ionic +
Capacitor target. Required app font faces are resolved by exact family, weight,
and style; validated against the returned TTF or OTF metadata; and vendored as
content-addressed project assets. Each target registers those files with its
native runtime and selects the exact registered face for every text node. A
missing, corrupt, mislabeled, or unregistrable face fails project generation or
runtime initialization explicitly rather than falling back to a host font.

## Create an export

```bash
curl -sSf -X POST https://12ui.com/api/v1/convert \
  -H "Authorization: Bearer $TWELVE_UI_API_KEY" \
  -H "Idempotency-Key: $(uuidgen)" \
  -F 'layerdoc=@./screen.layerdoc.json;type="application/vnd.12ui.layerdoc+json;version=2"' \
  -F 'output=pptx'
```

Create a React + Tailwind project from that same LayerDoc:

```bash
curl -sSf -X POST https://12ui.com/api/v1/convert \
  -H "Authorization: Bearer $TWELVE_UI_API_KEY" \
  -H "Idempotency-Key: $(uuidgen)" \
  -F 'layerdoc=@./screen.layerdoc.json;type="application/vnd.12ui.layerdoc+json;version=2"' \
  -F 'output=web_project' \
  -F 'profile={"version":1,"framework":"react","styling":"tailwind","language":"typescript","packaging":"project"}'
```

Poll the returned resource with `Accept: application/json`. Once its status is
`succeeded`, request the same resource with the selected result media type:

```bash
curl -sSf https://12ui.com/api/v1/convert/$CONVERSION_ID \
  -H "Authorization: Bearer $TWELVE_UI_API_KEY" \
  -H 'Accept: application/vnd.openxmlformats-officedocument.presentationml.presentation' \
  --output screen.pptx
```

## Format behavior

- SVG preserves semantic group metadata, vector text and supported surfaces,
  and embeds required raster pixels so the file remains self-contained. Fonts
  are referenced by family rather than embedded; viewers may substitute a font
  that is not installed.
- PNG, JPG, and WebP rasterize that same edited export scene at the LayerDoc
  canvas dimensions. Exact font faces are resolved before rendering. PNG and
  WebP preserve alpha; JPG composites transparency over white. Raster exports
  are flattened intentionally, while SVG remains the editable image option.
- PDF preserves the canvas as one page, with supported text and geometry kept
  as native page objects and raster layers embedded at their resolved bounds.
  Generic PDF families use the built-in faces. Declared Google Font faces are
  resolved at their exact weight and italic identity, stored with a content
  hash, checked for every required glyph, and embedded in the file. A missing
  face or glyph fails explicitly rather than substituting or corrupting text.
  Soft surface shadows remain omitted and are reported in the export audit.
- PSD preserves named layers in global paint order and materializes semantic
  groups when their members are paint-contiguous. Rasterized pixels are used
  where the PSD model cannot represent a LayerDoc paint operation directly.
  The locked source reference is the bottom layer, and the stored composite
  preview is rebuilt from that reference plus the same effective paint order.
  Text is deliberately kept as named raster layers because incomplete live-text
  metadata causes Photoshop repair prompts. Visible text/raster transforms are
  baked into those pixels rather than retained as editable transform metadata;
  generated surface rotation/skew and soft surface shadows are omitted and
  reported explicitly.
- PPTX maps the canvas to one aspect-ratio-preserving slide and emits supported
  text, shapes, and images as editable slide objects. Extreme ratios are
  letterboxed within PresentationML slide limits; text skew and CSS shadow
  spread are reported but not encoded.
- Sketch emits a native ZIP document with one page and one anchor-canvas
  artboard, retaining named supported editable objects in paint order. Raster
  corner radii are native masks; LayerDoc text skew is not encoded.

Figma and Canva are not file outputs on this API. Their future plugins consume
the same normalized scene through a signed asset handoff contract; the
registration boundary and continuation points are documented in
[`PLUGIN_HANDOFFS.md`](./PLUGIN_HANDOFFS.md).

The exact HTTP request, operation, result, and error schemas are in
[`convert-v1.openapi.yaml`](./convert-v1.openapi.yaml).
