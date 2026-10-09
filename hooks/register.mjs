/**
 * The 12ui Design workspace pane for Claude Code: the glue that wires the hooks to the modules in ./workspace.
 *
 * Hooks:
 *   this plugin's own create and show tools   reads the workspace handle from their result, opens the pane
 *   drawing the Pane                          draws the workspace in its own pane; passes every other pane on
 *   drawing above the prompt                  while the pane waits for room, one Open button; otherwise passes on
 *   closing the pane                          stops polling
 *
 * Every `$` call lives in this file, because the engine follows `$` only into functions declared in the hooks module
 * itself. The one network request is the fetch in `rpc`, its address and options written at the call: the plugin's
 * own MCP server. It sends workspace handles, ids, picks and the words typed in the pane, never the conversation.
 * `$.prompt.submit` tells Claude, in one fixed line, what the person clicked; `$.ui.*` draws, `$.clock.*` polls and
 * counts down. `$.fs.read` reads one picture file, and only when the person types its path in the Sketches tab and presses
 * Add. Nothing else: the mod reads nothing else from the computer, runs nothing and touches no other tool's calls.
 */

import { SELECTION_MAX, actionError as refusal, continueArgs, convertHandoffArgs, holdArgs, inspirationArgs, inspireArgs, isActionError, pickArgs, runBranchArgs, runEditArgs, runKeepArgs, runNewArgs, runRetryArgs, runSimplifyArgs } from './workspace/actions.mjs';
import { uuidV4 } from './workspace/bytes.mjs';
import { LOADING, NO_WORKSPACE, PANE_ID, PANE_TITLE, READY_TOAST, RECORDED_RUNNER, SENT, SKETCHES_NONE } from './workspace/copy.mjs';
import { PER_ROUND, SEARCH_COUNT, inspirationIds, openingTab, perRoundOf, pickLimit, picksOf, referenceSize, sameList, selectedOf, siteItems, tabThumbs, togglePick, twelveDraws, viewThumbs, waitingRound } from './workspace/gallery.mjs';
import { handleFromCall } from './workspace/handles.mjs';
import { afterRun, buildMessage, judgeRunner, runMessage } from './workspace/messages.mjs';
import { bandTree, paneTree } from './workspace/pane.mjs';
import { pictureMaxRows, tileGrid } from './workspace/layout.mjs';
import { SVG_MAX_CHARS, blitSaysAlt, decodeThumb, desktopPictureSize, imageSource, imageTreeBudget, pictureKind, rasterCells, svgPicture, tileBox, useCellsFor } from './workspace/picture.mjs';
import { nextStep, pollDelay, retriesFirstRead, wantsPolling } from './workspace/poll.mjs';
import { drawnSignature, pictureRedrawDelay, pressQuietDelay } from './workspace/redraw.mjs';
import { designSections } from './workspace/sections.mjs';
import { isSketchId, sketchName, sketchSize, sketchUpload, sketchesDrawing, sketchesOf, typedPath } from './workspace/sketches.mjs';
import { TOOLS, errorLine, imageBlock, isWorkspaceError, mendsOnRetry, readRpc, rpcBody, workspaceError } from './workspace/transport.mjs';
import { briefLine, countdownLine, countdownOf, findOp, hasRunning, isView, labelOfVersion, opWaitsOnPerson, tilesOf } from './workspace/view.mjs';

// ---- the session's state: module memory, as the hosted screen keeps it (a reload starts over) ----
let current = null;
// True while the pane is open but waits undrawn (opened unasked on a narrow terminal): the band above the prompt offers Open.
let paneWaits = false;
const views = new Map();
// Thumbnails, request-id drafts and clicks in flight are kept per workspace: the server mints option and version ids per
// workspace (every workspace's first option is `r1_a` / `v_r1_a`), so an id alone names nothing across workspaces.
const thumbs = new Map();
const drafts = new Map();
const inFlight = new Set();
const runnerWatch = new Map();
// What the person is doing in the pane: the tab (`openedFor`: the workspace whose opening tab was chosen), the prompt
// line, the waiting round's picks, the large view.
const ui = { tab: 'inspiration', autoTab: false, openedFor: null, prompt: '', promptEdited: false, chosen: null, chosenOp: null, heldOp: null, pauseOp: null, lv: null, perRound: null, keep: {}, sketchPath: '' };
// The selection the next round draws from while no round waits (references, websites and sketches, at most eight): the
// person's toggles not yet answered (`ids`, null when the view's own stands), written whole by one request at a time.
const selection = { ids: null, sending: false };
const poll = { timer: null, step: 0, busy: false, isOpen: false, failedRetryably: false };
const blit = { altDrawn: false, toggled: null, probed: false, lastAnswer: null };
// The pane's own redraws (redraw.mjs): what the last drawing showed (`shows`: the workspace whose view it drew) and for
// which surface and props, when the pane last asked for one on its own, the batch of pictures waiting to be drawn
// together (when it began, its timer), the person's last press and the redraw waiting for the pause after it.
const redraw = { drawn: null, shows: null, surface: null, props: null, lastSelfAtMs: null, batchStartAtMs: null, timer: null, lastPressAtMs: null, quietTimer: null };
let pollError = '';
let actionError = '';
let noticeText = '';

// ---- the wire ----
/** One JSON-RPC `tools/call` to the plugin's own MCP server: the mod's one network request, its address fixed here. */
async function rpc($, name, args) {
  const response = await $.http.fetch('https://design.12ui.com/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-06-18' },
    body: rpcBody(name, args),
  });
  return readRpc(response);
}

