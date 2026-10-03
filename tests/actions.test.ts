// The clicks: each is recorded on the server, then Claude is told with the screen's own message, except a run the
// workspace runner on the user's computer will draw, which is told only if the runner leaves it to the agent.
// Edit, Branch and Build this live in the large view of a design (Designs tab, press a tile); picks and Continue on
// Inspiration.
import { describe, expect, mock, test } from 'claude-code/testing';

import { CREATE, OTHER_RUN_DIR, PANE_ID, PANE_PROPS, ROUND_OP, RUN_DIR, SHOW, fakeServer, serverIdsView, viewWith, workspaceAnswers } from './fixtures/workspace.ts';

/** What `$.ui.panes` answers while the Design workspace pane is open. */
const PANE_UP = () => ({ value: [{ id: PANE_ID, title: 'Design workspace', isShown: true, isFocused: false, isPlaced: true }] });

const CREATE_TEXT = JSON.stringify({ schema: '12ui.slate.view/3', runDir: RUN_DIR });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

async function session($: any, on: any, answers: Record<string, any>) {
  const clock = mock.clock(on, { now: 1000 });
  const server = fakeServer(answers);
  const submitted: string[] = [];
  on('http.fetch', ($$: unknown, e: any) => server.answer(e.init));
  on('ui.open', () => ({ value: { isPlaced: true } }));
  on('ui.panes', PANE_UP);
  on('ui.blit', () => ({ value: {} }));
  on('ui.log', () => ({ value: undefined }));
  on('prompt.submit', ($$: unknown, e: any) => { submitted.push(e.text); return { text: e.text }; });
  on('tool.call', { tool: CREATE }, () => ({ result: { content: [] }, text: CREATE_TEXT }));
  await $.tool.call({ tool: CREATE, concept: 'A meditation app landing page' });
  const ui = await $.ui.mount({ plugin: '12ui-design', surface: 'terminal', component: 'Pane', requestId: PANE_ID, props: PANE_PROPS });
  await clock.advance(0);
  await clock.advance(0);
  return { clock, server, submitted, ui };
}

/** Opens the large view of option `id` on the Designs tab. */
async function openLarge(ui: any, id = 'c_a') {
  await ui.press({ key: 'tab:designs' });
  await ui.press({ key: `open:${id}` });
}

async function editWith(ui: any, id: string, words: string) {
  await openLarge(ui, id);
  await ui.press({ key: 'lv-edit' });
  await ui.input({ key: `lv-edit-note:${id}`, text: words });
}

const MESSAGE_TAIL = 'in the Design workspace';
const REFS = ['gen-a', 'gen-b', 'gen-c'];

function runResult(args: any, alive: boolean) {
  return { structured: { op: null, runner: { alive }, view: viewWith() }, content: [{ type: 'text', text: 'Recorded. Waiting for your agent.' }] };
}

