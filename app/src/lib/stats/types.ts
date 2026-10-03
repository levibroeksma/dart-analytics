import type {
  AtcDartsPerTargetMetrics,
  Bobs27SurvivalMetrics,
  BustRateMetrics,
  CheckoutPathMetrics,
  CheckoutRateMetrics,
  ConfusionMetrics,
  DoublePerformanceMetrics,
  LadderProgressMetrics,
  LegStatsMetrics,
  LooseDartsMetrics,
  MissDirectionMetrics,
  ScoringTrendMetrics,
  ShanghaiCountMetrics,
  TrainingResultMetrics,
  TargetAccuracyMetrics,
  TurnFact,
} from "@modules/types";
import type { GameTypeKey, SeatFact, StatsTag } from "@lib/types";

/** Phase-1 through phase-4 insight sections (`10-Statistics/01-Section-Catalog.md` §1). */
export type SectionId =
  | "completion"
  | "volume"
  | "session-result"
  | "heatmap"
  | "target-accuracy"
  | "confusion"
  | "grouping"
  | "miss-direction"
  | "loose-darts"
  | "scoring-trend"
  | "ladder-progress"
  | "checkout-rate"
  | "double-performance"
  | "checkout-path"
  | "bust-rate"
  | "leg-stats"
  | "treble-rate"
  | "atc-darts-per-target"
  | "bobs27-survival"
  | "shanghai-count"
  | "training-result";

/**
 * The declared-intent zones a target key can name (`01-Section-Catalog.md`
 * §1.1). `NUMBER` and `BULL` are the two derived aim zones (phase-4 decision
 * 2): a whole-number or bull aim recovered from an engine's own reducer,
 * never written back as stored intent.
 */
export type IntentZoneKey =
  | "DOUBLE"
  | "TREBLE"
  | "INNER_SINGLE"
  | "OUTER_SINGLE"
  | "INNER_BULL"
  | "OUTER_BULL"
  | "NUMBER"
  | "BULL";

/** `<ZONE_KEY>:<number>` — the record key for every intent-cell metric (00-Overview.md §5, phase-2 decision 5). */
export type TargetKey = `${IntentZoneKey}:${number}`;

/** Where a section's numbers are computed (`00-Overview.md` §4). */
export type ComputeSite = "sql" | "server" | "client";

/** One `requires` entry: a tag every game must carry, or a tag any one of which suffices (`00-Overview.md` §2, phase-4 decision 5). */
export type Requirement = StatsTag | { anyOf: readonly StatsTag[] };

/** Bucket granularity for a time-series request (`00-Overview.md` §5). */
export type Bucket = "none" | "day" | "week" | "month" | "year";

/** `status` query value (`00-Overview.md` §5). */
export type StatusFilter = "completed" | "abandoned" | "all";

/** `context` query value (`00-Overview.md` §8). */
export type ContextFilter = "all" | "standalone" | "routine";

/** Whether a higher or lower `counted_score` is the better session result; `null` when the headline is not a pure function of the rule-free components (D367). */
export type ResultDirection = "higher" | "lower" | null;

/** One insight section's registry entry (`00-Overview.md` §2). */
export interface SectionMeta {
  id: SectionId;
  version: number;
  requires: readonly Requirement[];
  computeSite: ComputeSite;
  bucketable: boolean;
  includesAbandoned: boolean;
  configSensitive: readonly string[];
  /** Optional query parameters this section accepts beyond the shared ones (phase-2 decision 5); `[]` for every section that accepts none. */
  params: readonly "target"[];
  /** Overrides `computeSite` with the first entry whose tag the game carries (`sectionSite`, phase-4 decision 5); absent tags fall through to `computeSite`. */
  siteByTag?: Partial<Record<StatsTag, ComputeSite>>;
  /** Narrows this section to named games on top of `requires` (phase-4 decision 10); absent means every game whose tags satisfy `requires`. */
  games?: readonly GameTypeKey[];
}

/**
 * Run- or step-surface routine section ids (D372 decision 6) — disjoint
 * from `SectionId`, which stays game-only so no game page can list one.
 */
export type RoutineSectionId =
  "routine-volume" | "routine-completion" | "step-volume" | "step-result";

/**
 * One routine-tab section's registry entry: `SectionMeta`'s fields with
 * `id` narrowed to `RoutineSectionId`, `requires` fixed to `[]` (no game
 * ever gates a routine section), plus `surface`, which page the section
 * appears on (D372 decision 6).
 */
