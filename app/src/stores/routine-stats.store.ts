import { isGameTypeKey } from "@lib/game/rulesets/capabilities";
import {
  isDartExerciseKind,
  sectionsForRoutine,
  sectionsForStep,
} from "@lib/stats/section-registry";
import { replayPath } from "@lib/stats/replay-route";
import {
  resolveStepAdapter,
  stepAdapterKey,
} from "@lib/training/routines/adapters/step-adapter.registry";
import {
  mergeStepResult,
  STEP_METRIC_SPECS,
} from "@modules/stats/step-metrics.module";
import {
  routineScopeKey,
  stepScopeKey,
} from "@modules/stats/routine-scope.module";
import {
  fetchRoutineHeader,
  fetchRoutineSection,
  fetchRoutineStepSection,
  fetchRoutineStepSessions,
  fetchTrainedRoutines,
} from "@client/api/statistics";
import {
  noteDataVersion,
  readSection,
  readSessionPage,
} from "@client/stats-cache/cache";
import { defaultRange, gameStatsStore } from "@stores/game-stats.store";
import type {
  RoutineHeaderSchemaData,
  RoutineSectionParams,
  RoutineStepSessionListResponseData,
  TrainedRoutineListResponseData,
} from "@client/api/types";
import type {
  Bucket,
  GameTypeKey,
  RoutineSectionId,
  RoutineSectionMeta,
  SectionMeta,
  SeriesBucket,
} from "@lib/types";
import type {
  DartExerciseKind,
  RoutineCompletionMetrics,
  RoutineVolumeMetrics,
  StepResultMetric,
  StepVolumeMetrics,
} from "@modules/types";
import type { CachedSeries, CacheScope, StatsCacheQuery } from "@client/types";

/** The same synthetic browser-scoped cache identity `game-stats.store.ts` uses: the client never learns its own `player_id`, and sign-out wipes the whole cache. */
const CACHE_PLAYER_ID = "me";

/**
 * `StatsCacheParams`' `context`/`inputMode`, fixed for every routine read.
 * `paramsKey` hashes them, but no routine fetcher ever sends either: the
 * routine routes fix context server-side and accept no input mode (D372
 * decision 4).
 */
const ROUTINE_CACHE_PARAMS = {
  context: "routine" as const,
  inputMode: "ALL",
};

/** One step session page, matching the Games tab's own page size. */
const STEP_SESSION_LIMIT = 25;

/** Display names for every `STEP_METRIC_SPECS` metric key; an unknown key shows as itself. */
const STEP_METRIC_LABELS: Readonly<Record<string, string>> = {
  points: "Points",
  darts: "Darts",
  hits: "Hits",
  bestChain: "Best chain",
  sequences: "Sequences",
  beats: "Beats",
  visits: "Visits",
  checkouts: "Checkouts",
  throws: "Throws",
  bullseyes: "Bullseyes",
  bulls: "Bulls",
};

type SeriesView = CachedSeries<unknown> | null;
type StatsRange = RoutineSectionParams & { bucket: Bucket };
type TrainedRoutine = TrainedRoutineListResponseData["items"][number];
type RoutineHeader = RoutineHeaderSchemaData;
type StepDescriptor = RoutineHeader["steps"][number];
type StepSession = RoutineStepSessionListResponseData["items"][number];

function bucketsOf<M>(view: SeriesView | undefined): SeriesBucket<M>[] {
  return (view?.buckets ?? []) as SeriesBucket<M>[];
}

function minutes(seconds: number): number {
  return Math.round(seconds / 60);
}

/** The one error line every routine-store failure shows: a raw `StatisticsApiError` message is written for developers, not players. */
const LOAD_ERROR =
  "Could not load your routine statistics. Check your connection and try again.";

/** A descriptor's `gameTypeKey`, narrowed to a known `GameTypeKey`; `null` for a non-game step or a game type this client does not know. */
function stepGameType(step: StepDescriptor): GameTypeKey | null {
  return step.gameTypeKey !== null && isGameTypeKey(step.gameTypeKey)
    ? step.gameTypeKey
    : null;
}

/** A step's dart exercise kind, or `null` for a GAME step or a dartless one (Warm-Up). */
function stepExerciseKind(step: StepDescriptor): DartExerciseKind | null {
  return isDartExerciseKind(step.exerciseTypeKey) ? step.exerciseTypeKey : null;
}

