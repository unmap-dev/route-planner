"use client";

import { useEffect, useMemo } from "react";
import { TruckIcon, WarehouseIcon } from "lucide-react";
import { Map } from "@/components/ui/map";
import { MapControls } from "@/components/ui/map-controls";
import { Marker } from "@/components/ui/marker-popup";
import { RouteLine } from "@/components/ui/route-line";
import { API_KEY, GATEWAY } from "@/lib/kit/config";
import { format, type Lang } from "@/lib/kit/i18n";
import { joinGeometry, type LegState } from "@/lib/legs";
import { useMap } from "@/lib/map-context";
import type { Depot, LngLat, Stop } from "@/lib/plan";
import type { Courier, JobState } from "@/lib/simulation";
import { TEXT } from "@/lib/text";
import { cn } from "@/lib/utils";

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Frames the depot and every stop whenever the set of places changes (not when they reorder). */
function Camera({ points }: { points: readonly LngLat[] }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).sort().join(";");
  useEffect(() => {
    if (!map || points.length === 0) return;
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
    for (const [lng, lat] of points) {
      w = Math.min(w, lng);
      e = Math.max(e, lng);
      s = Math.min(s, lat);
      n = Math.max(n, lat);
    }
    // More room on the right, where the map controls sit.
    map.fitBounds([[w, s], [e, n]], { padding: { top: 40, bottom: 40, left: 40, right: 72 }, maxZoom: 14, duration: reduceMotion() ? 0 : 600 });
    // Fit once per set of places, not on every render or reorder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

const PIN: Record<JobState, string> = {
  pending: "bg-background text-foreground border-foreground",
  in_progress: "bg-primary text-primary-foreground border-background ring-2 ring-primary/40",
  completed: "bg-muted text-muted-foreground border-background",
};

export interface RouteMapProps {
  depot: Depot;
  stops: readonly Stop[];
  legs: readonly LegState[];
  /** Per stop, from the simulation; all pending before it starts. */
  jobs: readonly JobState[];
  courier: Courier | null;
  /** The optimizer's proposed tour, drawn faint behind the current route while it is compared. */
  proposal: LngLat[] | null;
  selected: string | null;
  onSelect: (id: string) => void;
  lang: Lang;
}

/**
 * The registry map with the depot, a numbered pin per stop coloured by its job state, the route
 * (one line when every leg answered, each answered leg on its own otherwise, so a failed leg is a
 * visible gap rather than a straight line), the optimizer's proposal and the simulated courier.
 */
export function RouteMap({ depot, stops, legs, jobs, courier, proposal, selected, onSelect, lang }: RouteMapProps) {
  const t = TEXT[lang];
  const complete = legs.length > 0 && legs.every((l) => l.status === "ok");
  const line = useMemo(
    () => (complete ? joinGeometry(legs.map((l) => (l.status === "ok" ? (l.result.geometry.coordinates as LngLat[]) : []))) : []),
    [legs, complete],
  );
  const points = useMemo(() => [depot.coordinates, ...stops.map((s) => s.coordinates)], [depot, stops]);
  const started = !!courier && courier.phase.kind !== "ready";

  return (
    <div role="region" aria-label={t.mapLabel} className="relative h-full min-h-0">
      <Map apiKey={API_KEY} gateway={GATEWAY} style="base" lang={lang} center={[-114.07, 51.05]} zoom={10} controls={false} className="rounded-none" containerStyle={{ position: "absolute", inset: 0, minHeight: 0 }}>
        <Camera points={points} />
        <MapControls position="bottom-right" />
        {proposal && proposal.length > 1 ? <RouteLine id="routes-proposal" coordinates={proposal} active={false} /> : null}
        {complete ? (
          <RouteLine id="routes-route" coordinates={line} progress={started ? courier!.travelled : undefined} />
        ) : (
          legs.map((leg, i) => (leg.status === "ok" ? <RouteLine key={i} id={`routes-leg-${i}`} coordinates={leg.result.geometry.coordinates as LngLat[]} /> : null))
        )}
        <Marker
          lngLat={depot.coordinates}
          markerContent={
            <span aria-label={`${t.depot}: ${depot.name}`} data-depot-pin="" className="flex size-8 items-center justify-center rounded-md border-2 border-background bg-foreground text-background shadow-md">
              <WarehouseIcon className="size-4" aria-hidden />
            </span>
          }
        />
        {stops.map((stop, i) => (
          <Marker
            key={stop.id}
            lngLat={stop.coordinates}
            onClick={() => onSelect(stop.id)}
            markerContent={
              <span
                aria-label={format(t.stopLabel, { n: i + 1, name: stop.name })}
                data-stop-pin={stop.id}
                data-job={jobs[i] ?? "pending"}
                className={cn(
                  "flex items-center justify-center rounded-full border-2 font-sans text-[11px] font-semibold shadow-md tabular-nums transition-transform",
                  PIN[jobs[i] ?? "pending"],
                  selected === stop.id ? "size-8 scale-110" : "size-6",
                )}
              >
                {i + 1}
              </span>
            }
          />
        ))}
        {courier && started ? (
          <Marker
            lngLat={courier.position}
            markerContent={
              <span aria-label={t.courier} title={t.courier} data-courier="" className="flex size-8 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-lg">
                <TruckIcon className="size-4" aria-hidden />
              </span>
            }
          />
        ) : null}
      </Map>
    </div>
  );
}
