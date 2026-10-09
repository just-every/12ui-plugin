// The Claude pane's controls beyond the first cut, through the pane's public door (a mounted Pane, a press by key, the
// fake design.12ui.com): a failed option's Retry, Keep, Simplify, a group's More, and the Sketches tab (select, add the
// person's own sketch from a typed path, remove it). Each press must reach the server as the hosted screen sends it.
import { describe, expect, mock, test } from 'claude-code/testing';

import { CREATE, PANE_ID, PANE_PROPS, ROUND_OP, RUN_DIR, fakeServer, viewWith, workspaceAnswers } from './fixtures/workspace.ts';

const PANE_UP = () => ({ value: [{ id: PANE_ID, title: 'Design workspace', isShown: true, isFocused: false, isPlaced: true }] });
const CREATE_TEXT = JSON.stringify({ schema: '12ui.slate.view/3', runDir: RUN_DIR });
const OWN = 'sketch-bbbbbbbbbbbbbbbb';
const MODEL = 'sketch-aaaaaaaaaaaaaaaa';
// A 1x1 PNG (its first bytes are what the pane reads the type from).
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** Round 1 is a mixed round (Sketch, Sketch + inspiration, Sketch + site) of three drawn options and one failed one. */
function mixedView(state: { kept: boolean; own: boolean; selected: string[] }) {
  const view: any = viewWith({ running: false });
  const ready = view.candidates[0];
  const group = (id: string, label: string, name: string, extra: object = {}) => ({ ...ready, candidateId: id, label, group: name, versionIds: [`v_${label.toLowerCase()}`], latestVersionId: `v_${label.toLowerCase()}`, ...extra });
  view.rounds[0].groups = ['sketch', 'inspiration', 'site'];
  view.candidates = [
    group('c_a', 'A', 'sketch', { sketchId: MODEL, ...(state.kept ? { kept: true } : {}) }),
    group('c_b', 'B', 'inspiration'),
    group('c_c', 'C', 'site'),
    { ...view.candidates[2], group: 'site' },
  ];
  view.versions = ['A', 'B', 'C'].map((label) => ({ ...view.versions[0], versionId: `v_${label.toLowerCase()}`, candidateId: `c_${label.toLowerCase()}`, label }));
  view.candidates[3] = { ...view.candidates[3], candidateId: 'c_d', label: 'D' };
  view.sketches = [...(state.own ? [{ sketchId: OWN, source: 'own', roundId: null }] : []), { sketchId: MODEL, source: 'model', roundId: 'r_1' }];
  view.inspiration = { selected: state.selected, searches: [] };
  return view;
}

describe('actions.test.ts', () => {
  for (const surface of ['terminal', 'desktop'] as const) {
    test(`Retry, Keep, Simplify, a group More and the Sketches tab each send what the hosted screen sends (${surface})`, { timeoutMs: 30_000 }, async ($, on) => {
      const clock = mock.clock(on, { now: 1000 });
      const state = { kept: false, own: false, selected: [] as string[] };
      const view = () => mixedView(state);
      const server = fakeServer(workspaceAnswers(view, {
        'design.slate.run': (args: any) => {
          if (args.action.kind === 'keep') state.kept = args.action.kept;
          return { structured: { view: view(), runner: { alive: false } } };
        },
        'design.slate.inspiration': (args: any) => {
          if (args.sketch) { state.own = true; state.selected = [...args.referenceIds, OWN]; } else state.selected = args.referenceIds;
          if (args.removeSketch) { state.own = false; state.selected = args.referenceIds; }
          return { structured: { selected: state.selected, view: view() } };
        },
      }));
      on('http.fetch', ($$: unknown, e: any) => server.answer(e.init));
      on('ui.open', () => ({ value: { isPlaced: true } }));
      on('ui.panes', PANE_UP);
      on('ui.blit', () => ({ value: {} }));
      on('ui.log', () => ({ value: undefined }));
      on('fs.read', () => ({ value: { base64: PNG_BASE64 } }));
      on('prompt.submit', ($$: unknown, e: any) => ({ text: e.text }));
      on('tool.call', { tool: CREATE }, () => ({ result: { content: [] }, text: CREATE_TEXT }));
      await $.tool.call({ tool: CREATE, concept: 'A meditation app landing page' });
      const ui = await $.ui.mount({ plugin: '12ui-design', surface, component: 'Pane', requestId: PANE_ID, props: PANE_PROPS });
      await clock.advance(0);
      await clock.advance(0);
      const sent = () => server.calls.filter((call) => call.name !== 'design.slate.status' && call.name !== 'design.slate.reference' && call.name !== 'design.slate.image');

      await ui.press({ key: 'retry:c_d' });
      expect(sent().pop()).toEqual({ name: 'design.slate.run', args: { runDir: RUN_DIR, opId: ROUND_OP, action: { kind: 'retry', option: 'D' } } });

      await ui.press({ key: 'keep:c_a' });
      expect((sent().pop() as any).args.action).toEqual({ kind: 'keep', option: 'A', kept: true });
      await clock.advance(2000);
      expect((await ui.find({ key: 'keep:c_a' }))?.props.label).toBe('♥ Kept');

      await ui.press({ key: 'more:r_1:site' });
      expect((sent().pop() as any).args.action).toEqual({ kind: 'round', mode: 'new', count: 6, group: 'site' });

      await ui.press({ key: 'open:c_a' });
      await ui.press({ key: 'lv-edit' });
      await ui.press({ key: 'lv-simplify-high' });
      expect((sent().pop() as any).args.action).toEqual({ kind: 'simplify', versionId: 'v_a', level: 'high' });

      await ui.press({ key: 'tab:sketches' });
      await ui.press({ key: `pick:${MODEL}` });
      expect((sent().pop() as any).args).toEqual({ runDir: RUN_DIR, referenceIds: [MODEL] });
      await ui.input({ key: 'sketch-path', text: '/Users/me/my sketch', kind: 'change' });
      await ui.press({ key: 'sketch-add-button' });
      const added = (sent().pop() as any).args;
      expect(added.referenceIds).toEqual([MODEL]);
      expect(added.sketch).toEqual({ mimeType: 'image/png', data: PNG_BASE64 });
      await clock.advance(2000);
      await ui.press({ key: `remove:${OWN}` });
      expect((sent().pop() as any).args).toEqual({ runDir: RUN_DIR, referenceIds: [MODEL], removeSketch: OWN });
      await ui.unmount();
    });
  }
});
