"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { compareSequences, isMeaningful } from "@/lib/compare";
import { format, formatDistance, formatDuration, type Lang } from "@/lib/kit/i18n";
import type { Stop } from "@/lib/plan";
import { TEXT } from "@/lib/text";

export interface CompareCardProps {
  current: { stops: readonly Stop[]; distanceMeters: number; durationSeconds: number };
  optimized: { stops: readonly Stop[]; distanceMeters: number; durationSeconds: number };
  onUse: () => void;
  onDismiss: () => void;
  lang: Lang;
}

function Sequence({ numbers, label }: { numbers: number[]; label: string }) {
  return (
    <ol aria-label={label} className="flex flex-wrap items-center gap-1 text-xs tabular-nums">
      {numbers.map((n, i) => (
        <li key={i} className="flex items-center gap-1">
          {i > 0 ? <span aria-hidden className="text-muted-foreground">→</span> : null}
          <Badge variant="outline">{n}</Badge>
        </li>
      ))}
    </ol>
  );
}

/**
 * Your order beside the order `/optimized-route` returned, each with Unmap's own distance and
 * time, the stops numbered as they are in your list. Shown only for an answer from the API, and
 * only for the sequence it was asked about.
 */
export function CompareCard({ current, optimized, onUse, onDismiss, lang }: CompareCardProps) {
  const t = TEXT[lang];
  const cmp = compareSequences(current, optimized);
  const verdict = cmp.sameOrder
    ? t.sameOrder
    : isMeaningful(cmp)
      ? format(t.saves, { distance: formatDistance(Math.max(0, cmp.distanceSaved), lang), duration: formatDuration(Math.max(0, cmp.durationSaved), lang) })
      : cmp.distanceSaved < 0 && cmp.durationSaved < 0
        ? t.longer
        : t.aboutSame;
  const yours = current.stops.map((_, i) => i + 1);

  return (
    <Card size="sm" data-compare="">
      <CardHeader>
        <CardTitle>{t.compareTitle}</CardTitle>
        <CardDescription>{t.compareNote}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5" data-compare-side="current">
            <h3 className="text-xs font-medium text-muted-foreground">{t.yourOrder}</h3>
            <p className="font-semibold tabular-nums">{format(t.total, { distance: formatDistance(current.distanceMeters, lang), duration: formatDuration(current.durationSeconds, lang) })}</p>
            <Sequence numbers={yours} label={`${t.sequence}: ${t.yourOrder}`} />
          </div>
          <div className="flex flex-col gap-1.5" data-compare-side="optimized">
            <h3 className="text-xs font-medium text-muted-foreground">{t.optimizedOrder}</h3>
            <p className="font-semibold tabular-nums">{format(t.total, { distance: formatDistance(optimized.distanceMeters, lang), duration: formatDuration(optimized.durationSeconds, lang) })}</p>
            <Sequence numbers={cmp.fromPositions} label={`${t.sequence}: ${t.optimizedOrder}`} />
          </div>
        </div>
        <p role="status">{verdict}</p>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        {cmp.sameOrder ? null : (
          <Button size="sm" onClick={onUse}>
            {t.useOptimized}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onDismiss}>
          {t.keepMine}
        </Button>
      </CardFooter>
    </Card>
  );
}
