# Rebuild a design image as a live 3D scene

Use this when asked to recreate a design or concept image (hero shot, product on a surface, landing-page render,
illustrated scene) as a live Three.js scene with real geometry, materials, light and a few interactions, not a
projection of the picture. Solve the camera from landmarks, model the objects, then check the result from the source
camera and from 15 degrees either side. Everything runs on this machine through `12ui scene`: no account, no model
call, no network. `12ui scene --help` lists the tools and `12ui scene <verb> --help` explains each one.

## The rule

- **Model the objects.** Boxes, slabs, lathes, extrusions, instanced detail, procedural textures, physical materials,
  real lights and shadows. If it is solid in the picture it is solid in the scene.
- **Use the source image only as a reference** for colour, layout and mood, and as a texture on **flat printed things**
  (a screen, a label, a poster, a sleeve print). Never paint the whole picture onto geometry, and never bake shading
  or a reflection into a texture that should be lit.
- **It must hold at +-15 degrees and beyond.** You are trading some landing-view exactness (proportions, exact colour,
  a display font) for a scene that is real from every angle. That is the point. Say so in your report.
- **Everything is modelled procedurally.** There is no image-to-mesh step: a box, lathe, extrusion or instanced
  field covers the objects a design image shows.
- Budget 12 to 20 render passes. Stop when passes stop improving the worst mismatch.

## Setup (once)

Work in one folder, with the source image copied into it:

    12ui scene init <scene-dir>
    12ui scene serve <scene-dir> --port <port>

`init` writes the starter (`index.html`, `camera.js`, `scene.js`, `lib.js`, `gobo.js`, `main.js`) and three.js r186 in
`vendor/` (no build step, an importmap), and refuses to overwrite anything already there. `serve` binds 127.0.0.1 and
prints its PID; stop it by that PID when done, never by a name pattern.

The starter already gives you the renderer, tone mapping, the solved camera, a contain-fit frame, orbit about a pivot,
click-to-toggle actions, and the capture contract (`window.__ready`, `window.__scene.{actions,setOrbit,setAction,reset,render}`).
`buildScene(scene, renderer, camera)` gets the renderer (PMREM env maps) and camera (gobos, overlays).
You write `scene.js` (split into modules by object once it grows: `box.js`, `floor.js`, `textures.js`, `actions.js`).
Page text and buttons are real DOM inside `#stage`, positioned in source pixels.

## 1. Camera first

Everything else is placed through the camera, so solve it before modelling anything.

1. Read the source at full size. Pick **6 to 8 landmarks**: corners of the most clearly rectangular objects (a box, a
   screen, a table edge, a sleeve, a book), read to the pixel. Include at least one landmark off the main plane, or
   the field of view is ambiguous. Read them yourself from the image; zoom crops help. If a landmark residual is
   large later, you misread it.
2. Write `spec.json` and solve (`12ui scene solve --help` has the format). World coordinates are yours: choose a
   unit (an object height of 1, or a floor at y = 0), let unknown dimensions be `free`, pin a scale with `"fix"`.

       12ui scene solve spec.json --out cam.json

   rms should be 1 to 4 px. Roll is pinned to 0 unless you set `"solve_roll": true`. Read the `warnings` and
   `fovSensitivity`: flat-lay and table shots are near top-down and coplanar, where fov is not determined by
   landmarks. Pin it (`"fix": {"fov": 35}`; 20-30 product shot, 35-50 normal, 60+ wide) or add an off-plane landmark
   such as an object's top edge above its base. A non-square object of unknown depth: fix its width, `free` its depth.
3. Paste the printed `camera.js` line into the starter's `camera.js` (degrees, same keys as `cam.json`, plus the `clip`
   near/far, which must stay tight: far/near under about 100). Set `PIVOT` to the subject centre.
