import { z } from "zod";
import { parseTargetKey } from "@lib/stats/target-key";

/** Contract: docs/architecture/06-API/04-Endpoint-Contracts.md §Statistics Overview. */
export const StatisticsOverviewResponse = z.object({
  totalGamesPlayed: z.number().int(),
  totalPlayTimeSeconds: z.number().int(),
  favoriteGameTypeKey: z.string().nullable(),
  longestPlayStreakDays: z.number().int(),
  currentPlayStreakDays: z.number().int(),
  totalDartsThrown: z.number().int(),
  hundredPlusCount: z.number().int(),
  oneTwentyPlusCount: z.number().int(),
  oneFortyPlusCount: z.number().int(),
  oneEightiesCount: z.number().int(),
  medianVisitScore: z.number(),
  highestGameAverage: z.number(),
  firstNineCareerAverage: z.number(),
  scoringAverageExcludingDoubles: z.number(),
  bestLegDarts: z.number().int().nullable(),
  averageDartsPerLeg: z.number().nullable(),
  checkoutPercentage: z.number().min(0).max(1).nullable(),
  highestCheckout: z
    .object({ value: z.number().int(), timesHit: z.number().int() })
    .nullable(),
});

export type StatisticsOverviewResponseData = z.infer<
  typeof StatisticsOverviewResponse
>;

/**
 * Every `bucket ≠ none` request is capped at `MAX_BUCKETS` estimated buckets
 * (`10-Statistics/00-Overview.md` §5, D367). The estimate is span ÷ nominal
 * unit length, rounded up, plus 1 for the widening a bucketed request
 * always takes (decision 2): the lower bound floors to its bucket start, so
 * the widened range can span one more unit than the raw request.
 */
export const MAX_BUCKETS = 120;

const BUCKET_UNIT_SECONDS: Record<"day" | "week" | "month" | "year", number> = {
  day: 86400,
  week: 7 * 86400,
  month: 31 * 86400,
  year: 366 * 86400,
};

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Contract: docs/architecture/06-API/04-Endpoint-Contracts.md §Statistics Games. */
export const StatisticsRangeQuery = z
  .object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
    tz: z.string().optional(),
    bucket: z.enum(["none", "day", "week", "month", "year"]).default("none"),
    status: z.enum(["completed", "abandoned", "all"]).optional(),
    context: z.enum(["all", "standalone", "routine"]).default("all"),
    inputMode: z.literal("VISUAL_BOARD").default("VISUAL_BOARD"),
    target: z
      .string()
      .optional()
      .refine(
        (value) => value === undefined || parseTargetKey(value) !== null,
        {
          message: "target must be a valid TargetKey",
        },
      ),
  })
  .superRefine((val, ctx) => {
    const fromMs = Date.parse(val.from);
    const toMs = Date.parse(val.to);
    if (!(fromMs < toMs)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "to must be after from",
      });
      return;
    }
    if (val.tz !== undefined && !isValidTimeZone(val.tz)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tz"],
        message: "tz must be a valid IANA time zone",
      });
      return;
    }
    if (val.bucket === "none") return;
    if (val.tz === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tz"],
        message: "tz is required when bucket is not none",
      });
      return;
    }
    const spanSeconds = (toMs - fromMs) / 1000;
    const estimate =
      Math.ceil(spanSeconds / BUCKET_UNIT_SECONDS[val.bucket]) + 1;
    if (estimate > MAX_BUCKETS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bucket"],
        message: `range spans too many ${val.bucket} buckets (max ${MAX_BUCKETS})`,
      });
    }
  });
export type StatisticsRangeQueryData = z.infer<typeof StatisticsRangeQuery>;

export const SessionListQuery = z.intersection(
  StatisticsRangeQuery,
  z.object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().optional(),
  }),
);
export type SessionListQueryData = z.infer<typeof SessionListQuery>;

const BucketBase = z.object({
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
  closed: z.boolean(),
  sampleSize: z.number().int(),
});

const CompletionMetrics = z.object({
  completed: z.number().int(),
  abandoned: z.number().int(),
  neverStarted: z.number().int(),
  abandonedTurns: z.number().int(),
});

const ContextSplit = z.object({
  standalone: z.number().int(),
  routine: z.number().int(),
});

const VolumeMetrics = z.object({
  sessions: ContextSplit,
  darts: ContextSplit,
  durationSeconds: ContextSplit,
});

