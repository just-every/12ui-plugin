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
 * counts down. Nothing else: the mod reads nothing from the computer, runs nothing and touches no other tool's calls.
 */

import { ActionError, continueArgs, convertHandoffArgs, holdArgs, inspireArgs, pickArgs, runBranchArgs, runEditArgs, runNewArgs } from './workspace/actions.mjs';
import { uuidV4 } from './workspace/bytes.mjs';
import { LOADING, NO_ROUND_WAITING, NO_WORKSPACE, PANE_ID, PANE_TITLE, READY_TOAST, RECORDED_RUNNER, SENT } from './workspace/copy.mjs';
import { PER_ROUND, SEARCH_COUNT, inspirationIds, perRoundOf, pickLimit, picksOf, referenceSize, sameList, siteItems, togglePick, twelveDraws, waitingRound } from './workspace/gallery.mjs';
import { handleFromCall } from './workspace/handles.mjs';
import { afterRun, buildMessage, judgeRunner, runMessage } from './workspace/messages.mjs';
import { bandTree, paneTree } from './workspace/pane.mjs';
import { pictureMaxRows, tileGrid } from './workspace/layout.mjs';
import { blitSaysAlt, decodeThumb, desktopPictureSize, imageSource, pictureKind, rasterCells, svgPicture, tileBox, useCellsFor } from './workspace/picture.mjs';
import { nextStep, pollDelay, retriesFirstRead, wantsPolling } from './workspace/poll.mjs';
import { TOOLS, WorkspaceError, errorLine, imageBlock, mendsOnRetry, readRpc, rpcBody } from './workspace/transport.mjs';
import { briefLine, countdownLine, countdownOf, findOp, hasRunning, isView, labelOfVersion, opWaitsOnPerson, shownVersionIds, tilesOf } from './workspace/view.mjs';

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
// What the person is doing in the pane: the tab, the prompt line, the waiting round's picks, the large view.
const ui = { tab: 'inspiration', autoTab: false, prompt: '', promptEdited: false, chosen: null, chosenOp: null, heldOp: null, pauseOp: null, lv: null, perRound: null, nowMs: 0 };
const poll = { timer: null, step: 0, busy: false, isOpen: false, failedRetryably: false };
const blit = { altDrawn: false, toggled: null, probed: false, lastAnswer: null };
let ticker = null;
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
  syncTicker($);
  if (runDir === current) followPause(view, views.get(runDir).receivedAtMs);
  for (const versionId of shownVersionIds(view)) {
    const slot = workspaceSlot(runDir, versionId);
    if (!thumbs.has(slot)) void fetchThumb($, slot, TOOLS.image, { runDir, versionId, size: 'thumb' });
  }
  for (const id of [...inspirationIds(view), ...siteItems(view).map((site) => site.id)]) {
    const slot = workspaceSlot(runDir, `ref:${id}`);
    if (!thumbs.has(slot)) void fetchThumb($, slot, TOOLS.reference, { runDir, referenceId: id, size: 'thumb' });
  }
  $.ui.invalidate('ui.render');
}

/**
 * A round that starts waiting on the person opens the pane on Inspiration with its picks preselected; when the wait
 * ends (Continue, or the countdown ran out) a pane the round put on Inspiration moves to Designs, as the screen does.
 */
function followPause(view, receivedAtMs) {
  const countdown = countdownOf(view, receivedAtMs);
  if (countdown && ui.pauseOp !== countdown.opId) {
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
    const { content } = await rpc($, tool, args);
    const block = imageBlock(content);
    if (!block) throw new WorkspaceError('No picture came back.');
    thumbs.set(slot, { state: 'ready', jpeg: block.data, mimeType: block.mimeType, cache: new Map() });
  } catch (error) {
    thumbs.set(slot, { state: 'failed', reason: errorLine(error) });
  }
  $.ui.invalidate('ui.render');
}

function stopPolling() {
  if (poll.timer) poll.timer.cancel();
  poll.timer = null;
}

function stopTicker() {
  if (ticker) ticker.cancel();
  ticker = null;
}

