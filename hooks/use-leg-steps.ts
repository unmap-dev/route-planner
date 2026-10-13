"use client";

import { useEffect, useState } from "react";
import type { RouteResult } from "@unmap/sdk";
import { getUnmap } from "@/lib/kit/client";
import { isAbort } from "@/lib/kit/errors";
import type { Lang } from "@/lib/kit/i18n";
import { legKey } from "@/lib/legs";
import type { LngLat } from "@/lib/plan";

export type StepsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; result: RouteResult }
  | { status: "error"; error: unknown };

/**
 * Turn-by-turn directions for one leg, asked for only when the dispatcher opens them:
 * `unmap.router.route(from, to, { steps: true, lang })`. The plain legs stay small; each leg's
 * steps are fetched once per language and kept.
 */
export function useLegSteps(leg: [LngLat, LngLat] | null, lang: Lang): StepsState {
  const key = leg ? `${legKey(leg[0], leg[1])}|${lang}` : "";
  const [answers, setAnswers] = useState<Record<string, StepsState>>({});

  useEffect(() => {
    const unmap = getUnmap();
    if (!leg || !unmap || answers[key]) return;
    const controller = new AbortController();
    const asked = key;
    unmap.router.route(leg[0], leg[1], { mode: "auto", steps: true, lang, signal: controller.signal }).then(
      (result) => setAnswers((prev) => ({ ...prev, [asked]: { status: "ok", result } })),
      (error: unknown) => {
        if (isAbort(error)) {
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
    // One request per leg and language; `answers` is read only to skip known ones.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!leg) return { status: "idle" };
  return answers[key] ?? { status: "loading" };
}
