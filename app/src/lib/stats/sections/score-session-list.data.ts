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

const PAGE_SIZE = 25;

function localTz(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Score Training's session-list section: the sessions of the page-level
 * period, newest first, 25 per page through the IndexedDB cache, each linking
 * to its replay. Reloads from the first page on every `rangeKey` change.
 */
export function scoreSessionList() {
  let ticket = 0;
  let span = { from: "", to: "" };
  return {
    loading: true,
    loadingMore: false,
    error: null as string | null,
    items: [] as SessionListItem[],
    nextCursor: null as string | null,

    get period(): TrendRangeKey {
      return (this as unknown as PageScope).$data.rangeKey;
    },

    init(this: WatchesRange) {
      this.$watch("rangeKey", () => void this.load());
      void this.load();
    },

    async fetchPage(cursor?: string) {
      const params = { ...span, limit: PAGE_SIZE };
      return readSessionPage<SessionListItem>(
        CACHE_PLAYER_ID,
        gameScopeKey("SCORE_TRAINING"),
        {
          ...span,
          bucket: "none",
          context: "all",
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
      const mine = ++ticket;
      this.loading = true;
      this.error = null;
      span = heatmapWindow(this.period, now);
      try {
        const page = await this.fetchPage();
        if (mine !== ticket) return;
        this.items = page.items;
        this.nextCursor = page.nextCursor;
      } catch (cause) {
        if (mine !== ticket) return;
        this.error = cause instanceof Error ? cause.message : "load failed";
      } finally {
        if (mine === ticket) this.loading = false;
      }
    },

    async loadMore() {
      const cursor = this.nextCursor;
      if (cursor === null || this.loadingMore) return;
      const mine = ticket;
      this.loadingMore = true;
      try {
        const page = await this.fetchPage(cursor);
        if (mine !== ticket) return;
        this.items = [...this.items, ...page.items];
        this.nextCursor = page.nextCursor;
      } catch (cause) {
        if (mine !== ticket) return;
        this.error = cause instanceof Error ? cause.message : "load failed";
      } finally {
        this.loadingMore = false;
      }
    },

    get rows() {
      const tz = localTz();
      return this.items.map((item) => sessionRow(item, tz));
    },

    get hasMore(): boolean {
      return this.nextCursor !== null;
    },

    get isEmpty(): boolean {
      return this.items.length === 0;
    },
  };
}