function viewOf(runDir) {
  const entry = runDir ? views.get(runDir) : null;
  return entry ? entry.view : null;
}

/** The slot of anything kept per workspace and per item: the workspace handle, then the item's own parts. */
function workspaceSlot(runDir, ...parts) {
  return [runDir, ...parts].join('\u0000');
}

function draftId(slot) {
  if (!drafts.has(slot)) drafts.set(slot, uuidV4());
  return drafts.get(slot);
}

// ---- the view, the pictures and the polling ----
async function applyView($, runDir, view) {
  views.set(runDir, { view, receivedAtMs: await $.clock.now() });
  if (runDir !== current) return;
  followPause(runDir, view, views.get(runDir).receivedAtMs);
  fetchThumbs($, runDir);
  // A view whose shown tab still waits on pictures (ones it brings, or ones already being read) is drawn once, together
  // with them: it joins their batch (redraw.mjs PICTURE_WAIT_MS at most) instead of drawing its tiles loading and then
  // again with their pictures. That holds for the first view too: until it draws, the pane says it is loading and has
  // no tabs to press. A view with every picture in is drawn at once.
  if (thumbsOut() > 0) await joinPictureBatch($);
  else await redrawIfChanged($);
}

/** Reads every thumbnail of the view the pane does not hold yet, the shown tab's first (gallery.mjs `viewThumbs`). */
function fetchThumbs($, runDir) {
  const view = viewOf(runDir);
  if (!view || runDir !== current) return;
  for (const want of viewThumbs(view, ui.tab)) {
    const slot = workspaceSlot(runDir, want.slot);
    if (thumbs.has(slot)) continue;
    void fetchThumb($, slot, want.kind === 'version' ? TOOLS.image : TOOLS.reference, { runDir, ...want.args, size: 'thumb' });
  }
}

/** Whether the shown tab of the shown workspace draws the thumbnail kept under `slot`. */
function isShown(slot) {
  const view = viewOf(current);
  return Boolean(view) && tabThumbs(view, ui.tab).some((want) => workspaceSlot(current, want.slot) === slot);
}

/** How many of the shown tab's thumbnails are still being read. */
function thumbsOut() {
  const view = viewOf(current);
  if (!view) return 0;
  return tabThumbs(view, ui.tab).filter((want) => {
    const thumb = thumbs.get(workspaceSlot(current, want.slot));
    return thumb && thumb.state === 'loading';
  }).length;
}

/**
 * The tab a workspace opens on (gallery.mjs `openingTab`): Inspiration with its picks preselected while a round waits on
 * the person, else Designs once it has options. A round that starts waiting later moves the pane to Inspiration; when
 * the wait ends (Continue, or the countdown ran out) a pane the round put on Inspiration moves to Designs, as the screen
 * does.
 */
function followPause(runDir, view, receivedAtMs) {
  const countdown = countdownOf(view, receivedAtMs);
  const opening = ui.openedFor !== runDir;
  ui.openedFor = runDir;
  if (opening && !countdown) {
    ui.tab = openingTab(view, false);
    ui.autoTab = false;
  } else if (countdown && ui.pauseOp !== countdown.opId) {
    ui.pauseOp = countdown.opId;
    ui.chosen = null;
    ui.chosenOp = null;
    if (ui.tab !== 'inspiration') ui.tab = 'inspiration';
    ui.autoTab = true;
  } else if (!countdown && ui.pauseOp) {
    ui.pauseOp = null;
    if (ui.autoTab) ui.tab = 'designs';
    ui.autoTab = false;
  }
}

async function fetchThumb($, slot, tool, args) {
  thumbs.set(slot, { state: 'loading' });
  try {
    const { content, structured } = await rpc($, tool, args);
    const block = imageBlock(content);
    if (block) thumbs.set(slot, { state: 'ready', jpeg: block.data, mimeType: block.mimeType, cache: new Map() });
    // A model sketch answers its SVG text, not an image (the reference tool, workers/api/src/slate/mcp/handlers/images.ts).
    else if (structured && typeof structured.svg === 'string') thumbs.set(slot, { state: 'ready', svg: structured.svg, cache: new Map() });
    else throw workspaceError('No picture came back.');
  } catch (error) {
    thumbs.set(slot, { state: 'failed', reason: errorLine(error) });
  }
  // Another tab's picture, or another workspace's, changes nothing drawn: it waits in `thumbs` for that tab's drawing.
  if (isShown(slot)) await joinPictureBatch($);
}

/**
 * A shown picture landed, or a view that waits on some: drawn with the others of the shown tab, in one redraw once the
 * last is in, or when the batch has waited PICTURE_WAIT_MS (redraw.mjs `pictureRedrawDelay`).
 */
async function joinPictureBatch($) {
  const now = await $.clock.now();
  if (redraw.batchStartAtMs === null) redraw.batchStartAtMs = now;
  // The once-a-second pace is between drawings of one workspace's view: a workspace's first view (the pane says it is
  // loading) draws as soon as its pictures are in.
  const paced = redraw.lastSelfAtMs !== null && redraw.shows === current;
  const delay = pictureRedrawDelay({
    sinceLastSelfMs: paced ? now - redraw.lastSelfAtMs : null,
    sinceBatchStartMs: now - redraw.batchStartAtMs,
    outstanding: thumbsOut(),
  });
  if (redraw.timer) redraw.timer.cancel();
  redraw.timer = $.clock.after(delay, () => {
    redraw.timer = null;
    redraw.batchStartAtMs = null;
    void redrawIfChanged($);
  });
}

