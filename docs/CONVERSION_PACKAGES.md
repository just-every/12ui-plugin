# Conversion packages

`POST /api/v1/convert/package` turns an ordered page/viewport structure into
one final conversion per page. It is the batch composition layer for clients
such as Design Lab's branch system; it does not import or depend on Design Lab
types.

Every viewport supplies a screenshot. It may also supply a canonical public
LayerDoc v2 with every exact raster asset referenced by that document. Viewports
without a LayerDoc run as independent image-to-LayerDoc conversions in
parallel. Supplied LayerDocs are canonically republished through the ordinary
conversion pipeline so every downstream input has one owned artifact set.

The multipart request contains one `manifest` JSON part, repeated `screenshot`
parts, and optional repeated `layerdoc` and `asset` parts. Each multipart
filename is an opaque, package-global part id. The manifest references those
ids explicitly; page structure is never inferred from a filename or upload
order. A supplied LayerDoc maps its document-local artifact ids to
package-global asset part ids. The mapping is required so coordinator retries
never depend on expiring signed URLs.

```json
{
  "version": 1,
  "source": {
    "kind": "design-lab-branch",
    "project_id": "branch-project-1",
    "revision": 42
  },
  "output": "layerdoc",
  "model": "standard",
  "pages": [
    {
      "id": "home",
      "ordinal": 0,
      "kind": "source",
      "title": "Home",
      "path": "/",
      "viewports": [
        {
          "id": "hero",
          "ordinal": 0,
          "screenshot_part": "shot-home-hero",
          "layerdoc": {
            "part": "doc-home-hero",
            "assets": { "source": "asset-home-hero-source" }
          }
        },
        {
          "id": "features",
          "ordinal": 1,
          "screenshot_part": "shot-home-features"
        }
      ]
    }
  ]
}
```

## Durable execution

The package coordinator owns orchestration only. Viewport extraction and final
page export are ordinary conversion runs, so they retain the existing stage
leases, paid-effect identities, request ids, cost accounting, artifact
integrity, and retry behavior.

1. Convert or republish every viewport to LayerDoc in parallel.
2. Require one common LayerDoc width within each page.
3. Build a real row-streamed vertical PNG source for each page.
4. Shift every node, namespace every raster artifact, and rebuild contiguous
   global paint order.
5. Detect only repeated semantic header/nav/footer groups and conservatively
   normalize equivalent typography. Fitted text and raster layers are not
   changed.
6. Start one ordinary LayerDoc-input conversion per page in parallel for the
   requested LayerDoc, HTML, fixed, or project output.

No screenshot or LayerDoc is fabricated. Unequal widths, invalid or missing
assets, child failures, a canvas above 10,000 pixels per side, or a joined
source above the 8-megapixel asset limit produce explicit terminal failures.
Screenshot dimensions are validated independently and do not need to match a
supplied LayerDoc canvas; composition uses that LayerDoc's exact source
artifact. Clients must place a branch root at the first viewport ordinal of its
source page and preserve stable page and viewport ids across retries.

Poll `GET /api/v1/convert/package/{id}`. A successful operation lists stable
page URLs at `GET /api/v1/convert/package/{id}/pages/{pageId}`. Each page URL
redirects to its ordinary conversion, so `Accept` negotiation and result bytes
stay identical to the single-page API.

## Unified HTML site artifact

Existing `output: "html"` manifests retain the original independent per-page
result behavior. A manifest becomes a unified static website contract only
when it explicitly includes `"site": {"version": 1}`. In that mode every page
must declare `kind`, `title`, `purpose`, and a canonical unique `path`. There
must be exactly one `kind: "source"` page at `index.html`; additional routes
use lowercase directories such as `features/index.html`. Absolute paths,
aliases, traversal, duplicate paths, and arbitrary `.html` filenames are
rejected at admission. The `site` marker is accepted only with `output:
"html"`; page `navigation` is accepted only in this explicit mode.

```json
{
  "version": 1,
  "output": "html",
  "site": { "version": 1 },
  "pages": [
    {
      "id": "home",
      "ordinal": 0,
      "kind": "source",
      "title": "Home",
      "purpose": "Introduce the product.",
      "path": "index.html",
      "navigation": [
        { "layer": 12, "target_page_id": "features" }
      ],
      "viewports": [
        { "id": "desktop", "ordinal": 0, "screenshot_part": "home-desktop" }
      ]
    },
    {
      "id": "features",
      "ordinal": 1,
      "kind": "additional",
      "title": "Features",
      "purpose": "Explain the product features.",
      "path": "features/index.html",
      "viewports": [
        { "id": "desktop", "ordinal": 0, "screenshot_part": "features-desktop" }
      ]
    }
  ]
}
```

