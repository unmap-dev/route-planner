import { MAX_STOPS } from "@/lib/plan";

/**
 * What the app may do with stop-order optimization, and how to read its answers.
 *
 * `/optimized-route` takes 3 to 10 points; the first and last stay where they are, which is the
 * depot leaving and the depot returning. It is behind its own feature flag on every deployment
 * (`OPTIMIZE_ENABLED` in the gateway). A deployment with the flag unset answers 404 with code
 * `not_found`, the same as a path that does not exist.
 */

export type OptimizeAvailability = { ok: true } | { ok: false; reason: "too-few" | "too-many" };

/** Whether `stops` intermediate stops can be optimized: two or more to reorder, eight at most. */
export function canOptimize(stops: number): OptimizeAvailability {
  if (stops < 2) return { ok: false, reason: "too-few" };
  if (stops > MAX_STOPS) return { ok: false, reason: "too-many" };
  return { ok: true };
}

/**
 * True when an optimize call failed because the endpoint is not enabled on this deployment: a 404
 * answered with the gateway's `not_found` envelope (or no code at all, from a proxy in between).
 */
export function isOptimizeDisabled(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: unknown; code?: unknown };
  return e.status === 404 && (e.code === undefined || e.code === "not_found");
}

/** Where the order on screen came from. "optimized" is only ever set from an API answer. */
export type OrderSource = "sample" | "manual" | "optimized";
