// The pane: which picture element each surface gets, the blit fact that switches the terminal to colour cells, the
// error line, and that nothing polls where nothing draws.
import { describe, expect, mock, test } from 'claude-code/testing';

import { CREATE, OTHER_RUN_DIR, PANE_ID, PANE_PROPS, RUN_DIR, SHOW, fakeServer, serverIdsView, viewWith, workspaceAnswers } from './fixtures/workspace.ts';

const CREATE_TEXT = JSON.stringify({ schema: '12ui.slate.view/3', runDir: RUN_DIR });

/** A session that draws on `surface`, a create result naming RUN_DIR, and the fake server; returns its calls. */
async function openWorkspace($: any, on: any, surface: string, answers = workspaceAnswers(() => viewWith())) {
  const server = fakeServer(answers);
  const opened: unknown[] = [];
  on('http.fetch', ($$: unknown, e: any) => server.answer(e.init));
  on('ui.open', ($$: unknown, e: unknown) => { opened.push(e); return { value: { isPlaced: true } }; });
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

/** The pane opens on Inspiration; the design pictures are on the Designs tab. */
async function showDesigns(ui: any) {
  await ui.press({ key: 'tab:designs' });
}

describe('pane.test.ts', () => {
  test('a create result opens the pane where the session draws', async ($, on) => {
    mock.clock(on, { now: 1000 });
    const { opened } = await openWorkspace($, on, 'terminal');
    expect(opened).toEqual([{ id: PANE_ID, title: 'Design workspace' }]);
  });

  test('a pane that cannot open leaves the tool result as the tool gave it', async ($, on) => {
    mock.clock(on, { now: 1000 });
    const logged: string[] = [];
    on('ui.open', () => ({ deny: 'panes are off here' }));
    on('ui.log', ($$: unknown, e: any) => { logged.push(e.text); return { value: undefined }; });
    on('tool.call', { tool: CREATE }, () => ({ result: { content: [] }, text: CREATE_TEXT }));
    on('tool.call', { tool: SHOW }, () => ({ result: { content: [] }, text: 'shown' }));
    const result = await $.tool.call({ tool: CREATE, concept: 'x' } as never);
    expect(result.text).toBe(CREATE_TEXT);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain('the Design workspace pane did not open');
  });

  test('a pane the terminal cannot seat shows the toast instead', async ($, on) => {
    mock.clock(on, { now: 1000 });
    const toasts: string[] = [];
    const server = fakeServer(workspaceAnswers(() => viewWith()));
    on('http.fetch', ($$: unknown, e: any) => server.answer(e.init));
    on('ui.open', () => ({ value: { isPlaced: false, reason: 'below 144 columns' } }));
    on('ui.toast', ($$: unknown, e: any) => { toasts.push(e.text); return { value: undefined }; });
    on('tool.call', { tool: CREATE }, () => ({ result: { content: [] }, text: CREATE_TEXT }));
    on('tool.call', { tool: SHOW }, () => ({ result: { content: [] }, text: 'shown' }));
    await $.tool.call({ tool: CREATE, concept: 'x' } as never);
    expect(toasts).toEqual(['Design workspace ready. Press Open above the prompt to see it.']);
  });

  for (const [surface, element, absent] of [['terminal', 'Image', 'Svg'], ['desktop', 'Svg', 'Image']] as const) {
    test(`a ${surface} mount opens on Inspiration, and Designs draws the options with ${element}`, async ($, on) => {
      const clock = mock.clock(on, { now: 1000 });
      on('ui.blit', () => ({ value: {} }));
      await openWorkspace($, on, surface);
      const ui = await mountPane($, surface);
      await clock.advance(0);
      await clock.advance(0);
      expect(await promptValue(ui)).toBe('A meditation app landing page');
      expect(await ui.find({ key: 'design' })).toBeDefined();
      expect(await ui.find({ type: 'Text', text: 'No inspiration yet.' })).toBeDefined();
      expect(await ui.find({ type: element })).toBeUndefined();
      await showDesigns(ui);
      expect(await ui.findAll({ type: element })).toHaveLength(1);
      expect(await ui.find({ type: absent })).toBeUndefined();
      expect(await ui.find({ type: 'Text', text: 'waiting for your agent' })).toBeDefined();
      expect(await ui.find({ type: 'Text', text: 'failed: Codex on this Mac is not signed in. Nothing was drawn.' })).toBeDefined();
      expect(await ui.find({ key: 'open:c_a' })).toBeDefined();
      expect(await ui.find({ key: 'per:12' })).toBeDefined();
      await ui.unmount();
    });
  }

  for (const surface of ['vscode', 'mobile'] as const) {
    test(`a ${surface} mount draws a valid tree with the elements that surface has`, async ($, on) => {
      const clock = mock.clock(on, { now: 1000 });
      await openWorkspace($, on, surface);
      const ui = await $.ui.mount({ plugin: '12ui-design', surface, component: 'Pane', requestId: PANE_ID, props: PANE_PROPS });
      await clock.advance(0);
      await clock.advance(0);
      await showDesigns(ui);
      expect(await ui.findAll({ type: 'Svg' })).toHaveLength(1);
      expect(await ui.find({ key: 'per:12' })).toBeDefined();
      expect(await ui.find({ key: 'open:c_a' })).toBeDefined();
      if (surface === 'mobile') {
        expect(await ui.find({ type: 'Input' })).toBeUndefined();
                expect(await ui.find({ key: 'design' })).toBeDefined();
      }
      await ui.unmount();
    });
  }

  test('a desktop picture embeds the thumbnail JPEG in the Svg', async ($, on) => {
    const clock = mock.clock(on, { now: 1000 });
    await openWorkspace($, on, 'desktop');
    const ui = await mountPane($, 'desktop');
    await clock.advance(0);
    await clock.advance(0);
    await showDesigns(ui);
    const svg = await ui.find({ type: 'Svg' });
    expect(String(svg?.props.source)).toContain('href="data:image/jpeg;base64,/9j/');
    expect(svg?.props.alt).toBe('Option A');
    await ui.unmount();
  });

  // The grid (layout.mjs): at the fixture's 100 columns two tiles of 49 sit side by side (the ring takes one column a
  // side, so a picture is 47 wide), the rows the 32 x 18 thumbnail asks; a short window holds the picture to it and
  // narrows it to keep its aspect.
  for (const [name, bodyRows, terminal, desktop] of [
    ['a tall window draws each picture the tile\'s whole width (silent: no row limit reached)', 60, { columns: 47, rows: 13 }, { width: 376, height: 212 }],
    ['a short window holds each picture to what one whole tile leaves of it (fires)', 10, { columns: 21, rows: 6 }, { width: 168, height: 95 }],
  ] as const) {
    for (const surface of ['terminal', 'desktop'] as const) {
      test(`${name}, on ${surface}`, async ($, on) => {
        const clock = mock.clock(on, { now: 1000 });
        on('ui.blit', () => ({ value: {} }));
        await openWorkspace($, on, surface);
        const props = { ...PANE_PROPS, scroll: { offset: 0, bodyRows } };
        const ui = await $.ui.mount({ plugin: '12ui-design', surface, component: 'Pane', requestId: PANE_ID, props });
        await clock.advance(0);
        await clock.advance(0);
        await showDesigns(ui);
        if (surface === 'terminal') {
          const image = await ui.find({ type: 'Image' });
          expect({ columns: image?.props.columns, rows: image?.props.rows }).toEqual(terminal);
          expect(image?.props.alt).toBe('Press v for colour cells');
        } else {
          const svg = await ui.find({ type: 'Svg' });
          expect({ width: svg?.props.width, height: svg?.props.height }).toEqual(desktop);
        }
        expect((await ui.find({ key: 'design:c_a' }))?.props.width).toBe(49);
        await ui.unmount();
      });
    }
  }

  test('a blit deny for the alt switches the terminal to colour cells', async ($, on) => {
    const clock = mock.clock(on, { now: 1000 });
    on('ui.blit', () => ({ value: { deny: 'the Image draws its alt there: no placeholder images' } }));
    await openWorkspace($, on, 'terminal');
    const ui = await mountPane($, 'terminal');
    await clock.advance(0);
    await clock.advance(0);
    await showDesigns(ui);
    expect(await ui.find({ type: 'Image' })).toBeDefined();
    await clock.advance(300);
    expect(await ui.find({ type: 'Raster' })).toBeDefined();
    expect(await ui.find({ type: 'Image' })).toBeUndefined();
    await ui.unmount();
  });

  test('a blit that takes the pixels keeps the picture', async ($, on) => {
    const clock = mock.clock(on, { now: 1000 });
    on('ui.blit', () => ({ value: {} }));
    await openWorkspace($, on, 'terminal');
    const ui = await mountPane($, 'terminal');
    await clock.advance(0);
    await showDesigns(ui);
    await clock.advance(300);
    expect(await ui.find({ type: 'Image' })).toBeDefined();
    expect(await ui.find({ type: 'Raster' })).toBeUndefined();
    await ui.unmount();
  });

  test('the pane polls while an option runs and fetches each thumbnail once', async ($, on) => {
    const clock = mock.clock(on, { now: 1000 });
    on('ui.blit', () => ({ value: {} }));
    const { server } = await openWorkspace($, on, 'terminal');
    const ui = await mountPane($, 'terminal');
    await clock.advance(0);
    await clock.advance(0);
    const statusCalls = () => server.calls.filter((call) => call.name === 'design.slate.status').length;
    expect(statusCalls()).toBe(1);
    await clock.advance(2000);
    expect(statusCalls()).toBe(2);
    await clock.advance(3000);
    expect(statusCalls()).toBe(3);
    expect(server.calls.filter((call) => call.name === 'design.slate.image')).toEqual([
      { name: 'design.slate.image', args: { runDir: RUN_DIR, versionId: 'v_a', size: 'thumb' } },
    ]);
    await ui.unmount();
  });

  test('the pane stops polling once nothing runs', async ($, on) => {
    const clock = mock.clock(on, { now: 1000 });
    on('ui.blit', () => ({ value: {} }));
    const { server } = await openWorkspace($, on, 'terminal', workspaceAnswers(() => viewWith({ running: false })));
    const ui = await mountPane($, 'terminal');
    await clock.advance(0);
    await clock.advance(30000);
    expect(server.calls.filter((call) => call.name === 'design.slate.status')).toHaveLength(1);
    await ui.unmount();
  });

  // The engine raises `ui.close` when the person closes the pane; an inline plugin's close raises the same event here.
  const CLOSER = {
    name: 'closer',
    register(on: any) {
      on('command.run', { command: 'close-pane' }, async ($: any) => {
        await $.ui.close({ id: 'design-workspace' });
        return { text: 'closed' };
      });
    },
  };

  test('closing the pane stops polling', { plugins: [CLOSER] }, async ($, on) => {
    const clock = mock.clock(on, { now: 1000 });
    on('ui.blit', () => ({ value: {} }));
    on('ui.close', () => ({ value: undefined }) as never);
    const { server } = await openWorkspace($, on, 'terminal');
    const ui = await mountPane($, 'terminal');
    await clock.advance(0);
    await $.command.run({ command: 'close-pane', args: '' } as never);
    await clock.advance(30000);
    expect(server.calls.filter((call) => call.name === 'design.slate.status')).toHaveLength(1);
    await ui.unmount();
  });

  test('a refused fetch shows the error line', async ($, on) => {
    const clock = mock.clock(on, { now: 1000 });
    on('http.fetch', () => ({ deny: 'web fetch is off for this organization' }));
    on('ui.open', () => ({ value: { isPlaced: true } }));
    on('tool.call', { tool: CREATE }, () => ({ result: { content: [] }, text: CREATE_TEXT }));
    on('tool.call', { tool: SHOW }, () => ({ result: { content: [] }, text: 'shown' }));
    await $.tool.call({ tool: CREATE, concept: 'x' } as never);
    const ui = await mountPane($, 'terminal');
    await clock.advance(0);
    const line = await ui.find({ type: 'Text', text: /^The Design workspace can't reach design\.12ui\.com: / });
    expect(line?.text).toContain('web fetch is off for this organization');
    expect(await ui.find({ type: 'Text', text: 'Loading the Design workspace.' })).toBeUndefined();
    await ui.unmount();
  });

  test('before the first answer the pane says it is loading, with no error line', async ($, on) => {
    mock.clock(on, { now: 1000 });
    await openWorkspace($, on, 'terminal');
    const ui = await mountPane($, 'terminal');
    expect(await ui.find({ type: 'Text', text: 'Loading the Design workspace.' })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: /can't reach/ })).toBeUndefined();
    await ui.unmount();
  });

  // The mod reads no session facts: it opens the pane either way, and where nothing draws the engine draws no pane, so
  // nothing is read, polled or told.
  test('where nothing draws, a create result polls nothing and tells Claude nothing', async ($, on) => {
    mock.clock(on, { now: 1000 });
    const server = fakeServer(workspaceAnswers(() => viewWith()));
    const submitted: string[] = [];
    let opens = 0;
    on('http.fetch', ($$: unknown, e: any) => server.answer(e.init));
    on('ui.open', () => { opens += 1; return { value: { isPlaced: true } }; });
    on('prompt.submit', ($$: unknown, e: any) => { submitted.push(e.text); return { text: e.text }; });
    on('tool.call', { tool: CREATE }, () => ({ result: { content: [] }, text: CREATE_TEXT }));
    on('tool.call', { tool: SHOW }, () => ({ result: { content: [] }, text: 'shown' }));
    await $.tool.call({ tool: CREATE, concept: 'x' } as never);
    expect(opens).toBe(1);
    expect(server.calls).toEqual([]);
    expect(submitted).toEqual([]);
  });

  // Switching workspaces while the pane is open: the pane reads the workspace it now shows, and re-showing the one it
  // already holds reads nothing more (design 3.3.3 and 3.3.5).
  const OTHER_BRIEF = 'A tea shop menu';

  /** Each workspace's own view: RUN_DIR as `viewWith` draws it, OTHER_RUN_DIR with its own brief. */
  function twoWorkspaces(options: { running?: boolean } = {}) {
    const viewOf = (args: any) => (args.runDir === OTHER_RUN_DIR
      ? { ...viewWith(options), runDir: OTHER_RUN_DIR, brief: { concept: OTHER_BRIEF, aspect: 'landscape' } }
      : viewWith(options));
    return fakeServer(workspaceAnswers(() => viewWith(options), {
      'design.slate.status': (args: any) => ({ structured: viewOf(args) }),
      'design.slate.show': (args: any) => ({ structured: viewOf(args) }),
    }));
  }

  /** A pane open on RUN_DIR with its view drawn; `createText` is what the next create result names. */
  async function openOnFirst($: any, on: any, server: ReturnType<typeof fakeServer>) {
    const clock = mock.clock(on, { now: 1000 });
    const created = { text: CREATE_TEXT };
    on('http.fetch', ($$: unknown, e: any) => server.answer(e.init));
    on('ui.open', () => ({ value: { isPlaced: true } }));
    on('ui.blit', () => ({ value: {} }));
    on('ui.log', () => ({ value: undefined }));
    on('tool.call', { tool: CREATE }, () => ({ result: { content: [] }, text: created.text }));
    on('tool.call', { tool: SHOW }, () => ({ result: { content: [] }, text: 'shown' }));
    on('tool.call', { tool: SHOW }, () => ({ result: { content: [] }, text: 'Design workspace shown.' }));
    await $.tool.call({ tool: CREATE, concept: 'A meditation app landing page' });
    const ui = await mountPane($, 'terminal');
    await clock.advance(0);
    await clock.advance(0);
    expect(await promptValue(ui)).toBe('A meditation app landing page');
    const statusFor = (runDir: string) => server.calls.filter((call) => call.name === 'design.slate.status' && call.args.runDir === runDir);
    return { clock, created, ui, statusFor };
  }

  const switches = [
    ['a second create result', async ($: any, created: { text: string }) => {
      created.text = JSON.stringify({ schema: '12ui.slate.view/3', runDir: OTHER_RUN_DIR });
      await $.tool.call({ tool: CREATE, concept: OTHER_BRIEF });
    }],
    ['a show result', async ($: any) => { await $.tool.call({ tool: SHOW, runDir: OTHER_RUN_DIR }); }],
    ['showing the other handle', async ($: any) => { await $.tool.call({ tool: SHOW, runDir: OTHER_RUN_DIR } as never); }],
  ] as const;

  for (const [name, switchTo] of switches) {
    test(`${name} while the pane is open reads the new workspace and shows its brief`, async ($, on) => {
      const server = twoWorkspaces();
      const { clock, created, ui, statusFor } = await openOnFirst($, on, server);
      expect(statusFor(OTHER_RUN_DIR)).toHaveLength(0);
      await switchTo($, created);
      await clock.advance(0);
      await clock.advance(0);
      expect(statusFor(OTHER_RUN_DIR)).toEqual([{ name: 'design.slate.status', args: { runDir: OTHER_RUN_DIR } }]);
      expect(await promptValue(ui)).toBe(OTHER_BRIEF);
      expect(await ui.find({ type: 'Text', text: 'Loading the Design workspace.' })).toBeUndefined();
      await ui.unmount();
    });
  }

  test('a switch while a read of the old workspace is still out reads the new one once that read is back', async ($, on) => {
    const clock = mock.clock(on, { now: 1000 });
    const server = twoWorkspaces();
    let release: () => void = () => {};
    let holdNext = false;
    on('http.fetch', async ($$: unknown, e: any) => {
      if (holdNext) {
        holdNext = false;
        await new Promise<void>((resolve) => { release = resolve; });
      }
      return server.answer(e.init);
    });
    on('ui.open', () => ({ value: { isPlaced: true } }));
    on('ui.blit', () => ({ value: {} }));
    on('ui.log', () => ({ value: undefined }));
    on('tool.call', { tool: CREATE }, () => ({ result: { content: [] }, text: CREATE_TEXT }));
    on('tool.call', { tool: SHOW }, () => ({ result: { content: [] }, text: 'shown' }));
    await $.tool.call({ tool: CREATE, concept: 'A meditation app landing page' });
    holdNext = true;
    const ui = await mountPane($, 'terminal');
    await clock.advance(0);
    await $.tool.call({ tool: SHOW, runDir: OTHER_RUN_DIR } as never);
    await clock.advance(0);
    const otherReads = () => server.calls.filter((call) => call.name === 'design.slate.status' && call.args.runDir === OTHER_RUN_DIR);
    expect(otherReads()).toHaveLength(0);
    release();
    await clock.advance(0);
    await clock.advance(0);
    expect(otherReads()).toHaveLength(1);
    expect(await promptValue(ui)).toBe(OTHER_BRIEF);
    expect(await promptValue(ui)).not.toBe('A meditation app landing page');
    await ui.unmount();
  });

  test('re-showing the workspace the pane already holds reads nothing more', async ($, on) => {
    const server = twoWorkspaces({ running: false });
    const { clock, ui, statusFor } = await openOnFirst($, on, server);
    expect(statusFor(RUN_DIR)).toHaveLength(1);
    await $.tool.call({ tool: CREATE, concept: 'A meditation app landing page' });
    await $.tool.call({ tool: SHOW, runDir: RUN_DIR });
    await $.tool.call({ tool: SHOW, runDir: RUN_DIR } as never);
    await $.tool.call({ tool: SHOW, runDir: RUN_DIR } as never);
    await clock.advance(0);
    await clock.advance(30000);
    expect(statusFor(RUN_DIR)).toHaveLength(1);
    expect(server.calls.filter((call) => call.name === 'design.slate.status' || call.name === 'design.slate.show')).toHaveLength(1);
    expect(await promptValue(ui)).toBe('A meditation app landing page');
    await ui.unmount();
  });

  // A first read that fails: the pane keeps reading on the backoff when a retry can mend it, and stops on a refusal.
  /**
   * A pane open on RUN_DIR whose first status read fails with `failure`: a 503 (`unavailable`), no answer at all, or the
   * server's `unknown_workspace` refusal, which every read gets. Reads after a 503 or no answer get the view.
   */
  async function firstReadFails($: any, on: any, failure: 'unavailable' | 'no answer' | 'unknown workspace') {
    const clock = mock.clock(on, { now: 1000 });
    const server = fakeServer(workspaceAnswers(() => viewWith({ running: false }), {
      'design.slate.status': (args: any) => {
        if (failure === 'unknown workspace') return { isError: true, content: [{ type: 'text', text: `unknown_workspace: No Design workspace ${args.runDir}.` }], structured: { code: 'unknown_workspace', retryable: false } };
        return { structured: viewWith({ running: false }) };
      },
    }));
    on('http.fetch', ($$: unknown, e: any) => {
      const body = JSON.parse(String(e.init.body));
      const reads = server.calls.filter((call) => call.name === 'design.slate.status').length;
      if (failure !== 'unknown workspace' && body.params.name === 'design.slate.status' && reads === 0) {
        server.calls.push({ name: 'design.slate.status', args: body.params.arguments });
        if (failure === 'no answer') return { deny: 'connection reset' };
        return { value: { status: 503, ok: false, headers: { 'content-type': 'text/plain' }, text: 'upstream unavailable' } };
      }
      return server.answer(e.init);
    });
    on('ui.open', () => ({ value: { isPlaced: true } }));
    on('ui.blit', () => ({ value: {} }));
    on('ui.log', () => ({ value: undefined }));
    on('tool.call', { tool: CREATE }, () => ({ result: { content: [] }, text: CREATE_TEXT }));
    on('tool.call', { tool: SHOW }, () => ({ result: { content: [] }, text: 'shown' }));
    await $.tool.call({ tool: CREATE, concept: 'A meditation app landing page' });
    const ui = await mountPane($, 'terminal');
    await clock.advance(0);
    await clock.advance(0);
    const statusReads = () => server.calls.filter((call) => call.name === 'design.slate.status').length;
    return { clock, ui, statusReads };
  }

  for (const [failure, line] of [['unavailable', 'design.12ui.com answered 503: upstream unavailable'], ['no answer', /^The Design workspace can't reach design\.12ui\.com: .*connection reset/]] as const) {
    test(`a first read that fails (${failure}) is read again after the first backoff step and shows the brief`, async ($, on) => {
      const { clock, ui, statusReads } = await firstReadFails($, on, failure);
      expect(statusReads()).toBe(1);
      expect(await ui.find({ type: 'Text', text: line })).toBeDefined();
      expect(await promptValue(ui)).not.toBe('A meditation app landing page');
      await clock.advance(2999);
      expect(statusReads()).toBe(1);
      await clock.advance(1);
      await clock.advance(0);
      expect(statusReads()).toBe(2);
      expect(await promptValue(ui)).toBe('A meditation app landing page');
      expect(await ui.find({ type: 'Text', text: line })).toBeUndefined();
      await clock.advance(60000);
      expect(statusReads()).toBe(2);
      await ui.unmount();
    });
  }

  test('a first read the server refuses (unknown_workspace) is not read again, and keeps its error line', async ($, on) => {
    const { clock, ui, statusReads } = await firstReadFails($, on, 'unknown workspace');
    const line = `unknown_workspace: No Design workspace ${RUN_DIR}.`;
    expect(statusReads()).toBe(1);
    await clock.advance(60000);
    expect(statusReads()).toBe(1);
    expect(await ui.find({ type: 'Text', text: line })).toBeDefined();
    await ui.unmount();
  });

  test('showing again asks once more for a shown workspace the pane holds no view of', async ($, on) => {
    const { clock, ui, statusReads } = await firstReadFails($, on, 'unknown workspace');
    expect(statusReads()).toBe(1);
    await $.tool.call({ tool: SHOW, runDir: RUN_DIR } as never);
    await clock.advance(0);
    await clock.advance(0);
    expect(statusReads()).toBe(2);
    await clock.advance(60000);
    expect(statusReads()).toBe(2);
    await ui.unmount();
  });

  // Pictures belong to their workspace: the server mints version ids per workspace (every workspace's first option is
  // `v_r1_a`), so a picture read for one workspace is never shown for another, and each is read once (3.3.3, 3.3.5).
  const FIRST_BRIEF = 'A meditation app landing page';

  /** Two workspaces with the server's own ids; OTHER_RUN_DIR's picture read answers `otherPicture`. */
  function twoServerWorkspaces(otherPicture: 'drawn' | 'missing') {
    const viewOf = (args: any) => (args.runDir === OTHER_RUN_DIR ? serverIdsView(OTHER_RUN_DIR, OTHER_BRIEF, { running: false }) : serverIdsView(RUN_DIR, FIRST_BRIEF, { running: false }));
    const answers = workspaceAnswers(() => viewOf({}), {
      'design.slate.status': (args: any) => ({ structured: viewOf(args) }),
      'design.slate.show': (args: any) => ({ structured: viewOf(args) }),
    });
    const drawn = answers['design.slate.image'];
    return fakeServer({
      ...answers,
      'design.slate.image': (args: any) => (args.runDir === OTHER_RUN_DIR && otherPicture === 'missing'
        ? { isError: true, content: [{ type: 'text', text: `image_missing: ${args.versionId} has no picture yet.` }], structured: { code: 'image_missing', retryable: false } }
        : drawn(args)),
    });
  }

  for (const [surface, element] of [['terminal', 'Image'], ['desktop', 'Svg']] as const) {
    test(`after a switch on ${surface}, the other workspace reads its own picture for the same version id once`, async ($, on) => {
      const clock = mock.clock(on, { now: 1000 });
      const server = twoServerWorkspaces('drawn');
      on('http.fetch', ($$: unknown, e: any) => server.answer(e.init));
      on('ui.open', () => ({ value: { isPlaced: true } }));
      on('ui.blit', () => ({ value: {} }));
      on('ui.log', () => ({ value: undefined }));
      on('tool.call', { tool: CREATE }, () => ({ result: { content: [] }, text: CREATE_TEXT }));
      on('tool.call', { tool: SHOW }, () => ({ result: { content: [] }, text: 'shown' }));
      await $.tool.call({ tool: CREATE, concept: FIRST_BRIEF });
      const ui = await mountPane($, surface);
      await clock.advance(0);
      await clock.advance(0);
      await showDesigns(ui);
      const imageReads = (runDir: string) => server.calls.filter((call) => call.name === 'design.slate.image' && call.args.runDir === runDir);
      expect(imageReads(RUN_DIR)).toEqual([{ name: 'design.slate.image', args: { runDir: RUN_DIR, versionId: 'v_r1_a', size: 'thumb' } }]);
      expect(await ui.findAll({ type: element })).toHaveLength(1);
      await $.tool.call({ tool: SHOW, runDir: OTHER_RUN_DIR } as never);
      await clock.advance(0);
      await clock.advance(0);
      expect(await promptValue(ui)).toBe(OTHER_BRIEF);
      expect(imageReads(OTHER_RUN_DIR)).toEqual([{ name: 'design.slate.image', args: { runDir: OTHER_RUN_DIR, versionId: 'v_r1_a', size: 'thumb' } }]);
      expect(await ui.findAll({ type: element })).toHaveLength(1);
      await clock.advance(30000);
      expect(imageReads(OTHER_RUN_DIR)).toHaveLength(1);
      await ui.unmount();
    });
  }

  test('after a switch, a workspace whose picture the server has not drawn says so instead of showing the first one\'s', async ($, on) => {
    const clock = mock.clock(on, { now: 1000 });
    const server = twoServerWorkspaces('missing');
    on('http.fetch', ($$: unknown, e: any) => server.answer(e.init));
    on('ui.open', () => ({ value: { isPlaced: true } }));
    on('ui.blit', () => ({ value: {} }));
    on('ui.log', () => ({ value: undefined }));
    on('tool.call', { tool: CREATE }, () => ({ result: { content: [] }, text: CREATE_TEXT }));
    on('tool.call', { tool: SHOW }, () => ({ result: { content: [] }, text: 'shown' }));
    await $.tool.call({ tool: CREATE, concept: FIRST_BRIEF });
    const ui = await mountPane($, 'terminal');
    await clock.advance(0);
    await clock.advance(0);
    await showDesigns(ui);
    expect(await ui.findAll({ type: 'Image' })).toHaveLength(1);
    await $.tool.call({ tool: SHOW, runDir: OTHER_RUN_DIR } as never);
    await clock.advance(0);
    await clock.advance(0);
    expect(await promptValue(ui)).toBe(OTHER_BRIEF);
    expect(await ui.find({ type: 'Image' })).toBeUndefined();
    expect(await ui.find({ type: 'Text', text: 'No picture: image_missing: v_r1_a has no picture yet.' })).toBeDefined();
    await ui.unmount();
  });

  test('switching back to the first workspace shows its picture again and reads no picture again', async ($, on) => {
    const clock = mock.clock(on, { now: 1000 });
    const server = twoServerWorkspaces('missing');
    on('http.fetch', ($$: unknown, e: any) => server.answer(e.init));
    on('ui.open', () => ({ value: { isPlaced: true } }));
    on('ui.blit', () => ({ value: {} }));
    on('ui.log', () => ({ value: undefined }));
    on('tool.call', { tool: CREATE }, () => ({ result: { content: [] }, text: CREATE_TEXT }));
    on('tool.call', { tool: SHOW }, () => ({ result: { content: [] }, text: 'shown' }));
    await $.tool.call({ tool: CREATE, concept: FIRST_BRIEF });
    const ui = await mountPane($, 'terminal');
    await clock.advance(0);
    await clock.advance(0);
    await showDesigns(ui);
    await $.tool.call({ tool: SHOW, runDir: OTHER_RUN_DIR } as never);
    await clock.advance(0);
    await clock.advance(0);
    const imageReads = () => server.calls.filter((call) => call.name === 'design.slate.image').map((call) => call.args.runDir);
    expect(imageReads()).toEqual([RUN_DIR, OTHER_RUN_DIR]);
    await $.tool.call({ tool: SHOW, runDir: RUN_DIR } as never);
    await clock.advance(0);
    await clock.advance(0);
    expect(await promptValue(ui)).toBe(FIRST_BRIEF);
    expect(await ui.findAll({ type: 'Image' })).toHaveLength(1);
    expect(await ui.find({ type: 'Text', text: /^No picture/ })).toBeUndefined();
    await clock.advance(30000);
    expect(imageReads()).toEqual([RUN_DIR, OTHER_RUN_DIR]);
    await ui.unmount();
  });

  // The pane's render hook matches every Pane and draws only its own: another pane is passed on untouched.
  test('a Pane with another id is passed on, and the Design workspace pane draws', async ($, on) => {
    const clock = mock.clock(on, { now: 1000 });
    const passedOn: string[] = [];
    on('ui.render', { component: 'Pane' }, ($$: any, e: any) => {
      passedOn.push(e.requestId);
      return $$.ui.resolve(e).Text({ children: 'Another plugin\'s pane' });
    });
    on('ui.blit', () => ({ value: {} }));
    const { server } = await openWorkspace($, on, 'terminal');
    const other = await $.ui.mount({ plugin: '12ui-design', surface: 'terminal', component: 'Pane', requestId: 'notes', props: PANE_PROPS });
    await clock.advance(0);
    await clock.advance(0);
    expect(passedOn).toEqual(['notes']);
    expect(await other.find({ type: 'Text', text: 'Another plugin\'s pane' })).toBeDefined();
    expect(await promptValue(other)).not.toBe(FIRST_BRIEF);
    expect(server.calls).toEqual([]);
    await other.unmount();
    const ui = await mountPane($, 'terminal');
    await clock.advance(0);
    await clock.advance(0);
    expect(passedOn).toEqual(['notes']);
    expect(await promptValue(ui)).toBe(FIRST_BRIEF);
    expect(await ui.find({ type: 'Text', text: 'Another plugin\'s pane' })).toBeUndefined();
    await ui.unmount();
  });
});
