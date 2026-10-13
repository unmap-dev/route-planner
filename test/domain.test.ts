import { describe, expect, it } from "vitest";
import type { MatrixResult, RouteResult } from "@unmap/sdk";
import { compareSequences, isMeaningful } from "../lib/compare";
import { joinGeometry, legDurations, legKey, legPairs, placeWarnings, relocationDistance, routeTotals, type LegState } from "../lib/legs";
import { countGaps, hasShape, matrixCells } from "../lib/matrix";
import { canOptimize, isOptimizeDisabled } from "../lib/optimize";
import type { LngLat, Stop } from "../lib/plan";
import { buildSchedule, formatClock, parseClock } from "../lib/schedule";

const route = (distanceMeters: number, durationSeconds: number, coordinates: LngLat[] = [[0, 0], [0, 0.01]], warnings?: RouteResult["warnings"]): LegState => ({
  status: "ok",
  result: { distanceMeters, durationSeconds, geometry: { type: "LineString", coordinates }, ...(warnings ? { warnings } : {}) },
});

describe("legs", () => {
  it("pairs consecutive waypoints and keys each leg by its ends", () => {
    const pts: LngLat[] = [[-114, 51], [-114.1, 51.1], [-114, 51]];
    expect(legPairs(pts)).toEqual([[pts[0], pts[1]], [pts[1], pts[2]]]);
    expect(legKey([-114, 51], [-114.1, 51.1])).toBe("-114.000000,51.000000>-114.100000,51.100000");
    expect(legKey([-114, 51], [-114.1, 51.1])).not.toBe(legKey([-114.1, 51.1], [-114, 51]));
  });

  it("totals only what answered, and says whether the round is complete", () => {
    expect(routeTotals([route(1000, 60), route(2000, 120)])).toMatchObject({ distanceMeters: 3000, durationSeconds: 180, complete: true });
    const partial = routeTotals([route(1000, 60), { status: "error", error: new Error("x") }, { status: "loading" }]);
    expect(partial).toMatchObject({ distanceMeters: 1000, failed: 1, loading: 1, complete: false });
    expect(legDurations([route(1, 60), { status: "loading" }])).toEqual([60, null]);
  });

  it("joins leg lines without repeating the shared point", () => {
    expect(joinGeometry([[[0, 0], [1, 1]], [[1, 1], [2, 2]]])).toEqual([[0, 0], [1, 1], [2, 2]]);
  });

  it("puts each warning on the waypoint it concerns, once", () => {
    const relocated = { code: "ENDPOINT_RELOCATED", message: "moved", where: "destination" as const };
    const sameFromOrigin = { code: "ENDPOINT_RELOCATED", message: "moved", where: "origin" as const };
    const closure = { code: "CLOSURE_IN_FORCE_NEAR_ROUTE", message: "closed", where: "route" as const };
    const placed = placeWarnings([route(1, 1, undefined, [relocated]), route(1, 1, undefined, [sameFromOrigin, closure])]);
    expect(placed.map((p) => [p.waypoint, p.warning.code, p.warning.where])).toEqual([
      [1, "ENDPOINT_RELOCATED", "destination"],
      [2, "CLOSURE_IN_FORCE_NEAR_ROUTE", "route"],
    ]);
  });
});

describe("relocationDistance", () => {
  it("reads the distance out of the gateway's sentence, and nothing out of any other", () => {
    expect(relocationDistance("The route's destination is 312 m from the point requested: no road the vehicle can use was found nearer, so the engine moved it.")).toBe("312 m");
    expect(relocationDistance("The route's origin is 292 km from the point requested: ...")).toBe("292 km");
    expect(relocationDistance("Something else entirely")).toBeNull();
  });
});

