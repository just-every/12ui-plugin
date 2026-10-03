/**
 * The Design workspace pane's element tree (slate v2), built from the surface's own element table (what
 * `$.ui.resolve(e)` returned) and a plain model of what to show. No `$` here: every handler is a closure register.mjs
 * passes in.
 *
 * Top to bottom, as the hosted screen lays it out: one prompt line (its Design button inside the same row), the tabs
 * Inspiration · References · Designs with a quiet "N selected" at the right, the notice and error lines, then the
 * active tab. Inspiration and References are a wrapped gallery of picture tiles; a selected tile carries a ring and a
 * check. The tray under the gallery holds the round's words and Continue. Designs holds the 6 · 12 switch and the
 * design tiles; pressing one opens the large view with Edit · Branch · Build this.
 */

import { BAND_TEXT, BRANCH_PAGES_HINT, LABELS, LOADING, pictureAlt } from './copy.mjs';
import { TABS, TAB_LABELS } from './gallery.mjs';
import { BUTTON_GAP, TILE_GAP, briefReserve } from './layout.mjs';
import { stateLine } from './view.mjs';

const RING = 'cyan';
/** Columns between two tab labels. */
const TAB_GAP = 3;

/** The engine accepts `plain` only as true or absent (a Button with `plain: false` is skipped), so a quiet button spreads this. */
function quiet(isQuiet) {
  return isQuiet ? { plain: true } : {};
}

function text(els, words, props = {}) {
  return els.Text({ ...props, children: words });
}

function pictureNode(els, name, picture, alt) {
  if (!picture) return text(els, ' ', { dimColor: true });
  if (picture.kind === 'image') return els.Image({ key: `picture:${name}`, source: picture.source, columns: picture.columns, rows: picture.rows, alt });
  if (picture.kind === 'raster') return els.Raster({ key: `cells:${name}`, cells: picture.cells, columns: picture.columns, rows: picture.rows });
  if (picture.kind === 'svg') return els.Svg({ source: picture.source, alt, width: picture.width, height: picture.height });
  if (picture.kind === 'loading') return text(els, 'Loading picture', { dimColor: true });
  if (picture.kind === 'failed') return text(els, `No picture: ${picture.reason}`, { dimColor: true, wrap: 'wrap' });
  return null;
}

function row(els, key, children, gap = BUTTON_GAP) {
  return els.Box({ key, flexDirection: 'row', flexWrap: 'wrap', columnGap: gap, children: children.filter(Boolean) });
}

function promptNode(els, model) {
  const { handlers, prompt } = model;
  const children = [];
  if (els.Input) {
    // No label: the engine draws any given label, even an empty one, as "<label>: " before the value.
    children.push(els.Input({
      key: 'prompt',
      placeholder: 'Describe the design',
      value: prompt,
      submitLabel: LABELS.design.toLowerCase(),
      onInput: (value) => handlers.promptInput(value),
      onSubmit: (value) => handlers.promptSubmit(value),
    }));
  } else children.push(text(els, prompt, { bold: true, wrap: 'wrap' }));
  children.push(els.Button({ key: 'design', label: LABELS.design, variant: 'primary', onPress: () => handlers.promptSubmit(prompt) }));
  return els.Box({ key: 'prompt-row', flexDirection: 'row', columnGap: BUTTON_GAP, paddingRight: briefReserve(model.surface), children });
}

function tabsNode(els, model) {
  const tabs = TABS.map((name) => els.Button({
    key: `tab:${name}`,
    label: TAB_LABELS[name],
    plain: true,
    dimColor: model.tab !== name,
    onPress: () => model.handlers.tab(name),
  }));
  const right = model.selectedCount > 0 ? text(els, `${model.selectedCount} selected`, { dimColor: true }) : null;
  // The active tab is underlined: a rule under its label, as the screen's slim tab row has it.
  let offset = 0;
  for (const name of TABS) {
    if (name === model.tab) break;
    offset += TAB_LABELS[name].length + TAB_GAP;
  }
  const rule = `${' '.repeat(offset)}${'─'.repeat(TAB_LABELS[model.tab].length)}`;
  return els.Box({
    key: 'tabs',
    flexDirection: 'column',
    marginTop: 1,
    children: [
      els.Box({ key: 'tab-line', flexDirection: 'row', justifyContent: 'space-between', children: [row(els, 'tab-row', tabs, TAB_GAP), right].filter(Boolean) }),
      text(els, rule, { color: RING }),
    ],
  });
}