export type RoutineSectionMeta = Omit<SectionMeta, "id" | "requires"> & {
  id: RoutineSectionId;
  requires: readonly [];
  surface: "routine" | "step";
};

/** One bucket of a `Series<M>` result (`00-Overview.md` §5.2). */
export interface SeriesBucket<M> {
  start: string;
  end: string;
  closed: boolean;
  sampleSize: number;
  metrics: M;
}

/** A bucketed section result (`00-Overview.md` §5.2, `range` per D367 decision 2). */
export interface Series<M> {
  sectionId: SectionId;
  sectionVersion: number;
  dataVersion: string;
  bucket: Bucket;
  tz: string | null;
  range: { from: string; to: string };
  buckets: SeriesBucket<M>[];
}

/**
 * `Series<M>`'s shape for the Routines tab: everything is identical except
 * `sectionId`, which names one of the routine's own sections rather than a
 * game's. Kept as its own type instead of widening `Series.sectionId`'s
 * union, so a game route can never be handed a routine section id by
 * mistake and vice versa.
 */
export type RoutineSeries<M> = Omit<Series<M>, "sectionId"> & {
  sectionId: RoutineSectionId;
};

/**
 * The section ids whose metrics can fold server-side (`00-Overview.md` §4,
 * phase-3 decision 1): phase 3's checkout family, always server, plus the
 * four phase-4 derived-intent sections (server only on a game whose
 * `siteByTag` resolves them there, `sectionSite`) and the three phase-4
 * game-specific sections (always server). Exhaustive over every id
 * `mergeMetrics` must handle — a section added here with no `MERGERS` entry
 * is a type error, not a silent gap.
 */
export type ServerSectionId =
  | "ladder-progress"
  | "checkout-rate"
  | "double-performance"
  | "checkout-path"
  | "bust-rate"
  | "leg-stats"
  | "target-accuracy"
  | "confusion"
  | "miss-direction"
  | "loose-darts"
  | "atc-darts-per-target"
  | "bobs27-survival"
  | "shanghai-count"
  | "training-result";

/** Each server section's own metrics shape, keyed by its id — what `mergeMetrics` (`lib/stats/merge-metrics.ts`) folds over. */
export type ServerSectionMetrics = {
  "ladder-progress": LadderProgressMetrics;
  "checkout-rate": CheckoutRateMetrics;
  "double-performance": DoublePerformanceMetrics;
  "checkout-path": CheckoutPathMetrics;
  "bust-rate": BustRateMetrics;
  "leg-stats": LegStatsMetrics;
  "target-accuracy": TargetAccuracyMetrics;
  confusion: ConfusionMetrics;
  "miss-direction": MissDirectionMetrics;
  "loose-darts": LooseDartsMetrics;
  "atc-darts-per-target": AtcDartsPerTargetMetrics;
  "bobs27-survival": Bobs27SurvivalMetrics;
  "shanghai-count": ShanghaiCountMetrics;
  "training-result": TrainingResultMetrics;
};

/** One chunked request's span (`00-Overview.md` §4, phase-3 decision 2). */
export type ChunkWindow = { from: string; to: string };

export interface FormattedStatisticsOverview {
  totalGamesPlayed: string;
  totalPlayTimeSeconds: string;
  favoriteGameTypeKey: string;
  currentPlayStreakDays: string;
  longestStreakHint: string;
  totalDartsThrown: string;
  hundredPlusCount: string;
  oneTwentyPlusCount: string;
  oneFortyPlusCount: string;
  oneEightiesCount: string;
  medianVisitScore: string;
  highestGameAverage: string;
  firstNineCareerAverage: string;
  scoringAverageExcludingDoubles: string;
  bestLegDarts: string;
  averageDartsPerLeg: string;
  checkoutPercentage: string;
  highestCheckoutValue: string;
  highestCheckoutHint: string;
}

/**
 * A replay's decoded snapshot (`snapshotOf`), seated: a seatless snapshot of
 * a one-participant session carries the one seat `foldReplay` synthesized
 * for it (D371 decision 8).
 */
export type ReplaySnapshot = Record<string, unknown> & {
  seats: readonly SeatFact[];
};

/**
 * Why a replay shows its stored facts only (D371 decision 8, D372 decision
 * 11). `NO_EXERCISE_ENGINE` is a non-game step whose
 * `exerciseRulesetVersionKey` names no registered dart exercise engine.
 */
