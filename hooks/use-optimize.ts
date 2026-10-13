"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OptimizedRouteResult } from "@unmap/sdk";
import { getUnmap } from "@/lib/kit/client";
import { isAbort } from "@/lib/kit/errors";
import { isOptimizeDisabled } from "@/lib/optimize";
import { applyOrder, sequenceKey, waypoints, type Depot, type Stop } from "@/lib/plan";

export type OptimizeState =
  | { status: "idle" }
  | { status: "loading"; key: string }
  | { status: "ok"; key: string; result: OptimizedRouteResult; stops: Stop[] }
  | { status: "error"; key: string; error: unknown }
  /** The endpoint is switched off on this deployment: keep the supplied order and say so. */
  | { status: "disabled" };

/**
 * Stop-order optimization through `unmap.router.optimize()` (`POST /optimized-route`), on demand.
 * The answer belongs to the exact sequence it was asked for: change the stops and it is set aside,
 * never shown against a different order. A sequence already answered is not asked again, and once
 * the deployment says the endpoint is off, the app stops asking.
 */
export function useOptimize(depot: Depot, stops: readonly Stop[]) {
  const [state, setState] = useState<OptimizeState>({ status: "idle" });
  const controller = useRef<AbortController | null>(null);
  const key = sequenceKey(depot, stops);

  useEffect(() => () => controller.current?.abort(), []);

  const optimize = useCallback(() => {
    const unmap = getUnmap();
    if (!unmap || state.status === "disabled") return;
    if ((state.status === "ok" || state.status === "loading") && state.key === key) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const sent = [...stops];
    setState({ status: "loading", key });
    unmap.router.optimize(waypoints(depot, sent), { mode: "auto", signal: current.signal }).then(
      (result) => {
        const ordered = applyOrder(sent, result.order);
        // An order that is not a permutation with both ends fixed is not shown as an optimization.
        if (!ordered) setState({ status: "error", key, error: { status: 502, code: "upstream_error", message: "The optimizer's order did not match the stops sent." } });
        else setState({ status: "ok", key, result, stops: ordered });
      },
      (error: unknown) => {
        if (isAbort(error)) return;
        setState(isOptimizeDisabled(error) ? { status: "disabled" } : { status: "error", key, error });
      },
    );
  }, [depot, stops, key, state]);

  // What belongs to the sequence on screen now.
  const current: OptimizeState = state.status === "idle" || state.status === "disabled" || state.key === key ? state : { status: "idle" };
  return { state: current, optimize };
}
