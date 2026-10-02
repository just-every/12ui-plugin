# Rebuild a design image as a live 3D scene

Real geometry and light, the page as real HTML over it, 2-3 clicks and drag orbit. `12ui convert` builds the page layer in the background while you model the scene; then merge the two, render and fix. `12ui scene <verb> --help` explains each verb.

- **Model the objects.** The source goes on geometry only as a flat printed surface (a screen, a label, a poster).
- **Page text stays the converted HTML.** Do not rebuild its text, buttons, logo or fonts yourself.
- **Hold at +-15 degrees.** No object turns into a card, no floor smears, no edge opens.

**1. Start.** Start convert first, in the folder with `source.png`, as a background job, and keep working while it runs. Convert's `auto` engine uses Codex when it is ready and the 12ui API otherwise. `convert-run` must be a new folder: a retry uses a new name. `serve --detach` prints a pid: stop that server only with `kill <pid>`.

    12ui convert source.png --output html --engine auto --out-dir convert-run
    12ui scene init .
    12ui scene serve . --port <port> --detach

**2. Camera: solve once.** Pick 6-8 landmarks, corners of clearly rectangular objects read to the pixel, at least one off the main plane. Write `spec.json` (format in `12ui scene solve --help`), run `12ui scene solve spec.json --out cam.json`, paste its `camera.js` line into `camera.js` and set `PIVOT` to the subject centre. rms 1-4 px is good; fix one misread landmark or pin fov at most once, then accept it. If the output starts with `degenerate`, do what its first warning says. Place objects by ray or rect, not by eye: `12ui scene ray cam.json --plane-y 0 u,v` lands an object's base on the ground; `12ui scene rect cam.json --corners "TLu,TLv;TRu,TRv;BRu,BRv;BLu,BLv" --plane-y 0` poses a flat rectangle.

**3. Model, while convert runs.** Leave the page text to convert. Build each object in `scene.js` as the table says. Thin parts get real thickness. Colours: `12ui scene colors source.png --box x0,y0,x1,y1`. Light like the source: one key placed by the shadows, a low fill, `contactShadow` under things; keep textures light. Add 2-3 click actions on separate objects (`apply(t)`, as in the starter `scene.js`); drag orbit is built in.

| Object | Build |
|---|---|
| Box, carton, crate, wall, table | `BoxGeometry` with real wall thickness, or five walls plus hinged flaps; bevel edges. |
| Book, card, phone, laptop, sleeve | `slabGeometry(w,h,t,r)` from `lib.js`; a page block and boards for a book. |
| Cup, jar, bottle, vinyl, lamp | `LatheGeometry` from a profile read off the silhouette. |
| Logos, rings, outlines, ribbons | `ExtrudeGeometry` of a `Shape`, or a canvas texture if it is printed flat. |
| Rows of small things (keys, grass, bricks) | `InstancedMesh`, jittered per instance in scale, rotation, colour. |
| Terrain, sand, cloth | Displaced plane with gentle, low-frequency relief plus a grain bump map; never a photo. |
| Flat printed surface | Canvas texture, or the source region flattened with `12ui scene rectify`. |

**4. Merge, when convert is done.** Run `12ui scene merge convert-run .`. It reads the run the way its engine wrote it, puts the page's styles in `<head>` and its body in `#stage` at the source frame, copies the files the page uses, and lists its images, with the source box `x0,y0,x1,y1` where the run declares one. While convert is still running it says so and writes nothing: keep modelling and merge later. Then:
- Run it again with `--drop <image>,...` naming the image(s) the 3D scene replaces; it removes every `<img>` and `url()` using them. Each merge replaces the last one, edits inside it included, so do the steps below after it.
- In `index.html`, clear the background of the box that held the 3D image and of any wrapper over the 3D area, so the canvas under `#stage` shows through. Panels over flat page area keep theirs.

If convert fails, or merge says it stopped, recover it as the CLI prints: `12ui next convert-run`, then the `12ui resume` it names. If convert still fails, report that it failed and stop.

**5. Check.** Run `12ui scene capture http://127.0.0.1:<port>/index.html --out-dir shots/i01 --orbit=-15,15` (a new `shots/iNN` each time) and look at `landing`, `az-15` and `az+15`. Fix the biggest mismatch first (placement, silhouettes, light, colour) and capture again. Stop when landing reads as the source and +-15 holds.

**6. Report** in two lines: the URL and what you built (objects, interactions); the landing capture path and what still differs.
