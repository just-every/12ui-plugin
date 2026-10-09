/**
 * The Designs tab's sections, as the hosted screen lays them (packages/12ui/src/mcp-slate-ui-script-designs.ts and
 * mcp-slate-ui-script-groups.ts): one section per round, the newest first, each headed "Round N" (a branch, "Branch of
 * A"). A mixed round (`rounds[].groups`, or `groupOnly` for a group More) shows one group under it for each technique,
 * Sketch, Sketch + inspiration and Sketch + site, every group with its own More. Older rounds are one grid. Pure: no `$`.
 */

import { GROUP_NAMES, SKETCH_GAP_AFTER, SKETCH_GAP_AHEAD } from './copy.mjs';
import { byLabel, isRunningOp, labelOfVersion } from './view.mjs';

/** Whether a round is a mixed round: it lists the groups it dealt, or it is one group's More. */
export function isMixedRound(round) {
  return Boolean(round) && round.kind !== 'branch' && (Boolean(round.groupOnly) || Boolean(round.groups && round.groups.length));
}

/**
 * The groups a mixed round shows, in its order. A group an option names that the round does not list still shows, last;
 * a group none of whose options is left shows no section (an option names what it drew from).
 */
function groupsOf(round, tiles) {
  const list = round.groupOnly ? [round.groupOnly] : [...(round.groups || [])];
  for (const tile of tiles) if (tile.group && !list.includes(tile.group)) list.push(tile.group);
  const held = list.filter((group) => tiles.some((tile) => tile.group === group));
  return held.length ? held : list;
}

/** The line on a group none of whose options has a sketch: "will be" while any waits to be drawn, "were" once none does. */
function gapLine(round, own, candidates) {
  if (!round.sketchGap || own.some((tile) => candidates.get(tile.candidateId)?.sketchId)) return '';
  return own.some((tile) => tile.state !== 'failed' && !tile.versionId) ? SKETCH_GAP_AHEAD : SKETCH_GAP_AFTER;
}

/** Whether any round of the workspace is drawing: a group's More is offered only when none is. */
export function roundRuns(view) {
  return view.ops.some((op) => op.kind === 'round' && isRunningOp(op));
}

/**
 * The sections of `tiles` (view.mjs `tilesOf`), newest round first: `{ key, title, groups: [{ key, group, name, gap,
 * more, tiles }] }`. `more` is true on a group of a mixed round while no round runs. A tile whose round the view does
 * not list stays in a last section, so no option is ever lost.
 */
export function designSections(view, tiles) {
  const rounds = [...view.rounds].sort((a, b) => b.index - a.index);
  const candidates = new Map(view.candidates.map((candidate) => [candidate.candidateId, candidate]));
  const idle = !roundRuns(view);
  const sections = [];
  const placed = new Set();
  for (const round of rounds) {
    const own = tiles.filter((tile) => tile.roundId === round.roundId).sort(byLabel);
    if (own.length === 0) continue;
    own.forEach((tile) => placed.add(tile.candidateId));
    const source = round.kind === 'branch' ? labelOfVersion(view, round.fromVersionId) : null;
    const title = round.kind === 'branch' ? `Branch of ${source ?? 'a design'}` : `Round ${round.index}`;
    let groups;
    if (isMixedRound(round)) {
      const names = groupsOf(round, own);
      groups = names.map((group) => {
        const inGroup = own.filter((tile) => tile.group === group);
        return { key: `${round.roundId}:${group}`, group, name: GROUP_NAMES[group] ?? group, gap: gapLine(round, inGroup, candidates), more: idle, tiles: inGroup };
      });
      const rest = own.filter((tile) => !names.includes(tile.group));
      if (rest.length) groups.push({ key: `${round.roundId}:rest`, group: null, name: '', gap: '', more: false, tiles: rest });
    } else groups = [{ key: `${round.roundId}:all`, group: null, name: '', gap: '', more: false, tiles: own }];
    sections.push({ key: round.roundId, title, groups });
  }
  const orphans = tiles.filter((tile) => !placed.has(tile.candidateId)).sort(byLabel);
  if (orphans.length) sections.push({ key: 'other', title: 'Other', groups: [{ key: 'other:all', group: null, name: '', gap: '', more: false, tiles: orphans }] });
  return sections;
}
