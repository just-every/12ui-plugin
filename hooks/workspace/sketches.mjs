/**
 * The Sketches tab as plain data (no `$`), after the hosted screen's (packages/12ui/src/mcp-slate-ui-script-sketches.ts):
 * the layout sketches a mixed round draws from (`view.sketches`), the person's own first, then each round's model
 * sketches, as the server lists them; their names; and the picture file the person types a path to, read into the
 * `sketch` the inspiration tool takes (a JPEG, PNG or WebP of at most 300 KiB; the server checks its pixels).
 */

import { actionError } from './actions.mjs';
import { base64Decode } from './bytes.mjs';
import { byLabel } from './view.mjs';

export const SKETCH_ID = /^sketch-[0-9a-f]{16}$/;
/** The tool's ceiling on the picture's base64 (409,600 characters = 300 KiB of bytes). */
export const SKETCH_MAX_BASE64 = 409600;
export const SKETCH_MAX_KIB = 300;

export function isSketchId(id) {
  return typeof id === 'string' && SKETCH_ID.test(id);
}

/** The sketches the view lists, in the server's order, each `{ id, own, roundId }`. */
export function sketchesOf(view) {
  return (view.sketches || []).filter((sketch) => isSketchId(sketch.sketchId)).map((sketch) => ({ id: sketch.sketchId, own: sketch.source === 'own', roundId: sketch.roundId ?? null }));
}

/** A sketch's name: "Your sketch 2" (counted from the first the person added) or "Option B" (the first option drawn from it). */
export function sketchName(view, id) {
  const list = sketchesOf(view);
  const own = list.filter((sketch) => sketch.own);
  const at = own.findIndex((sketch) => sketch.id === id);
  if (at >= 0) return `Your sketch ${own.length - at}`;
  const option = view.candidates.filter((candidate) => candidate.sketchId === id).sort(byLabel)[0];
  return option ? `Option ${option.label}` : 'Sketch';
}

/** Whether any round's sketch call is still running (a quiet "Drawing sketches…" line, as the screen's). */
export function sketchesDrawing(view) {
  return view.rounds.some((round) => round.sketchesPending === true);
}

/** The path as typed: surrounding quotes dropped and backslash-escaped characters (a dragged-in path) unescaped. */
export function typedPath(text) {
  let path = String(text ?? '').trim();
  if (path.length >= 2 && ((path.startsWith('"') && path.endsWith('"')) || (path.startsWith("'") && path.endsWith("'")))) path = path.slice(1, -1);
  // A Windows path keeps its backslashes; a dragged-in POSIX path escapes spaces and other shell characters with one.
  if (/^(?:[A-Za-z]:[\\/]|\\\\)/.test(path)) return path;
  return path.replace(/\\([ ()&'"[\]#!$;])/g, '$1').trim();
}

/** The picture type a file's first bytes name, or null. */
export function pictureType(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
  const tag = (at, text) => text.split('').every((ch, index) => bytes[at + index] === ch.charCodeAt(0));
  if (bytes.length >= 12 && tag(0, 'RIFF') && tag(8, 'WEBP')) return 'image/webp';
  return null;
}

/**
 * The `sketch` of the inspiration tool for a file read as `base64`: its type from its first bytes, or the words the pane
 * shows. A file that is not a picture, or over the tool's ceiling, is refused here rather than sent to be refused.
 */
export function sketchUpload(base64) {
  const head = base64.slice(0, 16);
  const type = head ? pictureType(base64Decode(head.slice(0, head.length - (head.length % 4)))) : null;
  if (!type) throw actionError('This file is not a picture. Use a JPEG, PNG or WebP.');
  if (base64.length > SKETCH_MAX_BASE64) throw actionError(`This picture is over ${SKETCH_MAX_KIB} KiB. Make it smaller (at most 1,280 pixels on its long edge) and add it again.`);
  return { mimeType: type, data: base64 };
}

/** The frame a sketch is drawn in: the brief's aspect, as its designs are (landscape 3:2, portrait 2:3, square). */
export function sketchSize(view) {
  const aspect = view.brief && view.brief.aspect;
  if (aspect === 'portrait') return { width: 1024, height: 1536 };
  if (aspect === 'square') return { width: 1024, height: 1024 };
  return { width: 1536, height: 1024 };
}
