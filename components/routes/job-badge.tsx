"use client";

import { Badge } from "@/components/ui/badge";
import type { Lang } from "@/lib/kit/i18n";
import type { JobState } from "@/lib/simulation";
import { TEXT } from "@/lib/text";

/** A job's state from the simulation: pending, in progress, completed. */
export function JobBadge({ state, lang }: { state: JobState; lang: Lang }) {
  const t = TEXT[lang];
  const label = state === "completed" ? t.completed : state === "in_progress" ? t.inProgress : t.pending;
  return (
    <Badge variant={state === "in_progress" ? "default" : state === "completed" ? "secondary" : "outline"} data-job-state={state}>
      {label}
    </Badge>
  );
}
