import { loadGameSection } from "@lib/stats/load-game-section";
import {
  averageDeltaPercent,
  foldAverages,
  personalBestWindow,
  trendWindow,
} from "@lib/stats/sections/score-trend-window";
import { variationParam } from "@lib/stats/variation";
import { formatPointDelta, formatRate } from "@lib/stats/x01/format";
import { splitByBoundary } from "@lib/stats/x01/periods";
import {
  bestLegOf,
  bustRate,
  checkoutRate,
  dartsPerLeg,
  pointDelta,
} from "@lib/stats/x01/summaries";
import type { SectionId, SeriesBucket, TrendRangeKey } from "@lib/types";
import type {
  BestLeg,
  BustRateMetrics,
  CheckoutRateMetrics,
  LegStatsMetrics,
  ScoringTrendMetrics,
} from "@modules/types";

type PageScope = {
  $data: { rangeKey: TrendRangeKey; variation: number };
};

type WatchesPage = {
  $watch(key: "rangeKey" | "variation" | "game", callback: () => void): void;
  load(): Promise<void>;
  loadBestLeg(): Promise<void>;
};

type Periods<M> = { current: SeriesBucket<M>[]; previous: SeriesBucket<M>[] };

const DASH = "—";

function empty<M>(): Periods<M> {
  return { current: [], previous: [] };
}

