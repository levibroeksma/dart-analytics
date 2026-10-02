import { BOARD_RADII_MM } from "@lib/game/board/board-geometry.module";
import { GAME_TYPE_BY_RULESET } from "@lib/game/rulesets/capabilities";
import {
  RESULT_DIRECTION,
  SECTIONS,
  sectionsForGame,
} from "@lib/stats/section-registry";
import {
  DEDICATED_STATS_LAYOUTS,
  MIN_TARGET_SAMPLE,
} from "@lib/stats/constants";
import { CACHE_PLAYER_ID, loadGameSection } from "@lib/stats/load-game-section";
import {
  formatTargetKey,
  parseTargetKey,
  targetLabel,
} from "@lib/stats/target-key";
import { replayPath } from "@lib/stats/replay-route";
import { doublesPath, targetAt } from "@modules/game/board-progression.module";
import { checkoutPathFor } from "@modules/game/checkout-path.module";
import { doubleTargetIntent } from "@modules/game/turn-log.module";
import { groupingSummary } from "@modules/stats/sections/grouping.module";
import { fetchGameSection, fetchGameSessions } from "@client/api/statistics";
import { readSection, readSessionPage } from "@client/stats-cache/cache";
import { gameScopeKey } from "@modules/stats/routine-scope.module";
import type {
  AtcDartsPerTargetMetrics,
  Bobs27SurvivalMetrics,
  BustRateMetrics,
  ChartSeries,
  ChartSpec,
  CheckoutPathMetrics,
  CheckoutRateMetrics,
  CompletionMetrics,
  ConfusionMetrics,
  DoublePerformanceMetrics,
  GroupingMetrics,
  GroupingMoment,
  HeatmapMetrics,
  LadderProgressMetrics,
  LegStatsMetrics,
  LooseDartsMetrics,
  MissDirectionMetrics,
  ScoringTrendMetrics,
  SessionResultMetrics,
  ShanghaiCountMetrics,
  TargetAccuracyMetrics,
  TrebleRateMetrics,
  VolumeMetrics,
} from "@modules/types";
import type { GameSessionListResponseData } from "@client/api/types";
import type {
  Bucket,
  GameTypeKey,
  IntentZoneKey,
  RulesetVersionKey,
  SectionId,
  SectionMeta,
  SeriesBucket,
  TargetKey,
} from "@lib/types";
import type { CachedSeries } from "@client/types";

type SectionView = CachedSeries<unknown> | null;

type SessionResultRow = {
  rulesetVersionKey: string;
  sessions: number;
  averageCountedScore: number | null;
  personalBest: {
    direction: "higher" | "lower";
    value: number;
    sessionId: string;
  } | null;
};

/** The `checkout-rate`/`bust-rate` remaining-score bands, a client constant (phase-3 decision 3) — never refetched to reband. */
const REMAINING_BANDS: readonly { label: string; low: number; high: number }[] =
  [
    { label: "2–40", low: 2, high: 40 },
    { label: "41–60", low: 41, high: 60 },
    { label: "61–80", low: 61, high: 80 },
    { label: "81–100", low: 81, high: 100 },
    { label: "101–130", low: 101, high: 130 },
    { label: "131–170", low: 131, high: 170 },
  ];

/** The width of one `ladderSummary` target band. */
const LADDER_BAND_SIZE = 10;

/** The four rings `ringSplit` reads off a `NUMBER:n` aim's `confusion` landings (phase-4 decision 9). */
const NUMBER_AIM_RINGS = [
  "INNER_SINGLE",
  "OUTER_SINGLE",
  "DOUBLE",
  "TREBLE",
] as const;

/**
 * Bob's 27's own doubles path (D1..D20, BULL), each entry mapped to its
 * stored-intent `TargetKey` (`doubleTargetIntent`, `turn-log.module.ts`) —
 * shared with `bobs27-survival.module.ts`'s own `targetKeyAt` so
 * `survivalCurve` walks the exact same 21 keys the server folded.
 */
const BOBS27_PATH_KEYS: readonly TargetKey[] = doublesPath().map((_, index) => {
  const intent = doubleTargetIntent(targetAt(doublesPath(), index));
  return formatTargetKey(
    intent.intendedTargetNumber!,
    intent.intendedZoneKey as IntentZoneKey,
  );
});

/** `atc-darts-per-target` totals for one config group, folded across every loaded bucket. */
function sumAtcTargets(
  series: CachedSeries<AtcDartsPerTargetMetrics> | undefined,
  group: string,
): Map<string, { darts: number; cleared: number }> {
  const totals = new Map<string, { darts: number; cleared: number }>();
  for (const b of series?.buckets ?? []) {
    const groupMetrics = b.metrics[group];
    if (!groupMetrics) continue;
    for (const [targetKey, m] of Object.entries(groupMetrics)) {
      const existing = totals.get(targetKey) ?? { darts: 0, cleared: 0 };
      existing.darts += m.darts;
      existing.cleared += m.cleared;
      totals.set(targetKey, existing);
    }
  }
  return totals;
}

type LadderTargetTotal = { attempts: number; successes: number };

/** `maxTarget` merges by `max`, with `null` as the identity (mirrors `lib/stats/merge-metrics.ts`). */
function combineMaxTarget(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}

/** `ladder-progress` buckets folded into per-target totals, the highest target attempted, and after-a-miss counts. */
function sumLadderTargets(
  buckets: readonly SeriesBucket<LadderProgressMetrics>[],
): {
  totals: Map<string, LadderTargetTotal>;
  maxTarget: number | null;
  afterMiss: number;
  recovered: number;
} {
  const totals = new Map<string, LadderTargetTotal>();
  let maxTarget: number | null = null;
  let afterMiss = 0;
  let recovered = 0;
  for (const b of buckets) {
    for (const [target, m] of Object.entries(b.metrics.targets)) {
      const existing = totals.get(target) ?? { attempts: 0, successes: 0 };
      existing.attempts += m.attempts;
      existing.successes += m.successes;
      totals.set(target, existing);
    }
    maxTarget = combineMaxTarget(maxTarget, b.metrics.maxTarget);
    afterMiss += b.metrics.afterMiss;
    recovered += b.metrics.recovered;
  }
  return { totals, maxTarget, afterMiss, recovered };
}