/** What `thumbs` holds for a slot, as a drawing would show it, without decoding or encoding a picture. */
function thumbFact(thumbSlot) {
  const thumb = thumbs.get(thumbSlot);
  if (!thumb) return null;
  if (thumb.state === 'loading') return { kind: 'loading' };
  if (thumb.state === 'failed') return { kind: 'failed', reason: thumb.reason };
  return { kind: 'ready' };
}

/**
 * A redraw the pane asks for on its own (a view, pictures, a poll's error): only when what it would draw differs from
 * what is drawn (redraw.mjs `drawnSignature`), and only once the person has paused pressing (`pressQuietDelay`).
 * Presses redraw directly.
 */
async function redrawIfChanged($) {
  const now = await $.clock.now();
  const quiet = pressQuietDelay(redraw.lastPressAtMs === null ? null : now - redraw.lastPressAtMs);
  if (quiet > 0) {
    if (!redraw.quietTimer) redraw.quietTimer = $.clock.after(quiet, () => { redraw.quietTimer = null; void redrawIfChanged($); });
    return;
  }
  if (redraw.drawn !== null) {
    const { model } = paneModel(redraw.surface, redraw.props, thumbFact);
    const signature = drawnSignature(model);
    if (signature === redraw.drawn) return;
    redraw.drawn = signature;
  }
  redraw.lastSelfAtMs = now;
  $.ui.invalidate('ui.render');
}

function stopPolling() {
  if (poll.timer) poll.timer.cancel();
  poll.timer = null;
}

/** Whether the Design workspace pane is still on screen: the person closing it raises nothing a hook sees, so this asks. */
async function paneIsUp($) {
  return (await $.ui.panes()).some((pane) => pane.id === PANE_ID);
}

/** The pane is gone: nothing polls or waits for it any more. */
function paneGone() {
  poll.isOpen = false;
  paneWaits = false;
  stopPolling();
}

async function schedulePoll($) {
  stopPolling();
  const entry = views.get(current);
  const running = wantsPolling({ isOpen: poll.isOpen, hasWorkspace: Boolean(entry), isRunning: Boolean(entry && hasRunning(entry.view)) });
  const retrying = retriesFirstRead({ isOpen: poll.isOpen, hasView: Boolean(entry), failedRetryably: poll.failedRetryably });
  if (!running && !retrying) return;
  const delay = pollDelay(poll.step, entry ? countdownOf(entry.view, entry.receivedAtMs) : null, await $.clock.now());
  poll.timer = $.clock.after(delay, () => { void refresh($); });
}

/** Read the shown workspace now, once the current turn of the clock is through (a pane in sight only). */
function readSoon($) {
  if (poll.isOpen && current) $.clock.after(0, () => { void refresh($); });
}

/**
 * One status read for the shown workspace (the screen in sight), then the next one if anything still runs or a first
 * read failed in a way a retry can mend. A read only ever lands on the workspace it asked about: when the person
 * switched workspaces while it was out, its answer is dropped and the workspace now shown is read instead (the read
 * the switch asked for found this one still out and was dropped).
 */
async function refresh($) {
  if (!(await paneIsUp($))) {
    paneGone();
    return;
  }
  const runDir = current;
  if (!runDir || poll.busy) return;
  poll.busy = true;
  let changed = false;
  try {
    const known = viewOf(runDir);
    const { structured } = await rpc($, TOOLS.status, known ? { runDir, since: known.stamp } : { runDir });
    if (isView(structured) && runDir === current) {
      changed = true;
      pollError = '';
      poll.failedRetryably = false;
      await applyView($, runDir, structured);
    }
  } catch (error) {
    if (runDir === current) {
      pollError = errorLine(error);
      poll.failedRetryably = mendsOnRetry(error);
      await redrawIfChanged($);
    }
  } finally {
    poll.busy = false;
  }
  if (runDir !== current) {
    if (poll.isOpen) await refresh($);
    return;
  }
  poll.step = nextStep(poll.step, changed);
  await schedulePoll($);
}

/**
 * Show `runDir` in the pane. A different workspace starts over and, with the pane open, is read at once (an open pane
 * reads nothing else for a workspace it holds no view of). The workspace already shown is read again only while the
 * pane holds no view of it, as after a first read the server refused: that is how showing it again asks once more.
 */
function showWorkspace($, runDir) {
  if (runDir === current) {
    if (!views.has(runDir)) readSoon($);
    return;
  }
  current = runDir;
  stopPolling();
  poll.step = 0;
  poll.failedRetryably = false;
  pollError = '';
  actionError = '';
  noticeText = '';
  ui.lv = null;
  ui.pauseOp = null;
  ui.promptEdited = false;
  ui.keep = {};
  ui.sketchPath = '';
  selection.ids = null;
  // Presses on the last workspace's drawing hold back no redraw of this one: what they pressed on is gone.
  redraw.lastPressAtMs = null;
  // No redraw here: its one caller opens the pane next, and that open redraws it.
  readSoon($);
}

/**
 * Open the pane. Opened unasked (Claude opened a workspace) a narrow terminal keeps it waiting undrawn: the toast says
 * so and the band above the prompt offers Open, which the person presses, so that open is asked and placed at any width.
 */
async function openPane($, asked) {
  const opened = await $.ui.open(asked ? { id: PANE_ID, title: PANE_TITLE, focus: true } : { id: PANE_ID, title: PANE_TITLE });
  paneWaits = !opened.isPlaced;
  if (paneWaits && !asked) $.ui.toast(READY_TOAST);
  $.ui.invalidate('ui.render');
  return opened;
}

