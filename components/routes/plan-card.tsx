"use client";

import { InfoIcon, SparklesIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { format, formatDistance, formatDuration, type Lang } from "@/lib/kit/i18n";
import { ProvenanceBadge } from "@/lib/kit/provenance-badge";
import type { RouteTotals } from "@/lib/legs";
import { canOptimize, type OrderSource } from "@/lib/optimize";
import type { Plan } from "@/lib/plan";
import { formatClock, type Schedule } from "@/lib/schedule";
import { TEXT } from "@/lib/text";
import type { OptimizeState } from "@/hooks/use-optimize";
import { RouteProblem } from "./route-problem";

export interface PlanCardProps {
  plan: Plan;
  stopCount: number;
  totals: RouteTotals;
  schedule: Schedule;
  departAt: number;
  orderSource: OrderSource;
  optimize: OptimizeState;
  onOptimize: () => void;
  onRetry: () => void;
  hasKey: boolean;
  lang: Lang;
}

/**
 * The round at a glance: who, when, how far and how long (Unmap's figures, no traffic), where the
 * order came from, and the button that asks Unmap to optimize it.
 */
export function PlanCard({ plan, stopCount, totals, schedule, departAt, orderSource, optimize, onOptimize, onRetry, hasKey, lang }: PlanCardProps) {
  const t = TEXT[lang];
  const availability = canOptimize(stopCount);
  const source = orderSource === "optimized" ? t.orderOptimized : orderSource === "manual" ? t.orderManual : t.orderSample;
  const busy = optimize.status === "loading";

  return (
    <Card size="sm" data-plan-card="">
      <CardHeader>
        <CardTitle>{plan.company}</CardTitle>
        <CardDescription>{format(t.planLine, { vehicle: plan.vehicle[lang], time: formatClock(departAt, lang) })}</CardDescription>
        <CardAction>
          <ProvenanceBadge kind="sample" lang={lang} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <section aria-labelledby="route-summary" className="flex flex-col gap-1" aria-live="polite">
          <h2 id="route-summary" className="text-xs font-medium text-muted-foreground">
            {t.summary}
          </h2>
          {stopCount === 0 ? (
            <p className="text-sm">{t.noStops}</p>
          ) : !hasKey ? null : totals.loading > 0 ? (
            <p className="flex items-center gap-2 text-sm" data-route-status="loading">
              <Spinner />
              {t.summaryLoading}
            </p>
          ) : (
            <>
              <p className="text-base font-semibold tabular-nums" data-route-summary="">
                {format(t.summaryLine, {
                  distance: formatDistance(totals.distanceMeters, lang),
                  drive: formatDuration(totals.durationSeconds, lang),
                  service: formatDuration(schedule.serviceSeconds, lang),
                })}
              </p>
              {schedule.returnAt !== null ? <p className="text-sm">{format(t.summaryReturn, { time: formatClock(departAt + schedule.returnAt, lang) })}</p> : null}
              {totals.failed > 0 ? (
                <div className="flex flex-wrap items-center gap-2 text-sm text-destructive" data-route-status="incomplete">
                  {format(t.summaryIncomplete, { failed: totals.failed, legs: totals.legs })}
                  <Button variant="outline" size="sm" onClick={onRetry}>
                    {t.retryLegs}
                  </Button>
                </div>
              ) : null}
            </>
          )}
          <p className="text-xs text-muted-foreground">{t.summaryNote}</p>
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{t.order}:</span>
          <Badge variant={orderSource === "optimized" ? "default" : "outline"} data-order-source={orderSource} title={orderSource === "optimized" ? t.applied : undefined}>
            {source}
          </Badge>
          <Button
            className="ml-auto"
            size="sm"
            onClick={onOptimize}
            disabled={!hasKey || !availability.ok || busy || optimize.status === "disabled"}
            aria-describedby="optimize-hint"
          >
            {busy ? <Spinner /> : <SparklesIcon />}
            {busy ? t.optimizing : t.optimize}
          </Button>
        </div>
        <p id="optimize-hint" className="text-xs text-muted-foreground">
          {!availability.ok && availability.reason === "too-few" ? t.tooFew : t.optimizeHint}
        </p>

        {optimize.status === "disabled" ? (
          <Alert data-optimize="disabled">
            <InfoIcon />
            <AlertTitle>{t.disabledTitle}</AlertTitle>
            <AlertDescription>{t.disabledBody}</AlertDescription>
          </Alert>
        ) : optimize.status === "error" ? (
          <RouteProblem error={optimize.error} title={t.noTourTitle} hint={t.noTourHint} lang={lang} onRetry={onOptimize} />
        ) : null}
      </CardContent>
    </Card>
  );
}