/** Per-target totals grouped into `LADDER_BAND_SIZE`-wide bands, each with its own gated success rate. */
function bandLadderTargets(totals: ReadonlyMap<string, LadderTargetTotal>): {
  start: number;
  end: number;
  attempts: number;
  successes: number;
  rate: number | null;
}[] {
  const bandTotals = new Map<number, LadderTargetTotal>();
  for (const [targetKey, t] of totals.entries()) {
    const target = Number(targetKey);
    const start =
      Math.floor((target - 1) / LADDER_BAND_SIZE) * LADDER_BAND_SIZE + 1;
    const existing = bandTotals.get(start) ?? { attempts: 0, successes: 0 };
    existing.attempts += t.attempts;
    existing.successes += t.successes;
    bandTotals.set(start, existing);
  }

  return Array.from(bandTotals.entries())
    .sort(([a], [b]) => a - b)
    .map(([start, t]) => ({
      start,
      end: start + LADDER_BAND_SIZE - 1,
      attempts: t.attempts,
      successes: t.successes,
      rate: t.attempts >= MIN_TARGET_SAMPLE ? t.successes / t.attempts : null,
    }));
}

/** A statistics page's opening range: the last twelve months to a minute from now, bucketed by month in the browser's own time zone. Shared with `routine-stats.store.ts`, so both tabs open on the same window. */
export function defaultRange() {
  const now = new Date();
  const from = new Date(now);
  from.setUTCMonth(from.getUTCMonth() - 12);
  const to = new Date(now.getTime() + 60_000);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    bucket: "month" as const,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

/**
 * The range a section reads under: the page range, except a section that is
 * not bucketable, which reads as one un-bucketed request over the whole range.
 */
function sectionRange(
  meta: SectionMeta,
  range: ReturnType<typeof defaultRange>,
): { from: string; to: string; bucket: Bucket; tz?: string } {
  if (meta.bucketable) return { ...range };
  return { from: range.from, to: range.to, bucket: "none" };
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : "load failed";
}

/**
 * Game statistics page state: the completion, volume and session-result
 * sections plus the session list, all read through the IndexedDB cache
 * (`10-Statistics/00-Overview.md` §7). Registered through
 * `Alpine.store("gameStats", gameStatsStore())`; `x-init` is forbidden
 * repo-wide.
 */
export function gameStatsStore() {
  return {
    gameTypeKey: "501" as GameTypeKey,
    range: defaultRange(),
    sections: {} as Partial<Record<SectionId, SectionView>>,
    sessions: [] as GameSessionListResponseData["items"],
    nextCursor: null as string | null,
    loading: false,
    error: null as string | null,
    sectionErrors: {} as Partial<Record<SectionId, string>>,
    heatmapTarget: null as TargetKey | null,

    /** Registered on every page, so it fetches nothing; `/statistics` loads through `selectGame`. */
    init(): void {},

    /** Resolves the picked ruleset version to its game type, then reloads; a dedicated-layout game loads its own sections. */
    selectGame(rulesetVersionKey: string) {
      if (DEDICATED_STATS_LAYOUTS.has(rulesetVersionKey)) return;
      const gameTypeKey =
        GAME_TYPE_BY_RULESET[rulesetVersionKey as RulesetVersionKey];
      if (gameTypeKey === undefined) return;
      this.gameTypeKey = gameTypeKey;
      void this.load();
    },

    /** One line naming the sections that failed to load, or `null` when none did. */
    get failedSectionsMessage(): string | null {
      const failed = Object.keys(this.sectionErrors);
      return failed.length === 0
        ? null
        : `Could not load: ${failed.join(", ")}`;
    },

    /**
     * Reads every section independently: a rejected section lands in
     * `sectionErrors` and leaves the others, and the session list, intact.
     */
    async load() {
      this.loading = true;
      this.error = null;
      const gameTypeKey = this.gameTypeKey;
      const query = {
        ...this.range,
        context: "all" as const,
        inputMode: "VISUAL_BOARD",
      };
      const ids = sectionsForGame(gameTypeKey);
      const settled = await Promise.allSettled(
        ids.map((id): Promise<SectionView> => {
          if (id === "checkout-path")
            return this.fetchCheckoutPath(gameTypeKey);
          const range = sectionRange(SECTIONS[id], this.range);
          return loadGameSection<unknown>(gameTypeKey, id, range);
        }),
      );
      const sections: Partial<Record<SectionId, SectionView>> = {};
      const sectionErrors: Partial<Record<SectionId, string>> = {};
      settled.forEach((result, index) => {
        const id = ids[index];
        if (result.status === "fulfilled") {
          sections[id] = result.value;
          return;
        }
        sectionErrors[id] = errorMessage(result.reason);
      });
      this.sections = sections;
      this.sectionErrors = sectionErrors;

      try {
        const page = await readSessionPage<
          GameSessionListResponseData["items"][number]
        >(CACHE_PLAYER_ID, gameScopeKey(gameTypeKey), query, () =>
          fetchGameSessions(gameTypeKey, { ...this.range, limit: 25 }),
        );
        this.sessions = page.items;
        this.nextCursor = page.nextCursor;
      } catch (cause) {
        this.error = errorMessage(cause);
      } finally {
        this.loading = false;
      }
    },

    /**
     * `checkout-path` is not bucketable (`00-Overview.md` §5) and metrics are
     * already keyed by the exact `startingRemaining`, so it always reads as
     * one un-bucketed request over the whole range — the remaining picker
     * (`pathsFor`) is a pure client-side read of the loaded metrics, not a
     * further fetch.
     */
    async fetchCheckoutPath(gameTypeKey: GameTypeKey): Promise<SectionView> {
      const query = {
        from: this.range.from,
        to: this.range.to,
        bucket: "none" as const,
        context: "all" as const,
        inputMode: "VISUAL_BOARD",
      };
      return readSection<CheckoutPathMetrics>(
        CACHE_PLAYER_ID,
        { key: gameScopeKey(gameTypeKey), gameTypeKey },
        SECTIONS["checkout-path"],
        query,
        (span) =>
          fetchGameSection(gameTypeKey, "checkout-path", {
            ...query,
            ...span,
          }) as Promise<CachedSeries<CheckoutPathMetrics>>,
      );
    },

    /** Reloads only `heatmap`, through the cache, under the new target (or the whole board when `null`). */
    async selectHeatmapTarget(target: TargetKey | null) {
      this.heatmapTarget = target;
      await this.loadHeatmap();
    },

    async loadHeatmap() {
      const gameTypeKey = this.gameTypeKey;
      const target = this.heatmapTarget ?? undefined;
      const range = sectionRange(SECTIONS.heatmap, this.range);
      const result = await loadGameSection<HeatmapMetrics>(
        gameTypeKey,
        "heatmap",
        { ...range, target },
      );
      this.sections = { ...this.sections, heatmap: result };
    },

    async loadMoreSessions() {
      if (this.nextCursor === null) return;
      const gameTypeKey = this.gameTypeKey;
      const cursor = this.nextCursor;
      const query = {
        ...this.range,
        context: "all" as const,
        inputMode: "VISUAL_BOARD",
        cursor,
      };
      const page = await readSessionPage<
        GameSessionListResponseData["items"][number]
      >(CACHE_PLAYER_ID, gameScopeKey(gameTypeKey), query, () =>
        fetchGameSessions(gameTypeKey, { ...this.range, limit: 25, cursor }),
      );
      this.sessions = [...this.sessions, ...page.items];
      this.nextCursor = page.nextCursor;
    },

    /** A session's replay page, for a session-list row or the PB line's `sessionId` (D371 decision 12). */
    replayHref(sessionId: string): string {
      return replayPath(sessionId);
    },

    /** Completion totals across every loaded bucket, or `null` before the section has loaded. */
    get completionTotals(): CompletionMetrics | null {
      const series = this.sections.completion as
        CachedSeries<CompletionMetrics> | undefined;
      if (!series) return null;
      return series.buckets.reduce<CompletionMetrics>(
        (totals, b) => ({
          completed: totals.completed + b.metrics.completed,
          abandoned: totals.abandoned + b.metrics.abandoned,
          neverStarted: totals.neverStarted + b.metrics.neverStarted,
          abandonedTurns: totals.abandonedTurns + b.metrics.abandonedTurns,
        }),
        { completed: 0, abandoned: 0, neverStarted: 0, abandonedTurns: 0 },
      );
    },

    /** `(abandoned + neverStarted) / sampleSize`; `null` when there is no sample yet. */
    get abandonRate(): number | null {
      const totals = this.completionTotals;
      if (totals === null) return null;
      const sample = totals.completed + totals.abandoned + totals.neverStarted;
      if (sample === 0) return null;
      return (totals.abandoned + totals.neverStarted) / sample;
    },

    /** Volume totals across every loaded bucket, or `null` before the section has loaded. */
    get volumeTotals(): VolumeMetrics | null {
      const series = this.sections.volume as
        CachedSeries<VolumeMetrics> | undefined;
      if (!series) return null;
      const empty = { standalone: 0, routine: 0 };
      return series.buckets.reduce<VolumeMetrics>(
        (totals, b) => ({
          sessions: {
            standalone:
              totals.sessions.standalone + b.metrics.sessions.standalone,
            routine: totals.sessions.routine + b.metrics.sessions.routine,
          },
          darts: {
            standalone: totals.darts.standalone + b.metrics.darts.standalone,
            routine: totals.darts.routine + b.metrics.darts.routine,
          },
          durationSeconds: {
            standalone:
              totals.durationSeconds.standalone +
              b.metrics.durationSeconds.standalone,
            routine:
              totals.durationSeconds.routine +
              b.metrics.durationSeconds.routine,
          },
        }),
        {
          sessions: { ...empty },
          darts: { ...empty },
          durationSeconds: { ...empty },
        },
      );
    },

    /** One summary row per ruleset version played, with a PB line only where `RESULT_DIRECTION` names a direction. */
    get sessionResultRows(): SessionResultRow[] {
      const series = this.sections["session-result"] as
        CachedSeries<SessionResultMetrics> | undefined;
      if (!series) return [];

      const totals = new Map<
        string,
        {
          sessions: number;
          countedScoreSum: number;
          countedScoreMin: number;
          countedScoreMax: number;
          bestLowSessionId: string;
          bestHighSessionId: string;
        }
      >();
      for (const b of series.buckets) {
        for (const [rulesetVersionKey, m] of Object.entries(b.metrics)) {
          const existing = totals.get(rulesetVersionKey);
          if (!existing) {
            totals.set(rulesetVersionKey, {
              sessions: m.sessions,
              countedScoreSum: m.countedScoreSum,
              countedScoreMin: m.countedScoreMin,
              countedScoreMax: m.countedScoreMax,
              bestLowSessionId: m.bestLowSessionId,
              bestHighSessionId: m.bestHighSessionId,
            });
            continue;
          }
          existing.sessions += m.sessions;
          existing.countedScoreSum += m.countedScoreSum;
          if (m.countedScoreMin < existing.countedScoreMin) {
            existing.countedScoreMin = m.countedScoreMin;
            existing.bestLowSessionId = m.bestLowSessionId;
          }
          if (m.countedScoreMax > existing.countedScoreMax) {
            existing.countedScoreMax = m.countedScoreMax;
            existing.bestHighSessionId = m.bestHighSessionId;
          }
        }
      }

      const direction = RESULT_DIRECTION[this.gameTypeKey];
      return Array.from(totals.entries()).map(([rulesetVersionKey, t]) => ({
        rulesetVersionKey,
        sessions: t.sessions,
        averageCountedScore:
          t.sessions === 0 ? null : t.countedScoreSum / t.sessions,
        personalBest:
          direction === null
            ? null
            : {
                direction,
                value:
                  direction === "higher"
                    ? t.countedScoreMax
                    : t.countedScoreMin,
                sessionId:
                  direction === "higher"
                    ? t.bestHighSessionId
                    : t.bestLowSessionId,
              },
      }));
    },

    /** Display label for a `TargetKey` (`DOUBLE:16` -> `D16`). */
    targetLabel,

    /** Per-target hit rate across every loaded bucket, weakest first. */
    get accuracyRows(): {
      targetKey: string;
      attempts: number;
      hits: number;
      rate: number;
    }[] {
      const series = this.sections["target-accuracy"] as
        CachedSeries<TargetAccuracyMetrics> | undefined;
      if (!series) return [];

      const totals = new Map<string, { attempts: number; hits: number }>();
      for (const b of series.buckets) {
        for (const [targetKey, m] of Object.entries(b.metrics)) {
          const existing = totals.get(targetKey) ?? { attempts: 0, hits: 0 };
          existing.attempts += m.attempts;
          existing.hits += m.hits;
          totals.set(targetKey, existing);
        }
      }

      return Array.from(totals.entries())
        .map(([targetKey, t]) => ({
          targetKey,
          attempts: t.attempts,
          hits: t.hits,
          rate: t.attempts === 0 ? 0 : t.hits / t.attempts,
        }))
        .sort((a, b) => a.rate - b.rate);
    },

    /** The best-rate target with at least `MIN_TARGET_SAMPLE` attempts, or `null` when none qualify. */
    get favoriteTarget() {
      const qualifying = this.accuracyRows.filter(
        (r) => r.attempts >= MIN_TARGET_SAMPLE,
      );
      if (qualifying.length === 0) return null;
      return qualifying.reduce((best, r) => (r.rate > best.rate ? r : best));
    },

    /** The worst-rate target with at least `MIN_TARGET_SAMPLE` attempts, or `null` when none qualify. */
    get weakestTarget() {
      const qualifying = this.accuracyRows.filter(
        (r) => r.attempts >= MIN_TARGET_SAMPLE,
      );
      if (qualifying.length === 0) return null;
      return qualifying.reduce((worst, r) => (r.rate < worst.rate ? r : worst));
    },

    /** The `n` most frequent non-hit landings for an intended target, from `confusion`'s single bucket. */
    confusionTop(
      target: string,
      n: number,
    ): { hitKey: string; count: number }[] {
      const series = this.sections.confusion as
        CachedSeries<ConfusionMetrics> | undefined;
      const landings = series?.buckets[0]?.metrics[target] ?? {};
      return Object.entries(landings)
        .filter(([hitKey]) => hitKey !== target)
        .map(([hitKey, count]) => ({ hitKey, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, n);
    },

    /** `groupingSummary` per target, summed across every loaded bucket. */
    get groupingRows(): {
      targetKey: string;
      summary: ReturnType<typeof groupingSummary>;
    }[] {
      const series = this.sections.grouping as
        CachedSeries<GroupingMetrics> | undefined;
      if (!series) return [];

      const totals = new Map<string, GroupingMoment>();
      for (const b of series.buckets) {
        for (const [targetKey, m] of Object.entries(b.metrics)) {
          const existing = totals.get(targetKey);
          if (!existing) {
            totals.set(targetKey, { ...m });
            continue;
          }
          existing.n += m.n;
          existing.sumX += m.sumX;
          existing.sumY += m.sumY;
          existing.sumXX += m.sumXX;
          existing.sumYY += m.sumYY;
          existing.sumXY += m.sumXY;
        }
      }

      return Array.from(totals.entries()).map(([targetKey, moment]) => {
        const parsed = parseTargetKey(targetKey);
        return {
          targetKey,
          summary: parsed === null ? null : groupingSummary(moment, parsed),
        };
      });
    },

    /** The 8-sector rose plus radial split for one target, from `miss-direction`'s single bucket. Always 8 entries. */
    missRose(
      target: string,
    ): { sector: number; inside: number; within: number; outside: number }[] {
      const series = this.sections["miss-direction"] as
        CachedSeries<MissDirectionMetrics> | undefined;
      const entries = series?.buckets[0]?.metrics[target] ?? [];

      const rose = Array.from({ length: 8 }, (_, sector) => ({
        sector,
        inside: 0,
        within: 0,
        outside: 0,
      }));
      for (const entry of entries) {
        const row = rose[entry.sector];
        if (!row) continue;
        if (entry.radial === "INSIDE") row.inside += entry.darts;
        else if (entry.radial === "WITHIN") row.within += entry.darts;
        else row.outside += entry.darts;
      }
      return rose;
    },

    /**
     * `heatmap`'s cells as `DartBoard.astro`-relative percentages (its SVG
     * `viewBox` spans `±BOARD_RADII_MM.surroundOuter` mm on each axis),
     * opacity scaled to the busiest cell in view — the sequential encoding
     * `dataviz` calls for.
     */
    get heatmapCells(): {
      key: string;
      leftPct: number;
      topPct: number;
      sizePct: number;
      opacity: number;
    }[] {
      const series = this.sections.heatmap as
        CachedSeries<HeatmapMetrics> | undefined;
      const bucket = series?.buckets[0];
      if (!bucket) return [];

      const span = BOARD_RADII_MM.surroundOuter * 2;
      const origin = BOARD_RADII_MM.surroundOuter;
      const cellMm = bucket.metrics.cellMm;
      const sizePct = (cellMm / span) * 100;
      const maxDarts = bucket.metrics.cells.reduce(
        (max, [, , darts]) => Math.max(max, darts),
        0,
      );

      return bucket.metrics.cells.map(([ix, iy, darts]) => ({
        key: `${ix}:${iy}`,
        leftPct: ((ix * cellMm + origin) / span) * 100,
        topPct: ((iy * cellMm + origin) / span) * 100,
        sizePct,
        opacity: maxDarts === 0 ? 0 : darts / maxDarts,
      }));
    },

    /** On/near/loose shares per bucket, summed across every intended target — the loose-darts trend. */
    get looseDartsTrend(): {
      start: string;
      onTarget: number;
      nearMiss: number;
      loose: number;
    }[] {
      const series = this.sections["loose-darts"] as
        CachedSeries<LooseDartsMetrics> | undefined;
      if (!series) return [];

      return series.buckets.map((b) => {
        let onTarget = 0;
        let nearMiss = 0;
        let loose = 0;
        for (const m of Object.values(b.metrics)) {
          onTarget += m.onTarget;
          nearMiss += m.nearMiss;
          loose += m.loose;
        }
        return { start: b.start, onTarget, nearMiss, loose };
      });
    },

    /** `checkout-rate` chances/finishes summed into `REMAINING_BANDS`; `rate` is `null` below `MIN_TARGET_SAMPLE` chances. */
    get checkoutRateBands(): {
      label: string;
      chances: number;
      finished: number;
      rate: number | null;
    }[] {
      const series = this.sections["checkout-rate"] as
        CachedSeries<CheckoutRateMetrics> | undefined;
      return REMAINING_BANDS.map((band) => {
        let chances = 0;
        let finished = 0;
        for (const b of series?.buckets ?? []) {
          for (const [key, m] of Object.entries(b.metrics)) {
            const remaining = Number(key);
            if (remaining < band.low || remaining > band.high) continue;
            chances += m.chances;
            finished += m.finished;
          }
        }
        return {
          label: band.label,
          chances,
          finished,
          rate: chances >= MIN_TARGET_SAMPLE ? finished / chances : null,
        };
      });
    },

    /** `bust-rate` visits/busts summed into `REMAINING_BANDS`; `rate` is `null` below `MIN_TARGET_SAMPLE` visits. */
    get bustRateBands(): {
      label: string;
      visits: number;
      busts: number;
      rate: number | null;
    }[] {
      const series = this.sections["bust-rate"] as
        CachedSeries<BustRateMetrics> | undefined;
      return REMAINING_BANDS.map((band) => {
        let visits = 0;
        let busts = 0;
        for (const b of series?.buckets ?? []) {
          for (const [key, m] of Object.entries(b.metrics)) {
            const remaining = Number(key);
            if (remaining < band.low || remaining > band.high) continue;
            visits += m.visits;
            busts += m.busts;
          }
        }
        return {
          label: band.label,
          visits,
          busts,
          rate: visits >= MIN_TARGET_SAMPLE ? busts / visits : null,
        };
      });
    },

    /** `checkout-rate`'s overall conversion rate per bucket, for the trend line — `null` below `MIN_TARGET_SAMPLE` chances. */
    get checkoutRateTrend(): { start: string; rate: number | null }[] {
      const series = this.sections["checkout-rate"] as
        CachedSeries<CheckoutRateMetrics> | undefined;
      if (!series) return [];
      return series.buckets.map((b) => {
        let chances = 0;
        let finished = 0;
        for (const m of Object.values(b.metrics)) {
          chances += m.chances;
          finished += m.finished;
        }
        return {
          start: b.start,
          rate: chances >= MIN_TARGET_SAMPLE ? finished / chances : null,
        };
      });
    },

    /** `bust-rate`'s overall bust rate per bucket, for the trend line — `null` below `MIN_TARGET_SAMPLE` visits. */
    get bustRateTrend(): { start: string; rate: number | null }[] {
      const series = this.sections["bust-rate"] as
        CachedSeries<BustRateMetrics> | undefined;
      if (!series) return [];
      return series.buckets.map((b) => {
        let visits = 0;
        let busts = 0;
        for (const m of Object.values(b.metrics)) {
          visits += m.visits;
          busts += m.busts;
        }
        return {
          start: b.start,
          rate: visits >= MIN_TARGET_SAMPLE ? busts / visits : null,
        };
      });
    },

    /** `treble-rate`'s overall treble share per bucket, for the trend line — `null` below `MIN_TARGET_SAMPLE` darts. */
    get trebleRateTrend(): { start: string; rate: number | null }[] {
      const series = this.sections["treble-rate"] as
        CachedSeries<TrebleRateMetrics> | undefined;
      if (!series) return [];
      return series.buckets.map((b) => {
        let darts = 0;
        let trebles = 0;
        for (const m of Object.values(b.metrics)) {
          darts += m.darts;
          trebles += m.trebles;
        }
        return {
          start: b.start,
          rate: darts >= MIN_TARGET_SAMPLE ? trebles / darts : null,
        };
      });
    },

    /** Per-double hit rate across every loaded bucket, weakest first — `double-performance`'s analogue of `accuracyRows`. */
    get doubleRows(): {
      targetKey: string;
      attempts: number;
      hits: number;
      rate: number;
    }[] {
      const series = this.sections["double-performance"] as
        CachedSeries<DoublePerformanceMetrics> | undefined;
      if (!series) return [];

      const totals = new Map<string, { attempts: number; hits: number }>();
      for (const b of series.buckets) {
        for (const [targetKey, m] of Object.entries(b.metrics)) {
          const existing = totals.get(targetKey) ?? { attempts: 0, hits: 0 };
          existing.attempts += m.attempts;
          existing.hits += m.hits;
          totals.set(targetKey, existing);
        }
      }

      return Array.from(totals.entries())
        .map(([targetKey, t]) => ({
          targetKey,
          attempts: t.attempts,
          hits: t.hits,
          rate: t.attempts === 0 ? 0 : t.hits / t.attempts,
        }))
        .sort((a, b) => a.rate - b.rate);
    },

    /** The best-rate double with at least `MIN_TARGET_SAMPLE` attempts, or `null` when none qualify. */
    get favoriteDouble() {
      const qualifying = this.doubleRows.filter(
        (r) => r.attempts >= MIN_TARGET_SAMPLE,
      );
      if (qualifying.length === 0) return null;
      return qualifying.reduce((best, r) => (r.rate > best.rate ? r : best));
    },

    /** The worst-rate double with at least `MIN_TARGET_SAMPLE` attempts, or `null` when none qualify. */
    get weakestDouble() {
      const qualifying = this.doubleRows.filter(
        (r) => r.attempts >= MIN_TARGET_SAMPLE,
      );
      if (qualifying.length === 0) return null;
      return qualifying.reduce((worst, r) => (r.rate < worst.rate ? r : worst));
    },

    /** The exact `startingRemaining` values `checkout-path` holds data for, highest first. */
    get checkoutPathRemainings(): number[] {
      const series = this.sections["checkout-path"] as
        CachedSeries<CheckoutPathMetrics> | undefined;
      const metrics = series?.buckets[0]?.metrics ?? {};
      return Object.keys(metrics)
        .map(Number)
        .sort((a, b) => b - a);
    },

    /** The routes thrown at `remaining`, most-used first, each with its own finish rate. */
    pathsFor(remaining: number): {
      route: string;
      visits: number;
      finished: number;
      finishRate: number;
    }[] {
      const series = this.sections["checkout-path"] as
        CachedSeries<CheckoutPathMetrics> | undefined;
      const routes = series?.buckets[0]?.metrics[String(remaining)] ?? {};
      return Object.entries(routes)
        .map(([route, m]) => ({
          route,
          visits: m.visits,
          finished: m.finished,
          finishRate: m.visits === 0 ? 0 : m.finished / m.visits,
        }))
        .sort((a, b) => b.visits - a.visits);
    },

    /** The conventional three-dart-or-fewer chart route for `remaining`, for comparison against `pathsFor` — `null` for a bogey or unreachable number. */
    chartRouteFor(remaining: number): readonly string[] | null {
      return checkoutPathFor(remaining);
    },

    /** `ladder-progress` totals: per-`LADDER_BAND_SIZE` success rate, the highest target attempted, and the after-a-miss recovery rate. */
    get ladderSummary(): {
      maxTarget: number | null;
      bands: {
        start: number;
        end: number;
        attempts: number;
        successes: number;
        rate: number | null;
      }[];
      recoveryRate: number | null;
    } | null {
      const series = this.sections["ladder-progress"] as
        CachedSeries<LadderProgressMetrics> | undefined;
      if (!series) return null;

      const { totals, maxTarget, afterMiss, recovered } = sumLadderTargets(
        series.buckets,
      );

      return {
        maxTarget,
        bands: bandLadderTargets(totals),
        recoveryRate:
          afterMiss >= MIN_TARGET_SAMPLE ? recovered / afterMiss : null,
      };
    },

    /** Darts-per-leg histogram, summed across every loaded bucket, sorted by dart count. */
    get legHistogram(): { darts: number; legs: number }[] {
      const series = this.sections["leg-stats"] as
        CachedSeries<LegStatsMetrics> | undefined;
      if (!series) return [];

      const totals = new Map<number, number>();
      for (const b of series.buckets) {
        for (const [key, legs] of Object.entries(b.metrics)) {
          const darts = Number(key);
          totals.set(darts, (totals.get(darts) ?? 0) + legs);
        }
      }
      return Array.from(totals.entries())
        .sort(([a], [b]) => a - b)
        .map(([darts, legs]) => ({ darts, legs }));
    },

    /** The fewest darts a loaded leg was won in, or `null` without one. */
    get bestLeg(): number | null {
      return this.legHistogram[0]?.darts ?? null;
    },

    /** The average darts per leg across every loaded, finished leg, or `null` without one. */
    get averageLegDarts(): number | null {
      const histogram = this.legHistogram;
      const totalLegs = histogram.reduce((sum, row) => sum + row.legs, 0);
      if (totalLegs === 0) return null;
      const totalDarts = histogram.reduce(
        (sum, row) => sum + row.darts * row.legs,
        0,
      );
      return totalDarts / totalLegs;
    },

    /** `scoring-trend` totals, summed across every loaded bucket. */
    get scoringTrendTotals(): ScoringTrendMetrics {
      const series = this.sections["scoring-trend"] as
        CachedSeries<ScoringTrendMetrics> | undefined;
      const empty: ScoringTrendMetrics = {
        points: 0,
        darts: 0,
        firstNinePoints: 0,
        firstNineDarts: 0,
        bands: { ton: 0, tonForty: 0, oneEighty: 0 },
      };
      if (!series) return empty;
      return series.buckets.reduce<ScoringTrendMetrics>(
        (totals, b) => ({
          points: totals.points + b.metrics.points,
          darts: totals.darts + b.metrics.darts,
          firstNinePoints: totals.firstNinePoints + b.metrics.firstNinePoints,
          firstNineDarts: totals.firstNineDarts + b.metrics.firstNineDarts,
          bands: {
            ton: totals.bands.ton + b.metrics.bands.ton,
            tonForty: totals.bands.tonForty + b.metrics.bands.tonForty,
            oneEighty: totals.bands.oneEighty + b.metrics.bands.oneEighty,
          },
        }),
        empty,
      );
    },

    /** Three-dart average over every loaded dart, or `null` without any. */
    get threeDartAverage(): number | null {
      const totals = this.scoringTrendTotals;
      return totals.darts === 0 ? null : (totals.points / totals.darts) * 3;
    },

    /** First-nine average over every loaded `LEG`-stage dart, or `null` without any (games with no `LEG` stage report zeros). */
    get firstNineAverage(): number | null {
      const totals = this.scoringTrendTotals;
      return totals.firstNineDarts === 0
        ? null
        : (totals.firstNinePoints / totals.firstNineDarts) * 3;
    },

    /** The 100+/140+/180 visit-score band counts, summed across every loaded bucket. */
    get bandCounts(): { ton: number; tonForty: number; oneEighty: number } {
      return this.scoringTrendTotals.bands;
    },

    /** True when at least one month has a 3-dart average to plot. */
    get scoringTrendHasData(): boolean {
      return this.scoringTrendChart.series[0].data.some(
        (value) => value !== null,
      );
    },

    /** `scoring-trend`'s monthly 3-dart and first-nine averages as a line chart; an empty-darts bucket is a gap. */
    get scoringTrendChart(): ChartSpec {
      const series = this.sections["scoring-trend"] as
        CachedSeries<ScoringTrendMetrics> | undefined;
      const buckets = series?.buckets ?? [];
      const average = (points: number, darts: number) =>
        darts === 0 ? null : (points / darts) * 3;
      const firstNine = buckets.map((b) =>
        average(b.metrics.firstNinePoints, b.metrics.firstNineDarts),
      );
      const chartSeries: ChartSeries[] = [
        {
          key: "three-dart-average",
          label: "3-dart average",
          data: buckets.map((b) => average(b.metrics.points, b.metrics.darts)),
          color: "sky",
        },
      ];
      if (firstNine.some((value) => value !== null)) {
        chartSeries.push({
          key: "first-nine-average",
          label: "First nine",
          data: firstNine,
          color: "orange",
        });
      }
      return {
        kind: "line",
        labels: buckets.map((b) =>
          new Date(b.start).toLocaleDateString(undefined, {
            month: "short",
            year: "numeric",
          }),
        ),
        series: chartSeries,
        ariaLabel: "3-dart average per month",
      };
    },

    /** `treble-rate` totals per hit number, summed across every loaded bucket. */
    get trebleRateTotals(): Record<string, { darts: number; trebles: number }> {
      const series = this.sections["treble-rate"] as
        CachedSeries<TrebleRateMetrics> | undefined;
      if (!series) return {};
      const totals: Record<string, { darts: number; trebles: number }> = {};
      for (const b of series.buckets) {
        for (const [key, m] of Object.entries(b.metrics)) {
          const existing = totals[key] ?? { darts: 0, trebles: 0 };
          existing.darts += m.darts;
          existing.trebles += m.trebles;
          totals[key] = existing;
        }
      }
      return totals;
    },

    /** The treble rate for one hit number (`"20"`, `"19"`, ...), or `null` below `MIN_TARGET_SAMPLE` darts at it. */
    trebleRate(numberKey: string): number | null {
      const entry = this.trebleRateTotals[numberKey];
      if (!entry || entry.darts < MIN_TARGET_SAMPLE) return null;
      return entry.trebles / entry.darts;
    },

    /** The overall treble share across every hit number (including `MISS`), or `null` below `MIN_TARGET_SAMPLE` darts. */
    get trebleRateAll(): number | null {
      let darts = 0;
      let trebles = 0;
      for (const entry of Object.values(this.trebleRateTotals)) {
        darts += entry.darts;
        trebles += entry.trebles;
      }
      return darts >= MIN_TARGET_SAMPLE ? trebles / darts : null;
    },

    /** Hits under a `NUMBER:n` aim, split by ring, read from `confusion`'s single bucket (phase-4 decision 9). `[]` for any other aim zone. */
    ringSplit(
      aim: string,
    ): { ring: (typeof NUMBER_AIM_RINGS)[number]; count: number }[] {
      const parsed = parseTargetKey(aim);
      if (parsed === null || parsed.zone !== "NUMBER") return [];
      const series = this.sections.confusion as
        CachedSeries<ConfusionMetrics> | undefined;
      const landings = series?.buckets[0]?.metrics[aim] ?? {};
      return NUMBER_AIM_RINGS.map((ring) => ({
        ring,
        count: landings[`${ring}:${parsed.number}`] ?? 0,
      }));
    },

    /** The count of sessions a server-computed section's fold could not replay, or `0` before it has loaded. */
    skippedSessionsFor(sectionId: SectionId): number {
      const series = this.sections[sectionId] as
        CachedSeries<unknown> | undefined;
      return series?.skippedSessions ?? 0;
    },

    /** The config groups `atc-darts-per-target` has data for, across every loaded bucket. */
    get atcConfigGroups(): string[] {
      const series = this.sections["atc-darts-per-target"] as
        CachedSeries<AtcDartsPerTargetMetrics> | undefined;
      const keys = new Set<string>();
      for (const b of series?.buckets ?? []) {
        for (const key of Object.keys(b.metrics)) keys.add(key);
      }
      return Array.from(keys).sort();
    },

    /** `atc-darts-per-target`'s darts-per-target for every aim in `group`, sorted along the path (target number ascending); `dartsPerTarget` is `null` for a target never cleared. */
    dartsPerTargetForGroup(group: string): {
      targetKey: string;
      darts: number;
      cleared: number;
      dartsPerTarget: number | null;
    }[] {
      const series = this.sections["atc-darts-per-target"] as
        CachedSeries<AtcDartsPerTargetMetrics> | undefined;
      const totals = sumAtcTargets(series, group);
      return Array.from(totals.entries())
        .map(([targetKey, t]) => ({
          targetKey,
          darts: t.darts,
          cleared: t.cleared,
          dartsPerTarget: t.cleared > 0 ? t.darts / t.cleared : null,
        }))
        .sort(
          (a, b) =>
            (parseTargetKey(a.targetKey)?.number ?? 0) -
            (parseTargetKey(b.targetKey)?.number ?? 0),
        );
    },

    /** The `n` slowest targets in `group` by darts/cleared, descending, among targets cleared at least once (phase-4 decision 14). */
    slowestTargets(
      group: string,
      n: number,
    ): {
      targetKey: string;
      darts: number;
      cleared: number;
      dartsPerTarget: number;
    }[] {
      const series = this.sections["atc-darts-per-target"] as
        CachedSeries<AtcDartsPerTargetMetrics> | undefined;
      const totals = sumAtcTargets(series, group);
      return Array.from(totals.entries())
        .filter(([, t]) => t.cleared >= 1)
        .map(([targetKey, t]) => ({
          targetKey,
          darts: t.darts,
          cleared: t.cleared,
          dartsPerTarget: t.darts / t.cleared,
        }))
        .sort((a, b) => b.dartsPerTarget - a.dartsPerTarget)
        .slice(0, n);
    },

    /** The config groups `bobs27-survival` has data for, across every loaded bucket. */
    get bobs27ConfigGroups(): string[] {
      const series = this.sections["bobs27-survival"] as
        CachedSeries<Bobs27SurvivalMetrics> | undefined;
      const keys = new Set<string>();
      for (const b of series?.buckets ?? []) {
        for (const key of Object.keys(b.metrics)) keys.add(key);
      }
      return Array.from(keys).sort();
    },

    /** `bobs27-survival`'s survival curve for one config group: `reached` runs and the average running score, along the path's own D1..BULL order (phase-4 decision 15). Every path position is present, `0`/`null` where the group has no data for it. */
    survivalCurve(
      group: string,
    ): { targetKey: string; reached: number; averageScore: number | null }[] {
      const series = this.sections["bobs27-survival"] as
        CachedSeries<Bobs27SurvivalMetrics> | undefined;

      const reached = new Map<string, number>();
      const scoreAfter = new Map<string, { runs: number; sum: number }>();
      for (const b of series?.buckets ?? []) {
        const g = b.metrics[group];
        if (!g) continue;
        for (const [targetKey, count] of Object.entries(g.reached)) {
          reached.set(targetKey, (reached.get(targetKey) ?? 0) + count);
        }
        for (const [targetKey, s] of Object.entries(g.scoreAfter)) {
          const existing = scoreAfter.get(targetKey) ?? { runs: 0, sum: 0 };
          existing.runs += s.runs;
          existing.sum += s.sum;
          scoreAfter.set(targetKey, existing);
        }
      }

      return BOBS27_PATH_KEYS.map((targetKey) => {
        const scoreEntry = scoreAfter.get(targetKey);
        return {
          targetKey,
          reached: reached.get(targetKey) ?? 0,
          averageScore:
            scoreEntry && scoreEntry.runs > 0
              ? scoreEntry.sum / scoreEntry.runs
              : null,
        };
      });
    },

    /** The target `bobs27-survival` runs die at most often in `group`, or `null` without any resolved run yet. */
    bobs27DeadliestTarget(
      group: string,
    ): { targetKey: string; died: number } | null {
      const series = this.sections["bobs27-survival"] as
        CachedSeries<Bobs27SurvivalMetrics> | undefined;
      const died = new Map<string, number>();
      for (const b of series?.buckets ?? []) {
        const g = b.metrics[group];
        if (!g) continue;
        for (const [targetKey, count] of Object.entries(g.died)) {
          died.set(targetKey, (died.get(targetKey) ?? 0) + count);
        }
      }
      if (died.size === 0) return null;
      const [targetKey, count] = Array.from(died.entries()).reduce(
        (best, entry) => (entry[1] > best[1] ? entry : best),
      );
      return { targetKey, died: count };
    },

    /** The average running score across every resolved Bob's 27 visit in `group`, or `null` without one. */
    bobs27AverageScore(group: string): number | null {
      const series = this.sections["bobs27-survival"] as
        CachedSeries<Bobs27SurvivalMetrics> | undefined;
      let sum = 0;
      let runs = 0;
      for (const b of series?.buckets ?? []) {
        const g = b.metrics[group];
        if (!g) continue;
        for (const s of Object.values(g.scoreAfter)) {
          sum += s.sum;
          runs += s.runs;
        }
      }
      return runs === 0 ? null : sum / runs;
    },

    /** `shanghai-count`'s Shanghai rate per bucket, for the trend line — `null` below `MIN_TARGET_SAMPLE` sessions. */
    get shanghaiRateTrend(): { start: string; rate: number | null }[] {
      const series = this.sections["shanghai-count"] as
        CachedSeries<ShanghaiCountMetrics> | undefined;
      if (!series) return [];
      return series.buckets.map((b) => ({
        start: b.start,
        rate:
          b.metrics.sessions >= MIN_TARGET_SAMPLE
            ? b.metrics.shanghais / b.metrics.sessions
            : null,
      }));
    },

    /** `shanghai-count`'s round histogram, summed across every loaded bucket, sorted by round. */
    get shanghaiByRound(): { round: number; count: number }[] {
      const series = this.sections["shanghai-count"] as
        CachedSeries<ShanghaiCountMetrics> | undefined;
      if (!series) return [];
      const totals = new Map<number, number>();
      for (const b of series.buckets) {
        for (const [key, count] of Object.entries(b.metrics.byRound)) {
          const round = Number(key);
          totals.set(round, (totals.get(round) ?? 0) + count);
        }
      }
      return Array.from(totals.entries())
        .sort(([a], [b]) => a - b)
        .map(([round, count]) => ({ round, count }));
    },

    /**
     * Shanghai's points-per-round headline (`01-Section-Catalog.md` §2.1):
     * `session-result`'s `countedScoreSum / turnSum` across every loaded
     * ruleset version. Reads `turns.total_score`, which a resolved Shanghai
     * visit stores as its counted change to the running total, Hard-mode
     * halving included (D376). `null` without any turns.
     */
    get pointsPerRound(): number | null {
      const series = this.sections["session-result"] as
        CachedSeries<SessionResultMetrics> | undefined;
      if (!series) return null;
      let scoreSum = 0;
      let turnSum = 0;
      for (const b of series.buckets) {
        for (const m of Object.values(b.metrics)) {
          scoreSum += m.countedScoreSum;
          turnSum += m.turnSum;
        }
      }
      return turnSum === 0 ? null : scoreSum / turnSum;
    },
  };
}
