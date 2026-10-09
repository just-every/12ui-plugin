/**
 * The words the mod shows the person: the pane's labels, the toast and the band above the prompt. Sentence case,
 * bare-verb buttons, no all-caps. Pure: no `$`.
 */

export const PANE_ID = 'design-workspace';
export const PANE_TITLE = 'Design workspace';

export const READY_TOAST = 'Design workspace ready. Press Open above the prompt to see it.';
/** The band above the prompt while the pane waits for room, beside its Open button. */
export const BAND_TEXT = 'Design workspace ready';
export const NO_WORKSPACE = 'No Design workspace yet. Ask Claude to open one, for example: Open a Design workspace for my app idea.';
export const LOADING = 'Loading the Design workspace.';
export const BRANCH_PAGES_HINT = 'Pages (optional), e.g. about, sign in, settings';
export const SENT = 'Recorded. Claude has been told.';
export const RECORDED_RUNNER = 'Recorded. It will be drawn on this computer.';

export const SKETCHES_CAPTION = 'Layout sketches for your brief. A selected sketch leads each group of the next round.';
export const SKETCH_PATH_HINT = 'Path to your own sketch (JPEG, PNG or WebP)';
export const SKETCHES_NONE = 'No sketches yet. Add your own, or draw a round.';
export const SKETCHES_DRAWING = 'Drawing sketches…';
export const SKETCH_GAP_AFTER = 'No sketches this round, so these were drawn without one.';
export const SKETCH_GAP_AHEAD = 'No sketches this round, so these will be drawn without one.';
/** A mixed round's groups, one per technique (the hosted screen's groupSketch words). */
export const GROUP_NAMES = Object.freeze({ sketch: 'Sketch', inspiration: 'Sketch + inspiration', site: 'Sketch + site' });

export const LABELS = Object.freeze({
  design: 'Design',
  sketches: 'Sketches',
  add: 'Add',
  remove: 'Remove',
  keep: '♡ Keep',
  kept: '♥ Kept',
  retry: 'Retry',
  simplify: 'Simplify',
  standard: 'Standard',
  high: 'High',
  groupMore: '+ More',
  selected: 'Selected',
  chosen: 'Building',
  back: 'Back',
  branch: 'Branch',
  fullPage: 'Full page',
  morePages: 'More pages',
  buildThis: 'Build this',
  select: 'Select',
  like: 'More like this',
  edit: 'Edit',
  send: 'Send',
  cancel: 'Cancel',
  more: 'Generate more',
  continue: 'Continue',
  cells: 'Show colour cells',
  pictures: 'Show pictures',
  count: 'Options',
  note: 'Note',
  pages: 'Pages',
  change: 'Change',
  explanation: 'Explanation',
  open: 'Open',
  format: 'Format',
});

/**
 * An option picture's alt text. The terminal draws it in the picture's place, under the option's own label, where it
 * cannot show pixels: there it says only what to do, never the label again. Elsewhere it is read in place of the
 * picture, so it names the option.
 */
export const TERMINAL_PICTURE_ALT = 'Press v for colour cells';

export function pictureAlt(label, surface) {
  return surface === 'terminal' ? TERMINAL_PICTURE_ALT : `Option ${label}`;
}
