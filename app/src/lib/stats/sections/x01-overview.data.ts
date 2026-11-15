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

/**
 * The 501 page's averages row and tiles: scoring trend, checkout rate, bust
 * rate and darts per leg, each from one bucketed request over the doubled
 * `trendWindow` split into the current and preceding period, plus best leg
 * from one all-time unbucketed `leg-stats` request. Every request carries the
 * page-level variation. A failed section leaves its values at a dash and is
 * named in `error`; the others still render.
 */
export function x01Overview() {
  let ticket = 0;
  let bestTicket = 0;
  return {
    loading: true,
    error: null as string | null,
    bestLegLoading: true,
    hasPrevious: false,
    scoring: empty<ScoringTrendMetrics>(),
    checkout: empty<CheckoutRateMetrics>(),
    bust: empty<BustRateMetrics>(),
    legs: empty<LegStatsMetrics>(),
    bestLeg: null as BestLeg | null,

    get page(): PageScope["$data"] {
      return (this as unknown as PageScope).$data;
    },

    init(this: WatchesPage) {
      this.$watch("rangeKey", () => void this.load());
      for (const key of ["variation", "game"] as const)
        this.$watch(key, () => {
          void this.load();
          void this.loadBestLeg();
        });
      void this.load();
      void this.loadBestLeg();
    },

    async load(now: Date = new Date()) {
      const mine = ++ticket;
      this.loading = true;
      this.error = null;
      const tz = localTz();
      const window = trendWindow(this.page.rangeKey, now, tz);
      const variation = variationParam("501", this.page.variation);
      const fetchSection = <M>(id: SectionId) =>
        loadGameSection<M>("501", id, {
          from: window.from,
          to: window.to,
          bucket: window.bucket,
          tz,
          variation,
        }).then((series) => splitByBoundary(series.buckets, window.boundary));
      const results = await Promise.allSettled([
        fetchSection<ScoringTrendMetrics>("scoring-trend"),
        fetchSection<CheckoutRateMetrics>("checkout-rate"),
        fetchSection<BustRateMetrics>("bust-rate"),
        fetchSection<LegStatsMetrics>("leg-stats"),
      ]);
      if (mine !== ticket) return;
      const ids = ["scoring-trend", "checkout-rate", "bust-rate", "leg-stats"];
      const failed = ids.filter((_, i) => results[i].status === "rejected");
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
      this.error =
        failed.length === 0 ? null : `Could not load: ${failed.join(", ")}`;
      this.loading = false;
    },

    async loadBestLeg(now: Date = new Date()) {
      const mine = ++bestTicket;
      this.bestLegLoading = true;
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
    get checkoutHint(): string {
      if (this.loading || !this.hasPrevious) return "";
      return formatPointDelta(
        pointDelta(
          checkoutRate(this.checkout.current),
          checkoutRate(this.checkout.previous),
        ),
      );
    },
    get bustValue(): string {
      return formatRate(bustRate(this.bust.current).rate);
    },
    get bustHint(): string {
      if (this.loading || !this.hasPrevious) return "";
      return formatPointDelta(
        pointDelta(bustRate(this.bust.current), bustRate(this.bust.previous)),
      );
    },

    get bestLegValue(): string {
      return this.bestLeg === null ? DASH : String(this.bestLeg.darts);
    },
    get bestLegSessionId(): string | null {
      return this.bestLeg?.sessionId ?? null;
    },

    get isEmpty(): boolean {
      return this.threeDart === null;
    },
  };
}
