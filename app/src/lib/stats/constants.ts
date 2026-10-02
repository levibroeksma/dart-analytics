/** The minimum attempt count before a target's accuracy rate is shown, rather than "not enough darts yet". */
export const MIN_TARGET_SAMPLE = 30;

/** Ruleset versions whose `/statistics` view is a dedicated layout of self-fetching sections, not the `gameStats` store's generic cards. */
export const DEDICATED_STATS_LAYOUTS: ReadonlySet<string> = new Set([
  "SCORE_TRAINING_V1",
]);
