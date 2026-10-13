"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { nextArrival, steppedTime, type Timeline } from "@/lib/simulation";

/** Playback speeds offered: simulated seconds per real second. */
export const SPEEDS = [60, 120, 300] as const;
export type Speed = (typeof SPEEDS)[number];

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeMotion(onChange: () => void) {
  const query = window.matchMedia(MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** The reader's reduced-motion preference, followed live. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeMotion, () => window.matchMedia(MOTION_QUERY).matches, () => false);
}

/**
 * The simulated clock the courier is played back on: play, pause, reset, jump to the next
 * arrival, and a speed. Purely local; it calls nothing. Under reduced motion the clock still runs
 * but while it plays the time shown moves in whole simulated minutes, so the courier steps
 * instead of gliding.
 * A new timeline (a new order, a new stop) starts the day over.
 */
export function useSimulation(timeline: Timeline | null, timelineKey: string) {
  const [time, setTimeState] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(120);
  const reduced = useReducedMotion();
  const total = timeline?.total ?? 0;
  const [prevKey, setPrevKey] = useState(timelineKey);
  // The clock the animation loop advances; `time` is its rendered copy.
  const clock = useRef(0);
  const frame = useRef<number | null>(null);

  const setTime = useCallback((t: number) => {
    clock.current = t;
    setTimeState(t);
  }, []);

  // A different day starts from the depot again (adjusting state while rendering, not in an effect).
  if (prevKey !== timelineKey) {
    setPrevKey(timelineKey);
    setTimeState(0);
    setPlaying(false);
  }
  useEffect(() => {
    clock.current = 0;
  }, [timelineKey]);

  useEffect(() => {
    if (!playing || !timeline) return;
    let last: number | null = null;
    const tick = (now: number) => {
      const elapsed = last === null ? 0 : (now - last) / 1000;
      last = now;
      const next = Math.min(total, clock.current + elapsed * speed);
      setTime(next);
      if (next >= total) {
        setPlaying(false);
        return;
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [playing, timeline, total, speed, setTime]);

  const play = useCallback(() => {
    if (!timeline) return;
    if (clock.current >= total) setTime(0);
    setPlaying(true);
  }, [timeline, total, setTime]);
  const pause = useCallback(() => setPlaying(false), []);
  const reset = useCallback(() => {
    setPlaying(false);
    setTime(0);
  }, [setTime]);
  const next = useCallback(() => {
    if (!timeline) return;
    setTime(nextArrival(timeline, clock.current));
  }, [timeline, setTime]);

  // Stepped only while playing: a jump to the next stop lands exactly on the arrival.
  const shown = reduced && playing ? steppedTime(time, total) : time;
  return { time: shown, playing: playing && time < total, speed, setSpeed, play, pause, reset, next, reduced, finished: total > 0 && time >= total };
}
