import {
  averageDeltaPercent,
  foldAverages,
} from "@lib/stats/sections/score-trend-window";
import { formatPointDelta, formatRate } from "@lib/stats/x01/format";
import {
  fetchBestLeg,
  fetchOverviewSections,
} from "@lib/stats/x01/overview-fetch";
import {
  bustRate,
  checkoutRate,
  dartsPerLeg,
  pointDelta,
} from "@lib/stats/x01/summaries";
import type { SplitPeriods, TrendRangeKey } from "@lib/types";
import type {
  BestLeg,
  BustRateMetrics,
  CheckoutRateMetrics,
  LegStatsMetrics,
  ScoringTrendMetrics,
} from "@modules/types";

type PageHost = { page: { rangeKey: TrendRangeKey; variation: number } };

type WatchesPage = {
  $watch(key: "rangeKey" | "variation", callback: () => void): void;
  load(): Promise<void>;
  loadBestLeg(): Promise<void>;
};

const DASH = "—";

function emptyPeriods<M>(): SplitPeriods<M> {
  return { current: [], previous: [] };
}

function initialOverview() {
  return {
    loading: true,
    failed: [] as string[],
    bestLegLoading: true,
    bestLegFailed: false,
    hasPrevious: false,
    ticket: 0,
    bestTicket: 0,
    scoring: emptyPeriods<ScoringTrendMetrics>(),
    checkout: emptyPeriods<CheckoutRateMetrics>(),
    bust: emptyPeriods<BustRateMetrics>(),
    legs: emptyPeriods<LegStatsMetrics>(),
    bestLeg: null as BestLeg | null,
  };
}

type Overview = ReturnType<typeof initialOverview> & PageHost;

const overviewMethods = {
  init(this: WatchesPage) {
    this.$watch("rangeKey", () => void this.load());
    this.$watch("variation", () => {
      void this.load();
      void this.loadBestLeg();
    });
    void this.load();
    void this.loadBestLeg();
  },

  async load(this: Overview, now: Date = new Date()) {
    const mine = ++this.ticket;
    this.loading = true;
    this.failed = [];
    const { rangeKey, variation } = this.page;
    const sections = await fetchOverviewSections(rangeKey, variation, now);
    if (mine !== this.ticket) return;
    this.scoring = sections.scoring;
    this.checkout = sections.checkout;
    this.bust = sections.bust;
    this.legs = sections.legs;
    this.hasPrevious = sections.hasPrevious;
    this.failed = sections.failed;
    this.loading = false;
  },

  async loadBestLeg(this: Overview, now: Date = new Date()) {
    const mine = ++this.bestTicket;
    this.bestLegLoading = true;
    this.bestLegFailed = false;
    try {
      const best = await fetchBestLeg(this.page.variation, now);
      if (mine !== this.bestTicket) return;
      this.bestLeg = best;
    } catch {
      if (mine !== this.bestTicket) return;
      this.bestLeg = null;
      this.bestLegFailed = true;
    } finally {
      if (mine === this.bestTicket) this.bestLegLoading = false;
    }
  },
};

const view = (host: unknown) => host as Overview;

const overviewGetters = {
  get page(): PageHost["page"] {
    return (this as unknown as { $data: PageHost["page"] }).$data;
  },
  get error(): string | null {
    const o = view(this);
    const names = o.bestLegFailed ? [...o.failed, "best leg"] : o.failed;
    return names.length === 0 ? null : `Could not load: ${names.join(", ")}`;
  },
  get threeDart(): number | null {
    return foldAverages(view(this).scoring.current).threeDart;
  },
  get threeDartDelta(): number | null {
    const o = view(this);
    return averageDeltaPercent(
      this.threeDart,
      o.hasPrevious ? foldAverages(o.scoring.previous).threeDart : null,
    );
  },
  get firstNine(): number | null {
    return foldAverages(view(this).scoring.current).firstNine;
  },
  get firstNineDelta(): number | null {
    const o = view(this);
    return averageDeltaPercent(
      this.firstNine,
      o.hasPrevious ? foldAverages(o.scoring.previous).firstNine : null,
    );
  },
  get legAverage(): number | null {
    return dartsPerLeg(view(this).legs.current);
  },
  get legAverageDelta(): number | null {
    const o = view(this);
    return averageDeltaPercent(
      this.legAverage,
      o.hasPrevious ? dartsPerLeg(o.legs.previous) : null,
    );
  },
  get checkoutValue(): string {
    return formatRate(checkoutRate(view(this).checkout.current).rate);
  },
  get checkoutDelta(): number | null {
    const o = view(this);
    if (o.loading || !o.hasPrevious) return null;
    return pointDelta(
      checkoutRate(o.checkout.current),
      checkoutRate(o.checkout.previous),
    );
  },
  get checkoutHint(): string {
    return formatPointDelta(this.checkoutDelta);
  },
  get bustValue(): string {
    return formatRate(bustRate(view(this).bust.current).rate);
  },
  get bustDelta(): number | null {
    const o = view(this);
    if (o.loading || !o.hasPrevious) return null;
    return pointDelta(bustRate(o.bust.current), bustRate(o.bust.previous));
  },
  get bustHint(): string {
    return formatPointDelta(this.bustDelta);
  },
  get bestLegValue(): string {
    const best = view(this).bestLeg;
    return best === null ? DASH : String(best.darts);
  },
  get bestLegSessionId(): string | null {
    const o = view(this);
    return o.bestLegLoading ? null : (o.bestLeg?.sessionId ?? null);
  },
  get isEmpty(): boolean {
    return this.threeDart === null;
  },
};

/**
 * The 501 page's averages row and tiles: values derived from the four
 * overview reads (`fetchOverviewSections`) and the all-time best leg
 * (`fetchBestLeg`), each current against the preceding period. A failed read
 * leaves its values at a dash and is named in `error`; the others still render.
 */
export function x01Overview() {
  return Object.defineProperties(
    { ...initialOverview(), ...overviewMethods },
    Object.getOwnPropertyDescriptors(overviewGetters),
  ) as ReturnType<typeof initialOverview> &
    typeof overviewMethods &
    typeof overviewGetters;
}
