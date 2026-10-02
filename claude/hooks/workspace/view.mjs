/**
 * The `12ui.slate.view/3` projection the server returns, read into what the pane draws: one tile per option with its
 * state, the header counts, the start countdown, and whether anything still runs. Pure: no `$`, no clock (the caller
 * passes the time a view was received).
 *
 * The server owns every rule; this module only reads its fields (packages/12ui/src/slate-view-contract.ts):
 * a candidate is `ready` once it has a version, `failed` with the server's own reason, `pending` while its round or an
 * edit runs; a running op's `phase` is `agent` until the workspace runner on the person's computer claims it
 * (`drawing`); a round may wait on the person (`rounds[].pause`) before it is drawn.
 */

export const VIEW_SCHEMA = '12ui.slate.view/3';

/** Whether the value is a whole view (a status answer may instead be `{ unchanged: true, stamp }`). */
export function isView(value) {
  return Boolean(value && typeof value === 'object' && value.schema === VIEW_SCHEMA && Array.isArray(value.candidates));
}

const RUNNING = new Set(['starting', 'running']);

/** Whether an op still runs. */
export function isRunningOp(op) {
  return Boolean(op && RUNNING.has(op.state));
}

function opById(view, opId) {
  return opId ? view.ops.find((op) => op.opId === opId) ?? null : null;
}

function roundOpOf(view, roundId) {
  return view.ops.find((op) => op.kind === 'round' && isRunningOp(op) && op.roundId === roundId) ?? null;
}

function roundById(view, roundId) {
  return view.rounds.find((round) => round.roundId === roundId) ?? null;
}

function byLabel(a, b) {
  return a.label.length - b.label.length || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0);
}

/**
 * The state words of one option: `selected`, `ready`, `waiting to start` (its round waits on the person),
 * `being drawn` (the runner holds it), `waiting for your agent`, or `failed` with the server's reason verbatim.
 */
export function tileOf(view, candidate) {
  const versionId = candidate.latestVersionId ?? null;
  const version = versionId ? view.versions.find((entry) => entry.versionId === versionId) ?? null : null;
  const pickedId = view.pick ? view.pick.versionId : null;
  const isSelected = Boolean(pickedId && candidate.versionIds.includes(pickedId));
  const op = candidate.busy ? opById(view, candidate.busyOpId) ?? roundOpOf(view, candidate.roundId) : null;
  const round = roundById(view, candidate.roundId);
  let state;
  let reason = null;
  if (candidate.state === 'failed') {
    state = 'failed';
    reason = typeof candidate.error === 'string' && candidate.error ? candidate.error : null;
  } else if (op && op.kind === 'round' && round && round.pause && candidate.state === 'pending') state = 'waiting to start';
  else if (op && isRunningOp(op)) state = op.phase === 'drawing' ? 'being drawn' : 'waiting for your agent';
  else if (candidate.state === 'pending') state = 'waiting for your agent';
  else state = isSelected ? 'selected' : 'ready';
  return {
    candidateId: candidate.candidateId,
    label: version ? version.label : candidate.label,
    optionLabel: candidate.label,
    versionId,
    width: version ? version.width : null,
    height: version ? version.height : null,
    isReady: candidate.state === 'ready',
    isSelected,
    isBusy: Boolean(op),
    editable: Boolean(version && version.editable),
    state,
    reason,
  };
}

/** The line under an option's label: its state, a failure with its reason. */
export function stateLine(tile) {
  if (tile.state === 'failed') return tile.reason ? `failed: ${tile.reason}` : 'failed';
  return tile.state;
}

/** Every option, in label order (A, B, ..., Z, AA). */
export function tilesOf(view) {
  return [...view.candidates].sort(byLabel).map((candidate) => tileOf(view, candidate));
}

/** "4 options · 2 being drawn · 1 failed": the option count, then each state that is not plain ready. */
export function countsLine(tiles) {
  if (tiles.length === 0) return 'No options yet';
  const parts = [tiles.length === 1 ? '1 option' : `${tiles.length} options`];
  for (const state of ['waiting to start', 'being drawn', 'waiting for your agent', 'failed', 'selected']) {
    const n = tiles.filter((tile) => tile.state === state).length;
    if (n > 0) parts.push(`${n} ${state}`);
  }
  return parts.join(' · ');
}

/** The brief on one line: the concept with its whitespace folded. */
export function briefLine(view) {
  const concept = view.brief && typeof view.brief.concept === 'string' ? view.brief.concept : '';
  return concept.replace(/\s+/g, ' ').trim() || 'Design workspace';
}

/**
 * The round that waits on the person (the latest with a `pause` and a running op): its op, its state, and when its
 * countdown ends on the caller's clock (`receivedAtMs` + `remainingMs`), or null.
 */
export function countdownOf(view, receivedAtMs) {
  const waiting = view.rounds.filter((round) => round.pause);
  for (let index = waiting.length - 1; index >= 0; index -= 1) {
    const round = waiting[index];
    const op = roundOpOf(view, round.roundId);
    if (!op) continue;
    const pause = round.pause;
    return {
      opId: op.opId,
      roundId: round.roundId,
      state: pause.state,
      endsAtMs: pause.state === 'countdown' ? receivedAtMs + Math.max(0, pause.remainingMs) : null,
    };
  }
  return null;
}

/** "Starting in 42 s" while it counts down, "Paused" when held, "Starting" at zero or while awaiting the screen. */
export function countdownLine(countdown, nowMs) {
  if (!countdown) return '';
  if (countdown.state === 'held') return 'Paused. Press Continue when ready.';
  if (countdown.state !== 'countdown' || countdown.endsAtMs === null) return 'Starting.';
  const left = Math.ceil((countdown.endsAtMs - nowMs) / 1000);
  return left > 0 ? `Starting in ${left} s. Press Continue to start now.` : 'Starting.';
}

/** Whether anything in the workspace still runs (so the pane keeps polling). */
export function hasRunning(view) {
  return view.ops.some(isRunningOp);
}

/** An op of the view by id. */
export function findOp(view, opId) {
  return opById(view, opId);
}

/** Whether a round op waits on the person (its round carries a pause): nobody's to draw yet. */
export function opWaitsOnPerson(view, op) {
  if (!op || op.kind !== 'round') return false;
  const round = roundById(view, op.roundId);
  return Boolean(round && round.pause);
}

/** The version a label names in this view, for the agent messages (`A`, `B2`), or null. */
export function labelOfVersion(view, versionId) {
  const version = versionId ? view.versions.find((entry) => entry.versionId === versionId) : null;
  return version ? version.label : null;
}

/** The versions whose thumbnails the pane shows: each ready option's latest. */
export function shownVersionIds(view) {
  return view.candidates.map((candidate) => candidate.latestVersionId).filter((id) => typeof id === 'string');
}

/** The selected option's version, for Build and Convert, or null. */
export function pickedVersion(view) {
  if (!view.pick) return null;
  return { versionId: view.pick.versionId, label: view.pick.label };
}
