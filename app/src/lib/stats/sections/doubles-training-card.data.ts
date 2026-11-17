import { GAME_TYPE_BY_RULESET } from "@lib/game/rulesets/capabilities";
import { doublesTrainingCard } from "@lib/stats/doubles/doubles-training-card";
import { loadGameSection } from "@lib/stats/load-game-section";
import { reloadOnPageFilters } from "@lib/stats/sections/period-section";
import { heatmapWindow } from "@lib/stats/sections/score-trend-window";
import { variationParam } from "@lib/stats/variation";
import { formatRate } from "@lib/stats/x01/format";
import type {
  AimTableRow,
  DoublesTrainingCard,
  RulesetVersionKey,
  TrendRangeKey,
} from "@lib/types";
import type {
  LooseDartsMetrics,
  MissDirectionMetrics,
  TargetAccuracyMetrics,
} from "@modules/types";

type PageScope = {
  $data: { rangeKey: TrendRangeKey; game: string; variation: number };
};

const EMPTY: DoublesTrainingCard = { favourite: null, darts: 0, rows: [] };

/** Alpine scope of the Doubles Training card: `target-accuracy`, `miss-direction` and `loose-darts` over the page period, joined into one card. */
export function doublesTrainingCardSection() {
  let ticket = 0;
  return {
    loading: true,
    error: null as string | null,
    card: EMPTY,

    init(this: Parameters<typeof reloadOnPageFilters>[0]) {
      reloadOnPageFilters(this);
      void this.load();
    },

    async load(
      this: PageScope & {
        loading: boolean;
        error: string | null;
        card: DoublesTrainingCard;
      },
      now: Date = new Date(),
    ) {
      const mine = ++ticket;
      this.loading = true;
      this.error = null;
      this.card = EMPTY;
      const gameTypeKey =
        GAME_TYPE_BY_RULESET[this.$data.game as RulesetVersionKey];
      if (gameTypeKey === undefined) {
        this.loading = false;
        return;
      }
      try {
        const range = {
          ...heatmapWindow(this.$data.rangeKey, now),
          bucket: "none" as const,
          variation: variationParam(gameTypeKey, this.$data.variation),
        };
        const [accuracy, misses, loose] = await Promise.all([
          loadGameSection<TargetAccuracyMetrics>(
            gameTypeKey,
            "target-accuracy",
            range,
          ),
          loadGameSection<MissDirectionMetrics>(
            gameTypeKey,
            "miss-direction",
            range,
          ),
          loadGameSection<LooseDartsMetrics>(gameTypeKey, "loose-darts", range),
        ]);
        if (mine !== ticket) return;
        this.card = doublesTrainingCard({
          accuracy: accuracy.buckets,
          misses: misses.buckets,
          loose: loose.buckets,
        });
      } catch (cause) {
        if (mine !== ticket) return;
        this.error = cause instanceof Error ? cause.message : "load failed";
      } finally {
        if (mine === ticket) this.loading = false;
      }
    },

    get headline(): string {
      return formatRate(this.card.favourite?.rate ?? null);
    },

    get caption(): string {
      const favourite = this.card.favourite;
      return favourite === null
        ? "Not enough darts yet"
        : `Favourite ${favourite.label}, ${favourite.darts} darts`;
    },

    get table(): AimTableRow[] {
      return this.card.rows.map((row) => ({
        label: row.label,
        count: row.darts,
        cells: [
          formatRate(row.rate),
          `${row.left}/${row.right}`,
          `${row.high}/${row.low}`,
          `${row.inside}/${row.within}/${row.outside}`,
          `${row.nearMiss}/${row.loose}`,
        ],
      }));
    },
  };
}
