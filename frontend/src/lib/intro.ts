"use client";

/**
 * Tiny intro coordinator so the landing hero's entrance can start the moment
 * the preloader curtain begins to lift (instead of guessing a delay).
 */

const STORAGE_KEY = "resumeai:intro-done";

let finished = false;
const subscribers = new Set<() => void>();

/** Has the intro already played in this browser session? */
export function introPlayed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

/** Mark the intro as played for the rest of the session. */
export function markIntroPlayed() {
  finished = true;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* storage blocked — the in-memory flag still covers this page view */
  }
}

/** Fire the "curtain is lifting" signal — hero timelines start here. */
export function releaseIntro() {
  finished = true;
  subscribers.forEach((cb) => cb());
  subscribers.clear();
}

/** Run `cb` now if the intro is over, otherwise as soon as it ends. */
export function onIntroRelease(cb: () => void): () => void {
  if (finished) {
    cb();
    return () => {};
  }
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

export function introReleased(): boolean {
  return finished;
}
