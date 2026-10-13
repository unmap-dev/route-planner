"use client";

import { PauseIcon, PlayIcon, RotateCcwIcon, SkipForwardIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { format, type Lang } from "@/lib/kit/i18n";
import { ProvenanceBadge } from "@/lib/kit/provenance-badge";
import type { Stop } from "@/lib/plan";
import { formatClock } from "@/lib/schedule";
import type { Courier } from "@/lib/simulation";
import { TEXT } from "@/lib/text";
import { SPEEDS, type Speed } from "@/hooks/use-simulation";

export interface SimulationCardProps {
  ready: boolean;
  courier: Courier | null;
  stops: readonly Stop[];
  /** Simulated seconds since leaving the depot. */
  time: number;
  departAt: number;
  playing: boolean;
  finished: boolean;
  reduced: boolean;
  speed: Speed;
  onSpeed: (speed: Speed) => void;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onNext: () => void;
  lang: Lang;
}

/**
 * Controls for the simulated courier, labelled "Simulated" where it is seen. It plays the route
 * back from Unmap's geometry and drive times; it is not tracking anything.
 */
export function SimulationCard({ ready, courier, stops, time, departAt, playing, finished, reduced, speed, onSpeed, onPlay, onPause, onReset, onNext, lang }: SimulationCardProps) {
  const t = TEXT[lang];
  const label = (i: number) => `${i + 1}. ${stops[i]?.name ?? ""}`;
  const phase = courier?.phase;
  const status = !phase
    ? t.simulationWaiting
    : phase.kind === "ready"
      ? t.phaseReady
      : phase.kind === "driving"
        ? phase.leg < stops.length
          ? format(t.phaseDriving, { stop: label(phase.leg) })
          : t.phaseDrivingHome
        : phase.kind === "serving"
          ? format(t.phaseServing, { stop: label(phase.stop) })
          : t.phaseDone;

  return (
    <Card size="sm" data-simulation="">
      <CardHeader>
        <CardTitle>{t.simulation}</CardTitle>
        <CardDescription>{format(t.simulationNote, { speed })}</CardDescription>
        <CardAction>
          <ProvenanceBadge kind="simulated" lang={lang} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ButtonGroup>
            {playing ? (
              <Button size="sm" variant="outline" onClick={onPause} disabled={!ready}>
                <PauseIcon />
                {t.pause}
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={onPlay} disabled={!ready}>
                <PlayIcon />
                {t.play}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onNext} disabled={!ready || finished}>
              <SkipForwardIcon />
              {t.nextStop}
            </Button>
            <Button size="sm" variant="outline" onClick={onReset} disabled={!ready || time === 0}>
              <RotateCcwIcon />
              {t.reset}
            </Button>
          </ButtonGroup>
          <ToggleGroup variant="outline" size="sm" spacing={0} value={[String(speed)]} onValueChange={(v) => v[0] && onSpeed(Number(v[0]) as Speed)} aria-label={t.speed}>
            {SPEEDS.map((s) => (
              <ToggleGroupItem key={s} value={String(s)} aria-label={`${s}×`}>
                {s}×
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="flex flex-col gap-0.5 text-sm" data-simulation-status="">
          {ready ? <p className="font-medium tabular-nums">{format(t.clock, { time: formatClock(departAt + time, lang) })}</p> : null}
          {/* Announced at each change of phase, not on every frame. */}
          <p role="status" aria-live="polite">
            {status}
          </p>
          {reduced ? <p className="text-xs text-muted-foreground">{t.reducedMotion}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
