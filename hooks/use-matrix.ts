"use client";

import { useEffect, useState } from "react";
import type { MatrixResult } from "@unmap/sdk";
import { getUnmap } from "@/lib/kit/client";
import { isAbort } from "@/lib/kit/errors";
import { hasShape } from "@/lib/matrix";
import type { LngLat } from "@/lib/plan";

export type MatrixState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; result: MatrixResult }
  | { status: "error"; error: unknown };

/**
 * Drive times between every pair of points, from one `unmap.router.matrix()` (`POST /matrix`).
 * Only while the panel that shows it is open, once per set of points: it is a nice-to-have next
 * to the route, so it never loads with the page. At most 10 by 10, which the plan always fits.
 */
export function useMatrix(points: readonly LngLat[], open: boolean): MatrixState {
  const key = points.map((p) => p.join(",")).join(";");
  const [answers, setAnswers] = useState<Record<string, MatrixState>>({});

  useEffect(() => {
    const unmap = getUnmap();
    if (!open || !unmap || points.length < 2 || answers[key]) return;
    const controller = new AbortController();
    const asked = key;
    unmap.router.matrix([...points], [...points], { mode: "auto", signal: controller.signal }).then(
      (result) => {
        const state: MatrixState = hasShape(result, points.length)
          ? { status: "ok", result }
          : { status: "error", error: { status: 502, code: "upstream_error", message: "The matrix was not the size asked for." } };
        setAnswers((prev) => ({ ...prev, [asked]: state }));
      },
      (error: unknown) => {
        if (isAbort(error)) {
          // Cancelled because the points changed or the panel closed: forget it, ask again later.
          setAnswers((prev) => {
            const next = { ...prev };
            delete next[asked];
            return next;
          });
          return;
        }
        setAnswers((prev) => ({ ...prev, [asked]: { status: "error", error } }));
      },
    );
    return () => controller.abort();
    // One request per set of points while open; `answers` is read only to skip known ones.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, open]);

  return answers[key] ?? (open ? { status: "loading" } : { status: "idle" });
}