// ---- telling Claude ----
function tell($, text) {
  $.prompt.submit({ text }).catch((error) => {
    actionError = `Recorded, but Claude Code did not take the message: ${error && error.message ? error.message : String(error)}`;
    $.ui.invalidate('ui.render');
  });
  noticeText = SENT;
}

async function runnerCheck($, runDir, opId) {
  const watch = runnerWatch.get(opId);
  if (!watch) return;
  try {
    const { structured } = await rpc($, TOOLS.status, { runDir });
    if (isView(structured)) await applyView($, runDir, structured);
  } catch {
    // The check judges on the last view the pane holds, as the hosted screen does.
  }
  const view = viewOf(runDir);
  const op = view ? findOp(view, opId) : null;
  const verdict = judgeRunner(op, view ? opWaitsOnPerson(view, op) : false, watch);
  if (verdict.drop) {
    runnerWatch.delete(opId);
    return;
  }
  if (verdict.tell) {
    runnerWatch.delete(opId);
    tell($, watch.message);
    $.ui.invalidate('ui.render');
    return;
  }
  watch.waited = verdict.waited;
  $.clock.after(verdict.waitMs, () => { void runnerCheck($, runDir, opId); });
}

function afterRunRecorded($, runDir, opId, message, runner) {
  const first = afterRun(runner);
  if (first.tell) {
    tell($, message);
    return;
  }
  noticeText = RECORDED_RUNNER;
  runnerWatch.set(opId, { message, waited: false });
  $.clock.after(first.waitMs, () => { void runnerCheck($, runDir, opId); });
}

// ---- the clicks ----
async function record($, slot, work) {
  if (inFlight.has(slot)) return;
  inFlight.add(slot);
  // A press whose drawing would be the one already drawn asks for none: every fresh drawing retires the buttons the person
  // may press next (redraw.mjs), so only a stale error or notice, which the press clears, is drawn away now.
  const staleWords = Boolean(actionError || noticeText);
  actionError = '';
  noticeText = '';
  if (staleWords) $.ui.invalidate('ui.render');
  try {
    await work();
    drafts.delete(slot);
  } catch (error) {
    actionError = isActionError(error) ? error.message : errorLine(error);
    // A request the server answered and refused is done with: the next try is a new request. One that may not have
    // reached it (no answer, or a retryable status) keeps its id, so trying again cannot record it twice.
    if (isWorkspaceError(error) && !error.retryable) drafts.delete(slot);
  } finally {
    inFlight.delete(slot);
    $.ui.invalidate('ui.render');
  }
}

async function recordRun($, slot, args) {
  const runDir = args.runDir;
  const { structured } = await rpc($, TOOLS.run, args);
  const view = structured && isView(structured.view) ? structured.view : viewOf(runDir);
  const message = runMessage(runDir, args.opId, args.action, (versionId) => (view ? labelOfVersion(view, versionId) : null));
  if (structured && isView(structured.view)) await applyView($, runDir, structured.view);
  afterRunRecorded($, runDir, args.opId, message, structured ? structured.runner : null);
  poll.step = 0;
  await schedulePoll($);
}

/** The waiting round's op, its picks and whether the person changed them, for the shown workspace. */
function pauseNow() {
  const entry = views.get(current);
  const countdown = entry ? countdownOf(entry.view, entry.receivedAtMs) : null;
  if (!entry || !countdown) return null;
  const round = waitingRound(entry.view);
  const picks = picksOf(entry.view, ui.chosenOp === countdown.opId ? ui.chosen : null);
  return { view: entry.view, countdown, round, picks, changed: Boolean(round && ui.chosenOp === countdown.opId && ui.chosen && !sameList(ui.chosen, round.referenceIds || [])) };
}

/** The screen holds a waiting round's countdown once the person touches it; the pane does the same on the first pick. */
function holdOnce($) {
  const pause = pauseNow();
  if (!pause || pause.countdown.state !== 'countdown' || ui.heldOp === pause.countdown.opId) return;
  ui.heldOp = pause.countdown.opId;
  const runDir = current;
  rpc($, TOOLS.run, holdArgs(runDir, pause.countdown.opId)).then(async ({ structured }) => {
    if (structured && isView(structured.view) && runDir === current) await applyView($, runDir, structured.view);
  }, (error) => { actionError = errorLine(error); $.ui.invalidate('ui.render'); });
}

/**
 * A pick. While a round waits it is that round's pick (and holds its countdown); otherwise it is a toggle of the
 * selection the next round draws from, written whole to the server one request at a time.
 */
function togglePickOf($, id) {
  const pause = pauseNow();
  if (!pause) {
    toggleSelection($, id);
    return;
  }
  const next = togglePick(pause.picks, id, pickLimit(pause.view));
  if (next.refused) noticeText = `At most ${pickLimit(pause.view)} picks.`;
  else noticeText = '';
  ui.chosen = next.picks;
  ui.chosenOp = pause.countdown.opId;
  holdOnce($);
  $.ui.invalidate('ui.render');
}

/** The selection as the pane shows it now: the person's unanswered toggles, else the view's. */
function selectionNow() {
  const view = viewOf(current);
  return view ? selectedOf(view, selection.ids) : [];
}

function toggleSelection($, id) {
  const next = togglePick(selectionNow(), id, SELECTION_MAX);
  noticeText = next.refused ? `At most ${SELECTION_MAX} picks.` : '';
  if (!next.refused) selection.ids = next.picks;
  $.ui.invalidate('ui.render');
  if (!next.refused) void flushSelection($);
}

