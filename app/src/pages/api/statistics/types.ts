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

/**
 * The `from`/`to`/`tz`/`bucket`/`status` fields every range-and-bucket query
 * shares — reused as-is by `StatisticsRangeQuery` and, unwidened, by the
 * routine section query (D372 decision 4), so the two contracts
 * cannot drift on what a valid range or bucket looks like.
 */
const RANGE_FIELDS = {
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
  tz: z.string().optional(),
  bucket: z.enum(["none", "day", "week", "month", "year"]).default("none"),
  status: z.enum(["completed", "abandoned", "all"]).optional(),
};

/**
 * `RANGE_FIELDS`' own cross-field rules, factored out so a query built from
 * a subset of those fields (the routine section query) runs the exact same
 * `from < to`, tz-validity and bucket-count-cap checks as
 * `StatisticsRangeQuery`.
 */
function refineRangeAndBucket(
  val: {
    from: string;
    to: string;
    tz?: string;
    bucket: "none" | "day" | "week" | "month" | "year";
  },
  ctx: z.RefinementCtx,
): void {
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
  const estimate = Math.ceil(spanSeconds / BUCKET_UNIT_SECONDS[val.bucket]) + 1;
  if (estimate > MAX_BUCKETS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["bucket"],
      message: `range spans too many ${val.bucket} buckets (max ${MAX_BUCKETS})`,
    });
  }
}

/** Contract: docs/architecture/06-API/04-Endpoint-Contracts.md §Statistics Games. */
export const StatisticsRangeQuery = z
  .object({
    ...RANGE_FIELDS,
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
  .superRefine(refineRangeAndBucket);
export type StatisticsRangeQueryData = z.infer<typeof StatisticsRangeQuery>;

/** The `limit`/`cursor` fields a paginated session list adds on top of a range query — reused as-is by the routine step session query (D372 decision 10). */
const SESSION_LIST_FIELDS = {
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
};

export const SessionListQuery = z.intersection(
  StatisticsRangeQuery,
  z.object(SESSION_LIST_FIELDS),
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
    bestAverage: z
      .object({
        sessionId: z.string().uuid(),
        points: z.number().int(),
        darts: z.number().int(),
        completedAt: z.string().datetime({ offset: true }),
      })
      .nullable(),
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

/**
 * Set only by a server-site (derived or folded) handler — the count of
 * sessions the fold could not replay (`00-Overview.md` §4, phase-4 decision
 * 4). Optional so a `sql`-site response, which never sets it, still
 * validates.
 */
const SkippedSessions = { skippedSessions: z.number().int().optional() };

export const TargetAccuracySeriesResponse = SeriesBase.extend({
  sectionId: z.literal("target-accuracy"),
  buckets: z.array(BucketBase.extend({ metrics: TargetAccuracyMetrics })),
  ...SkippedSessions,
});
export type TargetAccuracySeriesResponseData = z.infer<
  typeof TargetAccuracySeriesResponse
>;

export const ConfusionSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("confusion"),
  buckets: z.array(BucketBase.extend({ metrics: ConfusionMetrics })),
  ...SkippedSessions,
});
export type ConfusionSeriesResponseData = z.infer<
  typeof ConfusionSeriesResponse
>;

export const LooseDartsSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("loose-darts"),
  buckets: z.array(BucketBase.extend({ metrics: LooseDartsMetrics })),
  ...SkippedSessions,
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
  ...SkippedSessions,
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

const LegStatsMetrics = z.object({
  legs: ValueRecord(z.number().int()),
  bestLeg: z
    .object({ darts: z.number().int(), sessionId: z.string().uuid() })
    .nullable(),
});

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
  ...SkippedSessions,
});
export type CheckoutRateSeriesResponseData = z.infer<
  typeof CheckoutRateSeriesResponse
>;