/**
 * A step's cache scope (`CacheScope`): keyed by the step, versioned by its
 * routine, resolving compute-site against the step's own game type, and
 * carrying its dart exercise kind for `step-result`'s chunk merge.
 */
function stepScope(routineKey: string, step: StepDescriptor): CacheScope {
  const scope: CacheScope = {
    key: stepScopeKey(routineKey, step.stepKey),
    gameTypeKey: stepGameType(step),
    versionKey: routineScopeKey(routineKey),
  };
  const kind = stepExerciseKind(step);
  if (kind !== null) scope.exerciseKind = kind;
  return scope;
}

/**
 * A section's fetch parameters: the page range, except a section that is not
 * bucketable, which always reads as one un-bucketed request over the whole
 * range, exactly as `game-stats.store.ts` reads it.
 */
function sectionParams(
  meta: SectionMeta | RoutineSectionMeta,
  range: StatsRange,
): StatsRange {
  if (!meta.bucketable) {
    return { from: range.from, to: range.to, bucket: "none" };
  }
  return { ...range };
}

function cacheQuery(params: StatsRange): StatsCacheQuery {
  return { ...params, ...ROUTINE_CACHE_PARAMS };
}

/** `routine-volume` buckets summed; seconds arrive whole on the wire and convert to minutes only here. */
function routineVolumeTotals(buckets: SeriesBucket<RoutineVolumeMetrics>[]) {
  let runs = 0;
  let seconds = 0;
  let darts = 0;
  let shortest: number | null = null;
  let longest: number | null = null;
  for (const { metrics } of buckets) {
    runs += metrics.runs;
    seconds += metrics.durationSeconds;
    darts += metrics.darts;
    shortest = Math.min(shortest ?? Infinity, metrics.minDurationSeconds);
    longest = Math.max(longest ?? -Infinity, metrics.maxDurationSeconds);
  }
  return {
    runs,
    minutes: minutes(seconds),
    shortestMinutes: shortest === null ? null : minutes(shortest),
    longestMinutes: longest === null ? null : minutes(longest),
    darts,
  };
}

/** `routine-completion`'s three run counts, summed across every loaded bucket. */
function routineCompletionTotals(
  buckets: SeriesBucket<RoutineCompletionMetrics>[],
) {
  return buckets.reduce(
    (totals, { metrics }) => ({
      completed: totals.completed + metrics.completed,
      abandoned: totals.abandoned + metrics.abandoned,
      neverStarted: totals.neverStarted + metrics.neverStarted,
    }),
    { completed: 0, abandoned: 0, neverStarted: 0 },
  );
}

/** The abandon-point distribution: abandoned runs per steps-completed count, summed across buckets, fewest steps first. */
function abandonPoints(
  buckets: SeriesBucket<RoutineCompletionMetrics>[],
): { steps: number; runs: number }[] {
  const totals = new Map<number, number>();
  for (const { metrics } of buckets) {
    for (const [key, runs] of Object.entries(metrics.stepsCompletedAtAbandon)) {
      const steps = Number(key);
      totals.set(steps, (totals.get(steps) ?? 0) + runs);
    }
  }
  return Array.from(totals.entries())
    .sort(([a], [b]) => a - b)
    .map(([steps, runs]) => ({ steps, runs }));
}

/** `step-volume` buckets summed, seconds converted to minutes for display. */
function stepVolumeTotals(buckets: SeriesBucket<StepVolumeMetrics>[]) {
  let sessions = 0;
  let seconds = 0;
  let darts = 0;
  for (const { metrics } of buckets) {
    sessions += metrics.sessions;
    seconds += metrics.durationSeconds;
    darts += metrics.darts;
  }
  return { sessions, minutes: minutes(seconds), darts };
}

/** `step-result` buckets merged under the kind's own spec, exactly as the cache merges its chunks; every metric zero and both extremes `null` without a bucket. */
function stepResultTotals(
  kind: DartExerciseKind,
  buckets: SeriesBucket<StepResultMetric>[],
): StepResultMetric {
  const spec = STEP_METRIC_SPECS[kind];
  const empty: StepResultMetric = {
    metrics: Object.fromEntries(Object.keys(spec.metrics).map((k) => [k, 0])),
    headlineMin: null,
    headlineMax: null,
    sessions: 0,
    skippedSessions: 0,
  };
  const results = buckets.map((bucket) => bucket.metrics);
  if (results.length === 0) return empty;
  return results.reduce((a, b) => mergeStepResult(spec, a, b));
}