describe("schedule", () => {
  it("adds drive times and service times in order", () => {
    const s = buildSchedule([600, 300, 900], [120, 60]);
    expect(s.stops).toEqual([
      { arrive: 600, leave: 720 },
      { arrive: 1020, leave: 1080 },
    ]);
    expect(s.returnAt).toBe(1980);
    expect(s.driveSeconds).toBe(1800);
    expect(s.serviceSeconds).toBe(180);
  });

  it("stops estimating after a leg with no answer, rather than guessing", () => {
    const s = buildSchedule([600, null, 900], [120, 60]);
    expect(s.stops[0]).toEqual({ arrive: 600, leave: 720 });
    expect(s.stops[1]).toEqual({ arrive: null, leave: null });
    expect(s.returnAt).toBeNull();
  });

  it("reads and writes wall-clock times in both languages", () => {
    expect(parseClock("08:30")).toBe(30600);
    expect(parseClock("8:30")).toBeNull();
    expect(formatClock(30600 + 125, "en")).toBe("08:32");
    expect(formatClock(30600 + 125, "fr")).toBe("8 h 32");
    expect(formatClock(86400 + 600, "en")).toBe("00:10 (+1)");
  });
});

describe("compareSequences", () => {
  const s = (id: string): Stop => ({ id, name: id, address: "", coordinates: [0, 0], serviceSeconds: 0 });
  const [a, b, c] = [s("a"), s("b"), s("c")];

  it("measures the saving and says which of your stops moved where", () => {
    const cmp = compareSequences({ stops: [a, b, c], distanceMeters: 30000, durationSeconds: 3000 }, { stops: [c, a, b], distanceMeters: 24000, durationSeconds: 2500 });
    expect(cmp).toMatchObject({ sameOrder: false, distanceSaved: 6000, durationSaved: 500, moved: 3, fromPositions: [3, 1, 2] });
    expect(cmp.distanceShare).toBeCloseTo(0.2);
    expect(isMeaningful(cmp)).toBe(true);
  });

  it("calls an unchanged order unchanged, and a rounding-sized difference not a saving", () => {
    const cmp = compareSequences({ stops: [a, b], distanceMeters: 10000, durationSeconds: 600 }, { stops: [a, b], distanceMeters: 9990, durationSeconds: 590 });
    expect(cmp.sameOrder).toBe(true);
    expect(isMeaningful(cmp)).toBe(false);
  });
});

describe("matrix", () => {
  const result: MatrixResult = {
    durations: [[0, 600, null], [610, 0, 300], [null, 320, 0]],
    distances: [[0, 5000, null], [5100, 0, 2500], [null, 2600, 0]],
  };

  it("keeps null cells as gaps, never as a value", () => {
    const cells = matrixCells(result);
    expect(cells[0]![0]).toEqual({ kind: "self" });
    expect(cells[0]![1]).toEqual({ kind: "value", seconds: 600, metres: 5000 });
    expect(cells[0]![2]).toEqual({ kind: "none" });
    expect(countGaps(cells)).toBe(2);
  });

  it("checks the grid is the size asked for", () => {
    expect(hasShape(result, 3)).toBe(true);
    expect(hasShape(result, 4)).toBe(false);
  });
});

describe("optimization", () => {
  it("needs two stops to reorder and at most eight", () => {
    expect(canOptimize(1)).toEqual({ ok: false, reason: "too-few" });
    expect(canOptimize(2)).toEqual({ ok: true });
    expect(canOptimize(8)).toEqual({ ok: true });
    expect(canOptimize(9)).toEqual({ ok: false, reason: "too-many" });
  });

  it("reads a 404 not_found as the endpoint being switched off, and nothing else", () => {
    expect(isOptimizeDisabled({ status: 404, code: "not_found" })).toBe(true);
    expect(isOptimizeDisabled({ status: 404 })).toBe(true);
    expect(isOptimizeDisabled({ status: 422, code: "no_route" })).toBe(false);
    expect(isOptimizeDisabled({ status: 404, code: "something_else" })).toBe(false);
    expect(isOptimizeDisabled(new TypeError("fetch failed"))).toBe(false);
  });
});