export const DoublePerformanceSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("double-performance"),
  buckets: z.array(BucketBase.extend({ metrics: DoublePerformanceMetrics })),
  ...SkippedSessions,
});
export type DoublePerformanceSeriesResponseData = z.infer<
  typeof DoublePerformanceSeriesResponse
>;

export const CheckoutPathSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("checkout-path"),
  buckets: z.array(BucketBase.extend({ metrics: CheckoutPathMetrics })),
  ...SkippedSessions,
});
export type CheckoutPathSeriesResponseData = z.infer<
  typeof CheckoutPathSeriesResponse
>;

export const BustRateSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("bust-rate"),
  buckets: z.array(BucketBase.extend({ metrics: BustRateMetrics })),
  ...SkippedSessions,
});
export type BustRateSeriesResponseData = z.infer<typeof BustRateSeriesResponse>;

export const LegStatsSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("leg-stats"),
  buckets: z.array(BucketBase.extend({ metrics: LegStatsMetrics })),
  ...SkippedSessions,
});
export type LegStatsSeriesResponseData = z.infer<typeof LegStatsSeriesResponse>;

export const LadderProgressSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("ladder-progress"),
  buckets: z.array(BucketBase.extend({ metrics: LadderProgressMetrics })),
  ...SkippedSessions,
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

/** Wraps `inner` per config group (`configGroupKey`, phase-4 decision 13). */
function GroupRecord<T extends z.ZodTypeAny>(inner: T) {
  return z.record(z.string(), inner);
}

const AtcDartsPerTargetMetrics = GroupRecord(
  TargetRecord(
    z.object({ darts: z.number().int(), cleared: z.number().int() }),
  ),
);

const Bobs27SurvivalMetrics = GroupRecord(
  z.object({
    runs: z.number().int(),
    completed: z.number().int(),
    reached: TargetRecord(z.number().int()),
    died: TargetRecord(z.number().int()),
    scoreAfter: TargetRecord(
      z.object({
        runs: z.number().int(),
        sum: z.number().int(),
        min: z.number().int(),
        max: z.number().int(),
      }),
    ),
  }),
);

const ShanghaiCountMetrics = z.object({
  sessions: z.number().int(),
  shanghais: z.number().int(),
  byRound: ValueRecord(z.number().int()),
});

const TrainingResultMetrics = GroupRecord(
  z.object({
    sessions: z.number().int(),
    total: z.number().int(),
    best: z.number().int(),
  }),
);

export const TrainingResultSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("training-result"),
  buckets: z.array(BucketBase.extend({ metrics: TrainingResultMetrics })),
  ...SkippedSessions,
});
export type TrainingResultSeriesResponseData = z.infer<
  typeof TrainingResultSeriesResponse
>;

export const AtcDartsPerTargetSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("atc-darts-per-target"),
  buckets: z.array(BucketBase.extend({ metrics: AtcDartsPerTargetMetrics })),
  ...SkippedSessions,
});
export type AtcDartsPerTargetSeriesResponseData = z.infer<
  typeof AtcDartsPerTargetSeriesResponse
>;

export const Bobs27SurvivalSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("bobs27-survival"),
  buckets: z.array(BucketBase.extend({ metrics: Bobs27SurvivalMetrics })),
  ...SkippedSessions,
});
export type Bobs27SurvivalSeriesResponseData = z.infer<
  typeof Bobs27SurvivalSeriesResponse
>;

export const ShanghaiCountSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("shanghai-count"),
  buckets: z.array(BucketBase.extend({ metrics: ShanghaiCountMetrics })),
  ...SkippedSessions,
});
export type ShanghaiCountSeriesResponseData = z.infer<
  typeof ShanghaiCountSeriesResponse
>;

/**
 * One page of a session's replay (D371 decisions 4, 6): only `cursor` and
 * `limit` are accepted -- any other search param fails `.strict()`, per
 * `10-Statistics/00-Overview.md` §5's "never silently ignored" rule.
 */
