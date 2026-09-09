type BudgetListener = () => void;

type VideoCandidate = {
  ratio: number;
  order: number;
};

const MIN_VISIBLE_RATIO = 0.15;
const candidates = new Map<symbol, VideoCandidate>();
const listeners = new Set<BudgetListener>();
let currentOwner: symbol | null = null;
let nextOrder = 0;

function notifyOwnerChange(nextOwner: symbol | null) {
  if (currentOwner === nextOwner) return;
  currentOwner = nextOwner;
  for (const listener of listeners) listener();
}

function resolveOwner() {
  let bestId: symbol | null = null;
  let bestRatio = MIN_VISIBLE_RATIO;
  let bestOrder = Number.POSITIVE_INFINITY;

  for (const [id, candidate] of candidates) {
    if (candidate.ratio < MIN_VISIBLE_RATIO) continue;
    if (
      candidate.ratio > bestRatio ||
      (candidate.ratio === bestRatio && candidate.order < bestOrder)
    ) {
      bestId = id;
      bestRatio = candidate.ratio;
      bestOrder = candidate.order;
    }
  }

  notifyOwnerChange(bestId);
}

export function registerGameCardVideoCandidate(id: symbol) {
  if (candidates.has(id)) return;
  candidates.set(id, {
    ratio: 0,
    order: nextOrder++,
  });
}

export function updateGameCardVideoVisibility(
  id: symbol,
  intersectionRatio: number
) {
  const candidate = candidates.get(id);
  if (!candidate) return;

  candidate.ratio = Number.isFinite(intersectionRatio)
    ? Math.min(Math.max(intersectionRatio, 0), 1)
    : 0;
  resolveOwner();
}

export function unregisterGameCardVideoCandidate(id: symbol) {
  if (!candidates.delete(id)) return;
  resolveOwner();
}

export function subscribeGameCardVideoBudget(listener: BudgetListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isGameCardVideoBudgetOwner(id: symbol) {
  return currentOwner === id;
}
