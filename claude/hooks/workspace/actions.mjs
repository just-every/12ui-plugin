/**
 * The arguments of the clicks the pane records: Build this (`design.slate.pick`, then `design.slate.handoff`), Edit, Branch, Generate more and
 * Continue (`design.slate.run`). Each request carries a UUID v4 minted
 * when its dialog opened, so a repeated call never repeats work (the schema's rule). Pure: no `$`.
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
/** The longest prompt Continue sends (the screen's cut). */
export const BRIEF_MAX_CHARS = 2000;

/** A request the pane cannot send as it stands, with the words it shows. */
export class ActionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ActionError';
  }
}

function requireId(id) {
  if (!UUID_V4.test(id)) throw new ActionError('The request id is not a UUID v4.');
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
 * `convert`, output `html`, engine `service` (`12ui convert --engine api`, the web Convert page's /api/v1/convert
 * pipeline). It puts a waiting request, with its command and an upload token, into `design.slate.data`; without it
 * Claude has a pick but nothing to build from.
 */
export function convertHandoffArgs(runDir, handoffId, versionId) {
  return { runDir, handoffId: requireId(handoffId), kind: 'convert', versionId, options: { engine: 'service', output: 'html' } };
}

/** `design.slate.run`: new options, `count` of MORE_COUNTS, an optional steer note. */
export function runNewArgs(runDir, opId, { count = MORE_COUNT_INITIAL, note = '' } = {}) {
  const n = Number(count);
  if (!MORE_COUNTS.includes(n)) throw new ActionError(`Choose ${MORE_COUNTS.join(', ')} options.`);
  const words = cleanText(note);
  if (words.length > NOTE_MAX_CHARS) throw new ActionError(`The note is longer than ${NOTE_MAX_CHARS} characters.`);
  const action = { kind: 'round', mode: 'new', count: n };
  if (words) action.note = words;
  return { runDir, opId: requireId(opId), action };
}

/** `design.slate.run`: more like one version (the server's default count). */
export function runLikeArgs(runDir, opId, fromVersionId) {
  return { runDir, opId: requireId(opId), action: { kind: 'round', mode: 'like', fromVersionId } };
}

/** `design.slate.run`: edit one version with an instruction in words (the pane has no drawing). */
export function runEditArgs(runDir, opId, versionId, prompt) {
  const words = cleanText(prompt);
  if (!words) throw new ActionError('Say what to change.');
  if (utf8Bytes(words) > EDIT_PROMPT_MAX_BYTES) throw new ActionError('The change is too long to send.');
  return { runDir, opId: requireId(opId), action: { kind: 'edit', versionId, prompt: words } };
}

/** `design.slate.run`: start a round that waits on the person now. The op is the round's own (`pause.opId`). */
export function continueArgs(runDir, roundOpId, { referenceIds = null, brief = '' } = {}) {
  const action = { kind: 'continue' };
  if (referenceIds) action.referenceIds = [...referenceIds];
  const words = cleanText(brief);
  if (words) action.brief = Array.from(words).slice(0, BRIEF_MAX_CHARS).join('');
  return { runDir, opId: requireId(roundOpId), action };
}

/** `design.slate.run`: hold a waiting round's countdown while the person chooses (the screen holds on any touch). */
export function holdArgs(runDir, roundOpId) {
  return { runDir, opId: requireId(roundOpId), action: { kind: 'hold' } };
}

/** `design.slate.inspire`: search the reference collection with the prompt's words. */
export function inspireArgs(runDir, query, count) {
  const words = cleanText(query);
  if (!words) throw new ActionError('Describe the design first.');
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
  if (!BRANCH_SCOPES.includes(scope)) throw new ActionError('Choose Full page or More pages.');
  const action = { kind: 'round', mode: 'branch', fromVersionId, scope };
  const pages = scope === 'site' ? branchPages(pagesText) : [];
  if (pages.length > 0) action.pages = pages;
  return { runDir, opId: requireId(opId), action };
}
