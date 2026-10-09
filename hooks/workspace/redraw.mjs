/**
 * The redraw policy, one module (CLAUDE.md item 9): when the pane asks the engine for a fresh drawing on its own, not
 * after the person pressed something. Pure: no `$`; register.mjs feeds it the model and the clock.
 *
 * Why it matters. Claude Code keeps one live set of button handles per pane, and every fresh drawing retires the last
 * set; the Claude app cancels an ask in flight when a newer one comes and applies drawings only after the pointer is
 * released, so a press lands on a drawing the engine has already retired and is refused (`ui_press` answered
 * `{ handled: false }`, nothing run). Measured on the 0.2.117 pane: 21 to 25 self-redraws in a drawn workspace's first
 * 10 s (one per picture) and about 1.5 a second while a round waits (a 1 s countdown ticker plus polls), with 23% to
 * 50% of presses refused under the app's lag (~/.orchestrator/evidence/12ui/claude-workspace/results.md). So the pane
 * redraws on its own only when what it shows changes, never on the clock alone (the start countdown's words do not
 * change with time, view.mjs); a view that brings pictures is drawn once, together with them; and its own redraws wait
 * for a pause in the person's presses: a press redraws at once and its drawing carries whatever landed before it.
 */

/** The pane's picture redraws come at most once a second: a batch never draws sooner than this after the last self-redraw. */
export const PICTURE_BATCH_MS = 1000;

/**
 * How long a batch waits for the shown tab's pictures still being read, from the batch's start (a view that brings
 * pictures, or the first picture to land), before it draws what is in. design.12ui.com answered a whole workspace's
 * pictures in 0.6 to 2.6 s when they were all read at once (fix/round2/picture-latency-all.out: 3 runs of 34), and a
 * website's screenshot in a waiting round took longer than the 1 s the batch used to wait, so each website landing was
 * drawn twice, a second apart (gate out-waitidle400 at 19.0/20.0 s and 21.7/22.7 s).
 */
export const PICTURE_WAIT_MS = 3000;

/** A picture as a drawing shows it: nothing, loading, failed with its reason, or ready (whatever element draws it). */
function pictureFact(picture) {
  if (!picture) return null;
  if (picture.kind === 'loading') return 'loading';
  if (picture.kind === 'failed') return `failed:${picture.reason}`;
  return 'ready';
}

/**
 * What a drawing of `model` shows, as one string: the tab, the lines, the tray, every tile and item with its picture's
 * state. Two models with the same signature draw the same pane, so a self-redraw between them is skipped. Pictures
 * count by state only, so the bytes of an Svg or an Image never decide a redraw. Only the shown tab is in the model, so
 * the pictures of the other tabs land without a redraw.
 */
export function drawnSignature(model) {
  return JSON.stringify({
    surface: model.surface,
    workspace: model.workspace,
    emptyText: model.emptyText,
    isLoading: model.isLoading,
    prompt: model.prompt,
    tab: model.tab,
    noticeText: model.noticeText,
    errorText: model.errorText,
    tileColumns: model.tileColumns,
    tray: model.tray,
    selectedCount: model.selectedCount,
    emptyLine: model.emptyLine,
    perRound: model.perRound,
    lv: model.lv ? { tile: { ...model.lv.tile }, picture: pictureFact(model.lv.picture), mode: model.lv.mode, scope: model.lv.scope, pages: model.lv.pages } : null,
    sections: model.sections.map((section) => ({ ...section, groups: section.groups.map((group) => ({ ...group, tiles: group.tiles.map((tile) => ({ ...tile, picture: pictureFact(tile.picture) })) })) })),
    sketches: model.sketches,
    selectable: model.selectable,
    items: model.items.map((item) => ({ ...item, picture: pictureFact(item.picture) })),
  });
}

/**
 * How long, from now, a batch of the shown tab's pictures waits for its redraw: never sooner than PICTURE_BATCH_MS after
 * the last self-redraw (`sinceLastSelfMs`, null for none yet); once nothing the shown tab draws is still out, no longer
 * than that; while pictures are still out (`outstanding`), until PICTURE_WAIT_MS after the batch began
 * (`sinceBatchStartMs`), unless the last of them lands first. A picture that lands after that starts a batch of its own.
 */
export function pictureRedrawDelay({ sinceLastSelfMs, sinceBatchStartMs, outstanding }) {
  const floor = sinceLastSelfMs === null ? 0 : Math.max(0, PICTURE_BATCH_MS - sinceLastSelfMs);
  if (outstanding === 0) return floor;
  return Math.max(floor, PICTURE_WAIT_MS - sinceBatchStartMs);
}

/**
 * The pane's own redraws wait this long after the person's last press. Each self-redraw retires the drawing the person
 * is pressing on; while they press, every press redraws anyway and its drawing shows what landed meanwhile, so nothing
 * waits longer than the next press or this pause. Measured in the press rig at a 400 ms app delay: a picture batch drawn
 * 114 ms before a tab press refused it (1 of 28; fix/results.md).
 */
export const PRESS_QUIET_MS = 1500;

/** How long a self-redraw waits for the pause after the last press (`sinceLastPressMs`, null for none yet): 0 to draw now. */
export function pressQuietDelay(sinceLastPressMs) {
  if (sinceLastPressMs === null) return 0;
  return Math.max(0, PRESS_QUIET_MS - sinceLastPressMs);
}
