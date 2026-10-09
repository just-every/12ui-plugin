// The Claude pane's core flows: a create result (the whole view, or the hosted server's compact summary) opens the pane
// and it reads the workspace the result names; and the person's presses still land while the pane redraws.
import { describe, expect, mock, test } from 'claude-code/testing';

import { CREATE, PANE_ID, PANE_PROPS, RUN_DIR, SHOW, fakeServer, viewWith, workspaceAnswers } from './fixtures/workspace.ts';

/** What `$.ui.panes` answers while the Design workspace pane is open. */
const PANE_UP = () => ({ value: [{ id: PANE_ID, title: 'Design workspace', isShown: true, isFocused: false, isPlaced: true }] });

const CREATE_TEXT = JSON.stringify({ schema: '12ui.slate.view/3', runDir: RUN_DIR });

/** A session that draws on `surface`, a create result naming RUN_DIR, and the fake server; returns its calls. */
async function openWorkspace($: any, on: any, surface: string, answers = workspaceAnswers(() => viewWith()), panes: () => unknown = PANE_UP) {
  const server = fakeServer(answers);
  const opened: unknown[] = [];
  on('http.fetch', ($$: unknown, e: any) => server.answer(e.init));
  on('ui.open', ($$: unknown, e: unknown) => { opened.push(e); return { value: { isPlaced: true } }; });
  on('ui.panes', panes);
  on('ui.log', () => ({ value: undefined }));
  on('tool.call', { tool: CREATE }, () => ({ result: { content: [] }, text: CREATE_TEXT }));
  on('tool.call', { tool: SHOW }, () => ({ result: { content: [] }, text: 'shown' }));
  await $.tool.call({ tool: CREATE, concept: 'A meditation app landing page' });
  return { server, opened };
}

async function mountPane($: any, surface: 'terminal' | 'desktop') {
  return $.ui.mount({ plugin: '12ui-design', surface, component: 'Pane', requestId: PANE_ID, props: PANE_PROPS });
}

/** The prompt line's value: the workspace's brief until the person edits it. */
async function promptValue(ui: any) {
  return (await ui.find({ key: 'prompt' }))?.props.value;
}

