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

Buy one small set of candidate designs and keep every one addressable. Use
this when the run needs more than the four candidates `12ui draft` produces
in one step, a corpus reference or direction per slot, or tighter control
over what each slot explores.

    12ui create claim --concept "<product, audience, surface, goal, personality>" \
      --candidates '[{"slot":"a","direction":"<short direction>"},
                     {"slot":"b","direction":"<short direction>",
                      "referenceId":"gen-<corpus-id>"}]'
    12ui create dispatch <run-id>
    12ui create download <run-id> --out-dir <directory>

Each command prints the next; `12ui next <run-id>` reports what is still
generating, and `--wait` blocks until every slot settles.

The judgement is the brief and the slots. One aspect covers the whole run —
`landscape` (1536x1024), `portrait` (1024x1536), `square` (1024x1024) — and
directions must be meaningfully different from each other, since four
paraphrases of one idea buy four of the same design. A slot takes at most one
reference: `referenceId` names a corpus reference, or `"useReferenceImage":
true` conditions it on the run-level `--reference-image`, whose
`preserve-structure` mode keeps that image's layout. A run holds 1-96
candidates in slots `a`-`cr` and expires seven days after the claim.

A candidate that comes back `failed` is a settled, paid outcome rather than a
transient error. A winning candidate seeds a branch run as
`--winner-run <run-id> --winner-slot <slot>` without re-uploading its bytes.