/** One gallery tile: its picture inside a ring when selected, then the one-tap toggle. */
function galleryTile(els, item, model) {
  const mark = item.selected ? `✓ ${LABELS.selected}` : LABELS.select;
  const children = [pictureNode(els, item.id, item.picture, item.title || 'Reference')];
  if (item.title) children.push(text(els, item.title, { dimColor: true, wrap: 'truncate-end' }));
  children.push(els.Button({ key: `pick:${item.id}`, label: mark, ...quiet(!item.selected), dimColor: !item.selected, onPress: () => model.handlers.toggle(item.id) }));
  return els.Box({
    key: `item:${item.id}`,
    flexDirection: 'column',
    width: model.tileColumns + 2,
    borderStyle: 'round',
    borderColor: item.selected ? RING : undefined,
    borderDimColor: !item.selected,
    marginBottom: 1,
    children,
  });
}

function trayNode(els, model) {
  if (!model.tray) return null;
  const { words, canContinue } = model.tray;
  return row(els, 'tray', [
    text(els, words, { wrap: 'wrap' }),
    canContinue ? els.Button({ key: 'continue', label: LABELS.continue, variant: 'primary', onPress: () => model.handlers.continueRound() }) : null,
  ], 2);
}

function galleryNode(els, model) {
  const parts = [trayNode(els, model)];
  if (model.items.length === 0) parts.push(text(els, model.emptyLine, { dimColor: true, wrap: 'wrap' }));
  else parts.push(els.Box({ key: 'gallery', flexDirection: 'row', flexWrap: 'wrap', columnGap: TILE_GAP, children: model.items.map((item) => galleryTile(els, item, model)) }));
  return parts.filter(Boolean);
}

function designTile(els, tile, model) {
  const children = [
    pictureNode(els, tile.candidateId, tile.picture, pictureAlt(tile.label, model.surface)),
    row(els, `under:${tile.candidateId}`, [
      els.Button({ key: `open:${tile.candidateId}`, label: tile.label, plain: true, onPress: () => model.handlers.open(tile) }),
      tile.isReady && !tile.isSelected ? null : text(els, tile.isSelected ? LABELS.chosen : stateLine(tile), tile.state === 'failed' ? { color: 'red', wrap: 'wrap' } : { dimColor: true, wrap: 'wrap' }),
    ]),
  ];
  return els.Box({
    key: `design:${tile.candidateId}`,
    flexDirection: 'column',
    width: model.tileColumns + 2,
    borderStyle: 'round',
    borderColor: tile.isSelected ? RING : undefined,
    borderDimColor: !tile.isSelected,
    marginBottom: 1,
    children,
  });
}

function designsNode(els, model) {
  const switchRow = row(els, 'per-round', [
    text(els, 'Per round', { dimColor: true }),
    ...model.perRoundOptions.map((n) => els.Button({ key: `per:${n}`, label: String(n), ...quiet(model.perRound !== n), dimColor: model.perRound !== n, variant: model.perRound === n ? 'primary' : undefined, onPress: () => model.handlers.perRound(n) })),
  ]);
  const parts = [trayNode(els, model), switchRow];
  if (model.tiles.length === 0) parts.push(text(els, 'No designs yet.', { dimColor: true }));
  else parts.push(els.Box({ key: 'designs', flexDirection: 'row', flexWrap: 'wrap', columnGap: TILE_GAP, marginTop: 1, children: model.tiles.map((tile) => designTile(els, tile, model)) }));
  return parts.filter(Boolean);
}

