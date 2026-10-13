import { describe, expect, it } from "vitest";
import raw from "../data/route.sample.json";
import { addStop, applyOrder, MAX_STOPS, moveStop, parsePlan, removeStop, sameSequence, sequenceKey, waypoints, type Stop } from "../lib/plan";
import { SAMPLE_PLAN } from "../lib/sample";

const stop = (id: string, lng = -114 - Number(id.length) / 100, lat = 51): Stop => ({ id, name: id, address: "", coordinates: [lng, lat], serviceSeconds: 300 });

describe("the sample plan", () => {
  it("parses: one depot, seven stops with explicit service times, all in Calgary", () => {
    expect(SAMPLE_PLAN.company).toBe("Chinook Parcel Co.");
    // One short of the limit, so a stop can be added by search straight away.
    expect(SAMPLE_PLAN.stops).toHaveLength(MAX_STOPS - 1);
    for (const s of [SAMPLE_PLAN.depot, ...SAMPLE_PLAN.stops]) {
      const [lng, lat] = s.coordinates;
      expect(lng).toBeGreaterThan(-114.4);
      expect(lng).toBeLessThan(-113.8);
      expect(lat).toBeGreaterThan(50.8);
      expect(lat).toBeLessThan(51.25);
    }
    expect(SAMPLE_PLAN.stops.every((s) => s.serviceSeconds > 0 && s.serviceSeconds % 60 === 0)).toBe(true);
    expect(new Set(SAMPLE_PLAN.stops.map((s) => s.id)).size).toBe(7);
  });

  it("fits the optimizer: the depot twice plus every stop is at most ten points, with one to add", () => {
    expect(waypoints(SAMPLE_PLAN.depot, SAMPLE_PLAN.stops)).toHaveLength(9);
    expect(waypoints(SAMPLE_PLAN.depot, SAMPLE_PLAN.stops).length + 1).toBeLessThanOrEqual(10);
  });
});

describe("parsePlan", () => {
  it("lists every problem in one error", () => {
    const bad = { ...raw, departAt: "8:30", depot: { ...raw.depot, coordinates: [200, 51] }, stops: [{ ...raw.stops[0], serviceMinutes: -1 }, { ...raw.stops[0] }] };
    expect(() => parsePlan(bad)).toThrowError(/departAt[\s\S]*depot\.coordinates[\s\S]*serviceMinutes[\s\S]*used twice/);
  });

  it("refuses more stops than the optimizer can take", () => {
    const many = { ...raw, stops: Array.from({ length: MAX_STOPS + 1 }, (_, i) => ({ ...raw.stops[0], id: `s${i}` })) };
    expect(() => parsePlan(many)).toThrowError(/at most 8/);
  });

  it("refuses a stop that reuses the depot's id", () => {
    expect(() => parsePlan({ ...raw, stops: [{ ...raw.stops[0], id: "depot" }] })).toThrowError(/used twice/);
  });
});

describe("editing the stop list", () => {
  const a = stop("a"), b = stop("bb"), c = stop("ccc");

  it("moves a stop one place either way and leaves the ends alone", () => {
    expect(moveStop([a, b, c], 1, -1).map((s) => s.id)).toEqual(["bb", "a", "ccc"]);
    expect(moveStop([a, b, c], 1, 1).map((s) => s.id)).toEqual(["a", "ccc", "bb"]);
    expect(moveStop([a, b, c], 0, -1).map((s) => s.id)).toEqual(["a", "bb", "ccc"]);
    expect(moveStop([a, b, c], 2, 1).map((s) => s.id)).toEqual(["a", "bb", "ccc"]);
  });

  it("removes by id", () => {
    expect(removeStop([a, b, c], "bb").map((s) => s.id)).toEqual(["a", "ccc"]);
  });

  it("adds before the return, and refuses a full plan or a point already in it", () => {
    const depot = SAMPLE_PLAN.depot;
    expect(addStop([a], b, depot)).toEqual({ ok: true, stops: [a, b] });
    expect(addStop([a], { ...b, coordinates: a.coordinates }, depot)).toEqual({ ok: false, reason: "duplicate" });
    expect(addStop([a], { ...b, coordinates: depot.coordinates }, depot)).toEqual({ ok: false, reason: "duplicate" });
    const full = Array.from({ length: MAX_STOPS }, (_, i) => stop(`s${i}`, -114 + i / 100));
    expect(addStop(full, b, depot)).toEqual({ ok: false, reason: "full" });
  });

  it("keys a sequence by its order", () => {
    const depot = SAMPLE_PLAN.depot;
    expect(sequenceKey(depot, [a, b])).not.toBe(sequenceKey(depot, [b, a]));
    expect(sameSequence([a, b], [a, b])).toBe(true);
    expect(sameSequence([a, b], [b, a])).toBe(false);
  });
});

describe("applyOrder (an /optimized-route answer)", () => {
  const stops = [stop("a"), stop("bb"), stop("ccc")];

  it("reorders the stops between the fixed depot ends", () => {
    expect(applyOrder(stops, [0, 3, 1, 2, 4])?.map((s) => s.id)).toEqual(["ccc", "a", "bb"]);
  });

  it("refuses anything that is not a permutation with both ends fixed", () => {
    expect(applyOrder(stops, [1, 0, 2, 3, 4])).toBeNull(); // start moved
    expect(applyOrder(stops, [0, 1, 2, 4, 3])).toBeNull(); // end moved
    expect(applyOrder(stops, [0, 1, 1, 2, 4])).toBeNull(); // duplicate
    expect(applyOrder(stops, [0, 1, 2, 4])).toBeNull(); // missing one
    expect(applyOrder(stops, [0, 1, 2, 3, 4, 5])).toBeNull(); // extra
  });
});
