import { BOARD_RADII_MM } from "@lib/game/board/board-geometry.module";
import { GAME_TYPE_BY_RULESET } from "@lib/game/rulesets/capabilities";
import {
  RESULT_DIRECTION,
  SECTIONS,
  sectionsForGame,
} from "@lib/stats/section-registry";
import { MIN_TARGET_SAMPLE } from "@lib/stats/constants";
import { parseTargetKey } from "@lib/stats/target-key";
import { checkoutPathFor } from "@modules/game/checkout-path.module";
import { groupingSummary } from "@modules/stats/sections/grouping.module";
import { fetchGameSection, fetchGameSessions } from "@client/api/statistics";
import { readSection, readSessionPage } from "@client/stats-cache/cache";
import type {
  BustRateMetrics,
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
  TargetAccuracyMetrics,
  TrebleRateMetrics,
  VolumeMetrics,
} from "@modules/types";
import type { GameSessionListResponseData } from "@client/api/types";
import type {
  GameTypeKey,
  RulesetVersionKey,
  SectionId,
  SeriesBucket,
  TargetKey,
} from "@lib/types";
import type { CachedSeries } from "@client/types";

/**
 * A synthetic, browser-scoped player identity for the IndexedDB cache's
 * keys. The client never learns its own DB `player_id` — every request is
 * scoped server-side to `auth.playerId` — and the cache is wiped wholesale
 * on sign-out (`auth.store.ts`), so a constant key is safe: it never needs
 * to distinguish accounts sharing a browser.
 */
const CACHE_PLAYER_ID = "me";

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

function defaultRange() {
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
 * Game statistics page state: the completion, volume and session-result
 * sections plus the session list, all read through the IndexedDB cache
 * (`10-Statistics/00-Overview.md` §7). Registered through
 * `Alpine.store("gameStats", gameStatsStore())`, so `init()` is the
 * sanctioned hydration hook — `x-init` is forbidden repo-wide.
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
    heatmapTarget: null as TargetKey | null,

    async init() {
      await this.load();
    },

    /** Resolves the picked ruleset version to its game type, then reloads. */
    selectGame(rulesetVersionKey: string) {
      const gameTypeKey =
        GAME_TYPE_BY_RULESET[rulesetVersionKey as RulesetVersionKey];
      if (gameTypeKey === undefined) return;
      this.gameTypeKey = gameTypeKey;
      void this.load();
    },

    async load() {
      this.loading = true;
      this.error = null;
      try {
        const gameTypeKey = this.gameTypeKey;
        const query = {
          ...this.range,
          context: "all" as const,
          inputMode: "VISUAL_BOARD",
        };

        const allIds = sectionsForGame(gameTypeKey);
        const ids = allIds.filter((id) => id !== "checkout-path");
        const results = await Promise.all(
          ids.map((id) =>
            readSection<unknown>(
              CACHE_PLAYER_ID,
              gameTypeKey,
              SECTIONS[id],
              query,
              (span) =>
                fetchGameSection(gameTypeKey, id, {
                  ...this.range,
                  ...span,
                }) as Promise<CachedSeries<unknown>>,
            ),
          ),
        );
        const sections: Partial<Record<SectionId, SectionView>> = {};
        ids.forEach((id, index) => {
          sections[id] = results[index];
        });
        if (allIds.includes("checkout-path")) {
          sections["checkout-path"] = await this.fetchCheckoutPath(gameTypeKey);
        }
        this.sections = sections;

        const page = await readSessionPage<
          GameSessionListResponseData["items"][number]
        >(CACHE_PLAYER_ID, gameTypeKey, query, () =>
          fetchGameSessions(gameTypeKey, { ...this.range, limit: 25 }),
        );
        this.sessions = page.items;
        this.nextCursor = page.nextCursor;
      } catch (cause) {
        this.error = cause instanceof Error ? cause.message : "load failed";
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
        gameTypeKey,
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
      const query = {
        ...this.range,
        context: "all" as const,
        inputMode: "VISUAL_BOARD",
        target,
      };
      const result = await readSection<HeatmapMetrics>(
        CACHE_PLAYER_ID,
        gameTypeKey,
        SECTIONS.heatmap,
        query,
        (span) =>
          fetchGameSection(gameTypeKey, "heatmap", {
            ...this.range,
            ...span,
            target,
          }) as Promise<CachedSeries<HeatmapMetrics>>,
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
      >(CACHE_PLAYER_ID, gameTypeKey, query, () =>
        fetchGameSessions(gameTypeKey, { ...this.range, limit: 25, cursor }),
      );
      this.sessions = [...this.sessions, ...page.items];
      this.nextCursor = page.nextCursor;
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

    /** `scoring-trend`'s per-bucket averages, for the trend line. */
    get scoringTrendRows(): {
      start: string;
      threeDartAverage: number | null;
      firstNineAverage: number | null;
    }[] {
      const series = this.sections["scoring-trend"] as
        CachedSeries<ScoringTrendMetrics> | undefined;
      if (!series) return [];
      return series.buckets.map((b) => ({
        start: b.start,
        threeDartAverage:
          b.metrics.darts === 0
            ? null
            : (b.metrics.points / b.metrics.darts) * 3,
        firstNineAverage:
          b.metrics.firstNineDarts === 0
            ? null
            : (b.metrics.firstNinePoints / b.metrics.firstNineDarts) * 3,
      }));
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
  };
}
