"use client";

import { useMemo, useState } from "react";
import type { GeocodeResult } from "@unmap/sdk";
import { API_KEY, GATEWAY } from "@/lib/kit/config";
import { AppHeader } from "@/lib/kit/app-header";
import { MissingKey } from "@/lib/kit/missing-key";
import { useLang } from "@/lib/kit/use-lang";
import { legDurations, placeWarnings, routeTotals } from "@/lib/legs";
import { MANIFEST } from "@/lib/manifest";
import { MapProvider } from "@/lib/map-context";
import type { OrderSource } from "@/lib/optimize";
import { addStop, moveStop, removeStop, sequenceKey, waypoints, type LngLat, type Stop } from "@/lib/plan";
import { SAMPLE_PLAN } from "@/lib/sample";
import { buildSchedule, parseClock } from "@/lib/schedule";
import { buildTimeline, courierAt, type JobState } from "@/lib/simulation";
import { useLegSteps } from "@/hooks/use-leg-steps";
import { useMatrix } from "@/hooks/use-matrix";
import { useOptimize } from "@/hooks/use-optimize";
import { useRouteLegs } from "@/hooks/use-route-legs";
import { useSimulation } from "@/hooks/use-simulation";
import { AddStop, stopFromResult } from "./add-stop";
import { CompareCard } from "./compare-card";
import { DirectionsCard } from "./directions-card";
import { MatrixCard } from "./matrix-card";
import { PlanCard } from "./plan-card";
import { RouteMap } from "./route-map";
import { SimulationCard } from "./simulation-card";
import { StopList } from "./stop-list";

const plan = SAMPLE_PLAN;
const DEPART_AT = parseClock(plan.departAt) ?? 0;

/**
 * Routes: a one-vehicle delivery round for a fictional Calgary courier. The plan is sample data
 * kept in the browser; the routes, drive times, optimized order, matrix and search are live
 * Unmap, through `@unmap/sdk` and the registry items; the courier is simulated.
 */
