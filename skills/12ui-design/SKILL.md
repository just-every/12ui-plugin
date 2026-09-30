---
name: 12ui-design
description: "Design interfaces with 12ui, expand an approved screen into pages or app states, convert design images into editable code and assets or into a live 3D / Three.js scene, and improve existing applications. Use for non-trivial UI creation, image-to-code, and visual redesign."
---

# 12ui Design

If the `12ui` CLI is not present, run `npx -y @12ui/design cli install` once. Check `12ui workflow --help` for the installed persistent-workflow surface. Use the current coding session's available tools first: 12ui records the operation, its inputs, provider choice and returned artifacts; the session performs the requested design work.

Read [session.md](session.md) before starting. The durable sequence is **prepare → execute → register → continue**. Prepare freezes a request without inference. Execute selects an eligible provider or returns a session handoff. Perform that handoff with the actual tools available in this session, then register the real result. Continue a successful recipe plan to prepare its dependent operations; execute those explicitly. Keep the workspace and operation ID across interruptions; inspect status before continuing.

Declare only session capabilities you can actually use. Prefer session execution, then eligible subscription CLI execution, then an explicitly authorized OpenAI API route, then an explicitly authorized 12ui route. Subprocess image capability is not inferred. Codex child execution requires explicit trust in its configured tools and hooks; Claude uses supported safe mode and currently accepts no image attachments for text. Key presence is not permission to spend. Do not fall back or start a new operation after an uncertain dispatch; reconcile the saved operation. Read [outputs.md](outputs.md) for native-format and legacy-engine boundaries.

## 1. Draft

Use the brief to explore composition, hierarchy, typography, imagery and distinct directions. Retrieve relevant design references when useful; [inspire.md](inspire.md) covers the design DB. Keep the complete brief in the workflow prompt and carry local references as imported artifacts.

Prepare an image operation for each meaningful direction, usually four for an open brief. Execute through the session's native image tool when available and register each actual image. Image generation is a model operation; do not substitute CSS drawings or a screenshot of hand-written markup for requested design imagery. Independent directions can run in parallel with separate stable operation keys.

Inspect real images, choose the strongest fit or present a meaningful choice to the user, and preserve the selected artifact and rationale. A prepared operation or a provider completion alone is not an approved design.

To let the user choose, open the design workspace on the draft run: call `design.slate.show` with its run directory when the `design.slate.*` tools are available. Otherwise run `npx -y @12ui/design workspace open <run-dir> --wait` (`12ui workspace open <run-dir> --wait` when the installed CLI has that command). It first prints the page's address, then blocks until the user decides; if the sandbox blocks its local page server (a listen or write error), rerun the same command with approval to run outside the sandbox, because it needs a local port and the 12ui state folder. Tell the user in one line to choose in that page. Then stay in this turn until the decision arrives, because ending your turn ends the wait: run the command in the background and read its output every 20 seconds or so (sleep, then read), or give it the longest timeout your shell allows. Continue from the JSON decision it prints.

## 2. Branch

Expand the selected image into the pages or states the deliverable needs. Keep its visual system while preserving each page's real content and purpose. Record an operation for each expansion, with the chosen image among its inputs.

Ordered viewports of one continuous page remain regions of that page. Complete application states belong to separate pages; recurring shells must not be stacked into a long document. Inspect every generated page/state and its mapping before implementation. Labels and navigation proposals are separate text operations when needed, not an automatic paid service requirement.

## 3. Convert

For a finished design image, prepare the requested conversion directly. Use available session image editing for independent artwork and the coding tools for editable HTML/CSS or the requested framework. Register the output files and material uncertainties. Preserve live text and independent asset ownership; a full-page raster is not editable implementation.

The workflow ledger records what an executor produced; it does not itself reconstruct a LayerDoc, render a page or prove fidelity. Native LayerDoc and its design exports require the dedicated conversion path described in [outputs.md](outputs.md). Do not relabel HTML or arbitrary JSON as LayerDoc.

## 4. Integrate and close

Implement against the selected original image in the owning project. Preserve framework, routes, data, controls and tests. Reuse generated assets. For an existing application, read [improve.md](improve.md).

Inspect the real browser after content and behavior are in place, at relevant wide and narrow widths and through important transitions. Compare each region/state with its original approved image. Correct concrete mismatches in the source and re-render; use a new recorded image edit only when artwork actually needs changing. Keep originals and record the result. Do not impose an automatic broad judge/repair loop.

Deliver openable code and assets, the persistent workspace/operation references, checks performed and observed limitations. State when rendering or behavior remains unverified.

## 5. Search

Use the design DB when reference imagery is the deliverable or helps ground a design. Follow [inspire.md](inspire.md); preserve ranked manifest order and retrieval evidence. Corpus retrieval is a service boundary separate from local generation and implementation.

## 6. Improve

Capture and inspect the existing interface locally. With an approved target, prepare implementation work against that image and edit the actual application. For a new direction, prepare redesign image operations from the current capture, inspect the candidates and record the pick before implementation. The pick is mandatory when generating candidates; a design operation alone does not complete the application change.

Keep real claims, data, offers, controls and behavior even where the target abbreviates them. [improve.md](improve.md) carries the detailed preservation and inspection guidance, plus explicitly selected legacy CLI and hosted-kit routes. These older commands are alternatives, not the default inside a capable coding session.

## 7. 3D scene

When asked to recreate a design image as a live 3D or Three.js scene, with real geometry, light, and interactions rather than a projection of the picture, read [scene.md](scene.md). It uses the local `12ui scene` tools, which need no account and make no network request:

    12ui scene init <scene-dir>
