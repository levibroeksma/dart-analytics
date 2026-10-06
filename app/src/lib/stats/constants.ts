/** The minimum attempt count before a target's accuracy rate is shown, rather than "not enough darts yet". */
export const MIN_TARGET_SAMPLE = 30;

/** Ruleset versions whose `/statistics` view is a dedicated layout of self-fetching sections, not the `gameStats` store's generic cards. */
export const DEDICATED_STATS_LAYOUTS: ReadonlySet<string> = new Set([
  "SCORE_TRAINING_V1",
]);

/** Ruleset versions whose `/statistics` view is the plain heatmap alone (`HeatmapStatsOverview.astro`): board games, with a target picker where the heatmap takes a `target` (`heatmap-targets.ts`). */
export const HEATMAP_ONLY_LAYOUTS: ReadonlySet<string> = new Set([
  "501_V1",
  "121_V1",
  "TUOD_V1",
  "SINGLES_V1",
  "SHANGHAI_V1",
  "AROUND_THE_CLOCK_V1",
  "CRICKET_V1",
  "TACTICS_V1",
  "DOUBLES_TRAINING_V1",
  "BOBS27_V1",
]);