export function RoutesApp() {
  const [lang, setLang] = useLang();
  const hasKey = !!API_KEY;
  const [stops, setStops] = useState<Stop[]>(plan.stops);
  const [orderSource, setOrderSource] = useState<OrderSource>("sample");
  const [notice, setNotice] = useState<"full" | "duplicate" | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [directions, setDirections] = useState<{ leg: number; key: string } | null>(null);
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const key = sequenceKey(plan.depot, stops);
  // No stops, no legs: the depot to itself is not a route worth asking for.
  const points = useMemo<LngLat[]>(() => (stops.length ? waypoints(plan.depot, stops) : []), [stops]);
  const { legs, retry } = useRouteLegs(points);
  const totals = routeTotals(legs);
  const service = useMemo(() => stops.map((s) => s.serviceSeconds), [stops]);
  const schedule = buildSchedule(legDurations(legs), service);
  const warnings = placeWarnings(legs);

  const { state: optimizeState, optimize } = useOptimize(plan.depot, stops);
  const timeline = useMemo(
    () =>
      totals.complete
        ? buildTimeline(
            legs.map((l) => (l.status === "ok" ? { coordinates: l.result.geometry.coordinates as LngLat[], durationSeconds: l.result.durationSeconds } : { coordinates: [], durationSeconds: 0 })),
            service,
          )
        : null,
    [legs, service, totals.complete],
  );
  const sim = useSimulation(timeline, `${key}|${totals.complete}`);
  const courier = timeline ? courierAt(timeline, sim.time) : null;
  const jobs: JobState[] = courier?.jobs ?? stops.map(() => "pending");

  const matrixPoints = useMemo<LngLat[]>(() => [plan.depot.coordinates, ...stops.map((s) => s.coordinates)], [stops]);
  const matrix = useMatrix(matrixPoints, matrixOpen && hasKey);

  const openLeg = directions && directions.key === key ? directions.leg : null;
  const stepsLeg = openLeg !== null && points[openLeg] && points[openLeg + 1] ? ([points[openLeg]!, points[openLeg + 1]!] as [LngLat, LngLat]) : null;
  const steps = useLegSteps(stepsLeg, lang);
  const stepsName = openLeg === null ? "" : openLeg < stops.length ? `${openLeg + 1}. ${stops[openLeg]!.name}` : plan.depot.name;

  const showCompare = optimizeState.status === "ok" && dismissed !== key && totals.complete;

  function edit(next: Stop[]) {
    setStops(next);
    setOrderSource("manual");
    setNotice(null);
  }

  function add(result: GeocodeResult) {
    const outcome = addStop(stops, stopFromResult(result), plan.depot);
    if (!outcome.ok) return setNotice(outcome.reason);
    edit(outcome.stops);
  }

  return (
    // The outer provider holds no map of its own: it lets the search box and the directions list,
    // which sit beside the map rather than on it, reach the map the <Map> below registers.
    <MapProvider apiKey={API_KEY} gateway={GATEWAY} container={null} id="routes-panel">
      <div className="flex h-dvh flex-col">
        <AppHeader manifest={MANIFEST} lang={lang} onLang={setLang} />
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <aside className="order-last flex min-h-0 flex-1 flex-col overflow-y-auto border-t lg:order-first lg:w-[420px] lg:flex-none lg:border-t-0 lg:border-r">
            <div className="flex flex-col gap-3 p-3">
              <PlanCard
                plan={plan}
                stopCount={stops.length}
                totals={totals}
                schedule={schedule}
                departAt={DEPART_AT}
                orderSource={orderSource}
                optimize={optimizeState}
                onOptimize={() => {
                  setDismissed(null);
                  optimize();
                }}
                onRetry={retry}
                hasKey={hasKey}
                lang={lang}
              />
              {showCompare && optimizeState.status === "ok" ? (
                <CompareCard
                  current={{ stops, distanceMeters: totals.distanceMeters, durationSeconds: totals.durationSeconds }}
                  optimized={{ stops: optimizeState.stops, distanceMeters: optimizeState.result.distanceMeters, durationSeconds: optimizeState.result.durationSeconds }}
                  onUse={() => {
                    setStops(optimizeState.stops);
                    setOrderSource("optimized");
                    setNotice(null);
                  }}
                  onDismiss={() => setDismissed(key)}
                  lang={lang}
                />
              ) : null}
              {hasKey && stops.length > 0 ? (
                <SimulationCard
                  ready={!!timeline}
                  courier={courier}
                  stops={stops}
                  time={sim.time}
                  departAt={DEPART_AT}
                  playing={sim.playing}
                  finished={sim.finished}
                  reduced={sim.reduced}
                  speed={sim.speed}
                  onSpeed={sim.setSpeed}
                  onPlay={sim.play}
                  onPause={sim.pause}
                  onReset={sim.reset}
                  onNext={sim.next}
                  lang={lang}
                />
              ) : null}
            </div>
            <StopList
              depot={plan.depot}
              stops={stops}
              legs={legs}
              schedule={schedule}
              departAt={DEPART_AT}
              jobs={jobs}
              warnings={warnings}
              selected={selected}
              directionsLeg={openLeg}
              onMove={(i, delta) => edit(moveStop(stops, i, delta))}
              onRemove={(id) => edit(removeStop(stops, id))}
              onDirections={(leg) => setDirections(leg === null ? null : { leg, key })}
              onRetry={retry}
              lang={lang}
            />
            <div className="flex flex-col gap-3 p-3">
              {openLeg !== null ? <DirectionsCard name={stepsName} state={steps} onClose={() => setDirections(null)} lang={lang} /> : null}
              {hasKey ? <AddStop count={stops.length} notice={notice} onAdd={add} lang={lang} /> : null}
              {hasKey ? (
                <MatrixCard
                  open={matrixOpen}
                  onToggle={() => setMatrixOpen((o) => !o)}
                  state={matrix}
                  labels={["D", ...stops.map((_, i) => String(i + 1))]}
                  lang={lang}
                />
              ) : null}
            </div>
          </aside>
          <main className="h-[45dvh] shrink-0 lg:h-auto lg:min-w-0 lg:flex-1">
            {hasKey ? (
              <RouteMap
                depot={plan.depot}
                stops={stops}
                legs={legs}
                jobs={jobs}
                courier={courier}
                proposal={showCompare && optimizeState.status === "ok" ? (optimizeState.result.geometry.coordinates as LngLat[]) : null}
                selected={selected}
                onSelect={setSelected}
                lang={lang}
              />
            ) : (
              <MissingKey lang={lang} />
            )}
          </main>
        </div>
      </div>
    </MapProvider>
  );
}
