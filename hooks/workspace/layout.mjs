/**
 * The pane's grid policy: how many option tiles sit side by side, how wide each one is, how tall a picture may grow, and
 * the columns the brief line leaves for the terminal's close mark. Every sizing rule of the pane's layout lives here and
 * nowhere else (CLAUDE.md item 9); picture.mjs sizes the picture inside the tile this module returns. Pure: no `$`.
 *
 * The facts it works from are the surface's own: `bodyColumns` and `scroll.bodyRows` of the Pane props, and the width
 * the terminal draws a Button in (`[ label ]`, 2.1.287 d.ts `ButtonProps`: the label plus four columns).
 */

import { LABELS } from './copy.mjs';

/** Columns between two tiles in a row. */
export const TILE_GAP = 2;
/** Columns between two buttons in a tile's button row (pane.mjs draws the row with this gap). */
export const BUTTON_GAP = 1;
/** The rows a tile draws besides its picture: the label, the state line, the button row, and the gap below it. */
export const TILE_CHROME_ROWS = 4;
/**
 * The columns the terminal's close mark takes from the pane's first row: the mark in the last column, and one column of
 * space before it, so a truncated brief ends in its ellipsis and never runs into the mark.
 */
export const CLOSE_MARK_COLUMNS = 2;

/** The columns a terminal Button takes: `[ label ]`. */
export function buttonColumns(label) {
  return label.length + 4;
}

/** The narrowest tile whose button row (Select, More like this, Edit) fits on one line: 38 columns with today's labels. */
export const TILE_MIN_COLUMNS = [LABELS.select, LABELS.like, LABELS.edit].map(buttonColumns).reduce((sum, n) => sum + n, 0)
  + BUTTON_GAP * 2;

/**
 * The tile grid for a pane `bodyColumns` wide: `{ perRow, columns }`. As many tiles a row as fit at TILE_MIN_COLUMNS
 * (one at least), each as wide as the row then allows. A pane narrower than one minimum tile gets one tile of the
 * whole width (its button row wraps there; nothing narrower can hold it).
 */
export function tileGrid(bodyColumns) {
  const width = Math.max(1, Math.floor(bodyColumns));
  const perRow = Math.max(1, Math.floor((width + TILE_GAP) / (TILE_MIN_COLUMNS + TILE_GAP)));
  const columns = Math.floor((width - TILE_GAP * (perRow - 1)) / perRow);
  return { perRow, columns };
}

/**
 * The tallest a picture may be in a pane whose window shows `bodyRows` rows: one whole tile (picture and chrome) fits
 * the window, so no picture is taller than what the person can see at once. Without a window height, no limit here.
 */
export function pictureMaxRows(bodyRows) {
  if (typeof bodyRows !== 'number' || !Number.isFinite(bodyRows)) return Infinity;
  return Math.max(3, Math.floor(bodyRows) - TILE_CHROME_ROWS);
}

/** The columns the pane's first row leaves at its right edge: the close mark's on the terminal, none elsewhere. */
export function briefReserve(surface) {
  return surface === 'terminal' ? CLOSE_MARK_COLUMNS : 0;
}