4. **Place objects by ray, not by eye.** Cast the source pixel of an object's base onto the ground plane, or solve a
   rectangle directly, then check with `project`:

       12ui scene ray cam.json --plane-y 0 836,691 1237,749
       12ui scene rect cam.json --corners "TLu,TLv;TRu,TRv;BRu,BRv;BLu,BLv" --plane-y 0
       12ui scene rect cam.json --corners "TLu,TLv;TRu,TRv;BRu,BRv;BLu,BLv" --width 0.6 --height 0.4
       12ui scene project cam.json 0.1,0,0.3

   `--plane-y` is a rectangle flat on a surface; `--width` and `--height` are a tilted one of known size. Render once
   with plain grey boxes at the solved positions. If the silhouettes overlay the source, the rest is modelling and
   light. If not, fix the camera now: nothing downstream repairs it. A rectangle seen from one view is ambiguous in
   lean versus depth (give `--width` alone to solve the other side); use what you know (it rests on the floor, it
   leans on the wall) and force draw order when something ends up inside another object.

## 2. Model and material, per object type

| Object | Build |
|---|---|
| Box, carton, crate, wall, table | `BoxGeometry` with real wall thickness, or five walls plus hinged flaps. Bevel visible edges. |
| Book, card, drive, phone, laptop deck, sleeve | `slabGeometry(w,h,t,r)` from `lib.js` (rounded extrude, clean cap UVs), a page block and boards for a book. |
| Cup, jar, bottle, vinyl, bucket, lamp | `LatheGeometry` from a profile you read off the silhouette. Vinyl grooves: concentric bands in a roughness and colour canvas. |
| Logos, rings, outlines, ribbons | `ExtrudeGeometry` of a `Shape`, or a canvas texture if it is printed flat. |
| Rows of small things (keys, grass, bricks, sand, pins) | `InstancedMesh` with per-instance jitter in scale, rotation, colour. |
| Terrain, sand, cloth | Displaced plane plus a grain normal or bump map; never a photo. |
| Flat printed surface | Canvas texture, or the source region rectified (section 4). |

Materials: `MeshStandardMaterial` or `MeshPhysicalMaterial` (clearcoat for lacquer, glass, varnish; roughness map for
scuffs). Make surface textures procedural on a canvas (`canvasTex`, `grain` in `lib.js`): fibres and speckle for kraft
or paper, weave for cloth, streaks for brushed metal, value noise for concrete. **Sample the source for colour** before
you tune: `12ui scene colors source.png --box x0,y0,x1,y1` gives the hex to use; comparing regions against a render
afterwards gives brightness ratios to correct light, not paint.

Give thin parts real thickness (a sleeve, card or book is 1 to 2 percent of its width, not zero), and keep it consistent
with the source's shadow length: a long crisp shadow from a thin object means a low light, not a thicker object.
Glossy discs, lacquer and glass want an environment map, not more lights: `studioEnv(renderer)` from `lib.js`,
assigned to those materials only.

Light like the source: one key (spot or directional) placed by where the shadows fall, a low hemisphere or ambient
fill, a warm or cool bounce on the side faces if they read lit. Add `contactShadow` under everything that sits on a
surface. For a glossy floor use `reflections()` from `lib.js` (mirrored, jittered copies with fade) and a sheen strip;
planar reflection is often the biggest single win. Window light and leaf shadows: a `SpotLight.map` gobo drawn in
source-image pixels and resampled through the solved camera, so it lands where drawn and stays real light: the
starter's `gobo.js` (its header has the recipe and the orientation, which is verified; do not flip anything by hand).
Volumetric beams: an additive open cone. Use `ACESFilmicToneMapping`, `SRGBColorSpace`, and shadow bias about -0.0004.
Do not use `PCFSoftShadowMap` (removed in r186).

## 3. Layout and page text

Real DOM for real page text: headline, nav, buttons, body copy, callout labels, in `#stage` at source pixel
coordinates. Pick the display font by rendering candidate faces at the measured cap height in a strip next to a source
crop and choosing the closest glyph shapes, then fit the measured line width with a `scaleX` on a span (`data-fit`).

Fonts are local only. Copy a `.ttf`, `.otf` or `.woff2` into the scene folder (from the user's project or an installed
system font) and load it with `@font-face { src: url(./file.woff2) }`, or use a face that is already installed. Never
link a hosted font stylesheet: capture blocks it, and its `remote requests blocked` and `fonts:` lines show a missing
face. Leader lines are SVG whose end dots track 3D anchors (`Object3D.getWorldPosition(v).project(camera)`), so they
follow the orbit. Never render page text into the 3D scene.

