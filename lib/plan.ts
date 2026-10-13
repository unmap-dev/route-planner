import type { Text } from "@/lib/kit/i18n";

/**
 * The delivery plan: one vehicle leaves a depot, visits up to eight customer stops and returns
 * to the depot. Plain TypeScript, no React and no fetch, so it is unit-tested on its own.
 */

/** [longitude, latitude], WGS84. */
export type LngLat = [number, number];

export interface Depot {
  id: string;
  name: string;
  address: string;
  coordinates: LngLat;
}

export interface Stop {
  id: string;
  /** The customer, e.g. "Inglewood Pantry". */
  name: string;
  address: string;
  coordinates: LngLat;
  /** Time spent at the stop (unloading, signature), in seconds. Sample data, never from Unmap. */
  serviceSeconds: number;
  note?: Text;
  /** Added by the dispatcher through search rather than loaded from the sample file. */
  added?: boolean;
}

export interface Plan {
  company: string;
  vehicle: Text;
  /** Departure from the depot, local time, `HH:MM`. */
  departAt: string;
  depot: Depot;
  stops: Stop[];
}

/**
 * At most eight stops between the depot and the return to it. `/optimized-route` takes at most
 * ten stops including both fixed ends (the depot twice), so eight is what fits.
 */
export const MAX_STOPS = 8;

/** Service time given to a stop added through search, in seconds. Shown as a sample value. */
export const DEFAULT_SERVICE_SECONDS = 5 * 60;

function isLngLat(value: unknown): value is LngLat {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n)) &&
    Math.abs(value[0] as number) <= 180 &&
    Math.abs(value[1] as number) <= 90
  );
}

function isText(value: unknown): value is Text {
  return !!value && typeof value === "object" && typeof (value as Text).en === "string" && typeof (value as Text).fr === "string";
}

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Read and validate a plan file (data/route.sample.json, or your own in the same shape). Throws
 * one error listing every problem found, so a broken file is fixed in one pass.
 */
export function parsePlan(raw: unknown): Plan {
  const problems: string[] = [];
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (typeof r.company !== "string" || !r.company) problems.push("company: a name is required");
  if (!isText(r.vehicle)) problems.push("vehicle: { en, fr } is required");
  if (typeof r.departAt !== "string" || !CLOCK.test(r.departAt)) problems.push("departAt: HH:MM (24-hour) is required");

  const d = (r.depot && typeof r.depot === "object" ? r.depot : {}) as Record<string, unknown>;
  if (typeof d.id !== "string" || !d.id) problems.push("depot.id is required");
  if (typeof d.name !== "string" || !d.name) problems.push("depot.name is required");
  if (typeof d.address !== "string") problems.push("depot.address is required");
  if (!isLngLat(d.coordinates)) problems.push("depot.coordinates must be [longitude, latitude]");

  const rawStops = Array.isArray(r.stops) ? r.stops : null;
  if (!rawStops) problems.push("stops must be an array");
  if (rawStops && rawStops.length > MAX_STOPS) problems.push(`stops: at most ${MAX_STOPS} (the route optimizer takes ten points including the depot twice)`);

  const ids = new Set<string>([typeof d.id === "string" ? d.id : ""]);
  const stops: Stop[] = [];
  (rawStops ?? []).forEach((value, i) => {
    const s = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
    const at = `stops[${i}]`;
    if (typeof s.id !== "string" || !s.id) problems.push(`${at}.id is required`);
    else if (ids.has(s.id)) problems.push(`${at}.id "${s.id}" is used twice`);
    else ids.add(s.id);
    if (typeof s.name !== "string" || !s.name) problems.push(`${at}.name is required`);
    if (typeof s.address !== "string") problems.push(`${at}.address is required`);
    if (!isLngLat(s.coordinates)) problems.push(`${at}.coordinates must be [longitude, latitude]`);
    const minutes = s.serviceMinutes;
    if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes < 0 || minutes > 240) {
      problems.push(`${at}.serviceMinutes must be a number from 0 to 240`);
    }
    if (s.note !== undefined && !isText(s.note)) problems.push(`${at}.note must be { en, fr }`);
    stops.push({
      id: String(s.id),
      name: String(s.name),
      address: String(s.address ?? ""),
      coordinates: s.coordinates as LngLat,
      serviceSeconds: Math.round(Number(minutes) * 60),
      ...(isText(s.note) ? { note: s.note } : {}),
    });
  });

  if (problems.length) throw new Error(`Invalid plan:\n- ${problems.join("\n- ")}`);
  return {
    company: r.company as string,
    vehicle: r.vehicle as Text,
    departAt: r.departAt as string,
    depot: { id: d.id as string, name: d.name as string, address: d.address as string, coordinates: d.coordinates as LngLat },
    stops,
  };
}

/** Every point the vehicle visits, in order: the depot, each stop, the depot again. */
export function waypoints(depot: Depot, stops: readonly Stop[]): LngLat[] {
  return [depot.coordinates, ...stops.map((s) => s.coordinates), depot.coordinates];
}

/** A stable key for a sequence of stops, so a result computed for one order is never shown for another. */
export function sequenceKey(depot: Depot, stops: readonly Stop[]): string {
  return [depot.id, ...stops.map((s) => s.id), depot.id].join(">");
}

/** The stops with the one at `index` moved by `delta` (−1 earlier, +1 later). Unchanged at an end. */
export function moveStop<T>(stops: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || index >= stops.length || target < 0 || target >= stops.length) return [...stops];
  const next = [...stops];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved!);
  return next;
}

export function removeStop(stops: readonly Stop[], id: string): Stop[] {
  return stops.filter((s) => s.id !== id);
}

export type AddResult = { ok: true; stops: Stop[] } | { ok: false; reason: "full" | "duplicate" };

/**
 * Add a stop before the return to the depot. Refused when the plan is full or when the same
 * point (within about 10 m) is already a stop or the depot.
 */
export function addStop(stops: readonly Stop[], stop: Stop, depot: Depot): AddResult {
  if (stops.length >= MAX_STOPS) return { ok: false, reason: "full" };
  const near = (a: LngLat, b: LngLat) => Math.abs(a[0] - b[0]) < 1e-4 && Math.abs(a[1] - b[1]) < 1e-4;
  if (near(stop.coordinates, depot.coordinates) || stops.some((s) => s.id === stop.id || near(s.coordinates, stop.coordinates))) {
    return { ok: false, reason: "duplicate" };
  }
  return { ok: true, stops: [...stops, stop] };
}

/**
 * The stops in the order `/optimized-route` returned. `order` indexes the waypoints sent: 0 is the
 * depot leaving, `stops.length + 1` the depot returning. Null unless the answer is a permutation
 * with both ends where they were sent: an order the API did not return is never applied.
 */
export function applyOrder(stops: readonly Stop[], order: readonly number[]): Stop[] | null {
  const n = stops.length;
  if (order.length !== n + 2 || order[0] !== 0 || order[n + 1] !== n + 1) return null;
  const middle = order.slice(1, -1);
  const seen = new Set(middle);
  if (seen.size !== n || middle.some((i) => !Number.isInteger(i) || i < 1 || i > n)) return null;
  return middle.map((i) => stops[i - 1]!);
}

/** True when two stop lists visit the same stops in the same order. */
export function sameSequence(a: readonly Stop[], b: readonly Stop[]): boolean {
  return a.length === b.length && a.every((s, i) => s.id === b[i]!.id);
}
