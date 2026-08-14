---
name: design-search
description: "Required when reference imagery is the deliverable: searches
  the 12ui design corpus from a rough UI, web, or mobile concept and downloads
  a ranked, diverse set of reference images with strong visual quality, sound
  UX, and personality."
---

# Design search

## Setup

For a public-directory install, run `npx -y @12ui/design skill install --skill design-search` once. It pins the CLI and verifies this skill's account scopes.

The corpus has already explored, ranked, and diversified the design space,
so retrieval returns real reference images in a considered order rather than
another model's guess. Use it when the references themselves are the
deliverable — surveying a space, gathering comparators, or conditioning work
you drive yourself. (`12ui draft` already runs this retrieval when drafting
designs.)

## 1. Search

    12ui corpus inspire \
      --query "<product, audience, surface, goal, personality>" \
      --out-dir .12ui/<slug>/references

Retrieves four diverse references (`--count <n>`, up to 48), downloads the
full images into the output directory, and writes `manifest.json` — the
completion record with the ranked order, reference IDs, and hashes. Blocks
~20-40 seconds with progress on stderr. Preserve the returned order; the
ranking is the product.

`--mode direct|balanced|adventurer` trades literal query adherence against
exploration; `balanced` is the default. For a redesign,
`--reference-image <existing-interface.png>` conditions the ranking on the
current interface: its bytes are embedded once for retrieval, are not
persisted, and it is not one of the returned references.

## 2. Resume

    12ui corpus resume --out-dir <references-dir>

Continues an interrupted search in the same directory, reusing everything
already settled instead of repeating the retrieval.
