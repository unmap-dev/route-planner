"use client";

import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RouteSteps } from "@/components/ui/route-steps";
import { Spinner } from "@/components/ui/spinner";
import { ApiProblemAlert } from "@/lib/kit/api-problem";
import { format, type Lang } from "@/lib/kit/i18n";
import type { LngLat } from "@/lib/plan";
import { TEXT } from "@/lib/text";
import type { StepsState } from "@/hooks/use-leg-steps";

/** Turn-by-turn directions for one leg, through the registry `route-steps` item. */
export function DirectionsCard({ name, state, onClose, lang }: { name: string; state: StepsState; onClose: () => void; lang: Lang }) {
  const t = TEXT[lang];
  return (
    <Card size="sm" data-directions="">
      <CardHeader>
        <CardTitle>{format(t.stepsTitle, { name })}</CardTitle>
        <CardAction>
          <Button variant="ghost" size="icon-sm" aria-label={t.hideDirections} onClick={onClose}>
            <XIcon />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {state.status === "ok" ? (
          <RouteSteps steps={state.result.steps ?? []} coordinates={state.result.geometry.coordinates as LngLat[]} lang={lang} />
        ) : state.status === "error" ? (
          <ApiProblemAlert error={state.error} lang={lang} />
        ) : (
          <p className="flex items-center gap-2 text-sm" role="status">
            <Spinner />
            {t.stepsLoading}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
