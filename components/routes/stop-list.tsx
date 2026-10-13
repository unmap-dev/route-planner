"use client";

import { useEffect, useRef } from "react";
import { ArrowDownIcon, ArrowUpIcon, NavigationIcon, TriangleAlertIcon, WarehouseIcon, XIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { format, type Lang } from "@/lib/kit/i18n";
import { RELOCATED, relocationDistance, type LegState, type PlacedWarning } from "@/lib/legs";
import type { Depot, Stop } from "@/lib/plan";
import { formatClock, type Schedule } from "@/lib/schedule";
import type { JobState } from "@/lib/simulation";
import { TEXT } from "@/lib/text";
import { cn } from "@/lib/utils";
import { JobBadge } from "./job-badge";
import { RouteProblem } from "./route-problem";

export interface StopListProps {
  depot: Depot;
  stops: readonly Stop[];
  legs: readonly LegState[];
  schedule: Schedule;
  /** Departure, seconds after midnight. */
  departAt: number;
  jobs: readonly JobState[];
  warnings: readonly PlacedWarning[];
  selected: string | null;
  /** The leg whose directions are open, if any. */
  directionsLeg: number | null;
  onMove: (index: number, delta: -1 | 1) => void;
  onRemove: (id: string) => void;
  onDirections: (leg: number | null) => void;
  onRetry: () => void;
  lang: Lang;
}

function WarningList({ items, lang }: { items: readonly PlacedWarning[]; lang: Lang }) {
  const t = TEXT[lang];
  if (!items.length) return null;
  return (
    <>
      {items.map(({ warning }, i) => {
        const moved = warning.code === RELOCATED ? relocationDistance(warning.message) : null;
        const summary = warning.code === RELOCATED ? t.relocated : warning.code.startsWith("CLOSURE") ? t.closure : null;
        return (
          <Alert key={i} data-warning={warning.code}>
            <TriangleAlertIcon />
            <AlertTitle>{t.warnings}</AlertTitle>
            <AlertDescription>
              {summary ? (
                <span className="block">
                  {summary} {moved ? format(t.relocatedBy, { distance: moved }) : null}
                </span>
              ) : null}
              {/* The API's own words, kept: the code is stable, the sentence carries the detail. */}
              <details className="mt-1 text-xs">
                <summary className="cursor-pointer">{t.apiMessage}</summary>
                <p className="mt-1">{warning.message}</p>
              </details>
            </AlertDescription>
          </Alert>
        );
      })}
    </>
  );
}

/** A leg's failure where the dispatcher looks for it: on the stop the leg arrives at. */
function LegProblem({ leg, lang, onRetry }: { leg: LegState | undefined; lang: Lang; onRetry: () => void }) {
  if (leg?.status !== "error") return null;
  const t = TEXT[lang];
  return <RouteProblem error={leg.error} title={t.noRoadTitle} hint={t.noRoadHint} lang={lang} onRetry={onRetry} />;
}

/**
 * The round as an ordered list: the depot, each stop with its estimated arrival, its sample
 * service time, its job state and any warning, and the return. Stops are reordered with buttons
 * (no drag), and focus stays on the button pressed as its stop moves.
 */
export function StopList({ depot, stops, legs, schedule, departAt, jobs, warnings, selected, directionsLeg, onMove, onRemove, onDirections, onRetry, lang }: StopListProps) {
  const t = TEXT[lang];
  const list = useRef<HTMLOListElement>(null);
  const refocus = useRef<{ id: string; dir: "up" | "down" } | null>(null);
  const clock = (s: number | null) => (s === null ? null : formatClock(departAt + s, lang));
  const n = stops.length;
  const at = (waypoint: number) => warnings.filter((w) => w.waypoint === waypoint);

  useEffect(() => {
    const want = refocus.current;
    if (!want || !list.current) return;
    refocus.current = null;
    const button = list.current.querySelector<HTMLButtonElement>(`[data-move="${want.id}:${want.dir}"]`);
    const other = list.current.querySelector<HTMLButtonElement>(`[data-move="${want.id}:${want.dir === "up" ? "down" : "up"}"]`);
    (button && !button.disabled ? button : other)?.focus();
  }, [stops]);

  useEffect(() => {
    if (!selected || !list.current) return;
    list.current.querySelector(`[data-stop="${selected}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const directionsButton = (leg: number, name: string) => (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={directionsLeg === leg ? t.hideDirections : format(t.directions, { name })}
      aria-pressed={directionsLeg === leg}
      disabled={legs[leg]?.status !== "ok"}
      onClick={() => onDirections(directionsLeg === leg ? null : leg)}
    >
      <NavigationIcon />
    </Button>
  );

  return (
    <ol ref={list} aria-label={t.stops} className="flex flex-col">
      <li data-depot="start" className="flex gap-3 border-b px-3 py-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-foreground text-background" aria-hidden>
          <WarehouseIcon className="size-4" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-medium">
                <span className="sr-only">{t.depot}: </span>
                {depot.name}
              </h3>
              <p className="truncate text-xs text-muted-foreground">{depot.address}</p>
            </div>
            <Badge variant="outline">{format(t.depotLeave, { time: formatClock(departAt, lang) })}</Badge>
          </div>
          <WarningList items={at(0)} lang={lang} />
        </div>
      </li>

      {stops.map((stop, i) => {
        const times = schedule.stops[i];
        const arrive = clock(times?.arrive ?? null);
        const leave = clock(times?.leave ?? null);
        return (
          <li key={stop.id} data-stop={stop.id} aria-current={selected === stop.id ? "true" : undefined} className={cn("flex gap-3 border-b px-3 py-2.5", selected === stop.id && "bg-muted/60")}>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground tabular-nums" aria-hidden>
              {i + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-medium">
                    <span className="sr-only">{format(t.stopLabel, { n: i + 1, name: "" })}</span>
                    <span data-stop-name="">{stop.name}</span>
                    {stop.added ? (
                      <Badge variant="secondary" className="ml-1.5 align-middle">
                        {t.added}
                      </Badge>
                    ) : null}
                  </h3>
                  <p className="truncate text-xs text-muted-foreground">{stop.address}</p>
                </div>
                <JobBadge state={jobs[i] ?? "pending"} lang={lang} />
              </div>
              <p className="text-xs text-muted-foreground" data-eta={stop.id}>
                {arrive && leave ? (
                  <span className="font-medium text-foreground tabular-nums">{format(t.arriveLeave, { arrive, leave })}</span>
                ) : (
                  <span>{t.noEta}</span>
                )}
                {" · "}
                {format(t.service, { min: Math.round(stop.serviceSeconds / 60) })}
              </p>
              {stop.note ? <p className="text-xs text-muted-foreground">{format(t.note, { note: stop.note[lang] })}</p> : null}
              <LegProblem leg={legs[i]} lang={lang} onRetry={onRetry} />
              <WarningList items={at(i + 1)} lang={lang} />
              <ButtonGroup>
                <Button
                  variant="outline"
                  size="icon-sm"
                  data-move={`${stop.id}:up`}
                  aria-label={format(t.moveUp, { name: stop.name })}
                  disabled={i === 0}
                  onClick={() => {
                    refocus.current = { id: stop.id, dir: "up" };
                    onMove(i, -1);
                  }}
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  data-move={`${stop.id}:down`}
                  aria-label={format(t.moveDown, { name: stop.name })}
                  disabled={i === n - 1}
                  onClick={() => {
                    refocus.current = { id: stop.id, dir: "down" };
                    onMove(i, 1);
                  }}
                >
                  <ArrowDownIcon />
                </Button>
                <Button variant="outline" size="icon-sm" aria-label={format(t.remove, { name: stop.name })} onClick={() => onRemove(stop.id)}>
                  <XIcon />
                </Button>
              </ButtonGroup>
            </div>
            <div className="shrink-0 self-end">{directionsButton(i, stop.name)}</div>
          </li>
        );
      })}

      <li data-depot="end" className="flex gap-3 px-3 py-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-foreground text-background" aria-hidden>
          <WarehouseIcon className="size-4" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-medium">
                <span className="sr-only">{t.depot}: </span>
                {depot.name}
              </h3>
              <p className="truncate text-xs text-muted-foreground">{depot.address}</p>
            </div>
            {schedule.returnAt !== null ? <Badge variant="outline">{format(t.depotReturn, { time: formatClock(departAt + schedule.returnAt, lang) })}</Badge> : null}
          </div>
          <LegProblem leg={legs[n]} lang={lang} onRetry={onRetry} />
          <WarningList items={at(n + 1)} lang={lang} />
        </div>
        {n > 0 ? <div className="shrink-0 self-end">{directionsButton(n, depot.name)}</div> : null}
      </li>
    </ol>
  );
}