/**
 * The `/statistics` Routines tab's state (`10-Statistics/00-Overview.md`
 * §8): the trained-routine picker, the routine's run cards, its step list
 * and the selected step's cards and session list, all read through the
 * IndexedDB cache under the routine's and step's own scope keys (D372
 * decision 12). Registered through `Alpine.store("routineStats",
 * routineStatsStore())` on every page, so nothing loads at registration:
 * the Routines tab starts loading through `activate()` the first time it
 * is shown (`x-init` is forbidden repo-wide).
 */
export function routineStatsStore() {
  return {
    routines: [] as TrainedRoutine[],
    routineKey: null as string | null,
    header: null as RoutineHeader | null,
    stepKey: null as string | null,
    showEarlierSteps: false,
    range: defaultRange() as StatsRange,
    routineSections: {} as Partial<Record<RoutineSectionId, SeriesView>>,
    stepSections: {} as Record<string, SeriesView>,
    /**
     * The Games tab's own section view, fed from `stepSections`, that a GAME
     * step's cards render through (`GameSectionCards.astro`): its getters
     * do the rest. `selectStep` names the step's `gameTypeKey` the moment a
     * GAME step is selected, before any await, and the cards exist only
     * while a GAME step is (`x-if`), so the factory's own `"501"` default
     * is never rendered. Its loaders are never called: the step's cards
     * render without the heatmap target picker, the one card that would
     * reload through them.
     */
    stepGame: gameStatsStore(),
    stepSessions: [] as StepSession[],
    nextCursor: null as string | null,
    loading: false,
    error: null as string | null,
    activated: false,

    /** Alpine calls this at registration, on every page — so it fetches nothing; the Routines tab loads through `activate()`. */
    init(): void {},

    /**
     * Loads the trained-routine list and selects the first routine, once:
     * the Routines tab calls this each time it is shown (`index.astro`'s
     * `x-effect` on the tab), and every call after the first is a no-op.
     */
    async activate() {
      if (this.activated) return;
      this.activated = true;
      this.loading = true;
      this.error = null;
      try {
        this.routines = (await fetchTrainedRoutines()).items;
      } catch {
        this.error = LOAD_ERROR;
        return;
      } finally {
        this.loading = false;
      }
      const first = this.routines[0];
      if (first !== undefined) await this.selectRoutine(first.routineKey);
    },

    /** Whether a load begun for `routineKey` (and `stepKey`, for a step load) still matches the selection. A `stepKey` is only unique within its own routine, so a step load checks both. */
    isSelected(routineKey: string, stepKey?: string): boolean {
      return (
        this.routineKey === routineKey &&
        (stepKey === undefined || this.stepKey === stepKey)
      );
    },

    /**
     * Loads `routineKey`'s header, records its fresh `dataVersion` before
     * any section read (`noteDataVersion`, so a step cached under the same
     * routine goes stale with it), reads both run-level sections, then
     * selects the first current step.
     */
    async selectRoutine(routineKey: string) {
      this.routineKey = routineKey;
      this.header = null;
      this.routineSections = {};
      this.resetStep();
      this.loading = true;
      this.error = null;
      try {
        const header = await fetchRoutineHeader(routineKey);
        await noteDataVersion(
          CACHE_PLAYER_ID,
          routineScopeKey(routineKey),
          header.dataVersion,
        );
        const sections = await this.readRoutineSections(routineKey);
        if (!this.isSelected(routineKey)) return;
        this.header = header;
        this.routineSections = sections;
        const first =
          header.steps.find((step) => step.current) ?? header.steps[0];
        if (first !== undefined) await this.selectStep(first.stepKey);
      } catch {
        if (this.isSelected(routineKey)) this.error = LOAD_ERROR;
      } finally {
        if (this.isSelected(routineKey)) this.loading = false;
      }
    },

    async readRoutineSections(
      routineKey: string,
    ): Promise<Partial<Record<RoutineSectionId, SeriesView>>> {
      const scope: CacheScope = {
        key: routineScopeKey(routineKey),
        gameTypeKey: null,
        versionKey: routineScopeKey(routineKey),
      };
      const metas = sectionsForRoutine();
      const results = await Promise.all(
        metas.map((meta) =>
          readSection<unknown>(
            CACHE_PLAYER_ID,
            scope,
            meta,
            cacheQuery(this.range),
            (span) =>
              fetchRoutineSection(routineKey, meta.id, {
                ...this.range,
                ...span,
              }) as Promise<CachedSeries<unknown>>,
          ),
        ),
      );
      return Object.fromEntries(
        metas.map((meta, index) => [meta.id, results[index]]),
      );
    },

    resetStep() {
      this.stepKey = null;
      this.stepSections = {};
      this.stepGame.sections = {};
      this.stepSessions = [];
      this.nextCursor = null;
    },

    /** Loads `stepKey`'s cards (`sectionsForStep`) and its first session page. */
    async selectStep(stepKey: string) {
      const routineKey = this.routineKey;
      const step = this.header?.steps.find((s) => s.stepKey === stepKey);
      if (routineKey === null || step === undefined) return;
      this.resetStep();
      this.stepKey = stepKey;
      const gameTypeKey = stepGameType(step);
      if (gameTypeKey !== null) this.stepGame.gameTypeKey = gameTypeKey;
      this.loading = true;
      this.error = null;
      try {
        const [sections, page] = await Promise.all([
          this.readStepSections(routineKey, step),
          this.readStepSessionPage(routineKey, stepKey, undefined),
        ]);
        if (!this.isSelected(routineKey, stepKey)) return;
        this.stepSections = sections;
        this.stepGame.sections = gameTypeKey === null ? {} : sections;
        this.stepSessions = page.items;
        this.nextCursor = page.nextCursor;
      } catch {
        if (this.isSelected(routineKey, stepKey)) this.error = LOAD_ERROR;
      } finally {
        if (this.isSelected(routineKey, stepKey)) this.loading = false;
      }
    },

    async readStepSections(
      routineKey: string,
      step: StepDescriptor,
    ): Promise<Record<string, SeriesView>> {
      const scope = stepScope(routineKey, step);
      const { sections } = sectionsForStep({
        exerciseTypeKey: step.exerciseTypeKey,
        gameTypeKey: scope.gameTypeKey,
      });
      const results = await Promise.all(
        sections.map((meta: SectionMeta | RoutineSectionMeta) => {
          const params = sectionParams(meta, this.range);
          return readSection<unknown>(
            CACHE_PLAYER_ID,
            scope,
            meta,
            cacheQuery(params),
            (span) =>
              fetchRoutineStepSection(routineKey, step.stepKey, meta.id, {
                ...params,
                ...span,
              }) as Promise<CachedSeries<unknown>>,
          );
        }),
      );
      return Object.fromEntries(
        sections.map((meta, index) => [meta.id, results[index]]),
      );
    },

    readStepSessionPage(
      routineKey: string,
      stepKey: string,
      cursor: string | undefined,
    ) {
      return readSessionPage<StepSession>(
        CACHE_PLAYER_ID,
        stepScopeKey(routineKey, stepKey),
        { ...cacheQuery(this.range), cursor },
        () =>
          fetchRoutineStepSessions(routineKey, stepKey, {
            from: this.range.from,
            to: this.range.to,
            limit: STEP_SESSION_LIMIT,
            cursor,
          }),
        routineScopeKey(routineKey),
      );
    },

    async loadMoreStepSessions() {
      const { routineKey, stepKey, nextCursor } = this;
      if (routineKey === null || stepKey === null || nextCursor === null) {
        return;
      }
      try {
        const page = await this.readStepSessionPage(
          routineKey,
          stepKey,
          nextCursor,
        );
        if (!this.isSelected(routineKey, stepKey)) return;
        this.stepSessions = [...this.stepSessions, ...page.items];
        this.nextCursor = page.nextCursor;
      } catch {
        if (this.isSelected(routineKey, stepKey)) this.error = LOAD_ERROR;
      }
    },

    /** Steps the latest run's snapshot holds (the descriptor's server-computed `current`), in header order. */
    get currentSteps(): StepDescriptor[] {
      return (this.header?.steps ?? []).filter((step) => step.current);
    },

    /** Every earlier version of a step, in header order. */
    get earlierSteps(): StepDescriptor[] {
      return (this.header?.steps ?? []).filter((step) => !step.current);
    },

    /** `earlierSteps` once the collapsed "Earlier versions" group is open, otherwise none. */
    get shownEarlierSteps(): StepDescriptor[] {
      return this.showEarlierSteps ? this.earlierSteps : [];
    },

    get selectedStep(): StepDescriptor | null {
      return (
        this.header?.steps.find((step) => step.stepKey === this.stepKey) ?? null
      );
    },

    /** Which cards the selected step shows: its game's own sections, a dart exercise's step result and volume, or volume alone. */
    get stepKind(): "game" | "exercise" | "dartless" | null {
      const step = this.selectedStep;
      if (step === null) return null;
      if (stepGameType(step) !== null) return "game";
      return this.selectedExerciseKind === null ? "dartless" : "exercise";
    },

    /** `Step n · <adapter headerLabel>`, the label the routine play header shows for the same step; the raw exercise type when no adapter matches. */
    stepLabel(step: StepDescriptor): string {
      const adapter = resolveStepAdapter(
        stepAdapterKey({
          exerciseTypeKey: step.exerciseTypeKey,
          gameRulesetVersionKey: step.rulesetVersionKey,
        }),
      );
      return `Step ${step.sequenceNumber} · ${adapter?.headerLabel ?? step.exerciseTypeKey}`;
    },

    /** A step row's detail: its session count, configured minutes when the snapshot sets a duration, and last run date — what tells two versions sharing one `stepLabel` apart. */
    stepDetail(step: StepDescriptor): string {
      const parts = [`${step.sessionCount} sessions`];
      if (step.durationSeconds !== null) {
        parts.push(`${minutes(step.durationSeconds)} min`);
      }
      parts.push(`last run ${new Date(step.lastSeenAt).toLocaleDateString()}`);
      return parts.join(" · ");
    },

    metricLabel(key: string): string {
      return STEP_METRIC_LABELS[key] ?? key;
    },

    get routineVolumeTotals() {
      const view = this.routineSections["routine-volume"];
      if (!view) return null;
      return routineVolumeTotals(bucketsOf<RoutineVolumeMetrics>(view));
    },

    get routineCompletionTotals() {
      const view = this.routineSections["routine-completion"];
      if (!view) return null;
      return routineCompletionTotals(bucketsOf<RoutineCompletionMetrics>(view));
    },

    get abandonPoints(): { steps: number; runs: number }[] {
      return abandonPoints(
        bucketsOf<RoutineCompletionMetrics>(
          this.routineSections["routine-completion"],
        ),
      );
    },

    get stepVolumeTotals() {
      const view = this.stepSections["step-volume"];
      if (!view) return null;
      return stepVolumeTotals(bucketsOf<StepVolumeMetrics>(view));
    },

    /** The selected step's dart exercise kind, `null` for a GAME or dartless step. */
    get selectedExerciseKind(): DartExerciseKind | null {
      const step = this.selectedStep;
      return step === null ? null : stepExerciseKind(step);
    },

    get stepResultTotals(): StepResultMetric | null {
      const kind = this.selectedExerciseKind;
      const view = this.stepSections["step-result"];
      if (kind === null || !view) return null;
      return stepResultTotals(kind, bucketsOf<StepResultMetric>(view));
    },

    /** Each of the kind's `STEP_METRIC_SPECS.rates` pairs divided out; `rate` is `null` over a zero denominator. */
    get stepRates(): {
      numerator: string;
      denominator: string;
      rate: number | null;
    }[] {
      const totals = this.stepResultTotals;
      const kind = this.selectedExerciseKind;
      if (totals === null || kind === null) return [];
      return STEP_METRIC_SPECS[kind].rates.map(([numerator, denominator]) => {
        const over = totals.metrics[denominator] ?? 0;
        return {
          numerator,
          denominator,
          rate: over === 0 ? null : (totals.metrics[numerator] ?? 0) / over,
        };
      });
    },

    /** The kind's headline metric: its merged total and the best single session, read off the extreme `direction` names. */
    get stepHeadline(): {
      key: string;
      total: number;
      personalBest: number | null;
    } | null {
      const totals = this.stepResultTotals;
      const kind = this.selectedExerciseKind;
      if (totals === null || kind === null) return null;
      const spec = STEP_METRIC_SPECS[kind];
      return {
        key: spec.headline,
        total: totals.metrics[spec.headline] ?? 0,
        personalBest:
          spec.direction === "higher" ? totals.headlineMax : totals.headlineMin,
      };
    },

    /** A step session row's replay page, or `null` for a dartless step (Warm-Up has no capture pair to replay, D372 decision 11). */
    sessionHref(sessionId: string): string | null {
      return this.stepKind === "dartless" || this.stepKind === null
        ? null
        : replayPath(sessionId);
    },
  };
}