const SessionResultMetrics = z.record(
  z.string(),
  z.object({
    sessions: z.number().int(),
    countedScoreSum: z.number().int(),
    dartSum: z.number().int(),
    turnSum: z.number().int(),
    countedScoreMin: z.number().int(),
    countedScoreMax: z.number().int(),
    bestLowSessionId: z.string().uuid(),
    bestHighSessionId: z.string().uuid(),
  }),
);

const SeriesBase = z.object({
  sectionVersion: z.number().int(),
  dataVersion: z.string(),
  bucket: z.enum(["none", "day", "week", "month", "year"]),
  tz: z.string().nullable(),
  range: z.object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
  }),
});

export const CompletionSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("completion"),
  buckets: z.array(BucketBase.extend({ metrics: CompletionMetrics })),
});
export type CompletionSeriesResponseData = z.infer<
  typeof CompletionSeriesResponse
>;

export const VolumeSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("volume"),
  buckets: z.array(BucketBase.extend({ metrics: VolumeMetrics })),
});
export type VolumeSeriesResponseData = z.infer<typeof VolumeSeriesResponse>;

export const SessionResultSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("session-result"),
  buckets: z.array(BucketBase.extend({ metrics: SessionResultMetrics })),
});
export type SessionResultSeriesResponseData = z.infer<
  typeof SessionResultSeriesResponse
>;

/** Keyed by `TargetKey` (`lib/stats/target-key.ts`) — the intended `<ZONE_KEY>:<number>` (phase-2 decision 5). */
function TargetRecord<T extends z.ZodTypeAny>(value: T) {
  return z.record(z.string(), value);
}

const TargetAccuracyMetrics = TargetRecord(
  z.object({ attempts: z.number().int(), hits: z.number().int() }),
);

/** The inner key is a hit key: a `TargetKey`, or `MISS`. */
const ConfusionMetrics = TargetRecord(z.record(z.string(), z.number().int()));

const LooseDartsMetrics = TargetRecord(
  z.object({
    onTarget: z.number().int(),
    nearMiss: z.number().int(),
    loose: z.number().int(),
  }),
);

const GroupingMetrics = TargetRecord(
  z.object({
    n: z.number().int(),
    sumX: z.number(),
    sumY: z.number(),
    sumXX: z.number(),
    sumYY: z.number(),
    sumXY: z.number(),
  }),
);

const MissDirectionMetrics = TargetRecord(
  z.array(
    z.object({
      sector: z.number().int().min(0).max(7),
      radial: z.enum(["INSIDE", "WITHIN", "OUTSIDE"]),
      darts: z.number().int(),
    }),
  ),
);

const HeatmapMetrics = z.object({
  cellMm: z.number().positive(),
  target: z.string().nullable(),
  cells: z.array(
    z.tuple([z.number().int(), z.number().int(), z.number().int()]),
  ),
});

export const TargetAccuracySeriesResponse = SeriesBase.extend({
  sectionId: z.literal("target-accuracy"),
  buckets: z.array(BucketBase.extend({ metrics: TargetAccuracyMetrics })),
});
export type TargetAccuracySeriesResponseData = z.infer<
  typeof TargetAccuracySeriesResponse
>;

export const ConfusionSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("confusion"),
  buckets: z.array(BucketBase.extend({ metrics: ConfusionMetrics })),
});
export type ConfusionSeriesResponseData = z.infer<
  typeof ConfusionSeriesResponse
>;

export const LooseDartsSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("loose-darts"),
  buckets: z.array(BucketBase.extend({ metrics: LooseDartsMetrics })),
});
export type LooseDartsSeriesResponseData = z.infer<
  typeof LooseDartsSeriesResponse
>;

export const GroupingSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("grouping"),
  buckets: z.array(BucketBase.extend({ metrics: GroupingMetrics })),
});
export type GroupingSeriesResponseData = z.infer<typeof GroupingSeriesResponse>;

export const MissDirectionSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("miss-direction"),
  buckets: z.array(BucketBase.extend({ metrics: MissDirectionMetrics })),
});
export type MissDirectionSeriesResponseData = z.infer<
  typeof MissDirectionSeriesResponse
>;

export const HeatmapSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("heatmap"),
  buckets: z.array(BucketBase.extend({ metrics: HeatmapMetrics })),
});
export type HeatmapSeriesResponseData = z.infer<typeof HeatmapSeriesResponse>;

