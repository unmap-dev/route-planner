import type { Lang } from "@/lib/kit/i18n";

/**
 * The estimated arrival schedule: leave the depot at the planned time, drive each leg for the
 * time Unmap's `/route` gave it, spend each stop's sample service time there, and return. No
 * traffic, no breaks, no time windows: an estimate from free-flow drive times, labelled as one.
 */

export interface StopTimes {
  /** Seconds after leaving the depot; null once an earlier leg has no answer. */
  arrive: number | null;
  leave: number | null;
}

export interface Schedule {
  stops: StopTimes[];
  /** Back at the depot, seconds after leaving it; null while a leg has no answer. */
  returnAt: number | null;
  /** Drive time over the legs that answered. */
  driveSeconds: number;
  /** Service time over every stop. */
  serviceSeconds: number;
}

/**
 * @param legs drive time per leg in seconds (`stops.length + 1` of them), null where unknown
 * @param service service time per stop in seconds
 */
export function buildSchedule(legs: readonly (number | null)[], service: readonly number[]): Schedule {
  const stops: StopTimes[] = [];
  let clock: number | null = 0;
  let driveSeconds = 0;
  for (let i = 0; i < service.length; i++) {
    const leg = legs[i] ?? null;
    if (leg !== null) driveSeconds += leg;
    clock = clock === null || leg === null ? null : clock + leg;
    const leave: number | null = clock === null ? null : clock + service[i]!;
    stops.push({ arrive: clock, leave });
    clock = leave;
  }
  const last = legs[service.length] ?? null;
  if (last !== null) driveSeconds += last;
  const returnAt = clock === null || last === null ? null : clock + last;
  return { stops, returnAt, driveSeconds, serviceSeconds: service.reduce((a, b) => a + b, 0) };
}

/** `HH:MM` as seconds after midnight, or null when it is not a 24-hour time. */
export function parseClock(text: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(text);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 : null;
}

/**
 * Seconds after midnight as a wall-clock time, rounded to the minute: `09:05` in English,
 * `9 h 05` in French. Past midnight it wraps and says so (`00:10 (+1)`).
 */
export function formatClock(seconds: number, lang: Lang): string {
  const total = Math.round(seconds / 60);
  const day = Math.floor(total / 1440);
  const minutes = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  const text = lang === "fr" ? `${h} h ${String(m).padStart(2, "0")}` : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return day > 0 ? `${text} (+${day})` : text;
}
