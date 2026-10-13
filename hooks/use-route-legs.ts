"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getUnmap } from "@/lib/kit/client";
import { isAbort } from "@/lib/kit/errors";
import { legKey, legPairs, type LegState } from "@/lib/legs";
import type { LngLat } from "@/lib/plan";

/** Edits within this window (a run of "move up" presses) cost one round of requests. */
const SETTLE_MS = 250;

/**
 * One `/route` per leg of the plan, through `@unmap/sdk`. Each leg is asked for once and kept, so
 * reordering only asks for the legs that are new; a leg that drops out of the plan while still in
 * flight is cancelled. Nothing is requested without a key.
 */
export function useRouteLegs(points: readonly LngLat[]): { legs: LegState[]; retry: () => void } {
  const pairs = useMemo(() => legPairs(points), [points]);
  const pairsKey = pairs.map(([a, b]) => legKey(a, b)).join("|");
  const [results, setResults] = useState<ReadonlyMap<string, LegState>>(() => new Map());
  const [attempt, setAttempt] = useState(0);
  // Requests in flight, by leg key. Only touched in effects and callbacks, never while rendering.
  const inflight = useRef(new Map<string, AbortController>());
  // Legs asked for in this session (answered, failed or in flight), so none is asked twice.
  const asked = useRef(new Set<string>());
  // Legs that answered with an error, for "Try again".
  const failed = useRef(new Set<string>());

  useEffect(() => {
    const unmap = getUnmap();
    if (!unmap) return;
    const needed = new Set(pairs.map(([a, b]) => legKey(a, b)));
    for (const [key, controller] of inflight.current) {
      if (!needed.has(key)) {
        controller.abort();
        inflight.current.delete(key);
        asked.current.delete(key);
      }
    }
    const timer = setTimeout(() => {
      for (const [from, to] of pairs) {
        const key = legKey(from, to);
        if (asked.current.has(key)) continue;
        asked.current.add(key);
        const controller = new AbortController();
        inflight.current.set(key, controller);
        setResults((prev) => new Map(prev).set(key, { status: "loading" }));
        unmap.router.route(from, to, { mode: "auto", signal: controller.signal }).then(
          (result) => {
            inflight.current.delete(key);
            setResults((prev) => new Map(prev).set(key, { status: "ok", result }));
          },
          (error: unknown) => {
            inflight.current.delete(key);
            if (isAbort(error)) return;
            failed.current.add(key);
            setResults((prev) => new Map(prev).set(key, { status: "error", error }));
          },
        );
      }
    }, SETTLE_MS);
    return () => clearTimeout(timer);
    // `pairsKey` stands for `pairs`: a new array with the same legs is not a new request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairsKey, attempt]);

  useEffect(() => {
    const flights = inflight.current;
    return () => {
      for (const controller of flights.values()) controller.abort();
      flights.clear();
    };
  }, []);

  /** Ask again for the legs that failed (a user's "Try again", never automatic). */
  const retry = useCallback(() => {
    const keys = [...failed.current];
    failed.current.clear();
    for (const key of keys) asked.current.delete(key);
    setResults((prev) => {
      const next = new Map(prev);
      for (const key of keys) next.delete(key);
      return next;
    });
    setAttempt((n) => n + 1);
  }, []);

  const legs = useMemo(() => pairs.map(([a, b]) => results.get(legKey(a, b)) ?? ({ status: "loading" } as const)), [pairs, results]);
  return { legs, retry };
}