/** Writes the selection whole, one request in flight; a toggle made meanwhile is sent next, so the last click wins. */
async function flushSelection($) {
  if (selection.sending) return;
  selection.sending = true;
  const runDir = current;
  try {
    while (selection.ids !== null && runDir === current) {
      const sent = selection.ids;
      const { structured } = await rpc($, TOOLS.inspiration, inspirationArgs(runDir, sent));
      if (runDir !== current) break;
      if (selection.ids !== null && sameList(selection.ids, sent)) selection.ids = null;
      if (structured && isView(structured.view)) await applyView($, runDir, structured.view);
    }
  } catch (error) {
    selection.ids = null;
    actionError = errorLine(error);
    $.ui.invalidate('ui.render');
  } finally {
    selection.sending = false;
  }
}

/** Retry: a failed option drawn again through its failed round's own request. */
function retryOption($, tile) {
  if (!tile.retryOpId) return Promise.resolve();
  const runDir = current;
  const slot = workspaceSlot(runDir, 'retry', tile.retryOpId, tile.optionLabel);
  return record($, slot, () => recordRun($, slot, runRetryArgs(runDir, tile.retryOpId, tile.optionLabel)));
}

/** Whether an option is kept now: the person's unanswered click, else the view's heart. */
function keptNow(candidateId) {
  const mine = ui.keep[candidateId];
  if (mine) return mine.kept;
  const view = viewOf(current);
  const candidate = view ? view.candidates.find((entry) => entry.candidateId === candidateId) : null;
  return Boolean(candidate && candidate.kept === true);
}

/** Keep: the heart toggles at once and is sent; it waits for nobody, so the agent is not told. The last click settles it. */
function toggleKeep($, tile) {
  const runDir = current;
  const id = tile.candidateId;
  const kept = !keptNow(id);
  const seq = (ui.keep[id] ? ui.keep[id].seq : 0) + 1;
  ui.keep[id] = { kept, seq };
  $.ui.invalidate('ui.render');
  rpc($, TOOLS.run, runKeepArgs(runDir, uuidV4(), tile.optionLabel, kept)).then(async ({ structured }) => {
    const now = ui.keep[id];
    // A later click is still on its way: its own answer settles the heart.
    if (runDir !== current || !now || now.seq !== seq || !structured || !isView(structured.view)) return;
    delete ui.keep[id];
    await applyView($, runDir, structured.view);
  }, (error) => {
    const now = ui.keep[id];
    if (runDir === current && now && now.seq === seq) delete ui.keep[id];
    actionError = errorLine(error);
    $.ui.invalidate('ui.render');
  });
}

/** Simplify the large view's design, `standard` or `high`; the request is the agent's to draw, as an edit is. */
function simplifyDesign($, level) {
  const tile = largeTile();
  if (!tile || !tile.versionId) return Promise.resolve();
  const runDir = current;
  const slot = workspaceSlot(runDir, 'simplify', tile.versionId, level);
  return record($, slot, async () => {
    await recordRun($, slot, runSimplifyArgs(runDir, draftId(slot), tile.versionId, level));
    ui.lv = null;
  });
}

/** More on one group of a mixed round: a round of that technique only, at the person's 6 or 12. */
function moreOfGroup($, group) {
  const view = viewOf(current);
  if (!view || !group || hasRunning(view)) return Promise.resolve();
  const runDir = current;
  const slot = workspaceSlot(runDir, 'more', group);
  return record($, slot, () => recordRun($, slot, runNewArgs(runDir, draftId(slot), { count: perRoundOf(view, ui.perRound), group })));
}

/** Add the person's own sketch: the picture file at the typed path, read here and sent with the selection, which it joins. */
function addSketch($, text) {
  ui.sketchPath = String(text ?? ui.sketchPath);
  const runDir = current;
  const path = typedPath(ui.sketchPath);
  return record($, workspaceSlot(runDir, 'sketch-add'), async () => {
    if (!path) throw refusal('Type the path of a JPEG, PNG or WebP file first.');
    let read;
    try {
      read = await $.fs.read(path, { as: 'bytes' });
    } catch (error) {
      throw refusal(`Could not read ${path}: ${error && error.message ? error.message : String(error)}`);
    }
    const sketch = sketchUpload(read.base64);
    const sent = selectionNow();
    const { structured } = await rpc($, TOOLS.inspiration, inspirationArgs(runDir, sent, { sketch }));
    ui.sketchPath = '';
    ui.tab = 'sketches';
    // The added sketch is a pick too: of the round that waits on the person, else of the selection.
    const added = structured && Array.isArray(structured.selected) ? structured.selected.filter((id) => isSketchId(id) && !sent.includes(id))[0] : null;
    if (structured && isView(structured.view)) await applyView($, runDir, structured.view);
    if (!added) return;
    const pause = pauseNow();
    if (pause) {
      if (!pause.picks.includes(added)) togglePickOf($, added);
    } else if (selection.ids !== null && !selection.ids.includes(added)) selection.ids = [...selection.ids, added];
  });
}

/** Remove one of the person's own sketches: off the tab and out of the selection, or of the waiting round's picks. */
function removeSketch($, id) {
  const runDir = current;
  return record($, workspaceSlot(runDir, 'sketch-remove', id), async () => {
    const pause = pauseNow();
    if (pause && pause.picks.includes(id)) togglePickOf($, id);
    if (selection.ids !== null) selection.ids = selection.ids.filter((entry) => entry !== id);
    const keep = selectionNow().filter((entry) => entry !== id);
    const { structured } = await rpc($, TOOLS.inspiration, inspirationArgs(runDir, keep, { removeSketch: id }));
    if (structured && isView(structured.view)) await applyView($, runDir, structured.view);
  });
}

