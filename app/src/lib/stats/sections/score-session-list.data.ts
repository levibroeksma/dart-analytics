import { fetchGameSessions } from "@client/api/statistics";
import { readSessionPage } from "@client/stats-cache/cache";
import { CACHE_PLAYER_ID } from "@lib/stats/load-game-section";
import { gameScopeKey } from "@modules/stats/routine-scope.module";
import { heatmapWindow } from "@lib/stats/sections/score-trend-window";
import { sessionRow } from "@lib/stats/sections/score-summaries";
import type { GameSessionListResponseData } from "@client/api/types";
import type { TrendRangeKey } from "@lib/types";

type SessionListItem = GameSessionListResponseData["items"][number];

type PageScope = { $data: { rangeKey: TrendRangeKey } };

type WatchesRange = {
  $watch(key: "rangeKey", callback: () => void): void;
  load(): Promise<void>;
};

const PAGE_SIZE = 10;

function localTz(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Score Training's replay section: the completed sessions of the page-level
 * period, newest first, 10 per page through the IndexedDB cache, each linking
 * to its replay. Pages are walked with `next()` and `previous()`; a change of
 * `rangeKey` reloads from the first page.
 */
export function scoreSessionList() {
  let ticket = 0;
  let span = { from: "", to: "" };
  return {
    loading: true,
    error: null as string | null,
    items: [] as SessionListItem[],
    nextCursor: null as string | null,
    pageIndex: 0,
    cursors: [undefined] as (string | undefined)[],

    get period(): TrendRangeKey {
      return (this as unknown as PageScope).$data.rangeKey;
    },

    init(this: WatchesRange) {
      this.$watch("rangeKey", () => void this.load());
      void this.load();
    },

    async fetchPage(cursor?: string) {
      const params = {
        ...span,
        status: "completed" as const,
        limit: PAGE_SIZE,
      };
      return readSessionPage<SessionListItem>(
        CACHE_PLAYER_ID,
        gameScopeKey("SCORE_TRAINING"),
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
            "SCORE_TRAINING",
            cursor === undefined ? params : { ...params, cursor },
          ),
      );
    },

    async load(now: Date = new Date()) {
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

    get hasNext(): boolean {
      return this.nextCursor !== null;
    },

    get hasPrevious(): boolean {
      return this.pageIndex > 0;
    },

    get pageLabel(): string {
      return `Page ${this.pageIndex + 1}`;
    },

    get isEmpty(): boolean {
      return this.items.length === 0;
    },
  };
}