## 4. Screens and app UI

- **Flat and static** (default): flatten the screen quad to a texture, then map it on the screen face of the device
  slab. Remove painted glare and shadows in the crop, cover any bezel bleed, and light the screen with an emissive map
  so it reads as lit.

      12ui scene rectify source.png --corners "TLu,TLv;TRu,TRv;BRu,BRv;BLu,BLv" --size 1200x800 --out screen.png

- **Live and editable screens**, only if the user asks for one. Optional, needs network: `12ui convert <crop.png> --output html`.
  Put the result in a `CSS3DRenderer` layer (`vendor/addons/renderers/CSS3DRenderer.js`) with the same camera, or as
  an iframe texture; keep the rectified crop as the offline default in the report.
- A wall of screens, a dashboard, cards on a wall: same recipe per screen, one rectified crop each.

## 5. The self-review loop (this is the work)

After every pass, render and compare:

    12ui scene capture http://127.0.0.1:<port>/index.html --out-dir shots/i01 --size 1536x1024
    12ui scene sheet source.png shots/i01/landing.png shots/i01/az-15.png shots/i01/az+15.png --out shots/i01/sheet.png
    12ui scene blend source.png shots/i01/landing.png --out shots/i01/blend.png
    12ui scene colors source.png shots/i01/landing.png --exclude "x0,y0,x1,y1;x0,y0,x1,y1"

`capture` writes `landing`, `az-15/-10/+10/+15` and `act-<name>` (each action at t = 1), then prints
`remote requests blocked: N`, `fonts: N loaded, M failed` and any console errors. A blocked count above 0 is a defect:
the scene reached for something off this machine; make it local. If capture reports that Chromium is missing, run the
install command it prints once, then retry. Custom views: `half=0:0:lid=0.5` (name=azimuth:elevation:action=t,...).
Debug an object with `--hide vinyl` (name substring; name your groups), `--eval "js"`, `--size 900x600` for fast passes.

`colors` lists the worst cells of a grid; `--exclude` the boxes covered by DOM text (or `--exclude-dom boxes.json`),
or the text cells read as error. `--region "name:x0,y0,x1,y1;name:x0,y0,x1,y1"` compares named regions instead.

Open the sheet and the blend (source, render, 50 percent overlay, difference) and look. Fix the **single largest
mismatch** in this order: camera and silhouettes, object proportions, light direction and value, colour, then texture
detail. Log one line per pass (what looked wrong, what you changed). Look at `az-15` and `az+15` every time: if an
object turns into a card, a floor smears, or an edge opens, that is a real defect the landing view hides. Stop when
the biggest gap left is texture realism. Headless software GL is slow (a few fps); do not chase framerate, but keep
triangle counts sane (under about 500k) and do not run 9-tap reflections on everything.

## 6. Interactions

Two or three, each on a **separate object**, each a pure function `apply(t)` of `t` in 0..1 (the starter's `actions`
registry, click a mesh to toggle, ease in and out): a **hinge** (lid, flap, cover, door: a Group at the hinge line,
rotate it), a **lift** (book, cup, card: translate along its own up axis with a small tilt), a **slide** (drive, paper,
drawer: translate along its own axis, optionally rotate slightly). Optional small extras: a lit-to-dark toggle,
a bucket tipping upright. Also give pointer-drag or arrow-key orbit clamped to +-15 degrees, and one or two labelled
buttons in `#stage` that call `__scene.toggle(name)`. Verify with a real click in the headless page as well as
`setAction`, and capture each action at t = 1 from the landing camera.

## 7. Report

Say what you built (objects, interactions), the camera rms and worst landmark, how many render passes, the paths of
the contact sheet and captures, the capture's `remote requests blocked` and `fonts:` lines, and the remaining gaps
against the source (fonts, texture realism, proportions). Do not claim a pixel match; claim a real scene that reads as
the source from the landing camera and holds at +-15 degrees.

Ports and processes: use only the ports you were given; stop your servers by the PID `serve` printed; never kill by
name pattern. Keep output small: `init` copies three.js once per scene folder, and captures go under `shots/`.
