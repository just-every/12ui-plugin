/**
 * When the pane next asks the server for the workspace (`design.slate.status`): the hosted screen's backoff
 * (2, 3, 5, 8, then 10 s; `DELAYS` in packages/12ui/src/mcp-slate-ui-script-state.ts), reset by every change, and
 * never later than the moment a start countdown ends, when the server lets that round go. Polling is the screen being
 * in sight (workers/api/src/slate/limits.ts `SLATE_PAUSE`): only while the pane is open and something runs, or while the
 * first read of the shown workspace keeps failing in a way a retry can mend. Pure.
 */

export const POLL_DELAYS_MS = Object.freeze([2000, 3000, 5000, 8000, 10000]);

/** A countdown's last poll lands this long after its end, so the server has passed its deadline. */
export const COUNTDOWN_MARGIN_MS = 500;

/** The backoff step after a poll: back to the start when the view changed, one step on otherwise (unchanged, failed). */
export function nextStep(step, changed) {
  return changed ? 0 : Math.min(step + 1, POLL_DELAYS_MS.length - 1);
}

/** Whether the pane polls at all: open, a workspace shown, and something running. */
export function wantsPolling({ isOpen, hasWorkspace, isRunning }) {
  return Boolean(isOpen && hasWorkspace && isRunning);
}

/**
 * Whether the pane reads again for a workspace it holds no view of yet: open, and the last read failed in a way a later
 * read can mend (a 429, a 5xx, no answer at all). A refusal such as `unknown_workspace` keeps its error line and reads
 * nothing more; Claude showing the workspace again still asks once.
 */
export function retriesFirstRead({ isOpen, hasView, failedRetryably }) {
  return Boolean(isOpen && !hasView && failedRetryably);
}

/** How long until the next poll: the backoff delay, cut short to just after a running countdown's end. */
export function pollDelay(step, countdown, nowMs) {
  const delay = POLL_DELAYS_MS[Math.min(Math.max(step, 0), POLL_DELAYS_MS.length - 1)];
  if (countdown && countdown.state === 'countdown' && typeof countdown.endsAtMs === 'number') {
    const untilEnd = countdown.endsAtMs - nowMs + COUNTDOWN_MARGIN_MS;
    return Math.max(COUNTDOWN_MARGIN_MS, Math.min(delay, untilEnd));
  }
  return delay;
}
