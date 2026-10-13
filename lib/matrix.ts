import type { MatrixResult } from "@unmap/sdk";

/**
 * Drive times between every pair of points in the plan, from one `/matrix` call. A `null` cell is
 * a real answer that means "no answer for this pair", never "no road": the Matrix API's own docs
 * say every null found so far was a pair `/route` answers. The app shows it as a gap and says so.
 */

export type Cell =
  | { kind: "self" }
  | { kind: "value"; seconds: number; metres: number | null }
  | { kind: "none" };

/** The grid as cells: the diagonal is the point itself, a null is a gap, anything else a value. */
export function matrixCells(result: MatrixResult): Cell[][] {
  return result.durations.map((row, i) =>
    row.map((seconds, j): Cell => {
      if (i === j) return { kind: "self" };
      if (seconds === null || seconds === undefined) return { kind: "none" };
      const metres = result.distances[i]?.[j];
      return { kind: "value", seconds, metres: typeof metres === "number" ? metres : null };
    }),
  );
}

/** How many off-diagonal cells came back null. */
export function countGaps(cells: readonly Cell[][]): number {
  return cells.reduce((n, row) => n + row.filter((c) => c.kind === "none").length, 0);
}

/** True when the grid is the shape asked for: `size` rows of `size` cells. */
export function hasShape(result: MatrixResult, size: number): boolean {
  return (
    result.durations.length === size &&
    result.durations.every((row) => Array.isArray(row) && row.length === size) &&
    result.distances.length === size
  );
}
