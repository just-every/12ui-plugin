/**
 * The arguments of the clicks the pane records: Build this (`design.slate.pick`, then `design.slate.handoff`), Edit,
 * Simplify, Branch, Generate more (and a group's More), Keep, Retry and Continue (`design.slate.run`), and the
 * inspiration selection with the person's own sketches (`design.slate.inspiration`). A new request carries a UUID v4
 * minted when its dialog opened, so a repeated call never repeats work (the schema's rule); hold, continue and retry
 * name the request that already exists (the waiting round's, the failed round's), whose own id they carry. Pure: no `$`.
 *
 * The limits are the server's schema (workers/api/src/slate/mcp/tools.json); a value over one is refused here with
 * words the pane shows, rather than sent to be refused.
 */

import { UUID_V4 } from './bytes.mjs';

/** The counts Generate more offers, and the one it starts on (SLATE_MORE_COUNTS). */
export const MORE_COUNTS = Object.freeze([1, 2, 4, 6, 8, 12]);
export const MORE_COUNT_INITIAL = 6;
export const NOTE_MAX_CHARS = 600;
export const EDIT_PROMPT_MAX_BYTES = 6000;
/** The longest design prompt the server stores (the view contract's SLATE_BRIEF_MAX_CHARACTERS), in characters once whitespace collapses. */
export const BRIEF_MAX_CHARS = 20000;

/** A request the pane cannot send as it stands, with the words it shows: a plain Error named `ActionError`. */
export function actionError(message) {
  const error = new Error(message);
  error.name = 'ActionError';
  return error;
}

/** Whether an error is one `actionError` made. */
export function isActionError(error) {
  return Boolean(error) && error.name === 'ActionError';
}

function requireId(id) {
  if (!UUID_V4.test(id)) throw actionError('The request id is not a UUID v4.');
  return id;
}

