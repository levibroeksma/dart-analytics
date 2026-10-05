import { GAME_TYPE_BY_RULESET } from "@lib/game/rulesets/capabilities";
import { fetchGameSessions } from "@client/api/statistics";
import { readSessionPage } from "@client/stats-cache/cache";
import { CACHE_PLAYER_ID } from "@lib/stats/load-game-section";
import { gameScopeKey } from "@modules/stats/routine-scope.module";
import { heatmapWindow } from "@lib/stats/sections/score-trend-window";
import { sessionRow } from "@lib/stats/sections/score-summaries";
import type { GameSessionListResponseData } from "@client/api/types";
import type { RulesetVersionKey, TrendRangeKey } from "@lib/types";

type SessionListItem = GameSessionListResponseData["items"][number];
type SessionRow = ReturnType<typeof sessionRow>;

type PageScope = { $data: { rangeKey: TrendRangeKey; game: string } };

type WatchesRange = {
  $watch(key: "rangeKey" | "game", callback: () => void): void;
  load(): Promise<void>;
};

const PAGE_SIZE = 10;

function localTz(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * The replay section of a game's `/statistics` layout: the completed sessions
 * of the page-level game and period, newest first, 10 per page through the
 * IndexedDB cache, each a card that grows into its replay. The list endpoint leaves out
 * sessions with no darts. Pages are walked with `next()` and `previous()`; a
 * change of `rangeKey` or `game` reloads from the first page.
 */
export function gameSessionList() {
  let ticket = 0;
  let span = { from: "", to: "" };
  return {
    loading: true,
    error: null as string | null,
    items: [] as SessionListItem[],
    nextCursor: null as string | null,
    totalCount: null as number | null,
    pageIndex: 0,
    cursors: [undefined] as (string | undefined)[],

    get period(): TrendRangeKey {
      return (this as unknown as PageScope).$data.rangeKey;
    },

    init(this: WatchesRange) {
      this.$watch("rangeKey", () => void this.load());
      this.$watch("game", () => void this.load());
      void this.load();
    },

    get gameTypeKey() {
      const key = (this as unknown as PageScope).$data.game;
      return GAME_TYPE_BY_RULESET[key as RulesetVersionKey];
    },

    async fetchPage(cursor?: string) {
      const gameTypeKey = this.gameTypeKey;
      const params = {
        ...span,
        status: "completed" as const,
        limit: PAGE_SIZE,
      };
      return readSessionPage<SessionListItem>(
        CACHE_PLAYER_ID,
        `${gameScopeKey(gameTypeKey)}:counted`,
        {
          ...span,
          bucket: "none",
          context: "all",
          status: "completed",
          inputMode: "VISUAL_BOARD",
          cursor,
        },
        () =>
          fetchGameSessions(
            gameTypeKey,
            cursor === undefined ? params : { ...params, cursor },
          ),
        gameScopeKey(gameTypeKey),
      );
    },

    async load(now: Date = new Date()) {
      if (this.gameTypeKey === undefined) {
        this.items = [];
        this.nextCursor = null;
        this.totalCount = null;
        this.pageIndex = 0;
        this.loading = false;
        return;
      }
      span = heatmapWindow(this.period, now);
      this.cursors = [undefined];
      await this.goTo(0);
    },

    async goTo(index: number) {
      const mine = ++ticket;
      this.loading = true;
      this.error = null;
      try {
        const page = await this.fetchPage(this.cursors[index]);
        if (mine !== ticket) return;
        this.items = page.items;
        this.nextCursor = page.nextCursor;
        this.totalCount = page.totalCount ?? null;
        this.pageIndex = index;
        if (page.nextCursor !== null) this.cursors[index + 1] = page.nextCursor;
      } catch (cause) {
        if (mine !== ticket) return;
        this.error = cause instanceof Error ? cause.message : "load failed";
      } finally {
        if (mine === ticket) this.loading = false;
      }
    },

    async next() {
      if (this.hasNext && !this.loading) await this.goTo(this.pageIndex + 1);
    },

    async previous() {
      if (this.hasPrevious && !this.loading)
        await this.goTo(this.pageIndex - 1);
    },

    get rows() {
      const tz = localTz();
      return this.items.map((item) => sessionRow(item, tz));
    },

    /** Score Training rows carry a 3-dart average; other games' counted score is not comparable across sessions. */
    caption(row: SessionRow): string {
      const volume = `${row.darts} darts · ${row.minutes} min`;
      if (this.gameTypeKey !== "SCORE_TRAINING") return volume;
      return `${row.average === null ? "—" : row.average.toFixed(1)} avg · ${volume}`;
    },

    get hasNext(): boolean {
      return this.nextCursor !== null;
    },

    get hasPrevious(): boolean {
      return this.pageIndex > 0;
    },

    get pageNumber(): number {
      return this.pageIndex + 1;
    },

    get totalPages(): number | null {
      return this.totalCount === null
        ? null
        : Math.max(1, Math.ceil(this.totalCount / PAGE_SIZE));
    },

    get isEmpty(): boolean {
      return this.items.length === 0;
    },
  };
}