export const ReplayQuery = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(120).default(30),
  })
  .strict();
export type ReplayQueryData = z.infer<typeof ReplayQuery>;

/** A replay route's `sessionId` path param: a UUID, else `VALIDATION_FAILED`. */
export const ReplaySessionIdParam = z.string().uuid();

const ReplayParticipant = z.object({
  participantId: z.string().uuid(),
  displayName: z.string(),
  participantTypeKey: z.string(),
});

const ReplayStage = z.object({
  stageId: z.string().uuid(),
  parentStageId: z.string().uuid().nullable(),
  stageTypeKey: z.string(),
  sequence: z.number().int(),
});

/**
 * Mirrors `ReplayHeader` (`@services/types`, D371 decision 5; D372
 * decision 11): `gameTypeKey`/`rulesetVersionKey` are `null` for a non-game
 * routine step, and `exerciseTypeKey`/`exerciseRulesetVersionKey`/
 * `routineKey`/`stepKey` name the routine step a session ran as.
 */
export const ReplayHeaderSchema = z.object({
  sessionId: z.string().uuid(),
  gameTypeKey: z.string().nullable(),
  rulesetVersionKey: z.string().nullable(),
  inputModeKey: z.string(),
  statusKey: z.string(),
  contextKey: z.string(),
  activityId: z.string().uuid(),
  routineStepSequenceNumber: z.number().int().nullable(),
  configuration: z.record(z.unknown()).nullable(),
  startedAt: z.string().datetime({ offset: true }),
  completedAt: z.string().datetime({ offset: true }),
  durationSeconds: z.number().int(),
  turnCount: z.number().int(),
  dartCount: z.number().int(),
  exerciseTypeKey: z.string(),
  exerciseRulesetVersionKey: z.string().nullable(),
  routineKey: z.string().nullable(),
  stepKey: z.string().nullable(),
  participants: z.array(ReplayParticipant),
  stages: z.array(ReplayStage),
});
export type ReplayHeaderSchemaData = z.infer<typeof ReplayHeaderSchema>;

const ReplayDart = z.object({
  dartNumber: z.number().int(),
  intendedTargetNumber: z.number().int().nullable(),
  intendedZoneKey: z.string().nullable(),
  hitTargetNumber: z.number().int().nullable(),
  hitZoneKey: z.string(),
  score: z.number().int(),
  locationX: z.number().nullable(),
  locationY: z.number().nullable(),
});

/** Mirrors `ReplayTurn` (`@modules/types`, D371 decision 3). */
export const ReplayTurnSchema = z.object({
  stageId: z.string().uuid(),
  turnSequence: z.number().int(),
  participantId: z.string().uuid(),
  turnTotalScore: z.number().int(),
  darts: z.array(ReplayDart),
});
export type ReplayTurnSchemaData = z.infer<typeof ReplayTurnSchema>;

/** Mirrors `ReplayPage` (`@services/types`, D371 decisions 2, 4-5). */
export const ReplayPageSchema = z.object({
  header: ReplayHeaderSchema.nullable(),
  turns: z.array(ReplayTurnSchema),
  nextCursor: z.string().nullable(),
});
export type ReplayPageSchemaData = z.infer<typeof ReplayPageSchema>;

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

/**
 * A routine or routine-step section query (D372 decision 4):
 * `from`, `to`, `tz`, `bucket` and `status` only, built from `RANGE_FIELDS`
 * so it shares `StatisticsRangeQuery`'s own range/bucket rules exactly.
 * `.strict()` fails `context`, `inputMode`, `target` or anything else --
 * `context` is fixed to `"routine"` by the route itself (a GAME step
 * inherits it from the server-set `routineStep` scope), so accepting the
 * caller's own value would let a request widen a scope the server already
 * decided (`00-Overview.md` §5 "never silently ignored").
 */
export const RoutineStatsQuery = z
  .object({ ...RANGE_FIELDS })
  .strict()
  .superRefine(refineRangeAndBucket);