function cleanText(text) {
  // Control characters are stripped and the ends trimmed, as the servers measure user words.
  return String(text ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
}

function utf8Bytes(text) {
  return new TextEncoder().encode(text).length;
}

/** `design.slate.pick`: record the selection of a version. */
export function pickArgs(runDir, versionId) {
  return { runDir, versionId };
}

/**
 * `design.slate.handoff`: record Build this's Convert hand-off, as the Codex screen's does (remoteChoose): kind
 * `convert`, output `html`, engine `local`. It puts a waiting request, with its command and an upload token, into
 * `design.slate.data`; without it Claude has a pick but nothing to build from.
 */
export function convertHandoffArgs(runDir, handoffId, versionId) {
  return { runDir, handoffId: requireId(handoffId), kind: 'convert', versionId, options: { engine: 'local', output: 'html' } };
}

/** The techniques of a mixed round (the server's SlateGroup); a group's More draws more of one. */
export const GROUPS = Object.freeze(['sketch', 'inspiration', 'site']);

/**
 * `design.slate.run`: new options, `count` of MORE_COUNTS, an optional steer note, an optional `group` (a mixed round's
 * More on one technique: a round of that group only, `count` the person's 6 or 12 of which the server deals the group's).
 */
export function runNewArgs(runDir, opId, { count = MORE_COUNT_INITIAL, note = '', group = null } = {}) {
  const n = Number(count);
  if (!MORE_COUNTS.includes(n)) throw actionError(`Choose ${MORE_COUNTS.join(', ')} options.`);
  const words = cleanText(note);
  if (words.length > NOTE_MAX_CHARS) throw actionError(`The note is longer than ${NOTE_MAX_CHARS} characters.`);
  if (group !== null && !GROUPS.includes(group)) throw actionError('Choose a group of the round.');
  const action = { kind: 'round', mode: 'new', count: n };
  if (words) action.note = words;
  if (group) action.group = group;
  return { runDir, opId: requireId(opId), action };
}

/** `design.slate.run`: draw a failed option again, through the failed round's own request (`roundOpId`). */
export function runRetryArgs(runDir, roundOpId, option) {
  if (!option) throw actionError('Choose the option to draw again.');
  return { runDir, opId: requireId(roundOpId), action: { kind: 'retry', option } };
}

/** `design.slate.run`: the person's Keep heart on an option; it waits for nobody, so it needs no agent. */
export function runKeepArgs(runDir, opId, option, kept) {
  return { runDir, opId: requireId(opId), action: { kind: 'keep', option, kept: Boolean(kept) } };
}

/** The levels of a Simplify (the hosted screen's two choices). */
export const SIMPLIFY_LEVELS = Object.freeze(['standard', 'high']);

/** `design.slate.run`: simplify one version, `standard` or `high` (which ranks every competing element before it picks). */
export function runSimplifyArgs(runDir, opId, versionId, level = 'standard') {
  if (!SIMPLIFY_LEVELS.includes(level)) throw actionError('Choose Standard or High.');
  return { runDir, opId: requireId(opId), action: { kind: 'simplify', versionId, level } };
}

/** `design.slate.run`: more like one version (the server's default count). */
export function runLikeArgs(runDir, opId, fromVersionId) {
  return { runDir, opId: requireId(opId), action: { kind: 'round', mode: 'like', fromVersionId } };
}

/** `design.slate.run`: edit one version with an instruction in words (the pane has no drawing). */
export function runEditArgs(runDir, opId, versionId, prompt) {
  const words = cleanText(prompt);
  if (!words) throw actionError('Say what to change.');
  if (utf8Bytes(words) > EDIT_PROMPT_MAX_BYTES) throw actionError('The change is too long to send.');
  return { runDir, opId: requireId(opId), action: { kind: 'edit', versionId, prompt: words } };
}

/** `design.slate.run`: start a round that waits on the person now. The op is the round's own (`pause.opId`). */
export function continueArgs(runDir, roundOpId, { referenceIds = null, brief = '' } = {}) {
  const action = { kind: 'continue' };
  if (referenceIds) action.referenceIds = [...referenceIds];
  const words = cleanText(brief).replace(/\s+/g, ' ');
  // Every word the person wrote is sent, never cut: one over the server's ceiling is refused here with its count.
  const count = Array.from(words).length;
  if (count > BRIEF_MAX_CHARS) throw actionError(`The design prompt is ${count} characters; at most ${BRIEF_MAX_CHARS} fit. Shorten it by ${count - BRIEF_MAX_CHARS}.`);
  if (words) action.brief = words;
  return { runDir, opId: requireId(roundOpId), action };
}

/** `design.slate.run`: hold a waiting round's countdown while the person chooses (the screen holds on any touch). */
export function holdArgs(runDir, roundOpId) {
  return { runDir, opId: requireId(roundOpId), action: { kind: 'hold' } };
}

/** The most inspiration ids one selection holds (the server's schema): references, websites and sketches together. */
export const SELECTION_MAX = 8;

/** `design.slate.inspiration`: replace the whole selection; with `sketch` also add the person's own sketch, with `removeSketch` remove one. */
export function inspirationArgs(runDir, referenceIds, { sketch = null, removeSketch = null } = {}) {
  const args = { runDir, referenceIds: [...referenceIds].slice(0, SELECTION_MAX) };
  if (sketch) args.sketch = { mimeType: sketch.mimeType, data: sketch.data };
  if (removeSketch) args.removeSketch = removeSketch;
  return args;
}

/** `design.slate.inspire`: search the reference collection with the prompt's words. */
export function inspireArgs(runDir, query, count) {
  const words = cleanText(query);
  if (!words) throw actionError('Describe the design first.');
  return { runDir, query: words, count };
}

/** The scopes of a branch (the screen's two choices): the design's full page, or more pages of the product. */
export const BRANCH_SCOPES = Object.freeze(['page', 'site']);
export const BRANCH_MAX_PAGES = 8;
export const PAGE_NAME_MAX_CHARS = 60;

/** Page names typed as one line: comma, semicolon or newline separated, each trimmed and cut, at most eight. */
export function branchPages(text) {
  return String(text ?? '')
    .split(/[,\n;]/)
    .map((name) => Array.from(cleanText(name).replace(/\s+/g, ' ')).slice(0, PAGE_NAME_MAX_CHARS).join(''))
    .filter(Boolean)
    .slice(0, BRANCH_MAX_PAGES);
}

/**
 * `design.slate.run`: branch one design. `scope` `page` continues it below the fold into its full page; `site` adds the
 * product's other pages, the person's names when given (`pages` only travels with `site`).
 */
export function runBranchArgs(runDir, opId, fromVersionId, scope, pagesText = '') {
  if (!BRANCH_SCOPES.includes(scope)) throw actionError('Choose Full page or More pages.');
  const action = { kind: 'round', mode: 'branch', fromVersionId, scope };
  const pages = scope === 'site' ? branchPages(pagesText) : [];
  if (pages.length > 0) action.pages = pages;
  return { runDir, opId: requireId(opId), action };
}