function continueRound($) {
  const pause = pauseNow();
  if (!pause) return Promise.resolve();
  const runDir = current;
  const opId = pause.countdown.opId;
  const brief = ui.promptEdited ? ui.prompt : '';
  return record($, workspaceSlot(runDir, 'continue', opId), async () => {
    const { structured } = await rpc($, TOOLS.run, continueArgs(runDir, opId, { referenceIds: pause.changed ? pause.picks : null, brief }));
    ui.tab = 'designs';
    ui.autoTab = false;
    if (structured && isView(structured.view)) await applyView($, runDir, structured.view);
    poll.step = 0;
    await schedulePoll($);
  });
}

function searchPrompt($, words) {
  const runDir = current;
  ui.prompt = String(words ?? ui.prompt);
  ui.promptEdited = true;
  holdOnce($);
  return record($, workspaceSlot(runDir, 'inspire', ui.prompt), async () => {
    const { structured } = await rpc($, TOOLS.inspire, inspireArgs(runDir, ui.prompt, SEARCH_COUNT));
    ui.tab = 'inspiration';
    if (structured && isView(structured.view)) await applyView($, runDir, structured.view);
    else await refresh($);
  });
}

function setPerRound($, n) {
  const view = viewOf(current);
  ui.perRound = n;
  $.ui.invalidate('ui.render');
  if (n !== 12 || !view || !twelveDraws(view, hasRunning(view))) return Promise.resolve();
  const runDir = current;
  const slot = workspaceSlot(runDir, 'more');
  return record($, slot, () => recordRun($, slot, runNewArgs(runDir, draftId(slot), { count: 12 })));
}

function largeTile() {
  const view = viewOf(current);
  const tile = view && ui.lv ? tilesOf(view).find((entry) => entry.candidateId === ui.lv.candidateId) ?? null : null;
  return tile ? { ...tile, kept: keptNow(tile.candidateId) } : null;
}

/** Build this: record the pick, record the Convert-to-HTML hand-off (the request Claude builds from), then tell Claude. */
function buildThis($) {
  const tile = largeTile();
  if (!tile || !tile.versionId) return Promise.resolve();
  const runDir = current;
  const slot = workspaceSlot(runDir, 'build', tile.versionId);
  return record($, slot, async () => {
    const { structured } = await rpc($, TOOLS.pick, pickArgs(runDir, tile.versionId));
    if (structured && isView(structured.view)) await applyView($, runDir, structured.view);
    // One handoff id per version, kept until the whole click succeeded, so a retry never records a second request.
    const handoff = await rpc($, TOOLS.handoff, convertHandoffArgs(runDir, draftId(slot), tile.versionId));
    if (handoff.structured && isView(handoff.structured.view)) await applyView($, runDir, handoff.structured.view);
    const label = structured && structured.pick && structured.pick.label ? structured.pick.label : tile.label;
    tell($, buildMessage(runDir, label));
  });
}

function editDesign($, words) {
  const tile = largeTile();
  if (!tile || !tile.versionId) return Promise.resolve();
  const runDir = current;
  const slot = workspaceSlot(runDir, 'edit', tile.versionId);
  return record($, slot, async () => {
    await recordRun($, slot, runEditArgs(runDir, draftId(slot), tile.versionId, words));
    ui.lv = null;
  });
}

function branchDesign($, scope, pagesText) {
  const tile = largeTile();
  if (!tile || !tile.versionId) return Promise.resolve();
  const runDir = current;
  // One draft per version and scope: a Full page retry cannot repeat as More pages, nor the reverse.
  const slot = workspaceSlot(runDir, 'branch', tile.versionId, scope);
  return record($, slot, async () => {
    await recordRun($, slot, runBranchArgs(runDir, draftId(slot), tile.versionId, scope, pagesText));
    ui.lv = null;
  });
}

// ---- drawing ----
async function probeBlit($, slot, source) {
  if (blit.probed) return;
  blit.probed = true;
  const answer = await $.ui.blit({ requestId: PANE_ID, key: slot, source });
  blit.lastAnswer = answer;
  $.ui.log(`blit probe: ${JSON.stringify(answer)}`, { to: 'debug' });
  if (blitSaysAlt(answer)) {
    blit.altDrawn = true;
    $.ui.invalidate('ui.render');
  }
}

/**
 * New thumbnail decodes one render may run. The JPEG and WebP decoders are pure JS on the hooks worker, which must
 * answer the engine's heartbeat within 5 s or the engine unloads the mod (seen live 2026-10-02: one render decoding a
 * page of references wedged the worker and the pane vanished). The rest show as loading and the next render takes them.
 */
const DECODES_PER_RENDER = 2;
const decodes = { left: DECODES_PER_RENDER, deferred: false };

