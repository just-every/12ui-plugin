/**
 * The picture policy: how an option's thumbnail (the server's 480 px JPEG) is drawn on each surface. Every rendering
 * rule for the pictures lives here and nowhere else (CLAUDE.md item 9). Pure: no `$`; register.mjs feeds it facts
 * (the surface, the `$.ui.blit` answer, the person's `v` toggle) and pane.mjs draws what it returns.
 *
 * Terminal. The `Image` element takes PNG or RGBA only, so the JPEG is decoded (the vendored jpeg-js decoder) to RGBA.
 * It shows real pixels on terminals with a graphics protocol (kitty, Ghostty) and its `alt` text elsewhere. The fact
 * that tells the two apart is the engine's own: `$.ui.blit` on a keyed Image resolves `{ deny }` with a reason naming
 * the alt when that Image draws its alt (2.1.287 d.ts `UiBlitResult`). On that fact the pane draws `Raster` cells
 * instead: half blocks (U+2580), the top pixel as the foreground and the bottom one as the background, two pixels a
 * cell. `v` toggles either way. Which default stands, and the exact deny words, are recorded in mod/NOTES.md (spike 1).
 *
 * Desktop and the other remote surfaces. `Svg` (at most 131,072 characters) with the JPEG embedded as a data URI when
 * the whole document fits; otherwise the picture is decoded, scaled down and re-encoded as a stored PNG until it fits.
 */

import { base64Decode, base64Encode } from './bytes.mjs';
import { decode as decodeJpeg } from './jpeg-decoder.mjs';
import { encodePng, storedPngBytes } from './png.mjs';
import { decodeWebp } from './webp-decoder.mjs';

/** The Svg element's character ceiling (2.1.287 d.ts `SvgProps.source`). */
export const SVG_MAX_CHARS = 131072;
/** The XML namespace an SVG document names itself with; an identifier, never fetched. */
export const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
/** The half-block glyph a Raster cell draws: upper half in the foreground, lower half in the background. */
export const HALF_BLOCK = 0x2580;
/** Raster's own bounds (2.1.287 d.ts `RasterProps`), and Image's. */
export const RASTER_MAX_COLUMNS = 512;
export const RASTER_MAX_ROWS = 256;
export const IMAGE_MAX_CELLS = 255;
/** RGBA handed to an Image never exceeds this edge (2.1.287 d.ts `ImageSource`: 1 to 2048). */
export const IMAGE_MAX_EDGE = 2048;
/** The pixels an Image source carries per terminal cell, and a desktop picture's CSS pixels per column: a common cell size at 1x. */
export const CELL_PIXELS = Object.freeze({ width: 8, height: 16 });

/**
 * Which element draws the pictures on this surface: `image` or `raster` on the terminal (the person's or the blit
 * fact's choice, `useCells`), `svg` on every surface whose table has `Svg`.
 */
export function pictureKind(surface, { useCells = false } = {}) {
  if (surface === 'terminal') return useCells ? 'raster' : 'image';
  return 'svg';
}

/**
 * Whether a `$.ui.blit` answer says the keyed Image draws its alt text, the one deny that means "no pixels here".
 * Every other answer is silent: `{}` (pixels taken), or a deny for another reason (not mounted yet, another size).
 */
export function blitSaysAlt(result) {
  return Boolean(result && typeof result.deny === 'string' && /\balt\b/i.test(result.deny));
}

/** Whether the terminal should draw cells: the person's toggle when they pressed `v`, else the blit fact. */
export function useCellsFor({ toggled = null, altDrawn = false } = {}) {
  return toggled === null ? Boolean(altDrawn) : Boolean(toggled);
}

/** The decoded thumbnail: `{ rgba, width, height }` from the JPEG's base64. Throws on bytes that are not a JPEG. */
export function decodeThumb(jpegBase64, mimeType = 'image/jpeg') {
  if (mimeType === 'image/webp') {
    const webp = decodeWebp(base64Decode(jpegBase64));
    return { rgba: webp.data, width: webp.width, height: webp.height };
  }
  const image = decodeJpeg(base64Decode(jpegBase64), { formatAsRGBA: true, maxResolutionInMP: 16, maxMemoryUsageInMB: 64 });
  return { rgba: image.data, width: image.width, height: image.height };
}

/** The picture scaled to `width` x `height` by averaging the source area under each target pixel. */
export function resizeRgba({ rgba, width, height }, toWidth, toHeight) {
  const w = Math.max(1, Math.round(toWidth));
  const h = Math.max(1, Math.round(toHeight));
  if (w === width && h === height) return { rgba, width, height };
  const out = new Uint8Array(w * h * 4);
  const sx = width / w;
  const sy = height / h;
  for (let y = 0; y < h; y += 1) {
    const y0 = y * sy;
    const y1 = Math.min(height, y0 + sy);
    for (let x = 0; x < w; x += 1) {
      const x0 = x * sx;
      const x1 = Math.min(width, x0 + sx);
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let area = 0;
      for (let py = Math.floor(y0); py < Math.ceil(y1); py += 1) {
        const wy = Math.min(py + 1, y1) - Math.max(py, y0);
        if (wy <= 0) continue;
        for (let px = Math.floor(x0); px < Math.ceil(x1); px += 1) {
          const wx = Math.min(px + 1, x1) - Math.max(px, x0);
          if (wx <= 0) continue;
          const weight = wx * wy;
          const at = (py * width + px) * 4;
          r += rgba[at] * weight;
          g += rgba[at + 1] * weight;
          b += rgba[at + 2] * weight;
          a += rgba[at + 3] * weight;
          area += weight;
        }
      }
      const to = (y * w + x) * 4;
      out[to] = Math.round(r / area);
      out[to + 1] = Math.round(g / area);
      out[to + 2] = Math.round(b / area);
      out[to + 3] = Math.round(a / area);
    }
  }
  return { rgba: out, width: w, height: h };
}