export type RoutineStatsQueryData = z.infer<typeof RoutineStatsQuery>;

/**
 * A routine step's session-list query (D372 decision 10):
 * `SessionListQuery`'s own `from`, `to`, `status`, `limit` and `cursor`
 * fields, minus `context` and `inputMode` -- a step's sessions are always
 * routine context by definition (`v_stats_routine_step_facts` has no
 * `context_key` column), so accepting either would only ever be silently
 * ignored, which `.strict()` refuses instead. `z.intersection` does not
 * compose with `.strict()` (an intersected object's own unknown-keys mode is
 * lost), so this is a flat object built from the same field schemas rather
 * than `SessionListQuery` itself.
 */
export const RoutineSessionsQuery = z
  .object({
    from: RANGE_FIELDS.from,
    to: RANGE_FIELDS.to,
    status: RANGE_FIELDS.status,
    ...SESSION_LIST_FIELDS,
  })
  .strict()
  .superRefine((val, ctx) => {
    if (!(Date.parse(val.from) < Date.parse(val.to))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "to must be after from",
      });
    }
  });
export type RoutineSessionsQueryData = z.infer<typeof RoutineSessionsQuery>;

/** No routine-list or routine-header parameter is accepted; any key at all fails `.strict()` (D372 decision 4). */
export const RoutineNoQuery = z.object({}).strict();

/** Mirrors `TrainedRoutine` (`@services/types`, D372 decision 9). */
export const TrainedRoutineSchema = z.object({
  routineKey: z.string(),
  routineTemplateId: z.string().uuid().nullable(),
  routineName: z.string(),
  runCount: z.number().int(),
  completedRunCount: z.number().int(),
  lastRunAt: z.string().datetime({ offset: true }),
});
export type TrainedRoutineSchemaData = z.infer<typeof TrainedRoutineSchema>;

/**
 * `GET /api/statistics/routines`' response body (D372 decision 9):
 * every routine the caller has trained, unpaginated. Named
 * `TrainedRoutineListResponse` rather than `RoutineListResponse` --
 * `src/pages/api/routines/types.ts` already owns that name for the
 * unrelated `/api/routines` CRUD listing, and both flow through the same
 * `@routes/types` barrel.
 */
export const TrainedRoutineListResponse = z.object({
  items: z.array(TrainedRoutineSchema),
});
export type TrainedRoutineListResponseData = z.infer<
  typeof TrainedRoutineListResponse
>;

/** Mirrors `RoutineStepDescriptor` (`@services/types`, D372 decision 9). */
export const RoutineStepDescriptorSchema = z.object({
  stepKey: z.string(),
  sequenceNumber: z.number().int(),
  exerciseTypeKey: z.string(),
  exerciseRulesetVersionKey: z.string().nullable(),
  gameTypeKey: z.string().nullable(),
  rulesetVersionKey: z.string().nullable(),
  durationSeconds: z.number().int().nullable(),
  sessionCount: z.number().int(),
  firstSeenAt: z.string().datetime({ offset: true }),
  lastSeenAt: z.string().datetime({ offset: true }),
  current: z.boolean(),
});
export type RoutineStepDescriptorSchemaData = z.infer<
  typeof RoutineStepDescriptorSchema
>;

/** `GET /api/statistics/routines/:routineKey`'s response body (D372 decision 9); mirrors `RoutineHeader` (`@services/types`). */
export const RoutineHeaderSchema = z.object({
  routineKey: z.string(),
  routineName: z.string(),
  runCount: z.number().int(),
  firstRunAt: z.string().datetime({ offset: true }),
  lastRunAt: z.string().datetime({ offset: true }),
  dataVersion: z.string(),
  steps: z.array(RoutineStepDescriptorSchema),
});
export type RoutineHeaderSchemaData = z.infer<typeof RoutineHeaderSchema>;

