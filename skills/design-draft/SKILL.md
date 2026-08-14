---
name: design-draft
description: "Required to draft candidate interface designs through the
  hosted create API when a run needs more slots or per-slot control than
  `12ui draft` exposes: claims an idempotent run from a written brief,
  generates one candidate per slot, and downloads the images."
---

# Design draft

## Setup

For a public-directory install, run `npx -y @12ui/design skill install --skill design-draft` once. It pins the CLI and verifies this skill's account scopes.

Buy one small set of candidate designs and keep every one addressable. This
uses the hosted create API through credential-aware `12ui create` commands —
not the local `12ui draft` command, which runs a four-candidate version of the
same flow. Use it for more slots, per-slot references, or tighter direction
control.

## 1. Claim the run

    12ui create claim \
      --concept "<product, audience, surface, goal, personality>" \
      --aspect landscape \
      --candidates '[
        {"slot":"a","direction":"<short direction>"},
        {"slot":"b","direction":"<short direction>",
         "referenceId":"gen-<corpus-id>"}
      ]'

Use `--candidates @candidates.json` for a long list. The concept is at most 600
characters. One run holds 1–96 candidates in slots `a`–`cr`, with one aspect:
`landscape` (1536x1024), `portrait` (1024x1536), or `square` (1024x1024).
Each candidate has a meaningfully different direction and at most one corpus
`referenceId`. Alternatively, add `--reference-image <png|jpeg|webp>` and set
`"useReferenceImage":true` on the slots it should guide. `--mode
preserve-structure` keeps that image's layout; the default is `inspiration`.

The command derives a stable idempotency key from the request, claims the run,
and prints its `id`. Claiming buys nothing.

## 2. Dispatch every slot

    12ui create dispatch <run-id>

Dispatches all unsettled slots concurrently and blocks until they return (up
to about 2.5 minutes each). Add `--slot a,b` to select slots. A failed
candidate is a settled, paid outcome. If the command is interrupted, generation
continues; do not claim another run.

## 3. Follow and download

    12ui create status <run-id>
    12ui create download <run-id> --out-dir <directory>

Status reads durable run state. Download writes every succeeded PNG; add
`--slot a,b` to select slots. Runs expire seven days after the claim. A winner
can seed `12ui branch execute --winner-run <run-id> --winner-slot <slot>`
without re-uploading its bytes.