/** The picture of one thumbnail (a design version or a reference) for a box `tileColumns` wide. */
function pictureFor(surface, thumbSlot, size, useCells, tileColumns, maxRows) {
  const thumb = thumbs.get(thumbSlot);
  if (!thumb) return null;
  if (thumb.state === 'loading') return { kind: 'loading' };
  if (thumb.state === 'failed') return { kind: 'failed', reason: thumb.reason };
  // A model sketch is vector text: the desktop draws it as it is; the terminal has no Svg element.
  if (thumb.svg !== undefined) {
    if (surface === 'terminal' || thumb.svg.length > SVG_MAX_CHARS) return { kind: 'text', text: 'A layout sketch. Sketch pictures show in the Claude app.' };
    return { kind: 'svg', source: thumb.svg, ...desktopPictureSize(tileBox(tileColumns, size.width, size.height, maxRows), size.width, size.height) };
  }
  const kind = pictureKind(surface, { useCells });
  if (kind !== 'svg' && !thumb.decoded) {
    if (decodes.left <= 0) {
      decodes.deferred = true;
      return { kind: 'loading' };
    }
    decodes.left -= 1;
  }
  const box = tileBox(tileColumns, size.width, size.height, maxRows);
  const cacheSlot = `${kind}:${box.columns}x${box.rows}`;
  if (thumb.cache.has(cacheSlot)) return thumb.cache.get(cacheSlot);
  let picture;
  try {
    if (kind === 'svg') {
      const width = size.width || 480;
      const height = size.height || 270;
      const svg = svgPicture({ jpegBase64: thumb.jpeg, width, height, mimeType: thumb.mimeType }, () => decodedOf(thumb));
      picture = { kind, source: svg.source, ...desktopPictureSize(box, width, height) };
    } else if (kind === 'raster') {
      picture = { kind, ...rasterCells(decodedOf(thumb), box.columns, box.rows) };
    } else {
      picture = { kind, source: imageSource(decodedOf(thumb), box), columns: box.columns, rows: box.rows };
    }
  } catch (error) {
    picture = { kind: 'failed', reason: error && error.message ? error.message : String(error) };
  }
  thumb.cache.set(cacheSlot, picture);
  return picture;
}

function decodedOf(thumb) {
  if (!thumb.decoded) thumb.decoded = decodeThumb(thumb.jpeg, thumb.mimeType);
  return thumb.decoded;
}

/** A reference's size: the corpus record, else the decoded picture's own once it is in. */
function refSize(view, id) {
  const thumb = thumbs.get(workspaceSlot(current, `ref:${id}`));
  if (thumb && thumb.state === 'ready' && thumb.decoded) return { width: thumb.decoded.width, height: thumb.decoded.height };
  return referenceSize(view, id);
}

/** The pane's handlers, each noting the press first, so the pane's own redraws wait for the pause after it (redraw.mjs). */
function pressHandlers($, handlers) {
  const noted = {};
  for (const [name, handler] of Object.entries(handlers)) {
    noted[name] = (...args) => {
      void $.clock.now().then((now) => { redraw.lastPressAtMs = now; });
      return handler(...args);
    };
  }
  return noted;
}

/**
 * What the pane draws for `surface` and its `props`, as a plain model (pane.mjs draws it). `pictureOf(thumbSlot, size,
 * tileColumns, maxRows)` gives each picture: the render's real ones, or redrawIfChanged's facts without pixels.
 */
function paneModel(surface, props, pictureOf) {
  const bodyColumns = props && typeof props.bodyColumns === 'number' ? props.bodyColumns : 80;
  const maxRows = pictureMaxRows(props && props.scroll ? props.scroll.bodyRows : undefined);
  const grid = tileGrid(bodyColumns);
  const tileColumns = Math.max(8, grid.columns - 2);
  const entry = current ? views.get(current) : null;
  const view = entry ? entry.view : null;
  let probe = null;
  const budget = imageTreeBudget();
  const remember = (slot, picture) => {
    const admitted = budget.admit(picture);
    if (admitted && admitted.kind === 'image' && !probe) probe = { slot: 'picture:' + slot, source: admitted.source };
    return admitted;
  };
  const model = {
    surface,
    workspace: current,
    emptyText: current ? LOADING : NO_WORKSPACE,
    isLoading: !view,
    prompt: ui.prompt,
    tab: ui.tab,
    noticeText,
    errorText: actionError || pollError,
    tileColumns,
    items: [],
    sections: [],
    selectable: ui.tab !== 'designs',
    sketches: ui.tab === 'sketches' ? { drawing: false, path: ui.sketchPath } : null,
    lv: null,
    tray: null,
    selectedCount: 0,
    emptyLine: '',
    perRound: 6,
    perRoundOptions: PER_ROUND,
  };
  if (!view) return { model, probe };
  if (!ui.promptEdited) model.prompt = ui.prompt = briefLine(view);
  const pause = pauseNow();
  // What is picked: the waiting round's picks, else the selection the next round draws from.
  const picks = pause ? pause.picks : selectionNow();
  model.selectedCount = ui.tab !== 'designs' || pause ? picks.length : (view.pick ? 1 : 0);
  if (pause) {
    model.tray = { words: `${picks.length} picked · ${countdownLine(pause.countdown)}`, canContinue: picks.length > 0 };
  }
  if (ui.tab === 'designs') {
    model.perRound = perRoundOf(view, ui.perRound);
    if (ui.lv) {
      const tile = largeTile();
      if (tile) {
        const lvColumns = Math.max(16, bodyColumns - 4);
        const picture = tile.versionId ? pictureOf(workspaceSlot(current, tile.versionId), { width: tile.width, height: tile.height }, lvColumns, Math.max(maxRows, 30)) : null;
        model.lv = { tile, picture: remember(`lv:${tile.candidateId}`, picture), mode: ui.lv.mode, scope: ui.lv.scope, pages: ui.lv.pages };
      } else ui.lv = null;
    }
    const tiles = tilesOf(view).map((tile) => ({
      ...tile,
      kept: keptNow(tile.candidateId),
      picture: tile.versionId ? remember(tile.candidateId, pictureOf(workspaceSlot(current, tile.versionId), { width: tile.width, height: tile.height }, tileColumns, maxRows)) : null,
    }));
    model.sections = designSections(view, tiles);
  } else {
    let ids;
    let sizeOf = (id) => refSize(view, id);
    if (ui.tab === 'sketches') {
      ids = sketchesOf(view).map((sketch) => ({ id: sketch.id, title: sketchName(view, sketch.id), own: sketch.own }));
      sizeOf = () => sketchSize(view);
      model.sketches = { drawing: sketchesDrawing(view), path: ui.sketchPath };
      model.emptyLine = SKETCHES_NONE;
    } else {
      ids = ui.tab === 'references' ? siteItems(view) : inspirationIds(view).map((id) => ({ id, title: '' }));
      model.emptyLine = ui.tab === 'references' ? (pause ? 'Finding live sites.' : 'No website references yet.') : 'No inspiration yet.';
    }
    model.items = ids.map((item) => ({
      ...item,
      selected: picks.includes(item.id),
      picture: remember(item.id, pictureOf(workspaceSlot(current, `ref:${item.id}`), sizeOf(item.id), tileColumns, maxRows)),
    }));
  }
  return { model, probe };
}

