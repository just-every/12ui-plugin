/**
 * Workspace views and a fake design.12ui.com for the pane tests (`claude plugin test`). Shapes follow
 * `12ui.slate.view/3` (packages/12ui/src/slate-view-contract.ts) as workers/api/src/slate/view.ts projects them. This is
 * the TypeScript twin of `mod/fixtures/workspace.mjs` (the node tests' copy, since Node 22.13 cannot import TypeScript);
 * `mod-fixtures.test.mjs` keeps the two exporting the same data.
 */

import { THUMB_HEIGHT, THUMB_JPEG, THUMB_WIDTH } from './thumb.ts';

export const RUN_DIR = 'w_AbCdEfGhIjKlMnOpQrStUv';
export const OTHER_RUN_DIR = 'w_ZyXwVuTsRqPoNmLkJiHgFe';
export const CREATE = 'mcp__plugin_12ui-design_12ui-workspace__design_slate_create';
export const SHOW = 'mcp__plugin_12ui-design_12ui-workspace__design_slate_show';
export const PANE_ID = 'design-workspace';
export const ROUND_OP = '6f1d2c3b-4a59-4e7f-8a1b-2c3d4e5f6a7b';

type Json = Record<string, unknown>;

/** What `viewWith` varies: see its comment. */
export interface ViewOptions {
  running?: boolean;
  rev?: number;
  phase?: string;
  pause?: Json;
  pickA?: boolean;
  refs?: string[];
  sites?: Json[];
}

/** One server reply: the tool result's `structuredContent`, `content` and `isError`. */
export interface Reply {
  structured?: unknown;
  content?: unknown[];
  isError?: boolean;
}

export type Answers = Record<string, (args: Json) => Reply>;

function version(id: string, candidateId: string, label: string): Json {
  return {
    versionId: id, candidateId, label, n: 1, kind: 'generation', parentVersionId: null, prompt: null, marks: null,
    width: THUMB_WIDTH, height: THUMB_HEIGHT, sha256: 'a'.repeat(64), path: '', createdAt: '', fileState: 'ok',
    editable: true, editBlockedReason: null,
  };
}

function candidate(id: string, label: string, state: string, extra: Json = {}): Json {
  const versionIds = state === 'ready' ? [`v_${label.toLowerCase()}`] : [];
  return {
    candidateId: id, label, roundId: 'r_1', state, error: null, versionIds,
    latestVersionId: versionIds[0] ?? null, busy: false, busyOpId: null, latestOpId: null, referenceId: null, ...extra,
  };
}

/**
 * A workspace with option A drawn, option B waiting (its round still runs, unless `running: false`) and option C
 * failed with the command line's own reason. `pickA` selects A; `phase` is the round op's (`agent` or `drawing`);
 * `pause` puts the round on hold for the user (`{ state: 'countdown', remainingMs }`, `{ state: 'held' }`, ...).
 */
export function viewWith(options: ViewOptions = {}): Json {
  const running = options.running ?? true;
  const rev = options.rev ?? 3;
  const refs = options.refs ?? [];
  return {
    schema: '12ui.slate.view/3',
    rev,
    stamp: `${rev}:abc`,
    workspaceId: 'wk_public',
    runDir: RUN_DIR,
    brief: { concept: 'A meditation app landing page', aspect: 'landscape' },
    local: { image: { ready: true, reason: null } },
    rounds: [{
      roundId: 'r_1', index: 1, kind: 'root', note: null, fromVersionId: null, state: running ? 'running' : 'settled',
      count: 3, readyCount: 1, referenceIds: options.pause ? refs.slice(0, 2) : [], referenceSource: 'root', ...(options.pause ? { pause: options.pause } : {}),
    }],
    candidates: [
      candidate('c_a', 'A', 'ready'),
      candidate('c_b', 'B', 'pending', running ? { busy: true, busyOpId: ROUND_OP } : {}),
      candidate('c_c', 'C', 'failed', { error: 'Codex on this Mac is not signed in. Nothing was drawn.' }),
    ],
    versions: [version('v_a', 'c_a', 'A')],
    ops: [{
      opId: ROUND_OP, kind: 'round', state: running ? 'running' : 'succeeded', phase: running ? options.phase ?? 'agent' : 'done',
      attempt: 1, target: 'Round 1', roundId: 'r_1', startedAt: '', finishedAt: null, error: null, edit: null,
      resultVersionIds: [], runner: { alive: running, pid: null, heartbeatAgeMs: null }, resumable: false,
    }],
    pick: options.pickA ? {
      versionId: 'v_a', label: 'A', reason: null, pickedAt: '', imagePath: null, fileState: 'ok', intact: true,
      sourcePath: '', sha256: 'a'.repeat(64),
    } : null,
    inspiration: { selected: [], searches: refs.length > 0 ? [{ referenceIds: refs }] : [] },
    references: {},
    handoffs: [],
    ...(options.sites ? { sites: options.sites } : {}),
  };
}