function syncTicker($) {
  const entry = views.get(current);
  const countdown = entry ? countdownOf(entry.view, entry.receivedAtMs) : null;
  if (poll.isOpen && countdown && countdown.state === 'countdown') {
    if (!ticker) ticker = $.clock.every(1000, () => $.ui.invalidate('ui.render'));
  } else stopTicker();
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
      $.ui.invalidate('ui.render');
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
  stopTicker();
  poll.step = 0;
  poll.failedRetryably = false;
  pollError = '';
  actionError = '';
  noticeText = '';
  ui.lv = null;
  ui.pauseOp = null;
  ui.promptEdited = false;
  $.ui.invalidate('ui.render');
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
  actionError = '';
  noticeText = '';
  $.ui.invalidate('ui.render');
  try {
    await work();
    drafts.delete(slot);
  } catch (error) {
    actionError = error instanceof ActionError ? error.message : errorLine(error);
    // A request the server answered and refused is done with: the next try is a new request. One that may not have
    // reached it (no answer, or a retryable status) keeps its id, so trying again cannot record it twice.
    if (error instanceof WorkspaceError && !error.retryable) drafts.delete(slot);
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

function togglePickOf($, id) {
  const pause = pauseNow();
  if (!pause) {
    noticeText = NO_ROUND_WAITING;
    $.ui.invalidate('ui.render');
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
    if (structured && isView(structured.view)) await applyView($, runDir, structured.view);
    else await refresh($);
    ui.tab = 'inspiration';
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
  return view && ui.lv ? tilesOf(view).find((tile) => tile.candidateId === ui.lv.candidateId) ?? null : null;
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
/** Image source one pane tree may carry: under the engine's 2 MiB cap on a tree's Image sources. */
const IMAGE_TREE_BYTES = 1_800_000;
const decodes = { left: DECODES_PER_RENDER, deferred: false };

/** The picture of one thumbnail (a design version or a reference) for a box `tileColumns` wide. */
function pictureFor(surface, thumbSlot, size, useCells, tileColumns, maxRows) {
  const thumb = thumbs.get(thumbSlot);
  if (!thumb) return null;
  if (thumb.state === 'loading') return { kind: 'loading' };
  if (thumb.state === 'failed') return { kind: 'failed', reason: thumb.reason };
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

function paneModel($, e, els) {
  const surface = e.surface;
  const bodyColumns = e.props && typeof e.props.bodyColumns === 'number' ? e.props.bodyColumns : 80;
  const maxRows = pictureMaxRows(e.props && e.props.scroll ? e.props.scroll.bodyRows : undefined);
  const grid = tileGrid(bodyColumns);
  const tileColumns = Math.max(8, grid.columns - 2);
  const entry = current ? views.get(current) : null;
  const view = entry ? entry.view : null;
  const useCells = useCellsFor({ toggled: blit.toggled, altDrawn: blit.altDrawn });
  decodes.left = DECODES_PER_RENDER;
  decodes.deferred = false;
  let probe = null;
  let imageBytes = 0;
  const remember = (slot, picture) => {
    if (!picture || picture.kind !== 'image') return picture;
    // The engine refuses a whole tree past IMAGE_TREE_BYTES of Image source and draws an empty pane (seen live
    // 2026-10-02 on a page of tall references before the blit probe answered): a picture past the budget waits.
    imageBytes += picture.source.length;
    if (imageBytes > IMAGE_TREE_BYTES) return { kind: 'loading' };
    if (!probe) probe = { slot: 'picture:' + slot, source: picture.source };
    return picture;
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
    tiles: [],
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
  const picks = pause ? pause.picks : [];
  model.selectedCount = pause ? picks.length : (view.pick ? 1 : 0);
  if (pause) {
    const nowWords = countdownLine(pause.countdown, ui.nowMs);
    model.tray = { words: `${picks.length} picked · ${nowWords}`, canContinue: picks.length > 0 };
  }
  if (ui.tab === 'designs') {
    model.perRound = perRoundOf(view, ui.perRound);
    if (ui.lv) {
      const tile = largeTile();
      if (tile) {
        const lvColumns = Math.max(16, bodyColumns - 4);
        const picture = tile.versionId ? pictureFor(surface, workspaceSlot(current, tile.versionId), { width: tile.width, height: tile.height }, useCells, lvColumns, Math.max(maxRows, 30)) : null;
        model.lv = { tile, picture: remember(`lv:${tile.candidateId}`, picture), mode: ui.lv.mode, scope: ui.lv.scope, pages: ui.lv.pages };
      } else ui.lv = null;
    }
    model.tiles = tilesOf(view).map((tile) => ({
      ...tile,
      picture: tile.versionId ? remember(tile.candidateId, pictureFor(surface, workspaceSlot(current, tile.versionId), { width: tile.width, height: tile.height }, useCells, tileColumns, maxRows)) : null,
    }));
  } else {
    const ids = ui.tab === 'references' ? siteItems(view) : inspirationIds(view).map((id) => ({ id, title: '' }));
    model.emptyLine = ui.tab === 'references' ? (pause ? 'Finding live sites.' : 'No website references yet.') : 'No inspiration yet.';
    model.items = ids.map((item) => ({
      ...item,
      selected: picks.includes(item.id),
      picture: remember(item.id, pictureFor(surface, workspaceSlot(current, `ref:${item.id}`), refSize(view, item.id), useCells, tileColumns, maxRows)),
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

  on('ui.close', { id: 'design-workspace' }, async ($, e, next) => {
    poll.isOpen = false;
    paneWaits = false;
    stopPolling();
    stopTicker();
    return next(e);
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
    ui.nowMs = await $.clock.now();
    const { model, probe } = paneModel($, e, els);
    if (decodes.deferred) $.clock.after(50, () => { $.ui.invalidate('ui.render'); });
    if (probe && !blit.probed) $.clock.after(250, () => { void probeBlit($, probe.slot, probe.source); });
    model.handlers = {
      promptInput: (value) => { ui.prompt = String(value ?? ''); ui.promptEdited = true; },
      promptSubmit: (value) => { void searchPrompt($, value); },
      tab: (name) => { ui.tab = name; ui.autoTab = false; ui.lv = null; $.ui.invalidate('ui.render'); },
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
    };
    return paneTree(els, model);
  });

  // The band above the prompt, only while the pane waits undrawn: one line and Open. Every other time, and while the
  // engine shows its own survey there, the band is the next plugin's.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!paneWaits || (e.props && e.props.hasSurvey)) return next(e);
    return bandTree($.ui.resolve(e), () => { void openPane($, true); });
  });
}
