"use client";

import { RouteOffIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ApiProblemAlert } from "@/lib/kit/api-problem";
import type { Lang } from "@/lib/kit/i18n";

/**
 * A routing failure, said plainly. The gateway has two 422s: `outside_coverage` (a point outside
 * Canada) and `no_route` (inside coverage, but the road graph connects no route, e.g. Iqaluit has
 * no road to the mainland). The kit's alert reads every 422 as the first, so `no_route` gets its
 * own words here with the gateway's message beside them; everything else is the kit's alert.
 */
export function RouteProblem({ error, title, hint, lang, onRetry }: { error: unknown; title: string; hint: string; lang: Lang; onRetry?: () => void }) {
  const e = (error && typeof error === "object" ? error : {}) as { code?: unknown; message?: unknown };
  if (e.code !== "no_route") return <ApiProblemAlert error={error} lang={lang} onRetry={onRetry} />;
  return (
    <Alert variant="destructive" data-problem="no-route">
      <RouteOffIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {hint} {typeof e.message === "string" ? <span className="opacity-80">({e.message})</span> : null}
      </AlertDescription>
    </Alert>
  );
}