/** The ids `viewWith` uses, renamed to the ids the server mints for a workspace's first round. */
const SERVER_IDS: Record<string, string> = { r_1: 'r1', c_a: 'r1_a', c_b: 'r1_b', c_c: 'r1_c', v_a: 'v_r1_a' };

/**
 * `viewWith(options)` for workspace `runDir` with brief `concept`, carrying the ids the server really mints
 * (workers/api/src/slate/store/entities.ts: round `r<index>`, candidate `<roundId>_<slot>`, version
 * `v_<roundId>_<slot>`). They are minted per workspace, so every workspace's first option is `r1_a` / `v_r1_a`: two of
 * these views share every option and version id and differ only in handle and brief.
 */
export function serverIdsView(runDir: string, concept: string, options: ViewOptions = {}): Json {
  const view = viewWith(options);
  const renamed = JSON.parse(JSON.stringify(view), (_key, value) => (typeof value === 'string' && Object.hasOwn(SERVER_IDS, value) ? SERVER_IDS[value] : value));
  return { ...renamed, runDir, brief: { ...(view.brief as Json), concept } };
}

/**
 * A fake MCP server behind `http.fetch`: answers `tools/call` by tool name and records every call. `answer(init)` is
 * what an `http.fetch` hook returns (`{ value: HttpResponse }`); a reply is `{ structured, content, isError }`.
 */
export function fakeServer(answers: Answers) {
  const calls: Array<{ name: string; args: Json }> = [];
  const answer = (init?: { body?: unknown }) => {
    const body = JSON.parse(String((init && init.body) || '{}'));
    const name = String((body.params && body.params.name) || '');
    const args: Json = (body.params && body.params.arguments) || {};
    calls.push({ name, args });
    const reply = answers[name];
    const result: Reply = reply ? reply(args) : { content: [{ type: 'text', text: `unknown_tool: ${name}` }], isError: true };
    const text = JSON.stringify({
      jsonrpc: '2.0',
      id: body.id,
      result: {
        content: result.content ?? [],
        ...(result.structured === undefined ? {} : { structuredContent: result.structured }),
        ...(result.isError ? { isError: true } : {}),
      },
    });
    return { value: { status: 200, ok: true, headers: { 'content-type': 'application/json' }, text } };
  };
  return { calls, answer };
}

/** The server's answers for a workspace: status and show return the view, image returns the thumbnail. */
export function workspaceAnswers(view: () => Json, extra: Answers = {}): Answers {
  return {
    'design.slate.status': () => ({ structured: view() }),
    'design.slate.show': () => ({ structured: view(), content: [{ type: 'text', text: 'Design workspace wk_public: 3 options.' }] }),
    'design.slate.reference': (args: Json) => ({
      content: [{ type: 'image', data: THUMB_JPEG, mimeType: 'image/jpeg' }],
      structured: { referenceId: args.referenceId, size: 'thumb', width: THUMB_WIDTH, height: THUMB_HEIGHT, mimeType: 'image/jpeg' },
    }),
    'design.slate.image': (args) => ({
      content: [{ type: 'image', data: THUMB_JPEG, mimeType: 'image/jpeg' }],
      structured: { versionId: args.versionId, size: 'thumb', width: THUMB_WIDTH, height: THUMB_HEIGHT, mimeType: 'image/jpeg' },
    }),
    ...extra,
  };
}

/** The props a surface hands the pane's render hook. */
export const PANE_PROPS = {
  title: 'Design workspace',
  isFocused: true,
  bodyColumns: 100,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 60 },
  view: {},
};