function localTz(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** The section ids the factory reads, with the name shown when one fails. */
const SECTION_NAMES: Record<string, string> = {
  "scoring-trend": "averages",
  "checkout-rate": "checkout",
  "bust-rate": "bust",
  "leg-stats": "darts per leg",
};

/**
 * The 501 page's averages row and tiles. `scoring-trend` (sql) is one bucketed
 * request over the doubled `trendWindow`, split at its boundary. The three
 * server-computed sections (`checkout-rate`, `bust-rate`, `leg-stats`) are two
 * unbucketed requests, the current and the preceding window, because the cache
 * chunks a server section by its bucket unit and a day-bucketed doubled window
 * would be one request per day per section. Best leg is one all-time
 * unbucketed `leg-stats` request. Every request carries the page-level
 * variation. A failed read leaves its values at a dash and is named in
 * `error`; the others still render.
 */
export function x01Overview() {
  let ticket = 0;
  let bestTicket = 0;
  return {
    loading: true,
    failed: [] as string[],
    bestLegLoading: true,
    bestLegFailed: false,
    hasPrevious: false,
    scoring: empty<ScoringTrendMetrics>(),
    checkout: empty<CheckoutRateMetrics>(),
    bust: empty<BustRateMetrics>(),
    legs: empty<LegStatsMetrics>(),
    bestLeg: null as BestLeg | null,

    get page(): PageScope["$data"] {
      return (this as unknown as PageScope).$data;
    },

    get error(): string | null {
      const names = this.bestLegFailed
        ? [...this.failed, "best leg"]
        : this.failed;
      return names.length === 0 ? null : `Could not load: ${names.join(", ")}`;
    },

    init(this: WatchesPage) {
      this.$watch("rangeKey", () => void this.load());
      this.$watch("variation", () => {
        void this.load();
        void this.loadBestLeg();
      });
      void this.load();
      void this.loadBestLeg();
    },

    async load(now: Date = new Date()) {
      const mine = ++ticket;
      this.loading = true;
      this.failed = [];
      const tz = localTz();
      const window = trendWindow(this.page.rangeKey, now, tz);
      const variation = variationParam("501", this.page.variation);
      const current = { from: window.boundary ?? window.from, to: window.to };
      const previous =
        window.boundary === null
          ? null
          : { from: window.from, to: window.boundary };
      const scoring = () =>
        loadGameSection<ScoringTrendMetrics>("501", "scoring-trend", {
          from: window.from,
          to: window.to,
          bucket: window.bucket,
          tz,
          variation,
        }).then((series) => splitByBoundary(series.buckets, window.boundary));
      const unbucketed = <M>(
        id: SectionId,
        range: { from: string; to: string },
      ) =>
        loadGameSection<M>("501", id, {
          ...range,
          bucket: "none",
          tz,
          variation,
        }).then((series) => series.buckets);
      const periods = <M>(id: SectionId) =>
        Promise.all([
          unbucketed<M>(id, current),
          previous === null ? [] : unbucketed<M>(id, previous),
        ]).then(([cur, prev]): Periods<M> => ({
          current: cur,
          previous: prev,
        }));
      const results = await Promise.allSettled([
        scoring(),
        periods<CheckoutRateMetrics>("checkout-rate"),
        periods<BustRateMetrics>("bust-rate"),
        periods<LegStatsMetrics>("leg-stats"),
      ]);
      if (mine !== ticket) return;
      const ids = Object.keys(SECTION_NAMES);
      this.failed = ids
        .filter((_, i) => results[i].status === "rejected")
        .map((id) => SECTION_NAMES[id]);
      const value = <M>(i: number) => {
        const result = results[i];
        return result.status === "fulfilled"
          ? (result.value as Periods<M>)
          : empty<M>();
      };
      this.scoring = value<ScoringTrendMetrics>(0);
      this.checkout = value<CheckoutRateMetrics>(1);
      this.bust = value<BustRateMetrics>(2);
      this.legs = value<LegStatsMetrics>(3);
      this.hasPrevious = window.boundary !== null;
      this.loading = false;
    },

    async loadBestLeg(now: Date = new Date()) {
      const mine = ++bestTicket;
      this.bestLegLoading = true;
      this.bestLegFailed = false;
      try {
        const series = await loadGameSection<LegStatsMetrics>(
          "501",
          "leg-stats",
          {
            ...personalBestWindow(now),
            variation: variationParam("501", this.page.variation),
          },
        );
        if (mine !== bestTicket) return;
        this.bestLeg = bestLegOf(series.buckets);
      } catch {
        if (mine !== bestTicket) return;
        this.bestLeg = null;
        this.bestLegFailed = true;
      } finally {
        if (mine === bestTicket) this.bestLegLoading = false;
      }
    },

    get threeDart(): number | null {
      return foldAverages(this.scoring.current).threeDart;
    },
    get threeDartDelta(): number | null {
      return averageDeltaPercent(
        this.threeDart,
        this.hasPrevious ? foldAverages(this.scoring.previous).threeDart : null,
      );
    },
    get firstNine(): number | null {
      return foldAverages(this.scoring.current).firstNine;
    },
    get firstNineDelta(): number | null {
      return averageDeltaPercent(
        this.firstNine,
        this.hasPrevious ? foldAverages(this.scoring.previous).firstNine : null,
      );
    },
    get legAverage(): number | null {
      return dartsPerLeg(this.legs.current);
    },
    get legAverageDelta(): number | null {
      return averageDeltaPercent(
        this.legAverage,
        this.hasPrevious ? dartsPerLeg(this.legs.previous) : null,
      );
    },

    get checkoutValue(): string {
      return formatRate(checkoutRate(this.checkout.current).rate);
    },
    get checkoutDelta(): number | null {
      if (this.loading || !this.hasPrevious) return null;
      return pointDelta(
        checkoutRate(this.checkout.current),
        checkoutRate(this.checkout.previous),
      );
    },
    get checkoutHint(): string {
      return formatPointDelta(this.checkoutDelta);
    },
    get bustValue(): string {
      return formatRate(bustRate(this.bust.current).rate);
    },
    get bustDelta(): number | null {
      if (this.loading || !this.hasPrevious) return null;
      return pointDelta(
        bustRate(this.bust.current),
        bustRate(this.bust.previous),
      );
    },
    get bustHint(): string {
      return formatPointDelta(this.bustDelta);
    },

    get bestLegValue(): string {
      return this.bestLeg === null ? DASH : String(this.bestLeg.darts);
    },
    get bestLegSessionId(): string | null {
      return this.bestLegLoading ? null : (this.bestLeg?.sessionId ?? null);
    },

    get isEmpty(): boolean {
      return this.threeDart === null;
    },
  };
}