describe('pane.test.ts', () => {
  // The first test of a file pays the cold mount: 5.2 to 5.6 s on a cold CI runner, past the 5 s default.
  test('a create result opens the pane where the session draws', { timeoutMs: 30_000 }, async ($, on) => {
    mock.clock(on, { now: 1000 });
    const { opened } = await openWorkspace($, on, 'terminal');
    expect(opened).toEqual([{ id: PANE_ID, title: 'Design workspace' }]);
  });

  const SUMMARY_TEXT = JSON.stringify({
    schema: '12ui.slate.summary/1', runDir: RUN_DIR, rev: 1, stamp: '1', options: 6, ready: 0,
    requestId: '0d6c8a52-1f3e-4b7a-9c2d-3e4f5a6b7c8d', pushToken: `wp_${'a'.repeat(22)}`,
  });

  test('a create result in the compact summary shape opens the pane and reads the workspace it names (fires)', async ($, on) => {
    const clock = mock.clock(on, { now: 1000 });
    const server = fakeServer(workspaceAnswers(() => viewWith()));
    const opened: unknown[] = [];
    on('http.fetch', ($$: unknown, e: any) => server.answer(e.init));
    on('ui.open', ($$: unknown, e: unknown) => { opened.push(e); return { value: { isPlaced: true } }; });
    on('ui.panes', PANE_UP);
    on('ui.log', () => ({ value: undefined }));
    on('tool.call', { tool: CREATE }, () => ({ result: { content: [] }, text: SUMMARY_TEXT }));
    await $.tool.call({ tool: CREATE, concept: 'A meditation app landing page' });
    expect(opened).toEqual([{ id: PANE_ID, title: 'Design workspace' }]);
    const ui = await mountPane($, 'desktop');
    await clock.advance(0);
    await clock.advance(0);
    expect(server.calls.filter((call) => call.name === 'design.slate.status')[0]).toEqual({ name: 'design.slate.status', args: { runDir: RUN_DIR } });
    expect(await promptValue(ui)).toBe('A meditation app landing page');
    await ui.unmount();
  });

  /** A drawn workspace of `n` ready options (A, B, ...) with no round running, and a page of inspiration. */
  function drawnView(n: number) {
    const base: any = viewWith({ running: false, refs: Array.from({ length: 12 }, (_unused, index) => `gen-${index}`) });
    const labels = Array.from({ length: n }, (_unused, index) => String.fromCharCode(65 + index));
    base.candidates = labels.map((label) => ({ ...base.candidates[0], candidateId: `c_${label.toLowerCase()}`, label, versionIds: [`v_${label.toLowerCase()}`], latestVersionId: `v_${label.toLowerCase()}` }));
    base.versions = labels.map((label) => ({ ...base.versions[0], versionId: `v_${label.toLowerCase()}`, candidateId: `c_${label.toLowerCase()}`, label }));
    base.rounds[0].count = n;
    base.rounds[0].readyCount = n;
    return base;
  }

  /**
   * A session on `surface` whose server answers every picture `pictureMs` after it was asked (on the session clock; 0
   * answers at once), with the pane mounted and its first read answered. Counts the pane's `$.ui.invalidate` calls.
   */
  async function countedSession($: any, on: any, view: () => unknown, { surface = 'desktop', pictureMs = 0 }: { surface?: 'desktop' | 'terminal'; pictureMs?: number } = {}) {
    const clock = mock.clock(on, { now: 1000 });
    const server = fakeServer(workspaceAnswers(view as any));
    const redraws: number[] = [];
    on('ui.invalidate', ($$: unknown, e: unknown, next: any) => { redraws.push(clock.now()); return next(e); });
    on('http.fetch', async ($$: unknown, e: any) => {
      const body = String(e.init && e.init.body);
      if (pictureMs > 0 && (body.includes('"design.slate.image"') || body.includes('"design.slate.reference"'))) {
        const due = clock.now() + pictureMs;
        await new Promise<void>((resolve) => { held.push({ due, resolve }); });
      }
      return server.answer(e.init);
    });
    const held: Array<{ due: number; resolve: () => void }> = [];
    on('ui.open', () => ({ value: { isPlaced: true } }));
    on('ui.panes', PANE_UP);
    on('ui.blit', () => ({ value: {} }));
    on('ui.log', () => ({ value: undefined }));
    on('tool.call', { tool: CREATE }, () => ({ result: { content: [] }, text: CREATE_TEXT }));
    await $.tool.call({ tool: CREATE, concept: 'A meditation app landing page' });
    const ui = await mountPane($, surface);
    const opened = redraws.length;
    /** Moves the clock on by `ms` in 50 ms steps, answering each held picture once its time has come. */
    const run = async (ms: number) => {
      const until = clock.now() + ms;
      while (clock.now() < until) {
        await clock.advance(Math.min(50, until - clock.now()));
        for (const entry of held.filter((item) => item.due <= clock.now())) {
          held.splice(held.indexOf(entry), 1);
          entry.resolve();
        }
        await clock.advance(0);
      }
    };
    await clock.advance(0);
    await clock.advance(0);
    return { clock, server, ui, redraws, opened, run };
  }
  test('while the person presses tabs every 700 ms, the pane draws once a press and nothing of its own', async ($, on) => {
    const { clock, server, ui, redraws } = await countedSession($, on, () => drawnView(12));
    await clock.advance(10000);
    const start = redraws.length;
    const tabs = ['tab:inspiration', 'tab:references', 'tab:designs', 'tab:inspiration', 'tab:references'];
    for (const key of tabs) {
      await ui.press({ key });
      await clock.advance(700);
    }
    expect(server.calls.filter((call) => call.name === 'design.slate.reference')).toHaveLength(12);
    expect(redraws.length - start).toBe(tabs.length);
    await clock.advance(5000);
    expect(redraws.length - start).toBe(tabs.length);
    await ui.unmount();
  });

});