Page children still run in parallel. After every page HTML conversion succeeds,
the coordinator verifies each exact child result and builds one deterministic
ZIP. The archive contains only the declared HTML paths and
`site-manifest.json`, whose version 1 shape is
`{version, entrypoint, pages:[{id, ordinal, title, path}]}`. The assembler sets
the document title and description, guarantees `html[lang]`, UTF-8 charset,
and responsive viewport metadata, deduplicates repeated metadata declarations,
binds declared `data-x` actions, and adds accessible relative navigation to
every declared page. The manifest navigation is a viewport-fixed, high-contrast horizontal
rail with bounded width and horizontal scrolling, so full-height or
overflow-clipped page layouts cannot hide routes or force document-level
horizontal overflow.

### Generated navigation neutralization

Generated page HTML is complex model output, so a defect in it never discards
the paid conversions of the sibling pages. Declared manifest navigation is
admitted, validated user intent and always wins: a `data-x` layer whose
generated anchor points somewhere else is rewritten to its declared
destination. Anything the assembler cannot honour is neutralized per element
instead of failing the package:

| Case | Outcome |
| --- | --- |
| Declared layer landed on an element no link can be published on | The declared action is dropped; the element is published presentational |
| Two generated elements claim the same declared layer | The first is bound; the duplicate falls back to ordinary anchor handling |
| Declared layer carries a real authored href pointing elsewhere | Rewritten to the declared destination; the discarded href is recorded |
| Declared layer is absent from the generated HTML | Recorded; the rest of the page is published unchanged |
| Authored anchor keeps a placeholder destination (`href="#"` or none) | Destination stripped; the element is published presentational |
| Authored anchor points outside the supported route and link policy | Destination stripped; the element is published presentational |

A neutralized anchor keeps its text, classes, and inline geometry, loses
`href`, `target`, `rel`, `download`, `ping`, `referrerpolicy`, `hreflang`, and
`type`, and is then published with the same
`data-12ui-presentational-control` marking and inline
`pointer-events:none;cursor:default;opacity:.55` styling already used for
undeclared authored controls. Every declared page stays reachable from every
page through the navigation rail, so a neutralized anchor degrades one
affordance rather than the website.

Each neutralization is durable operator evidence, never a user-visible error.
The assembler attributes every neutralization to the page it came from, and
publication writes one `publish`-stage
`package_site_navigation_neutralized` review warning plus its matching
`stage.normalized` event against that page's own child conversion — the
conversion the package result already exposes as `conversion_id`. The warning
carries per-reason counts, the page id and path, the package id, the full
neutralization list (reason, layer, href, label), and evidence digests of the
exact generated page HTML and the published ZIP. Both writes deduplicate on the
warning fingerprint, so a coordinator that re-enters publish records once.

### Duplicate document metadata deduplication

Generated page HTML sometimes declares its charset, viewport, or description
more than once. That is a recoverable representation defect, not a structural
one, so the assembler canonicalizes instead of parking: the first declaration
in document order is kept and normalized to the canonical form the assembler
already enforces on every page (`utf-8` charset, `width=device-width,
initial-scale=1` viewport, the declared page purpose as description), and
every later duplicate is dropped. Because the kept element's attributes are
forced to those canonical values, a dropped duplicate cannot carry meaning the
published page loses — a page with duplicates deduplicates to exactly the
bytes its single-declaration twin produces.

Each deduplication is recorded through the same durable channel as navigation
neutralizations, under the distinct code `package_site_metadata_normalized`
(revision `package-site-metadata-normalization-v1`, disposition
`deduplicated-document-metadata`) — distinct so a warning about unpublishable
generated actions is never mixed with a head canonicalization during triage.
Publication writes one `publish`-stage review warning plus its matching
`stage.normalized` event against the page's own child conversion, carrying
per-kind counts, the dropped declarations' values, the page id and path, the
package id, and evidence digests of the exact generated page HTML and the
published ZIP. Both writes deduplicate on the warning fingerprint, so a
coordinator that re-enters publish records once.