export type ReplaySkipReason =
  | "NO_SNAPSHOT"
  | "NO_ENGINE"
  | "SEATLESS_MULTI"
  | "ENGINE_THREW"
  | "NO_EXERCISE_ENGINE";

/**
 * One loaded turn as a presenter reads it: the turn as its engine folded
 * it, the session state after the turn before it (`before`, the state
 * before any turn for the first), and the state after it (`after`).
 */
export type ReplayStep = {
  turn: TurnFact;
  before: unknown;
  after: unknown;
};

/**
 * A session's replayed states (`foldReplay`). `stateAfter(k)` is the state
 * after turn `k`, `-1` the state before any turn; `steps[k]` pairs turn `k`
 * with the states either side of it. A skipped fold says why instead.
 */
export type ReplayFold =
  | {
      ok: true;
      snapshot: ReplaySnapshot;
      steps: readonly ReplayStep[];
      stateAfter: (turnIndex: number) => unknown;
    }
  | { ok: false; reason: ReplaySkipReason };

/** Whether one dart of a turn hit the target it was thrown at. */
export type ReplayMark = "hit" | "miss";

/** One derived value a replay turn row shows beside its stored darts. */
export type ReplayCell =
  | { kind: "value"; label: string; value: string }
  | { kind: "flag"; label: string }
  | { kind: "marks"; label: string; marks: readonly ReplayMark[] };

/** One seat's value in a replay's session line. */
export type ReplaySessionEntry = {
  participantId: string;
  label: string;
  value: string;
};

/** One seat's score after each visit it threw, in play order. */
export type ReplayCurve = {
  participantId: string;
  points: readonly number[];
};

/** What a replay shows for the whole session (D371 decision 8's table). */
export type ReplaySessionLine = {
  entries: readonly ReplaySessionEntry[];
  curves: readonly ReplayCurve[];
};

/**
 * One game's view of its replayed states, reading each state the way that
 * game's play page does (D371 decision 8).
 */
export type ReplayPresenter = {
  turn(step: ReplayStep, snapshot: ReplaySnapshot): ReplayCell[];
  session(
    steps: readonly ReplayStep[],
    snapshot: ReplaySnapshot,
  ): ReplaySessionLine;
};

/** Why the replay page shows no session: the route's `NOT_FOUND` gate (a missing id included), or any other failure. */
export type ReplayLoadError = "NOT_FOUND" | "FAILED";

/** One stored dart as a replay row labels it (`T20`, `25`, `MISS`). */
export type ReplayDartView = { dartNumber: number; label: string };

/**
 * One loaded turn as the replay page shows it: its seat, its stored darts
 * and visit total, and the presenter's cells -- none when the fold was
 * skipped or the game has no presenter.
 */
export type ReplayTurnView = {
  index: number;
  seat: string;
  darts: readonly ReplayDartView[];
  total: number;
  cells: readonly ReplayCell[];
};

/** The loaded turns of one stage, under its heading (`Leg 2`, `Set 1 · Leg 3`); `null` hides it (a session's lone `EXERCISE_BLOCK`). */
export type ReplayStageGroup = {
  stageId: string;
  heading: string | null;
  rows: readonly ReplayTurnView[];
};

/** One point of a replay score curve, its bar width a percent of the highest score drawn. */
export type ReplayCurvePoint = {
  visit: number;
  score: number;
  widthPercent: number;
};

/** One seat's replay score curve, as the replay page draws it. */
export type ReplayCurveRow = {
  participantId: string;
  seat: string;
  points: readonly ReplayCurvePoint[];
};

/** The range part of a game section request; `target` only for `heatmap`. */
export type GameSectionRange = {
  from: string;
  to: string;
  bucket: Bucket;
  tz?: string;
  target?: string;
};

export type TrendRangeKey = "30d" | "90d" | "1y" | "all";
export type TrendBucket = Exclude<Bucket, "none">;

/** A score-trend request; `boundary` starts the current period, `null` when there is no previous period. */
export type TrendWindow = {
  from: string;
  to: string;
  bucket: TrendBucket;
  tz: string;
  boundary: string | null;
};

export type TrendAverages = {
  threeDart: number | null;
  firstNine: number | null;
};

/** The Score Training personal best: the highest single-session 3-dart average and when it was set. */
export type TrendPersonalBest = {
  average: number;
  completedAt: string;
};

export type TrendPeriods = {
  previous: SeriesBucket<ScoringTrendMetrics>[];
  current: SeriesBucket<ScoringTrendMetrics>[];
};
