/** The minimum attempt count before a target's accuracy rate is shown, rather than "not enough darts yet". */
export const MIN_TARGET_SAMPLE = 30;

/** The minimum attempt count before one row of a card's breakdown shows a rate; smaller rows show their count only. */
export const MIN_ROW_SAMPLE = 10;

/** The distance in millimetres from the aimed bed within which a missed dart is a near miss; exactly this far still counts. */
export const NEAR_MISS_MM = 20;

/** The most darts a per-dart landing read serves before the request is refused as too wide. */
export const MAX_LANDING_DARTS = 50_000;

/** Ruleset versions whose `/statistics` view is the 501 layout (`X01StatsOverview.astro`): averages, tiles, aim cards, heatmap and session list. */
export const X01_LAYOUTS: ReadonlySet<string> = new Set(["501_V1", "501_V2"]);

/** Ruleset versions whose `/statistics` view is the Doubles Training layout (`DoublesTrainingStatsOverview.astro`): the doubles card, then the heatmap and session list. */
export const DOUBLES_TRAINING_LAYOUTS: ReadonlySet<string> = new Set([
  "DOUBLES_TRAINING_V1",
]);

/** Ruleset versions whose `/statistics` view is the Track games layout (`TrackGamesStatsOverview.astro`): tiles and a sortable per-target table, then the heatmap and session list. */
export const TRACK_LAYOUTS: ReadonlySet<string> = new Set([
  "SINGLES_V1",
  "SHANGHAI_V1",
  "AROUND_THE_CLOCK_V1",
  "BOBS27_V1",
]);

/** Ruleset versions whose `/statistics` view is the Ace layout (`AceStatsOverview.astro`): period comparison tiles, the Track targets card, then the heatmap and session list (D563). */
export const ACE_LAYOUTS: ReadonlySet<string> = new Set(["ACE_V1"]);

/** Ruleset versions whose `/statistics` view is the Checkout layout (`CheckoutStatsOverview.astro`): period comparison tiles, the target range, double and route cards, then the heatmap and session list. */
export const CHECKOUT_LAYOUTS: ReadonlySet<string> = new Set([
  "121_V1",
  "121_V2",
  "TUOD_V1",
]);

/** Ruleset versions whose `/statistics` view is the Marks layout (`MarksStatsOverview.astro`): Cricket, Tactics and Mickey Mouse. */
export const MARKS_LAYOUTS: ReadonlySet<string> = new Set([
  "CRICKET_V1",
  "CRICKET_V2",
  "TACTICS_V1",
  "TACTICS_V2",
  "MICKEY_MOUSE_V1",
]);

/** Ruleset versions whose `/statistics` view is the plain heatmap alone (`HeatmapStatsOverview.astro`): board games, with a target picker where the heatmap takes a `target` (`heatmap-targets.ts`). */
export const HEATMAP_ONLY_LAYOUTS: ReadonlySet<string> = new Set([
  "BASEBALL_V1",
  "KILLER_V1",
  "FIVES_V1",
  "BULL_500_V1",
  "FOLLOW_THE_LEADER_V1",
  "PRISONER_V1",
]);