Site assembly parks only when the site would be structurally unusable: no
pages, a missing or duplicated `index.html` entrypoint, a duplicate page id or
path, a non-canonical path, page bytes that are not decodable UTF-8 HTML with
exactly one `html`/`head`/`body`/`title`, or an archive that exceeds the
deterministic memory boundary.
Manifest validation is unchanged and still rejects a malformed request with a
4xx at submission — including ambiguous page titles, which is why the
label-binding ambiguity check inside the assembler is an unreachable
contract-level invariant rather than a recoverable model defect.

A successful package operation exposes:

```json
{
  "result": {
    "kind": "package",
    "media_type": "application/vnd.12ui.package+json;version=1",
    "pages": [
      {
        "id": "home",
        "ordinal": 0,
        "title": "Home",
        "path": "index.html",
        "conversion_id": "conversion-id",
        "href": "https://api.example/api/v1/convert/package/package-id/pages/home",
        "media_type": "text/html"
      }
    ],
    "artifact": {
      "href": "https://api.example/api/v1/convert/package/package-id/result",
      "media_type": "application/zip",
      "size_bytes": 12345,
      "sha256": "64-lowercase-hex-characters"
    },
    "common_components": 0,
    "normalized_typography_fields": 0
  }
}
```

`GET /api/v1/convert/package/{id}/result` is authenticated and owner-scoped.
It returns 400 for a package that did not request the site marker. Before
returning a requested ZIP it verifies the canonical package storage key, media
type, byte length, stored digest metadata, and computed SHA-256. It returns 202
with the current operation while work is active, 410 after expiry, and a
structured failure instead of serving missing or corrupt bytes.

## Child retries resume the same conversion

Retryable child failures are reconciled within the same package identity, and
each retry re-drives the **same child conversion id**. Nothing is detached and
no replacement conversion is minted, so the child's succeeded stage records,
paid effects, provider-cost ledger, artifacts, quota admission, and settled
usage accounting are all reused and only the failed stage re-runs. Successful
sibling conversion ids are untouched. This is the ordinary conversion resume
path: the coordinator picks the first stage that is not `succeeded`, and the
paid-effect identity refuses to re-claim an effect that already succeeded.

A failed child is re-driven only when both of these hold:

1. The failure is attributed to one of the child's stages. A run-scoped
   failure (no error stage) names a property of the admitted run itself — its
   pipeline revision — which re-driving the same id cannot change.
2. Its recorded problem code is an infrastructure or provider class
   (`service_unavailable`, `provider_unavailable`, `rate_limited`,
   `local_worker_restarted`), or the terminal record explicitly declared
   itself retryable. Every other code — invalid input, an unsupported or
   too-complex export, an invalid LayerDoc, a parked conversion, a policy
   refusal — is decided by the child's own input and would fail identically,
   so it propagates as a terminal package failure.

Re-admission is one durable compare-and-set on the package child's
`retry_attempt` counter, which also bounds the retry count (5 per child; runs
minted by the previous mint-new lane still count against the same budget). A
losing concurrent coordinator pass writes nothing, so a replayed package create
cannot double-retry. The re-admission clears the child's error fields, resets
only its failed stage rows to `queued` at attempt 0, leaves `running` stage
leases to the conversion coordinator's own stale-lease recovery, clears the
evaluation case's first terminal snapshot so the resumed run can record its
real outcome, and writes a `conversion.package_child_retry_admitted` event.
Settled usage accounting is deliberately left settled: cost incurred after
settlement is already reconciled by the provider-cost ledger, while reopening
it would re-credit the whole conversion.

Because the child stays attached, its `conversion_id` in the package operation
is stable for the life of the package, and its reported status can move from
`failed` back to `queued`. A child inside its retry budget never fails the
package, even on a pass where its re-admission is refused (for example while
its evaluation archive is capturing); the coordinator polls again.

An attempt-scoped child idempotency key (`…:a:N`) still exists for the one case
that genuinely needs a new child identity: a child that was admitted and then
failed terminally before its attachment landed.

Replaying the same package idempotency key can resume a retryable package
failure without admitting a new package.

Version 1 accepts at most 32 pages, 64 total viewports, and a 64 MiB multipart
body. The request fingerprint covers the canonical manifest, every screenshot,
stable LayerDoc content, and uploaded asset bytes.
