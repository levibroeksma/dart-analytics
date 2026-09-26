import { BOARD_RADII_MM } from "@lib/game/board/board-geometry.module";
import { GAME_TYPE_BY_RULESET } from "@lib/game/rulesets/capabilities";
import {
  RESULT_DIRECTION,
  SECTIONS,
  sectionsForGame,
} from "@lib/stats/section-registry";
import { MIN_TARGET_SAMPLE } from "@lib/stats/constants";
import { parseTargetKey } from "@lib/stats/target-key";
import { groupingSummary } from "@modules/stats/sections/grouping.module";
import { fetchGameSection, fetchGameSessions } from "@client/api/statistics";
import { readSection, readSessionPage } from "@client/stats-cache/cache";
import type {
  CompletionMetrics,
  ConfusionMetrics,
  GroupingMetrics,
  GroupingMoment,
  HeatmapMetrics,
  LooseDartsMetrics,
  MissDirectionMetrics,
  SessionResultMetrics,
  TargetAccuracyMetrics,
  VolumeMetrics,
} from "@modules/types";
import type { GameSessionListResponseData } from "@client/api/types";
import type {
  GameTypeKey,
  RulesetVersionKey,
  SectionId,
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

        const ids = sectionsForGame(gameTypeKey);
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
  };
}