describe('actions.test.ts', () => {
  test('Build this records the pick and tells Claude to build it; the design then reads Building', async ($, on) => {
    const { server, submitted, ui } = await session($, on, workspaceAnswers(() => viewWith(), {
      'design.slate.pick': () => ({ structured: { pick: { versionId: 'v_a', label: 'A' }, rev: 4, view: viewWith({ pickA: true, rev: 4 }) } }),
      'design.slate.handoff': () => ({ structured: { handoff: { handoffId: 'h' }, rev: 5, view: viewWith({ pickA: true, rev: 5 }) } }),
    }));
    await openLarge(ui);
    expect(await ui.find({ key: 'lv-branch' })).toBeDefined();
    expect(await ui.find({ key: 'lv-build' })).toBeUndefined();
    expect(await ui.find({ key: 'lv-choose' })).toBeUndefined();
    await ui.press({ key: 'lv-build-this' });
    expect(server.calls.filter((call) => call.name === 'design.slate.pick')).toEqual([{ name: 'design.slate.pick', args: { runDir: RUN_DIR, versionId: 'v_a' } }]);
    // The hand-off is the Codex screen's (remoteChoose): Convert to HTML, engine local. It is what puts a waiting
    // request, its command and an upload token into design.slate.data; the pick alone leaves Claude nothing to build.
    const handoffs = server.calls.filter((call) => call.name === 'design.slate.handoff');
    expect(handoffs).toEqual([{ name: 'design.slate.handoff', args: { runDir: RUN_DIR, handoffId: expect.stringMatching(UUID), kind: 'convert', versionId: 'v_a', options: { engine: 'local', output: 'html' } } }]);
    expect(server.calls.map((call) => call.name).filter((name) => name === 'design.slate.pick' || name === 'design.slate.handoff')).toEqual(['design.slate.pick', 'design.slate.handoff']);
    expect(submitted).toEqual([`The user chose design A to build ${MESSAGE_TAIL} (runDir ${RUN_DIR}). Please read its selection with design.slate.data, then build that design as the user's request asks.`]);
    expect(await ui.find({ type: 'Text', text: 'Building' })).toBeDefined();
    expect(await ui.find({ key: 'lv-build-this' })).toBeUndefined();
    expect(await ui.find({ key: 'lv-branch' })).toBeUndefined();
    await ui.press({ key: 'lv-back' });
    expect(await ui.find({ type: 'Text', text: 'Building' })).toBeDefined();
    await ui.unmount();
  });

  test('a Building design stays Building in its tile; Inspiration picks keep Selected', async ($, on) => {
    const { ui } = await session($, on, workspaceAnswers(() => viewWith({ pickA: true, refs: REFS, pause: { state: 'held' } })));
    expect((await ui.find({ key: 'pick:gen-a' }))?.props.label).toBe('✓ Selected');
    expect((await ui.find({ key: 'pick:gen-c' }))?.props.label).toBe('Select');
    await ui.press({ key: 'tab:designs' });
    expect(await ui.find({ type: 'Text', text: 'Building' })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: 'Chosen' })).toBeUndefined();
    await ui.unmount();
  });

  test('Edit sends the change in words for that design, and the message never carries it', async ($, on) => {
    const { server, submitted, ui } = await session($, on, workspaceAnswers(() => viewWith(), {
      'design.slate.run': (args: any) => runResult(args, false),
    }));
    await editWith(ui, 'c_a', 'make the headline larger');
    const run = server.calls.find((call) => call.name === 'design.slate.run');
    expect(run?.args.action).toEqual({ kind: 'edit', versionId: 'v_a', prompt: 'make the headline larger' });
    expect(String(run?.args.opId)).toMatch(UUID);
    expect(submitted).toEqual([`The user asked to edit A ${MESSAGE_TAIL} (request ${run?.args.opId}, runDir ${RUN_DIR}). Please confirm it with design.slate.data, then carry it out.`]);
    expect(await ui.find({ key: 'lv-edit-note:c_a' })).toBeUndefined();
    expect(server.calls.filter((call) => call.name === 'design.slate.handoff')).toEqual([]);
    await ui.unmount();
  });

  test('Branch offers Full page and More pages; Full page sends scope page with no page names', async ($, on) => {
    const { server, submitted, ui } = await session($, on, workspaceAnswers(() => viewWith(), {
      'design.slate.run': (args: any) => runResult(args, false),
    }));
    await openLarge(ui);
    expect(await ui.find({ key: 'lv-scope-page' })).toBeUndefined();
    await ui.press({ key: 'lv-branch' });
    expect((await ui.find({ key: 'lv-scope-page' }))?.props.label).toBe('Full page');
    expect((await ui.find({ key: 'lv-scope-site' }))?.props.label).toBe('More pages');
    expect(await ui.find({ key: 'lv-branch-send' })).toBeUndefined();
    await ui.press({ key: 'lv-scope-page' });
    const run = server.calls.find((call) => call.name === 'design.slate.run');
    expect(run?.args).toMatchObject({ runDir: RUN_DIR, action: { kind: 'round', mode: 'branch', fromVersionId: 'v_a', scope: 'page' } });
    expect('pages' in (run?.args.action as object)).toBe(false);
    expect(submitted).toEqual([`The user asked for the full page of A ${MESSAGE_TAIL} (request ${run?.args.opId}, runDir ${RUN_DIR}). Please confirm it with design.slate.data, then carry it out.`]);
    expect(server.calls.filter((call) => call.name === 'design.slate.handoff' || call.name === 'design.slate.pick')).toEqual([]);
    await ui.unmount();
  });

  test('More pages sends scope site with the typed page names, or none, and the message never carries them', async ($, on) => {
    const { server, submitted, ui } = await session($, on, workspaceAnswers(() => viewWith(), {
      'design.slate.run': (args: any) => runResult(args, false),
    }));
    await openLarge(ui);
    await ui.press({ key: 'lv-branch' });
    await ui.press({ key: 'lv-scope-site' });
    await ui.input({ key: 'lv-branch-pages:c_a', text: 'about, sign in; settings' });
    const named = server.calls.filter((call) => call.name === 'design.slate.run');
    expect(named.map((call) => call.args.action)).toEqual([{ kind: 'round', mode: 'branch', fromVersionId: 'v_a', scope: 'site', pages: ['about', 'sign in', 'settings'] }]);
    expect(submitted[0]).toStartWith(`The user asked for more pages of A ${MESSAGE_TAIL} (request `);
    expect(submitted[0]).not.toContain('about');
    await openLarge(ui);
    await ui.press({ key: 'lv-branch' });
    await ui.press({ key: 'lv-scope-site' });
    await ui.press({ key: 'lv-branch-send' });
    const runs = server.calls.filter((call) => call.name === 'design.slate.run');
    expect(runs[1].args.action).toEqual({ kind: 'round', mode: 'branch', fromVersionId: 'v_a', scope: 'site' });
    await ui.unmount();
  });

  test('a run the workspace runner holds sends no message while the runner draws it', async ($, on) => {
    // The status answer carries the run's own op (the opId the run call sent), so each runner check finds it and reads
    // its phase; the twin below, whose op stays in the agent phase, is the case that must tell.
    const opIds: string[] = [];
    let phase = 'agent';
    const withRunOp = () => {
      const view = viewWith({ phase }) as any;
      if (opIds.length === 0) return view;
      return { ...view, ops: [...view.ops, { ...view.ops[0], opId: opIds[0], kind: 'round', state: 'running', phase, roundId: 'r_2' }] };
    };
    const { clock, server, submitted, ui } = await session($, on, workspaceAnswers(() => viewWith({ phase }), {
      'design.slate.run': (args: any) => { opIds.push(args.opId); return runResult(args, true); },
      'design.slate.status': () => ({ structured: withRunOp() }),
    }));
    // A runner check reads the whole workspace (no `since`), unlike the pane's own polls.
    const runnerChecks = () => server.calls.filter((call) => call.name === 'design.slate.status' && !('since' in call.args)).length;
    const checksBefore = runnerChecks();
    await editWith(ui, 'c_a', 'warmer colours');
    expect(opIds).toHaveLength(1);
    expect(submitted).toEqual([]);
    phase = 'drawing';
    await clock.advance(19000);
    expect(runnerChecks()).toBe(checksBefore);
    await clock.advance(1000);
    await clock.advance(0);
    expect(runnerChecks()).toBe(checksBefore + 1);
    expect(submitted).toEqual([]);
    await clock.advance(10000);
    await clock.advance(0);
    expect(runnerChecks()).toBe(checksBefore + 2);
    expect(submitted).toEqual([]);
    await ui.unmount();
  });

  test('a run the runner leaves to the agent is told after the grace', async ($, on) => {
    const opIds: string[] = [];
    const { clock, submitted, ui } = await session($, on, workspaceAnswers(() => viewWith(), {
      'design.slate.run': (args: any) => { opIds.push(args.opId); return { structured: { op: null, runner: { alive: true }, view: viewWith() } }; },
      'design.slate.status': () => ({ structured: { ...viewWith(), ops: [...(viewWith() as any).ops, { ...(viewWith() as any).ops[0], opId: opIds[0], roundId: 'r_2' }] } }),
    }));
    await editWith(ui, 'c_a', 'warmer colours');
    expect(submitted).toEqual([]);
    await clock.advance(19000);
    expect(submitted).toEqual([]);
    await clock.advance(1500);
    expect(submitted).toEqual([`The user asked to edit A ${MESSAGE_TAIL} (request ${opIds[0]}, runDir ${RUN_DIR}). Please confirm it with design.slate.data, then carry it out.`]);
    await ui.unmount();
  });

  test('a waiting round opens on Inspiration with its picks selected, and the tray counts them down', async ($, on) => {
    const deadline = 43000;
    let now = () => 1000;
    const { clock, server, ui } = await session($, on, workspaceAnswers(() => viewWith({ refs: REFS, pause: { state: 'countdown', remainingMs: deadline - now() } })));
    now = () => clock.now();
    expect(await ui.find({ type: 'Text', text: '2 picked · Starting in 42 s. Press Continue to start now.' })).toBeDefined();
    expect((await ui.find({ key: 'pick:gen-a' }))?.props.label).toBe('✓ Selected');
    expect((await ui.find({ key: 'pick:gen-b' }))?.props.label).toBe('✓ Selected');
    expect((await ui.find({ key: 'pick:gen-c' }))?.props.label).toBe('Select');
    expect(await ui.find({ type: 'Text', text: '2 selected' })).toBeDefined();
    expect(server.calls.filter((call) => call.name === 'design.slate.reference').map((call) => call.args.referenceId).sort()).toEqual(REFS);
    await clock.advance(2000);
    expect(await ui.find({ type: 'Text', text: '2 picked · Starting in 40 s. Press Continue to start now.' })).toBeDefined();
    await ui.unmount();
  });

  test('Continue with the round\'s own picks sends no reference list and moves to Designs', async ($, on) => {
    const runs: any[] = [];
    const { ui } = await session($, on, workspaceAnswers(() => viewWith({ refs: REFS, pause: { state: 'countdown', remainingMs: 42000 } }), {
      'design.slate.run': (args: any) => { runs.push(args); return { structured: { op: null, view: viewWith() } }; },
    }));
    await ui.press({ key: 'continue' });
    expect(runs).toEqual([{ runDir: RUN_DIR, opId: ROUND_OP, action: { kind: 'continue' } }]);
    expect(await ui.find({ key: 'per:6' })).toBeDefined();
    await ui.unmount();
  });

  test('changing a pick holds the countdown once, and Continue sends the changed picks', async ($, on) => {
    const runs: any[] = [];
    const { ui } = await session($, on, workspaceAnswers(() => viewWith({ refs: REFS, pause: { state: 'countdown', remainingMs: 42000 } }), {
      'design.slate.run': (args: any) => { runs.push(args); return { structured: { op: null, view: viewWith({ refs: REFS, pause: { state: 'countdown', remainingMs: 42000 } }) } }; },
    }));
    await ui.press({ key: 'pick:gen-c' });
    await ui.press({ key: 'pick:gen-a' });
    expect(runs).toEqual([{ runDir: RUN_DIR, opId: ROUND_OP, action: { kind: 'hold' } }]);
    expect((await ui.find({ key: 'pick:gen-c' }))?.props.label).toBe('✓ Selected');
    expect((await ui.find({ key: 'pick:gen-a' }))?.props.label).toBe('Select');
    await ui.press({ key: 'continue' });
    expect(runs[1]).toEqual({ runDir: RUN_DIR, opId: ROUND_OP, action: { kind: 'continue', referenceIds: ['gen-b', 'gen-c'] } });
    await ui.unmount();
  });

  test('a round with no pause shows no tray and no Continue', async ($, on) => {
    const { ui } = await session($, on, workspaceAnswers(() => viewWith()));
    expect(await ui.find({ key: 'continue' })).toBeUndefined();
    expect(await ui.find({ type: 'Text', text: /Starting/ })).toBeUndefined();
    await ui.unmount();
  });

  test('a server refusal is shown verbatim on the error line', async ($, on) => {
    const { submitted, ui } = await session($, on, workspaceAnswers(() => viewWith(), {
      'design.slate.run': () => ({ isError: true, content: [{ type: 'text', text: 'too_many_open_requests: 3 requests are already waiting for your agent.' }], structured: { code: 'too_many_open_requests' } }),
    }));
    await editWith(ui, 'c_a', 'warmer colours');
    expect(await ui.find({ type: 'Text', text: 'too_many_open_requests: 3 requests are already waiting for your agent.' })).toBeDefined();
    expect(submitted).toEqual([]);
    await ui.unmount();
  });

  test('a click\'s error line stays through the polls that follow', async ($, on) => {
    const { clock, ui } = await session($, on, workspaceAnswers(() => viewWith(), {
      'design.slate.run': () => ({ isError: true, content: [{ type: 'text', text: 'workspace_busy: Try again in a moment.' }], structured: { code: 'workspace_busy' } }),
    }));
    await editWith(ui, 'c_a', 'warmer colours');
    await clock.advance(5000);
    expect(await ui.find({ type: 'Text', text: 'workspace_busy: Try again in a moment.' })).toBeDefined();
    await ui.unmount();
  });

  test('a retry after a refusal is a new request; a retry after no answer repeats the same id', async ($, on) => {
    const opIds: string[] = [];
    let answer: 'refuse' | 'unreachable' | 'ok' = 'refuse';
    const { ui } = await session($, on, workspaceAnswers(() => viewWith(), {
      'design.slate.run': (args: any) => {
        opIds.push(args.opId);
        if (answer === 'refuse') return { isError: true, content: [{ type: 'text', text: 'workspace_busy: Try again in a moment.' }], structured: { code: 'workspace_busy', retryable: false } };
        if (answer === 'unreachable') throw new Error('connection reset');
        return runResult(args, false);
      },
    }));
    await editWith(ui, 'c_a', 'warmer colours');
    answer = 'unreachable';
    await ui.input({ key: 'lv-edit-note:c_a', text: 'warmer colours' });
    answer = 'ok';
    await ui.input({ key: 'lv-edit-note:c_a', text: 'warmer colours' });
    expect(opIds).toHaveLength(3);
    expect(opIds[1]).not.toBe(opIds[0]);
    expect(opIds[2]).toBe(opIds[1]);
    await ui.unmount();
  });

  // Request ids belong to their workspace. The server's paid-call ledger is keyed by the request id alone, and its
  // option and version ids repeat across workspaces (every first option is `r1_a` / `v_r1_a`), so a request id kept
  // after an unanswered click must never travel to another workspace (3.3.4; CLAUDE.md item 3). Within one workspace
  // the retry still repeats it, so the click cannot be recorded twice.
  const FIRST_BRIEF = 'A meditation app landing page';
  const OTHER_BRIEF = 'A bakery order page';

  /** Each click whose request id is drafted: how to press it, the tool it records with, and the id field it sends. */
  const DRAFTED = [
    { name: 'Edit', tool: 'design.slate.run', idField: 'opId', press: async (ui: any) => { await editWith(ui, 'r1_a', 'make the headline larger'); } },
    { name: 'Branch Full page', tool: 'design.slate.run', idField: 'opId', press: async (ui: any) => { await openLarge(ui, 'r1_a'); await ui.press({ key: 'lv-branch' }); await ui.press({ key: 'lv-scope-page' }); } },
    { name: 'Branch More pages', tool: 'design.slate.run', idField: 'opId', press: async (ui: any) => { await openLarge(ui, 'r1_a'); await ui.press({ key: 'lv-branch' }); await ui.press({ key: 'lv-scope-site' }); await ui.press({ key: 'lv-branch-send' }); } },
    { name: '6 · 12 switch to 12', tool: 'design.slate.run', idField: 'opId', press: async (ui: any) => { await ui.press({ key: 'tab:designs' }); await ui.press({ key: 'per:12' }); } },
  ] as const;

  /**
   * A pane open on RUN_DIR beside OTHER_RUN_DIR, both with the server's own ids and option A ready (not selected: a Building design no longer offers Branch). The first call
   * of `tool` gets no answer (the fetch is refused, as a dropped connection is); every later one is recorded.
   */
  async function twoWorkspaceSession($: any, on: any, tool: string) {
    const clock = mock.clock(on, { now: 1000 });
    const viewOf = (runDir: string) => serverIdsView(runDir, runDir === OTHER_RUN_DIR ? OTHER_BRIEF : FIRST_BRIEF, { running: false });
    const server = fakeServer(workspaceAnswers(() => viewOf(RUN_DIR), {
      'design.slate.status': (args: any) => ({ structured: viewOf(args.runDir) }),
      'design.slate.show': (args: any) => ({ structured: viewOf(args.runDir) }),
      'design.slate.run': (args: any) => ({ structured: { op: null, runner: { alive: false }, view: viewOf(args.runDir) } }),
    }));
    const sent: Array<{ runDir: string; id: string; answered: boolean }> = [];
    let unanswered = 1;
    on('http.fetch', ($$: unknown, e: any) => {
      const body = JSON.parse(String(e.init.body));
      if (body.params.name !== tool) return server.answer(e.init);
      const args = body.params.arguments;
      const answered = unanswered === 0;
      sent.push({ runDir: args.runDir, id: args.opId, answered });
      if (!answered) {
        unanswered -= 1;
        return { deny: 'connection reset' };
      }
      return server.answer(e.init);
    });
    on('ui.open', () => ({ value: { isPlaced: true } }));
    on('ui.panes', PANE_UP);
    on('ui.blit', () => ({ value: {} }));
    on('ui.log', () => ({ value: undefined }));
    on('prompt.submit', ($$: unknown, e: any) => ({ text: e.text }));
    on('tool.call', { tool: CREATE }, () => ({ result: { content: [] }, text: CREATE_TEXT }));
    on('tool.call', { tool: SHOW }, () => ({ result: { content: [] }, text: 'shown' }));
    await $.tool.call({ tool: CREATE, concept: FIRST_BRIEF });
    const ui = await $.ui.mount({ plugin: '12ui-design', surface: 'terminal', component: 'Pane', requestId: PANE_ID, props: PANE_PROPS });
    await clock.advance(0);
    await clock.advance(0);
    const show = async (runDir: string, brief: string) => {
      await $.tool.call({ tool: SHOW, runDir } as never);
      await clock.advance(0);
      await clock.advance(0);
      expect((await ui.find({ key: 'prompt' }))?.props.value).toBe(brief);
    };
    return { sent, show, ui };
  }

  for (const click of DRAFTED) {
    test(`${click.name} in another workspace after an unanswered one sends a new request id`, async ($, on) => {
      const { sent, show, ui } = await twoWorkspaceSession($, on, click.tool);
      await click.press(ui);
      await show(OTHER_RUN_DIR, OTHER_BRIEF);
      await click.press(ui);
      expect(sent.map((call) => [call.runDir, call.answered])).toEqual([[RUN_DIR, false], [OTHER_RUN_DIR, true]]);
      expect(sent[0].id).toMatch(UUID);
      expect(sent[1].id).toMatch(UUID);
      expect(sent[1].id).not.toBe(sent[0].id);
      await ui.unmount();
    });

    test(`${click.name} back in the first workspace repeats that workspace's unanswered request id`, async ($, on) => {
      const { sent, show, ui } = await twoWorkspaceSession($, on, click.tool);
      await click.press(ui);
      await show(OTHER_RUN_DIR, OTHER_BRIEF);
      await show(RUN_DIR, FIRST_BRIEF);
      await click.press(ui);
      expect(sent.map((call) => [call.runDir, call.answered])).toEqual([[RUN_DIR, false], [RUN_DIR, true]]);
      expect(sent[1].id).toBe(sent[0].id);
      await ui.unmount();
    });
  }
});
