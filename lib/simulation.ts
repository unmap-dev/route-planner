import type { LngLat } from "@/lib/plan";

/**
 * The simulated courier. Nothing here is GPS or telemetry: a courier is played back along the
 * route's own geometry, each leg taking the drive time Unmap gave it and each stop its sample
 * service time. Plain functions of a simulated clock, so they are tested without a browser.
 */

const EARTH_RADIUS_M = 6_371_008.8;

function haversine(a: LngLat, b: LngLat): number {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLng = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A line with its cumulative length at each point, measured once. */
export interface Track {
  coordinates: LngLat[];
  /** Metres from the start to each point; the first is 0. */
  cumulative: number[];
  length: number;
}

export function measure(coordinates: readonly LngLat[]): Track {
  const cumulative: number[] = [];
  let total = 0;
  coordinates.forEach((point, i) => {
    if (i > 0) total += haversine(coordinates[i - 1]!, point);
    cumulative.push(total);
  });
  return { coordinates: [...coordinates], cumulative, length: total };
}

/** The point `fraction` (0 to 1) of the way along a track, by distance. */
export function pointAlong(track: Track, fraction: number): LngLat {
  const { coordinates, cumulative, length } = track;
  if (coordinates.length === 0) return [0, 0];
  if (coordinates.length === 1 || fraction <= 0 || length === 0) return coordinates[0]!;
  if (fraction >= 1) return coordinates[coordinates.length - 1]!;
  const target = length * fraction;
  // The first point at or past the target, by binary search: a city leg has hundreds of points
  // and this runs on every animation frame.
  let lo = 1, hi = coordinates.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid]! < target) lo = mid + 1;
    else hi = mid;
  }
  const a = coordinates[lo - 1]!, b = coordinates[lo]!;
  const span = cumulative[lo]! - cumulative[lo - 1]!;
  const t = span === 0 ? 0 : (target - cumulative[lo - 1]!) / span;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export type Segment =
  | { kind: "drive"; leg: number; start: number; end: number }
  | { kind: "service"; stop: number; start: number; end: number };

export interface Timeline {
  segments: Segment[];
  /** Simulated seconds from leaving the depot to returning. */
  total: number;
  legs: Track[];
  /** Length of all legs together, as the route line measures it. */
  length: number;
  stops: number;
}

/**
 * The day as a sequence: drive leg 0, serve stop 1, drive leg 1, … , drive the last leg home.
 * @param legs each leg's geometry and drive time (`service.length + 1` of them)
 * @param service each stop's service time in seconds
 */
export function buildTimeline(legs: readonly { coordinates: readonly LngLat[]; durationSeconds: number }[], service: readonly number[]): Timeline {
  if (legs.length !== service.length + 1) throw new Error("buildTimeline: one more leg than stops is required");
  const segments: Segment[] = [];
  let clock = 0;
  legs.forEach((leg, i) => {
    const drive = Math.max(0, leg.durationSeconds);
    segments.push({ kind: "drive", leg: i, start: clock, end: clock + drive });
    clock += drive;
    if (i < service.length) {
      const serve = Math.max(0, service[i]!);
      segments.push({ kind: "service", stop: i, start: clock, end: clock + serve });
      clock += serve;
    }
  });
  const tracks = legs.map((leg) => measure(leg.coordinates));
  return { segments, total: clock, legs: tracks, length: tracks.reduce((a, t) => a + t.length, 0), stops: service.length };
}

export type JobState = "pending" | "in_progress" | "completed";

export type Phase =
  | { kind: "ready" }
  | { kind: "driving"; leg: number }
  | { kind: "serving"; stop: number }
  | { kind: "done" };

export interface Courier {
  position: LngLat;
  phase: Phase;
  /** Per stop, in plan order. */
  jobs: JobState[];
  /** Fraction of the whole route line travelled, 0 to 1, for the line's progress. */
  travelled: number;
}

/**
 * Where the courier is at simulated time `t` and what each job's state is. A stop is in progress
 * from the moment the courier leaves for it until its service time is over, then completed.
 */
export function courierAt(timeline: Timeline, t: number): Courier {
  const time = Math.min(Math.max(t, 0), timeline.total);
  const jobs: JobState[] = Array.from({ length: timeline.stops }, () => "pending");
  let position: LngLat = timeline.legs[0]?.coordinates[0] ?? [0, 0];
  let phase: Phase = { kind: "ready" };
  let before = 0; // metres of route line behind the current leg
  let travelled = 0;

  if (time > 0) {
    phase = { kind: "done" };
    for (const seg of timeline.segments) {
      if (seg.kind === "drive") {
        const track = timeline.legs[seg.leg]!;
        const toStop = seg.leg < timeline.stops ? seg.leg : null;
        if (time <= seg.start) {
          // Standing at the last stop, about to leave for the next one.
          phase = { kind: "driving", leg: seg.leg };
          break;
        }
        if (toStop !== null) jobs[toStop] = "in_progress";
        if (time < seg.end) {
          const f = (time - seg.start) / (seg.end - seg.start);
          position = pointAlong(track, f);
          travelled = before + track.length * f;
          phase = { kind: "driving", leg: seg.leg };
          break;
        }
        position = track.coordinates[track.coordinates.length - 1] ?? position;
        before += track.length;
        travelled = before;
      } else {
        if (time < seg.end) {
          jobs[seg.stop] = "in_progress";
          phase = { kind: "serving", stop: seg.stop };
          break;
        }
        jobs[seg.stop] = "completed";
      }
    }
  }
  return { position, phase, jobs, travelled: timeline.length > 0 ? Math.min(1, travelled / timeline.length) : time > 0 ? 1 : 0 };
}

/**
 * The time to show under reduced motion: whole simulated minutes, so the courier steps from
 * place to place instead of gliding. The end of the day is never rounded away.
 */
export function steppedTime(t: number, total: number, stepSeconds = 60): number {
  if (t >= total) return total;
  return Math.floor(t / stepSeconds) * stepSeconds;
}

/** The next moment worth jumping to: the next arrival at a stop or at the depot, else the end. */
export function nextArrival(timeline: Timeline, t: number): number {
  for (const seg of timeline.segments) {
    if (seg.kind === "drive" && seg.end > t + 0.5) return seg.end;
  }
  return timeline.total;
}
