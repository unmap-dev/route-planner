import type { RouteResult, RouteWarning } from "@unmap/sdk";
import type { LngLat } from "@/lib/plan";

/**
 * A route through the plan, leg by leg. `/route` takes exactly two points (no via points), so the
 * route through the depot, each stop and back is one `/route` per leg, and those legs are what
 * the distance, the drive time, the arrival schedule and the simulated courier are built from.
 */

export type LegState =
  | { status: "loading" }
  | { status: "ok"; result: RouteResult }
  | { status: "error"; error: unknown };

/** One leg's cache key: its two ends to six decimals (about 10 cm). */
export function legKey(from: LngLat, to: LngLat): string {
  const p = ([lng, lat]: LngLat) => `${lng.toFixed(6)},${lat.toFixed(6)}`;
  return `${p(from)}>${p(to)}`;
}

/** The legs between consecutive waypoints. */
export function legPairs(points: readonly LngLat[]): [LngLat, LngLat][] {
  const pairs: [LngLat, LngLat][] = [];
  for (let i = 1; i < points.length; i++) pairs.push([points[i - 1]!, points[i]!]);
  return pairs;
}

export interface RouteTotals {
  /** Sum over the legs that answered, in metres. */
  distanceMeters: number;
  /** Sum over the legs that answered, in seconds. */
  durationSeconds: number;
  legs: number;
  loading: number;
  failed: number;
  /** Every leg answered: the totals describe the whole round. */
  complete: boolean;
}

export function routeTotals(legs: readonly LegState[]): RouteTotals {
  let distanceMeters = 0, durationSeconds = 0, loading = 0, failed = 0;
  for (const leg of legs) {
    if (leg.status === "ok") {
      distanceMeters += leg.result.distanceMeters;
      durationSeconds += leg.result.durationSeconds;
    } else if (leg.status === "loading") loading++;
    else failed++;
  }
  return { distanceMeters, durationSeconds, legs: legs.length, loading, failed, complete: legs.length > 0 && loading === 0 && failed === 0 };
}

/** Each leg's drive time, null where the leg has not answered. */
export function legDurations(legs: readonly LegState[]): (number | null)[] {
  return legs.map((leg) => (leg.status === "ok" ? leg.result.durationSeconds : null));
}

/** The legs' lines joined into one, the shared point between two legs kept once. */
export function joinGeometry(lines: readonly (readonly LngLat[])[]): LngLat[] {
  const out: LngLat[] = [];
  for (const line of lines) {
    for (const point of line) {
      const last = out[out.length - 1];
      if (last && last[0] === point[0] && last[1] === point[1]) continue;
      out.push(point);
    }
  }
  return out;
}

/** A route warning placed on the waypoint it concerns. */
export interface PlacedWarning {
  /** Index into the waypoints: 0 the depot leaving, 1..n the stops, n+1 the depot returning. */
  waypoint: number;
  /** The leg that reported it. */
  leg: number;
  warning: RouteWarning;
}

/**
 * Put each leg's warnings on the waypoint they concern: `origin` is the leg's start, `destination`
 * its end, and anything along the way (`route`, a closure) goes on the stop the leg arrives at.
 * A stop the engine moved is reported by both legs that meet there (as the one's destination and
 * the other's origin); it is kept once.
 */
export function placeWarnings(legs: readonly LegState[]): PlacedWarning[] {
  const placed: PlacedWarning[] = [];
  const seen = new Set<string>();
  legs.forEach((leg, i) => {
    if (leg.status !== "ok") return;
    for (const warning of leg.result.warnings ?? []) {
      const waypoint = warning.where === "origin" ? i : i + 1;
      const key = warning.where === "route" ? `${waypoint}|${warning.code}|${warning.message}` : `${waypoint}|${warning.code}`;
      if (seen.has(key)) continue;
      seen.add(key);
      placed.push({ waypoint, leg: i, warning });
    }
  });
  return placed;
}

/** The relocation warning: the engine moved a point to the nearest road it could use. */
export const RELOCATED = "ENDPOINT_RELOCATED";

/**
 * How far the engine moved a point, read from the gateway's relocation message ("The route's
 * destination is 312 m from the point requested: ..."), e.g. "312 m". Null when the wording is not
 * the one this was written against: the code is stable, the text may change, so the app then
 * shows the message as sent and nothing parsed from it.
 */
export function relocationDistance(message: string): string | null {
  const m = /is (\d[\d,.]*\s?k?m) from the point requested/.exec(message);
  return m ? m[1]! : null;
}
