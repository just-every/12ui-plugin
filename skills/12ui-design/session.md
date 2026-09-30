# Persistent local workflow

Use one local workspace for related work. The CLI and MCP share the same operation service; choose whichever is available. Neither preparation nor artifact import needs a 12ui account. A session handoff lets this conversation use its native tools without extracting credentials or launching a nested coding agent.

## Prepare and import

Import an existing reference once:

    12ui workflow import <image.png> --workspace <workspace> --media-type image/png --role reference

Use an absolute source path when the file is outside the workspace. Relative imported paths resolve inside the workspace, not the shell's current directory. The returned artifact identifies stored bytes by path, hash, size and media type. Put returned artifact objects in the request's `inputs`; do not invent hashes or use expiring remote URLs as durable input identities.

Write a request JSON file. A new design direction can start with:

```json
{
  "capability": "image",
  "prompt": "Design an editorial architecture homepage with warm materials, clear project navigation and restrained typography. Use the attached references as visual context.",
  "inputs": [],
  "output": { "kind": "image" }
}
```

    12ui workflow prepare <request.json> --workspace <workspace> --key <stable-operation-key>

Preparation returns the persistent operation ID. Reusing the same key with the same request recovers that operation; changed intent needs a new key. Use separate operations for candidates, selected-page expansion, image edits, labels and implementation so dependent work can reuse verified outputs.

`text`, `image`, `image-edit`, `code` and `convert` are distinct capabilities. Output kinds are `json`, `image`, `html` and `project`; JSON may include an output schema. Keep provider credentials, environment dumps and private authentication state out of prompts, parameters and result files.

## Execute in the current session

    12ui workflow execute <operation-id> --workspace <workspace> --providers session --session-capabilities image

Declare the capability of this request only after confirming its tool is available. For an image edit use `image-edit`; for implementation use `code`. A session route returns a handoff with the frozen prompt, input artifacts, expected output, public parameters, work/evidence directories and `attemptNumber`. Keep that attempt number with the returned result or failure; it prevents an old session from settling a newer attempt. Use its selected project directory for implementation; do not edit a different project. This claims the operation before generation. Execute it once using the available native tool, preserve its returned output, and register that output. Do not mistake the handoff for a generated result.

Write a result JSON file using actual existing local files:

```json
{
  "files": [
    { "path": "/absolute/generated-image.png", "mediaType": "image/png", "role": "candidate" }
  ]
}
```

For structured text, use `value` with the requested JSON object. Include `providerRequestId` and `usage` only when actually supplied by the provider; do not estimate missing quota or image price from an account-wide percentage.

    12ui workflow register <operation-id> --workspace <workspace> --attempt <handoff-attempt-number> --result <result.json>
    12ui workflow status <operation-id> --workspace <workspace>

Registration copies and hashes file artifacts. Use the registered artifacts as inputs to the next prepared operation. Continue from this stored state after a restart, conversation change or executor change. Registration and schema validation establish an artifact contract, not visual approval; inspect the image/browser before accepting it for dependent work.

For an `implement` operation, the service records a baseline of the explicit `projectCwd` before the handoff. Make the actual changes in that project, then register a normal result with `value` containing your report and optional `files` for real additional receipts. Registration compares the project with its saved baseline and adds verified project-change evidence and changed-file artifacts automatically. Do not fabricate that evidence JSON or use a provider receipt as proof of implementation. No changed files produces `project_no_changes`; a claimed no-op is not a successful implementation. Report actual browser/test checks separately: verified file changes do not prove those checks passed, and the service does not invent validation evidence.

For a successful recipe plan, prepare its dependent operations deterministically:

    12ui workflow continue <plan-operation-id> --workspace <workspace>

Continue returns `readyOperationIds`, children, verified artifacts and waiting/blocked state. It does not execute models. Execute each ready operation with the intended provider policy, register its result, then continue the same parent plan again. Draft continuation creates candidate image operations; branch continuation unlocks later slots only after their actual dependency artifacts exist. A redesign plan continues to a draft plan, then to its candidate images. Repeated continuation reuses child IDs. Generic prepared requests have no recipe expansion; prepare their next dependent operation explicitly from registered artifacts.

## Provider selection and cost

    12ui workflow capabilities --session-capabilities text,image,image-edit,code

Only declare the subset actually available. Without a session image tool, a Codex or Claude text CLI is not an image provider. Default routing considers session, Codex, Claude, OpenAI and 12ui in order, filtering for the requested capability and explicit funding permission. Limit `--providers` when a particular execution boundary is required.

Subscription execution consumes the user's model allowance and local resources. OpenAI API execution requires its key and authorization; 12ui execution requires its service credentials and authorization. Set `--allow-paid openai` or `--allow-paid 12ui` only when the user has authorized that provider's spend for this work. A configured key alone does not authorize either. Preparation does not imply authorization for later paid fallback.