/** Keyed by the exact remaining score or dart total (`00-Overview.md` §5, phase-3 decision 3). */
function ValueRecord<T extends z.ZodTypeAny>(value: T) {
  return z.record(z.string().regex(/^\d+$/), value);
}

const HitCount = z.object({
  attempts: z.number().int(),
  hits: z.number().int(),
});

const CheckoutRateMetrics = ValueRecord(
  z.object({ chances: z.number().int(), finished: z.number().int() }),
);

const DoublePerformanceMetrics = TargetRecord(HitCount);

/** The inner key is a route label: dart labels in throw order (`checkout-path.module.ts`). */
const CheckoutPathMetrics = ValueRecord(
  z.record(
    z.string(),
    z.object({ visits: z.number().int(), finished: z.number().int() }),
  ),
);

const BustRateMetrics = ValueRecord(
  z.object({ visits: z.number().int(), busts: z.number().int() }),
);

const LegStatsMetrics = ValueRecord(z.number().int());

const LadderProgressMetrics = z.object({
  targets: ValueRecord(
    z.object({ attempts: z.number().int(), successes: z.number().int() }),
  ),
  maxTarget: z.number().int().nullable(),
  afterMiss: z.number().int(),
  recovered: z.number().int(),
});

const ScoringTrendMetrics = z.object({
  points: z.number().int(),
  darts: z.number().int(),
  firstNinePoints: z.number().int(),
  firstNineDarts: z.number().int(),
  bands: z.object({
    ton: z.number().int(),
    tonForty: z.number().int(),
    oneEighty: z.number().int(),
  }),
});

const TrebleRateMetrics = z.record(
  z.string().regex(/^(\d+|MISS)$/),
  z.object({ darts: z.number().int(), trebles: z.number().int() }),
);

export const CheckoutRateSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("checkout-rate"),
  buckets: z.array(BucketBase.extend({ metrics: CheckoutRateMetrics })),
});
export type CheckoutRateSeriesResponseData = z.infer<
  typeof CheckoutRateSeriesResponse
>;

export const DoublePerformanceSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("double-performance"),
  buckets: z.array(BucketBase.extend({ metrics: DoublePerformanceMetrics })),
});
export type DoublePerformanceSeriesResponseData = z.infer<
  typeof DoublePerformanceSeriesResponse
>;

export const CheckoutPathSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("checkout-path"),
  buckets: z.array(BucketBase.extend({ metrics: CheckoutPathMetrics })),
});
export type CheckoutPathSeriesResponseData = z.infer<
  typeof CheckoutPathSeriesResponse
>;

export const BustRateSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("bust-rate"),
  buckets: z.array(BucketBase.extend({ metrics: BustRateMetrics })),
});
export type BustRateSeriesResponseData = z.infer<typeof BustRateSeriesResponse>;

export const LegStatsSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("leg-stats"),
  buckets: z.array(BucketBase.extend({ metrics: LegStatsMetrics })),
});
export type LegStatsSeriesResponseData = z.infer<typeof LegStatsSeriesResponse>;

export const LadderProgressSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("ladder-progress"),
  buckets: z.array(BucketBase.extend({ metrics: LadderProgressMetrics })),
});
export type LadderProgressSeriesResponseData = z.infer<
  typeof LadderProgressSeriesResponse
>;

export const ScoringTrendSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("scoring-trend"),
  buckets: z.array(BucketBase.extend({ metrics: ScoringTrendMetrics })),
});
export type ScoringTrendSeriesResponseData = z.infer<
  typeof ScoringTrendSeriesResponse
>;

export const TrebleRateSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("treble-rate"),
  buckets: z.array(BucketBase.extend({ metrics: TrebleRateMetrics })),
});
export type TrebleRateSeriesResponseData = z.infer<
  typeof TrebleRateSeriesResponse
>;

const GameSessionListItem = z.object({
  sessionId: z.string().uuid(),
  rulesetVersionKey: z.string(),
  statusKey: z.string(),
  contextKey: z.string(),
  neverStarted: z.boolean(),
  startedAt: z.string().datetime({ offset: true }),
  completedAt: z.string().datetime({ offset: true }),
  durationSeconds: z.number().int(),
  turnCount: z.number().int(),
  dartCount: z.number().int(),
  countedScore: z.number().int(),
});

export const GameSessionListResponse = z.object({
  items: z.array(GameSessionListItem),
  nextCursor: z.string().nullable(),
  dataVersion: z.string(),
});
export type GameSessionListResponseData = z.infer<
  typeof GameSessionListResponse
>;