/** `routine-volume` section metrics (D372 decision 6): `durationSeconds`/`minDurationSeconds`/`maxDurationSeconds` are whole seconds, matching `RoutineVolumeMetrics` (`@modules/types`) -- the client converts to minutes, never the wire shape. */
const RoutineVolumeMetrics = z.object({
  runs: z.number().int(),
  durationSeconds: z.number().int(),
  minDurationSeconds: z.number().int(),
  maxDurationSeconds: z.number().int(),
  darts: z.number().int(),
});

/** `routine-completion` section metrics (D372 decision 6). */
const RoutineCompletionMetrics = z.object({
  completed: z.number().int(),
  abandoned: z.number().int(),
  neverStarted: z.number().int(),
  stepsCompletedAtAbandon: z.record(z.string(), z.number().int()),
});

/** `step-volume` section metrics (D372 decision 6). */
const StepVolumeMetrics = z.object({
  sessions: z.number().int(),
  durationSeconds: z.number().int(),
  darts: z.number().int(),
});

/** `step-result` section metrics (D372 decisions 6-8): one bucket's merged per-kind metrics plus the headline's extremes and the fold's own session counts. */
const StepResultMetrics = z.object({
  metrics: z.record(z.string(), z.number()),
  headlineMin: z.number().nullable(),
  headlineMax: z.number().nullable(),
  sessions: z.number().int(),
  skippedSessions: z.number().int(),
});

/** Mirrors `RoutineSeries<RoutineVolumeMetrics>` (`@lib/stats/types`). */
export const RoutineVolumeSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("routine-volume"),
  buckets: z.array(BucketBase.extend({ metrics: RoutineVolumeMetrics })),
});
export type RoutineVolumeSeriesResponseData = z.infer<
  typeof RoutineVolumeSeriesResponse
>;

/** Mirrors `RoutineSeries<RoutineCompletionMetrics>` (`@lib/stats/types`). */
export const RoutineCompletionSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("routine-completion"),
  buckets: z.array(BucketBase.extend({ metrics: RoutineCompletionMetrics })),
});
export type RoutineCompletionSeriesResponseData = z.infer<
  typeof RoutineCompletionSeriesResponse
>;

/** Mirrors `RoutineSeries<StepVolumeMetrics>` (`@lib/stats/types`). */
export const StepVolumeSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("step-volume"),
  buckets: z.array(BucketBase.extend({ metrics: StepVolumeMetrics })),
});
export type StepVolumeSeriesResponseData = z.infer<
  typeof StepVolumeSeriesResponse
>;

/** Mirrors `RoutineSeries<StepResultMetric>` (`@lib/stats/types`). */
export const StepResultSeriesResponse = SeriesBase.extend({
  sectionId: z.literal("step-result"),
  buckets: z.array(BucketBase.extend({ metrics: StepResultMetrics })),
});
export type StepResultSeriesResponseData = z.infer<
  typeof StepResultSeriesResponse
>;

const StepSessionListItem = z.object({
  sessionId: z.string().uuid(),
  rulesetVersionKey: z.string().nullable(),
  exerciseRulesetVersionKey: z.string().nullable(),
  statusKey: z.string(),
  neverStarted: z.boolean(),
  startedAt: z.string().datetime({ offset: true }),
  completedAt: z.string().datetime({ offset: true }),
  durationSeconds: z.number().int(),
  turnCount: z.number().int(),
  dartCount: z.number().int(),
  countedScore: z.number().int(),
});

/** `GET .../steps/:stepKey/sessions`' response body (D372 decision 10); mirrors `SessionList` (`@services/types`). */
export const RoutineStepSessionListResponse = z.object({
  items: z.array(StepSessionListItem),
  nextCursor: z.string().nullable(),
  dataVersion: z.string(),
});
export type RoutineStepSessionListResponseData = z.infer<
  typeof RoutineStepSessionListResponse
>;