The OpenAI adapter requires an explicit account-available model: set public `parameters.model` on a generic request, or use `OPENAI_MODEL` for text/generated HTML and `OPENAI_IMAGE_MODEL` for images. `OPENAI_API_KEY` and `TWELVE_UI_API_KEY` identify separately funded routes; never put keys in requests or results. Native subprocesses remove API-key/provider overrides from their environment. Codex text/code execution is unavailable unless the user trusts their existing CLI configuration, including configured tools and hooks: pass `--trust-codex-config` on execution or discovery only with that authorization. Its read-only text sandbox does not isolate remote tool effects. This opt-in is independent of paid-provider authorization and is unnecessary for the current session's tools. Claude uses supported safe mode, empty MCP configuration and a fixed file-tool set for code; it cannot run shell tests, and its text path currently rejects image attachments. Run project checks in the parent session. Use the session for visual planning, labels and review when it can inspect images. OpenAI code produces HTML without running a project; 12ui code uses its conversion path. Neither is an implementation executor for an existing project.

An unavailable provider can be skipped before dispatch. After a dispatch, a failure is not permission to buy the same work elsewhere. Follow the saved failure disposition: only a recorded proof of non-dispatch or a terminal no-output failure can make another provider eligible. An ambiguous outcome stays in reconciliation; preserve it and recover the actual result before any new dispatch. Do not clear state, change the key or repeatedly execute a handoff to work around this boundary.

If a session tool refuses, is denied permission or has an uncertain outcome, preserve that evidence and record a failure JSON containing `code`, `message` and `disposition`:

    12ui workflow fail <operation-id> --workspace <workspace> --attempt <handoff-attempt-number> --failure <failure.json>

Use `terminal-stop` for refusals or permission denials and `ambiguous` when dispatch/output is uncertain. Neither permits fallback. Use `not-dispatched` or `terminal-no-output` only with actual evidence establishing that outcome; elapsed time, a missing screenshot or a new session is not proof. An ambiguous operation can be completed by registering its recovered original result, not by downgrading the failure to enable another call.

An accepted hosted job with a failed download, or a completed response whose output is malformed, remains in reconciliation under its original operation and attempt. Recover the original provider output and dependencies, validate them and register them against that same attempt. Keep provider IDs and retained responses; do not regenerate or switch providers to repair a delivery failure. Refusals and permission denials remain terminal stops.

## Recipes and MCP

Workflow recipes prepare the same persistent operations. They are request builders, not a hosted pipeline or a guarantee that images/code have already been generated.

| Recipe | Input JSON | Prepared work |
| --- | --- | --- |
| `draft` | `concept`, optional `candidates`, `references`, `retain`, `content`, `aspect` | Text plan of distinct candidate prompts; continue it to prepare image operations. |
| `branch` | `concept`, approved `source`, optional `scope`, `maxScreens`, `references` | Text plan of pages and ordered viewport slots; preserve the existing root and generate only additional slots. |
| `edit` | `source`, `prompt`, optional `references`, `quality` | Image edit of the first source. |
| `redesign` | `source`, `direction`, optional `references` | Text concept/retain/corpus-query plan; image generation and implementation are subsequent operations. |
| `labels` | `source`, optional `context` | JSON labels and proposed interactions; not working behavior. |
| `review` | `source`, optional `target`, `context`, `criteria` | Evidence-based visual findings and limitations; no numeric quality score, runtime verification or automatic repair. |
| `convert` | `source`, optional `prompt`, `output`, `native` | Editable HTML/code by default. LayerDoc requires explicit native conversion and its supported provider. |
| `implement` | absolute existing `projectCwd`, `targets`, optional `prompt` | Code changes in that selected project; preserve source changes and verify real behavior. |

Image paths inside recipe JSON and file paths inside result JSON are relative to the workspace unless absolute. The JSON specification/result file passed to the CLI itself is read relative to the shell's current directory. For example, save `{"concept":"An editorial architecture homepage","candidates":4}` as the draft specification:

    12ui workflow draft <draft-spec.json> --workspace <workspace> --key <draft-plan-key>

Execute that operation with a text-capable session, register the JSON plan, and continue it to obtain stable candidate operation IDs. Inspect candidate images before selecting one for branch or implementation. Check installed help before relying on optional fields; generic `prepare` remains available for an explicit request.

## Capture, review and portable output

Capture a running local or public page with local Chromium:

    12ui workflow capture <http-or-https-url> --workspace <workspace> --width 1440 --height 900 --full-page

This stores screenshot, DOM and manifest artifacts without model work. It uses a fresh unauthenticated browser, not the user's signed-in browser profile. Inspect `requestedUrl`, `capturedUrl` and `redirected` plus the actual image before treating it as application evidence. For an authenticated interface, capture with an available authorized session browser and import that screenshot instead. Chromium must already be available locally.

Prepare a review specification with current screenshot `source`, optional approved `target` and `criteria`:

    12ui workflow review <review-spec.json> --workspace <workspace> --key <review-key>

Execute and register its findings like any text operation with image inputs. A screenshot review cannot prove route behavior, accessibility-tree semantics or tests. Use actual browser and project tools for those checks; prepare only justified corrections after inspection.

For session-generated HTML, register the entrypoint and every asset with their original relative paths. For example:

```json
{
  "files": [
    { "path": "/absolute/generated/index.html", "mediaType": "text/html", "role": "entrypoint", "relativePath": "index.html" },
    { "path": "/absolute/generated/assets/style.css", "mediaType": "text/css", "role": "asset", "relativePath": "assets/style.css" }
  ]
}
```

Preserve image, font, script and stylesheet mappings; copying only the HTML can break its references. The SDK's `collectBundleFiles(directory, entrypoint)` returns mapped file entries for an isolated generated-output directory; register those entries through the same operation service. Never collect a whole existing project checkout or credential directory. Project changes stay in the selected project; provider receipts alone are not a portable project.

    12ui workflow export <operation-id> --workspace <workspace> --destination <new-output-directory>

Export verifies stored bytes and retains the logical paths. A new or empty directory is required; an identical previous export is reused and differing existing files are refused. Export does not execute a model, convert to another native format, publish a site or validate browser behavior.

## Prototype interaction labels

For an existing converted branch, prepare labels from its actual DOM candidates and known destinations:

    12ui prototype <run-dir> --labels workflow --workspace <workspace>

This performs local browser inventory/analysis and returns `awaiting_labels` with stable operation IDs. It does not dispatch a model or read hosted credentials. Execute each prepared operation through the shared workflow service with an available text provider, then register its JSON using the handoff's attempt number. For a dispatched/reconciling operation, recover its existing result instead of executing again. Repeat the same prototype command once those operations succeed; it consumes the exact completed results and runs the normal build/runtime gates. Legacy branch resume will not replace an `awaiting_labels` pause with hosted label calls.

These operations freeze the real candidate IDs, screen, destinations and source HTML/plan/completion evidence. Generic image `workflow labels` annotations cannot be substituted. Each candidate requires exactly one supported action; unknown navigation targets, duplicate IDs and contradictory payloads are rejected before success. Ambiguous controls should be `none`; local-page outputs permit only navigation to known real pages or `none`. Existing links/forms and deterministic rules retain precedence. A prototype dialog demonstrates behavior; it does not execute a backend task.

For converted branches, a semantic dropdown may label any evidenced menu trigger, regardless of its analyzer kind. Registration preserves the supplied option strings. The existing builder normalizes and deduplicates them; fewer than three usable choices produce an inert control with a recorded `dropdown_options_incomplete` degradation.

The prototype manifest records source custody, operation IDs, provider, funding and reported usage. Its label `costMicros` counts only new hosted prototype-label calls; zero there does not imply free workflow model execution. Repeating preparation or moving the saved branch/workspace preserves IDs when the bound source content and candidate facts are unchanged. The source binding covers HTML, plan, completion and candidate facts, not a snapshot of every remotely linked asset.

Standalone prototype still defaults to `--labels none`. Explicit `--labels 12ui` selects the older hosted per-screen route; it is separate from these local workflow operations.

## Verified native LayerDoc

Native LayerDoc registration requires a canonical public LayerDoc v2 document with role `layerdoc` and `relativePath: "document.layerdoc.json"`, a role `layerdoc-assets` sidecar mapped to `layerdoc-assets.json`, and every referenced raster as a mapped role `asset` file. The sidecar uses schema `12ui.layerdoc-assets.v1`; its `assets` maps each canonical `artifactId` to `{path, sha256, mediaType}`. Paths identify retained local bytes. All files need portable relative mappings, and hashes, media types and declared pixel dimensions must agree with those bytes. Keep canonical artifact identities; do not insert invented URLs or relabel arbitrary JSON as LayerDoc.

Read a completed native operation locally:

    12ui workflow layerdoc <operation-id> --workspace <workspace>

The SDK equivalents are `loadWorkflowLayerDoc({workspace, operationId})` and, for a relocated exported directory, `loadLayerDocBundle({directory})`. They return the canonical `document`, absolute `documentPath` and `manifestPath`, plus `assets` keyed by artifact ID with verified local `path`, `relativePath`, `sha256` and `mediaType`. Raster dimensions are validated against the document. This is a verified local reader contract, not an offline editor or a new conversion.

The standard hosted `12ui convert <layerdoc.json>` path does not consume this sidecar bundle. It requires supported hydrated HTTP asset references; uploading local assets and hydrating those references needs a separate API path that is not supplied by the reader. Do not upload the raw canonical JSON alone and claim its local assets will follow.

The MCP equivalents are `design.workflow.prepare`, `design.workflow.execute`, `design.workflow.register`, `design.workflow.continue`, `design.workflow.fail`, `design.workflow.status`, `design.workflow.import`, `design.workflow.capabilities`, `design.workflow.capture`, `design.workflow.export` and `design.workflow.layerdoc`. Recipes use `design.workflow.prepare` with `recipe` and `input`; registration and failure use the handoff's `attemptNumber`. MCP execution and discovery accept `trustCodexConfig` for the same explicit Codex configuration trust boundary. Use the tool's supplied schema. They call the same service and obey the same provider authorization, custody and reconciliation rules as the CLI. Do not log into 12ui merely to prepare, inspect or register local operations.
