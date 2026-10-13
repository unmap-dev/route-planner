import { describe, expect, it } from "vitest";
import type { LngLat } from "../lib/plan";
import { buildTimeline, courierAt, measure, nextArrival, pointAlong, steppedTime } from "../lib/simulation";

// Three legs along a meridian: depot (0) → stop A (0.01) → stop B (0.03) → depot (0).
const legs: { coordinates: LngLat[]; durationSeconds: number }[] = [
  { coordinates: [[0, 0], [0, 0.005], [0, 0.01]], durationSeconds: 100 },
  { coordinates: [[0, 0.01], [0, 0.03]], durationSeconds: 200 },
  { coordinates: [[0, 0.03], [0, 0]], durationSeconds: 300 },
];
const timeline = buildTimeline(legs, [50, 20]);

describe("pointAlong", () => {
  const track = measure([[0, 0], [0, 0.01], [0, 0.03]]);

  it("interpolates by distance, not by vertex count", () => {
    const [lng, lat] = pointAlong(track, 0.5);
    expect(lng).toBe(0);
    expect(lat).toBeCloseTo(0.015, 6);
    expect(pointAlong(track, 0.25)[1]).toBeCloseTo(0.0075, 6);
  });

  it("clamps at both ends and copes with a degenerate line", () => {
    expect(pointAlong(track, -1)).toEqual([0, 0]);
    expect(pointAlong(track, 2)).toEqual([0, 0.03]);
    expect(pointAlong(measure([[1, 1]]), 0.5)).toEqual([1, 1]);
    expect(pointAlong(measure([[1, 1], [1, 1]]), 0.5)).toEqual([1, 1]);
  });
});

describe("the simulated day", () => {
  it("lays out drive, service, drive, service, drive", () => {
    expect(timeline.segments.map((s) => [s.kind, s.start, s.end])).toEqual([
      ["drive", 0, 100],
      ["service", 100, 150],
      ["drive", 150, 350],
      ["service", 350, 370],
      ["drive", 370, 670],
    ]);
    expect(timeline.total).toBe(670);
  });

  it("refuses legs that do not match the stops", () => {
    expect(() => buildTimeline(legs, [50])).toThrow();
  });

  it("starts with every job pending", () => {
    const c = courierAt(timeline, 0);
    expect(c.jobs).toEqual(["pending", "pending"]);
    expect(c.phase).toEqual({ kind: "ready" });
    expect(c.position).toEqual([0, 0]);
    expect(c.travelled).toBe(0);
  });

  it("puts the first job in progress once the courier leaves for it", () => {
    const c = courierAt(timeline, 50);
    expect(c.jobs).toEqual(["in_progress", "pending"]);
    expect(c.phase).toEqual({ kind: "driving", leg: 0 });
    expect(c.position[1]).toBeCloseTo(0.005, 6);
  });

  it("keeps a job in progress while the courier is on site, then completes it", () => {
    expect(courierAt(timeline, 120)).toMatchObject({ jobs: ["in_progress", "pending"], phase: { kind: "serving", stop: 0 } });
    expect(courierAt(timeline, 120).position).toEqual([0, 0.01]);
    expect(courierAt(timeline, 200).jobs).toEqual(["completed", "in_progress"]);
  });

  it("finishes with every job completed, back at the depot, the whole line travelled", () => {
    const c = courierAt(timeline, 10_000);
    expect(c.jobs).toEqual(["completed", "completed"]);
    expect(c.phase).toEqual({ kind: "done" });
    expect(c.position).toEqual([0, 0]);
    expect(c.travelled).toBe(1);
  });

  it("measures progress along the joined line by distance", () => {
    // Halfway through leg 1 (0.01 → 0.03): 0.02 of 0.06 degrees of line behind the courier.
    expect(courierAt(timeline, 250).travelled).toBeCloseTo(2 / 6, 3);
  });

  it("steps whole minutes under reduced motion, and never rounds the end away", () => {
    expect(steppedTime(119, 670)).toBe(60);
    expect(steppedTime(670, 670)).toBe(670);
    expect(steppedTime(700, 670)).toBe(670);
  });

  it("jumps to the next arrival", () => {
    expect(nextArrival(timeline, 0)).toBe(100);
    expect(nextArrival(timeline, 100)).toBe(350);
    expect(nextArrival(timeline, 360)).toBe(670);
    expect(nextArrival(timeline, 670)).toBe(670);
  });
});