/**
 * The box of one tile's picture, in cells: the tile's whole width (layout.mjs `tileGrid`), and as many rows as the
 * picture's aspect asks at two pixels a cell height (a cell is about twice as tall as wide). A picture taller than
 * `maxRows` (layout.mjs `pictureMaxRows`) is held to it and narrowed to keep its aspect. Never past Image's 255 cells.
 */
export function tileBox(tileColumns, width, height, maxRows = Infinity) {
  const aspect = width > 0 && height > 0 ? height / width : 9 / 16;
  let columns = Math.max(1, Math.min(IMAGE_MAX_CELLS, Math.floor(tileColumns)));
  let rows = Math.max(1, Math.round(columns * aspect / 2));
  const limit = Math.max(1, Math.min(IMAGE_MAX_CELLS, Math.floor(maxRows)));
  if (rows > limit) {
    rows = limit;
    columns = Math.max(1, Math.min(columns, Math.round(rows * 2 / aspect)));
  }
  return { columns, rows };
}

/** A desktop picture's CSS size for its box: CELL_PIXELS.width a column, the height from the picture's own aspect. */
export function desktopPictureSize(box, width, height) {
  const cssWidth = box.columns * CELL_PIXELS.width;
  return { width: cssWidth, height: Math.round(cssWidth * height / width) };
}

/**
 * An Image's source for the decoded picture: raw RGBA no larger than its box needs at CELL_PIXELS per cell (the tree
 * crosses to the engine on every redraw, so a 480 px thumbnail drawn 30 columns wide is sent at 240 px), and never past
 * the element's edge limit. A picture already small enough is sent as decoded.
 */
export function imageSource(picture, box = null) {
  const limits = [1, IMAGE_MAX_EDGE / Math.max(picture.width, picture.height)];
  if (box) limits.push((box.columns * CELL_PIXELS.width) / picture.width, (box.rows * CELL_PIXELS.height) / picture.height);
  const scale = Math.min(...limits);
  const sized = scale < 1 ? resizeRgba(picture, Math.max(1, picture.width * scale), Math.max(1, picture.height * scale)) : picture;
  return { rgba: base64Encode(sized.rgba), width: sized.width, height: sized.height };
}

/** A Raster's `cells` for the picture over `columns` x `rows`: half blocks, two pixels a cell. */
export function rasterCells(picture, columns, rows) {
  const c = Math.max(1, Math.min(RASTER_MAX_COLUMNS, columns));
  const r = Math.max(1, Math.min(RASTER_MAX_ROWS, rows));
  const sized = resizeRgba(picture, c, r * 2);
  const words = new Uint32Array(c * r * 3);
  for (let row = 0; row < r; row += 1) {
    for (let col = 0; col < c; col += 1) {
      const top = ((row * 2) * c + col) * 4;
      const bottom = ((row * 2 + 1) * c + col) * 4;
      const at = (row * c + col) * 3;
      words[at] = HALF_BLOCK;
      words[at + 1] = (sized.rgba[top] << 16) | (sized.rgba[top + 1] << 8) | sized.rgba[top + 2];
      words[at + 2] = (sized.rgba[bottom] << 16) | (sized.rgba[bottom + 1] << 8) | sized.rgba[bottom + 2];
    }
  }
  const bytes = new Uint8Array(words.length * 4);
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    const at = index * 4;
    bytes[at] = word & 0xff;
    bytes[at + 1] = (word >>> 8) & 0xff;
    bytes[at + 2] = (word >>> 16) & 0xff;
    bytes[at + 3] = (word >>> 24) & 0xff;
  }
  return { cells: base64Encode(bytes), columns: c, rows: r };
}

function svgDocument(width, height, mimeType, base64) {
  return `<svg xmlns="${SVG_NAMESPACE}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`
    + `<image href="data:${mimeType};base64,${base64}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>`
    + '</svg>';
}

/** The characters an Svg embedding `bytes` bytes of base64 takes, for a picture of that size. */
function svgChars(width, height, mimeType, bytes) {
  return svgDocument(width, height, mimeType, '').length + 4 * Math.ceil(bytes / 3);
}

/**
 * The Svg source for a thumbnail: `{ source, embedded }`, `embedded` naming what it carries (`jpeg` as the server sent
 * it, or `png` re-encoded smaller). `decode` is only called when the JPEG does not fit.
 */
export function svgPicture({ jpegBase64, width, height, mimeType = 'image/jpeg' }, decode = () => decodeThumb(jpegBase64, mimeType)) {
  const asIs = svgDocument(width, height, mimeType, jpegBase64);
  if (asIs.length <= SVG_MAX_CHARS) return { source: asIs, embedded: mimeType === 'image/webp' ? 'webp' : 'jpeg' };
  const picture = decode();
  let scale = 1;
  for (;;) {
    const w = Math.max(1, Math.floor(picture.width * scale));
    const h = Math.max(1, Math.floor(picture.height * scale));
    if (svgChars(width, height, 'image/png', storedPngBytes(w, h, 3)) <= SVG_MAX_CHARS) {
      const png = encodePng(resizeRgba(picture, w, h));
      return { source: svgDocument(width, height, 'image/png', base64Encode(png)), embedded: 'png' };
    }
    if (w === 1 && h === 1) throw new Error('the picture cannot fit an Svg');
    scale *= 0.85;
  }
}
