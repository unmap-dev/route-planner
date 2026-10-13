import type { Stop } from "@/lib/plan";

/**
 * Your order against the order Unmap's `/optimized-route` returned. Both sides are Unmap figures:
 * yours is the sum of one `/route` per leg, the optimized one is the tour total the optimizer
 * returned. They are computed separately, so a small difference can come from that alone; the
 * comparison says "about" and never claims a saving the numbers do not show.
 */

export interface SequenceSummary {
  stops: readonly Stop[];
  distanceMeters: number;
  durationSeconds: number;
}

export interface Comparison {
  /** The optimizer kept your order. */
  sameOrder: boolean;
  /** Positive when the optimized order is shorter. */
  distanceSaved: number;
  /** Positive when the optimized order is quicker. */
  durationSaved: number;
  /** distanceSaved as a share of your distance, 0 to 1 (negative when longer). */
  distanceShare: number;
  /** Stops whose position changed. */
  moved: number;
  /** For each optimized position, the number the stop has in your order (1-based). */
  fromPositions: number[];
}

export function compareSequences(current: SequenceSummary, optimized: SequenceSummary): Comparison {
  const index = new Map(current.stops.map((s, i) => [s.id, i + 1]));
  const fromPositions = optimized.stops.map((s) => index.get(s.id) ?? 0);
  const moved = fromPositions.filter((from, i) => from !== i + 1).length;
  const distanceSaved = current.distanceMeters - optimized.distanceMeters;
  return {
    sameOrder: moved === 0 && current.stops.length === optimized.stops.length,
    distanceSaved,
    durationSaved: current.durationSeconds - optimized.durationSeconds,
    distanceShare: current.distanceMeters > 0 ? distanceSaved / current.distanceMeters : 0,
    moved,
    fromPositions,
  };
}

/**
 * Whether a difference is worth calling a saving. Under 1% (or 100 m / 1 min) the two
 * calculations' own differences could account for it, so the app calls it "about the same".
 */
export function isMeaningful(comparison: Comparison): boolean {
  return (comparison.distanceSaved > 100 && comparison.distanceShare > 0.01) || comparison.durationSaved > 60;
}
