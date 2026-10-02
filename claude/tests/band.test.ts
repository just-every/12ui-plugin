// Opening the pane: only this plugin's own create and show results open it, and a pane a narrow terminal keeps waiting
// is offered as Open above the prompt, which the person presses so the pane is placed at any width.
import { describe, expect, test } from 'claude-code/testing';

import { CREATE, OTHER_RUN_DIR, PANE_ID, RUN_DIR, fakeServer, viewWith, workspaceAnswers } from './fixtures/workspace.ts';

const CREATE_TEXT = JSON.stringify({ schema: '12ui.slate.view/3', runDir: RUN_DIR });
const ENGINE_BAND = 'The engine\'s own band';
const BAND_PROPS = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 10 } };

/**
 * A session whose terminal seats nothing unasked (or everything, with `seats`); records every open and toast. Beneath
 * the plugin, the engine's own band draws one Text, so a band the mod passes on shows that.
 */
function narrowTerminal(on: any, { seats = false } = {}) {
  const opens: any[] = [];
  const toasts: string[] = [];
  const server = fakeServer(workspaceAnswers(() => viewWith()));
  on('http.fetch', ($$: unknown, e: any) => server.answer(e.init));
  on('ui.open', ($$: unknown, e: any) => {
    opens.push(e);
    return { value: e.focus || seats ? { isPlaced: true } : { isPlaced: false, reason: 'below 144 columns' } };
  });
  on('ui.render', { component: 'AbovePrompt' }, ($$: any, e: any) => $$.ui.resolve(e).Text({ children: ENGINE_BAND }));
  on('ui.toast', ($$: unknown, e: any) => { toasts.push(e.text); return { value: undefined }; });
  on('ui.log', () => ({ value: undefined }));
  on('tool.call', { tool: CREATE }, () => ({ result: { content: [] }, text: CREATE_TEXT }));
  return { opens, toasts };
}

async function mountBand($: any, surface: 'terminal' | 'desktop' = 'terminal', props: Record<string, unknown> = BAND_PROPS) {
  return $.ui.mount({ plugin: '12ui-design', surface, component: 'AbovePrompt', props });
}

describe('band.test.ts', () => {
  test('another tool naming a handle opens nothing', async ($, on) => {
    const { opens } = narrowTerminal(on);
    on('tool.call', { tool: 'mcp__other__lookup' }, () => ({ result: { content: [] }, text: `runDir ${OTHER_RUN_DIR}` }) as never);
    await $.tool.call({ tool: 'mcp__other__lookup' } as never);
    expect(opens).toEqual([]);
    const band = await mountBand($);
    expect(await band.find({ key: 'open' })).toBeUndefined();
    expect(await band.find({ type: 'Text', text: ENGINE_BAND })).toBeDefined();
    await band.unmount();
  });

  test('a pane the terminal cannot seat shows the toast and Open above the prompt; Open places it at any width', async ($, on) => {
    const { opens, toasts } = narrowTerminal(on);
    await $.tool.call({ tool: CREATE, concept: 'A meditation app landing page' } as never);
    expect(opens).toEqual([{ id: PANE_ID, title: 'Design workspace' }]);
    expect(toasts).toEqual(['Design workspace ready. Press Open above the prompt to see it.']);
    const band = await mountBand($);
    expect(await band.find({ type: 'Text', text: 'Design workspace ready' })).toBeDefined();
    await band.press({ key: 'open' });
    expect(opens).toEqual([{ id: PANE_ID, title: 'Design workspace' }, { id: PANE_ID, title: 'Design workspace', focus: true }]);
    expect(toasts).toHaveLength(1);
    await band.unmount();
    const after = await mountBand($);
    expect(await after.find({ key: 'open' })).toBeUndefined();
    expect(await after.find({ type: 'Text', text: ENGINE_BAND })).toBeDefined();
    await after.unmount();
  });

  test('a pane seated at once leaves the band to the next plugin', async ($, on) => {
    const { toasts } = narrowTerminal(on, { seats: true });
    await $.tool.call({ tool: CREATE, concept: 'A meditation app landing page' } as never);
    expect(toasts).toEqual([]);
    const band = await mountBand($, 'desktop');
    expect(await band.find({ key: 'open' })).toBeUndefined();
    expect(await band.find({ type: 'Text', text: ENGINE_BAND })).toBeDefined();
    await band.unmount();
  });

  test('a waiting pane yields the band to a survey', async ($, on) => {
    narrowTerminal(on);
    await $.tool.call({ tool: CREATE, concept: 'A meditation app landing page' } as never);
    const band = await mountBand($, 'terminal', { ...BAND_PROPS, hasSurvey: true });
    expect(await band.find({ key: 'open' })).toBeUndefined();
    expect(await band.find({ type: 'Text', text: ENGINE_BAND })).toBeDefined();
    await band.unmount();
  });
});