/** The large view of one design: the picture at the pane's width, then Edit · Branch · Build this. */
function largeViewNode(els, model) {
  const { lv, handlers } = model;
  const { tile } = lv;
  const actions = [els.Button({ key: 'lv-back', label: LABELS.back, plain: true, dimColor: true, onPress: () => handlers.close() })];
  if (tile.isReady) {
    if (els.Input) actions.push(els.Button({ key: 'lv-edit', label: LABELS.edit, ...quiet(lv.mode !== 'edit'), onPress: () => handlers.edit() }));
    // Once the design is building, Branch is no longer offered next to "Building".
    if (!tile.isSelected) actions.push(els.Button({ key: 'lv-branch', label: LABELS.branch, ...quiet(lv.mode !== 'branch'), onPress: () => handlers.branch() }));
    actions.push(tile.isSelected ? text(els, LABELS.chosen, { color: RING }) : els.Button({ key: 'lv-build-this', label: LABELS.buildThis, variant: 'primary', onPress: () => handlers.buildThis() }));
  }
  const children = [
    row(els, 'lv-head', [text(els, `Design ${tile.label}`, { bold: true }), tile.isReady ? null : text(els, stateLine(tile), { dimColor: true })], 2),
    pictureNode(els, `lv:${tile.candidateId}`, lv.picture, pictureAlt(tile.label, model.surface)),
    row(els, 'lv-actions', actions, 2),
  ];
  if (lv.mode === 'edit' && els.Input) {
    children.push(els.Input({
      key: `lv-edit-note:${tile.candidateId}`,
      label: LABELS.change,
      placeholder: `What to change in ${tile.label}`,
      submitLabel: 'send',
      autoFocus: true,
      onSubmit: (value) => handlers.editSubmit(value),
    }));
  }
  if (lv.mode === 'branch') children.push(...branchNodes(els, model));
  return children;
}

/**
 * The branch bar, as the screen's: Full page (the design continued below the fold) or More pages (other pages of the
 * product, names optional). Full page branches at once; More pages opens the names line, then Send.
 */
function branchNodes(els, model) {
  const { lv, handlers } = model;
  const choices = [
    els.Button({ key: 'lv-scope-page', label: LABELS.fullPage, onPress: () => handlers.branchScope('page') }),
    els.Button({ key: 'lv-scope-site', label: LABELS.morePages, ...quiet(lv.scope !== 'site'), onPress: () => handlers.branchScope('site') }),
  ];
  const nodes = [row(els, 'lv-branch-scope', choices, 2)];
  if (lv.scope === 'site') {
    const line = [];
    if (els.Input) {
      line.push(els.Input({
        key: `lv-branch-pages:${lv.tile.candidateId}`,
        label: LABELS.pages,
        placeholder: BRANCH_PAGES_HINT,
        value: lv.pages,
        submitLabel: 'send',
        autoFocus: true,
        onInput: (value) => handlers.branchPagesInput(value),
        onSubmit: (value) => handlers.branchSubmit(value),
      }));
    }
    line.push(els.Button({ key: 'lv-branch-send', label: LABELS.send, variant: 'primary', onPress: () => handlers.branchSubmit(lv.pages) }));
    nodes.push(row(els, 'lv-branch-pages', line, 2));
  }
  return nodes;
}

/** The whole pane. `model` is built by register.mjs; see the fields read above. */
export function paneTree(els, model) {
  if (!model.workspace) {
    const children = [text(els, model.emptyText, { wrap: 'wrap' })];
    if (model.errorText) children.push(text(els, model.errorText, { color: 'red', wrap: 'wrap' }));
    return els.Box({ flexDirection: 'column', children });
  }
  const children = [promptNode(els, model)];
  if (model.isLoading) {
    if (model.errorText) children.push(text(els, model.errorText, { color: 'red', wrap: 'wrap' }));
    else children.push(text(els, LOADING, { dimColor: true }));
    return els.Box({ flexDirection: 'column', children });
  }
  children.push(tabsNode(els, model));
  if (model.noticeText) children.push(text(els, model.noticeText, { dimColor: true, wrap: 'wrap' }));
  if (model.errorText) children.push(text(els, model.errorText, { color: 'red', wrap: 'wrap' }));
  if (model.lv) children.push(...largeViewNode(els, model));
  else if (model.tab === 'designs') children.push(...designsNode(els, model));
  else children.push(...galleryNode(els, model));
  return els.Box({ flexDirection: 'column', rowGap: 0, children: children.filter(Boolean) });
}

/** The band above the prompt while the pane waits undrawn for room: one dim line and Open, which seats the pane. */
export function bandTree(els, onOpen) {
  return row(els, 'design-workspace-band', [
    text(els, BAND_TEXT, { key: 'ready', dimColor: true }),
    els.Button({ key: 'open', label: LABELS.open, variant: 'primary', onPress: onOpen }),
  ]);
}
