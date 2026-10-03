/**
 * What the pane tells Claude after a click is recorded, and when it says nothing: the port of the hosted screen's
 * messages (packages/12ui/src/mcp-slate-ui-script-remote.ts). Pure: no `$`, no clock.
 *
 * Five messages, one per click: new options, more like an option, an edit, a branch, and Build this (the selection). `$.prompt.submit`
 * sends them framed as from this mod, so "I" of the screen becomes "The user". Each names what happened and how to
 * confirm it (`design.slate.data`, whose answer is the server's own trusted text) and carries no command, flag, path,
 * price or credit word; the user's own words (a note, an edit instruction, branch page names) are never put in a
 * message: the agent reads them from the data tool, quoted.
 *
 * The runner rule: when the run result says the workspace runner on the user's computer holds the workspace
 * (`runner.alive`), the runner claims the request within seconds and nobody is told. The agent is told after all, with
 * the same message, when the request is still the agent's once RUNNER_GRACE_MS has passed; while the runner draws it,
 * or while its round waits on the user, the pane keeps checking every RUNNER_RECHECK_MS.
 */

export const DATA_TOOL = 'design.slate.data';
export const RUNNER_GRACE_MS = 20000;
export const RUNNER_RECHECK_MS = 10000;

/** The message for a recorded Generate more, More like this, Edit or Branch request. */
export function runMessage(runDir, opId, action, labelOf) {
  let head;
  if (action.kind === 'edit') head = `The user asked to edit ${labelOf(action.versionId) ?? 'an option'}`;
  else if (action.mode === 'branch') head = `The user asked for ${action.scope === 'page' ? 'the full page' : 'more pages'} of ${labelOf(action.fromVersionId) ?? 'a design'}`;
  else if (action.mode === 'like') head = `The user asked for more like ${labelOf(action.fromVersionId) ?? 'an option'}`;
  else head = 'The user asked for new options';
  return `${head} in the Design workspace (request ${opId}, runDir ${runDir}). Please confirm it with ${DATA_TOOL}, then carry it out.`;
}

/** The message for a recorded Build this: the pick is recorded, and Claude is told to build that design. */
export function buildMessage(runDir, label) {
  return `The user chose design ${label} to build in the Design workspace (runDir ${runDir}). Please read its selection with ${DATA_TOOL}, then build that design as the user's request asks.`;
}

/** After a run is recorded: tell the agent now, or watch while the runner has it (returns the first wait). */
export function afterRun(runner) {
  return runner && runner.alive === true ? { tell: false, waitMs: RUNNER_GRACE_MS } : { tell: true };
}

/**
 * One runner check, on a fresh view: `{ tell: true }` sends the message now; `{ waitMs }` checks again after that
 * long; `{ drop: true }` forgets the request (it finished, failed or went away). `watch.waited` records that the round
 * waited on the user, after which the runner gets its grace again; the caller keeps the returned `waited`.
 */
export function judgeRunner(op, waitsOnPerson, watch) {
  if (!op || !(op.state === 'running' || op.state === 'starting')) return { drop: true };
  if (op.phase === 'drawing') return { waitMs: RUNNER_RECHECK_MS, waited: watch.waited };
  if (waitsOnPerson) return { waitMs: RUNNER_RECHECK_MS, waited: true };
  if (watch.waited) return { waitMs: RUNNER_GRACE_MS, waited: false };
  return { tell: true };
}