export function register(on) {
  on('tool.call', { tool: ['mcp__plugin_12ui-design_12ui-workspace__design_slate_create', 'mcp__plugin_12ui-design_12ui-workspace__design_slate_show'] }, async ($, e, next) => {
    const result = await next(e);
    const handle = handleFromCall(e, result);
    if (handle) {
      showWorkspace($, handle);
      // The tool's result is the model's whatever the pane does: a pane that cannot open is logged, never thrown.
      try {
        await openPane($, false);
      } catch (error) {
        $.ui.log(`the Design workspace pane did not open: ${error && error.message ? error.message : String(error)}`, { to: 'debug' });
      }
    }
    return result;
  });

  // Matched on every Pane, as design 3.7 spells the hook; only this mod's own pane is drawn here, and any other pane goes
  // on down the chain untouched.
  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE_ID) return next(e);
    if (paneWaits) {
      // Drawn after waiting (the terminal widened): the band's Open goes away.
      paneWaits = false;
      $.ui.invalidate('ui.render');
    }
    const els = $.ui.resolve(e);
    if (!poll.isOpen) {
      poll.isOpen = true;
      readSoon($);
    }
    const useCells = useCellsFor({ toggled: blit.toggled, altDrawn: blit.altDrawn });
    decodes.left = DECODES_PER_RENDER;
    decodes.deferred = false;
    const { model, probe } = paneModel(e.surface, e.props, (thumbSlot, size, tileColumns, maxRows) => pictureFor(e.surface, thumbSlot, size, useCells, tileColumns, maxRows));
    redraw.drawn = drawnSignature(model);
    redraw.shows = current && views.has(current) ? current : null;
    redraw.surface = e.surface;
    redraw.props = e.props;
    if (decodes.deferred) $.clock.after(50, () => { $.ui.invalidate('ui.render'); });
    if (probe && !blit.probed) $.clock.after(250, () => { void probeBlit($, probe.slot, probe.source); });
    model.handlers = pressHandlers($, {
      promptInput: (value) => { ui.prompt = String(value ?? ''); ui.promptEdited = true; },
      promptSubmit: (value) => { void searchPrompt($, value); },
      tab: (name) => { ui.tab = name; ui.autoTab = false; ui.lv = null; fetchThumbs($, current); $.ui.invalidate('ui.render'); },
      toggle: (id) => { togglePickOf($, id); },
      continueRound: () => { void continueRound($); },
      perRound: (n) => { void setPerRound($, n); },
      open: (tile) => { ui.lv = { candidateId: tile.candidateId, mode: null, scope: null, pages: '' }; $.ui.invalidate('ui.render'); },
      close: () => { ui.lv = null; $.ui.invalidate('ui.render'); },
      edit: () => { if (ui.lv) { ui.lv.mode = ui.lv.mode === 'edit' ? null : 'edit'; ui.lv.scope = null; } $.ui.invalidate('ui.render'); },
      editSubmit: (words) => { void editDesign($, words); },
      branch: () => { if (ui.lv) { ui.lv.mode = ui.lv.mode === 'branch' ? null : 'branch'; ui.lv.scope = null; } $.ui.invalidate('ui.render'); },
      branchScope: (scope) => {
        if (scope === 'page') void branchDesign($, 'page', '');
        else if (ui.lv) { ui.lv.scope = 'site'; $.ui.invalidate('ui.render'); }
      },
      branchPagesInput: (value) => { if (ui.lv) ui.lv.pages = String(value ?? ''); },
      branchSubmit: (value) => { void branchDesign($, 'site', value ?? (ui.lv ? ui.lv.pages : '')); },
      buildThis: () => { void buildThis($); },
      retry: (tile) => { void retryOption($, tile); },
      keep: (tile) => { toggleKeep($, tile); },
      simplify: (level) => { void simplifyDesign($, level); },
      groupMore: (group) => { void moreOfGroup($, group); },
      sketchPathInput: (value) => { ui.sketchPath = String(value ?? ''); },
      addSketch: (value) => { void addSketch($, value); },
      removeSketch: (id) => { void removeSketch($, id); },
    });
    return paneTree(els, model);
  });

  // The band above the prompt, only while the pane waits undrawn: one line and Open. Every other time, and while the
  // engine shows its own survey there, the band is the next plugin's.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!paneWaits || (e.props && e.props.hasSurvey)) return next(e);
    return bandTree($.ui.resolve(e), () => { void openPane($, true); });
  });
}
