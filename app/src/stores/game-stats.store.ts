import { GAME_TYPE_BY_RULESET } from "@lib/game/rulesets/capabilities";
import {
  RESULT_DIRECTION,
  SECTIONS,
  sectionsForGame,
} from "@lib/stats/section-registry";
import { fetchGameSection, fetchGameSessions } from "@client/api/statistics";
import { readSection, readSessionPage } from "@client/stats-cache/cache";
import type {
  CompletionMetrics,
  SessionResultMetrics,
  VolumeMetrics,
} from "@modules/types";
import type { GameSessionListResponseData } from "@client/api/types";
import type { GameTypeKey, RulesetVersionKey, SectionId } from "@lib/types";
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
  };
}
