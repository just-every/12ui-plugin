/**
 * Slate v2's three tabs as plain data (no `$`): what Inspiration and References list, which picks a waiting round
 * holds, and how many designs a round draws. Shapes follow `12ui.slate.view/3` as the slate v2 Worker projects it
 * (workers/api/src/slate/view.ts): `inspiration.searches`, `references`, `sites`, `rounds[].referenceIds` and `pause`.
 */

export const TABS = Object.freeze(['inspiration', 'references', 'designs']);
export const TAB_LABELS = Object.freeze({ inspiration: 'Inspiration', references: 'References', designs: 'Designs' });
/** Designs per round: 6 by default, 12 one tap away (the screen's switch). */
export const PER_ROUND = Object.freeze([6, 12]);
/** How many references one search asks for (the screen's first page). */
export const SEARCH_COUNT = 12;

/** The latest round that waits on the person, or null. */
export function waitingRound(view) {
  const rounds = (view && view.rounds ? view.rounds : []).filter((round) => round.pause);
  return rounds.length ? rounds[rounds.length - 1] : null;
}

function unique(ids) {
  return [...new Set(ids.filter((id) => typeof id === 'string' && id))];
}

/**
 * Inspiration: the first page (SEARCH_COUNT) of the newest search's results, with any pick of the waiting round that page
 * lacks put first. The server's own search behind a new workspace answers up to 96; every listed reference is fetched
 * and decoded on the hooks worker, so the pane lists one page, as the screen's first page does.
 */
export function inspirationIds(view) {
  const searches = (view.inspiration && view.inspiration.searches) || [];
  const newest = (searches.length ? searches[searches.length - 1].referenceIds || [] : []).slice(0, SEARCH_COUNT);
  const round = waitingRound(view);
  const picks = round ? round.referenceIds || [] : [];
  const missing = picks.filter((id) => !newest.includes(id));
  return unique([...missing, ...newest]);
}

/** References: the live site screenshots, in the order they landed. */
export function siteItems(view) {
  return (view.sites || []).map((site) => ({ id: site.id, title: site.title || '', sourceUrl: site.sourceUrl || '' }));
}

/** A reference's picture size as the corpus recorded it (null when unknown: the picture's own size then decides). */
export function referenceSize(view, id) {
  const meta = view.references ? view.references[id] : null;
  if (meta && meta.width && meta.height) return { width: meta.width, height: meta.height };
  if (meta && meta.aspect === 'portrait') return { width: 3, height: 4 };
  if (meta && meta.aspect === 'square') return { width: 1, height: 1 };
  return { width: 16, height: 10 };
}

/** The picks of the waiting round: the person's own once they changed them, else the round's preselection. */
export function picksOf(view, chosen) {
  if (chosen) return chosen;
  const round = waitingRound(view);
  return round ? [...(round.referenceIds || [])] : [];
}

/** At most this many picks: the round's own count of references. */
export function pickLimit(view) {
  const round = waitingRound(view);
  return round && typeof round.count === 'number' && round.count > 0 ? round.count : 12;
}

/** Adds or removes one pick; past the limit nothing changes and `refused` says so. The order never changes. */
export function togglePick(picks, id, limit) {
  const at = picks.indexOf(id);
  if (at >= 0) return { picks: picks.filter((pick) => pick !== id), refused: false };
  if (picks.length >= limit) return { picks, refused: true };
  return { picks: [...picks, id], refused: false };
}

export function sameList(a, b) {
  return a.length === b.length && a.every((id, index) => b[index] === id);
}

/** The switch's place: 12 once the newest round drew twelve or more, else 6 (or what the person tapped). */
export function perRoundOf(view, tapped) {
  if (tapped) return tapped;
  const rounds = view.rounds || [];
  const newest = rounds.length ? rounds[rounds.length - 1] : null;
  return newest && typeof newest.count === 'number' && newest.count >= 12 ? 12 : 6;
}

/** Whether tapping 12 draws a round of twelve now: the newest round drew fewer and no round runs. */
export function twelveDraws(view, roundRuns) {
  const rounds = view.rounds || [];
  const newest = rounds.length ? rounds[rounds.length - 1] : null;
  return Boolean(newest) && !roundRuns && (typeof newest.count !== 'number' || newest.count < 12);
}
