---
name: design-convert
description: "Required to turn a finished PNG, JPEG, or WebP design into
  production output: converts it once into a structured LayerDoc, then derives
  responsive HTML, web or native app code, PDF, PSD, PPTX, Sketch, SVG, PNG,
  JPEG, or WebP from that one conversion."
---

# Design convert

## Setup

For a public-directory install, run `npx -y @12ui/design skill install --skill design-convert` once. It pins the CLI and verifies this skill's account scopes.

Convert one finished image once, keep its base LayerDoc conversion, and
derive every required format from that structured source — near-pixel
fidelity, faster and truer than recreating the design by hand.

## 1. Convert

    12ui convert <source-image> --export html

Converts the image to a LayerDoc and exports responsive HTML alongside it in
one blocking command, which is faster than converting and then exporting.
The result carries the conversion under `id` and the export under `export.id`.

## 2. Export more formats

    12ui export <conversion-id> --output html_fixed,svg,pdf \
      --out-dir <dir> --idempotency-key <stable-key>

Derives further formats from the finished conversion without repeating
extraction, and independent exports run in parallel. Outputs: `html`,
`html_fixed`, `svg`, `png`, `jpg`, `webp`, `pdf`, `psd`, `pptx`, `sketch`,
`web_project`, `app_project`. Reusing the same key replays a finished export
instead of buying it again. Project outputs take a profile matching the
target project:

    --web-profile '{"version":1,"framework":"react","styling":"tailwind","language":"typescript","packaging":"page"}'
    --app-profile '{"version":1,"framework":"expo","styling":"native","language":"typescript","packaging":"screen"}'

## 3. One page, one package

Ordered viewports of one continuous page are one package conversion, not one
convert per image — separate conversions lose page order and stitching:

    12ui convert package --manifest <package.json> --out-dir <dir>

The manifest names each page and its ordered viewport images, with paths
relative to the manifest; independent routes are separate page entries:

    { "version": 1, "output": "html", "pages": [
      { "id": "home", "viewports": [
        { "id": "a", "image": "screens/a.png" },
        { "id": "b", "image": "screens/b.png" } ] } ] }

Writes `<out-dir>/<page-id>.html` per page plus `package.result.json`. A
viewport may carry `"sourceConversionId": "<id>"` to reuse an already
succeeded conversion of the same bytes for free.

## 4. Integrate

The exported HTML is the page: keep its document, structure, and bindings,
and build the surface around it — routing, real copy, state, interactions —
rather than mining it for assets and re-authoring the markup around them.
