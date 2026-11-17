import {
  doublesTrainingCaption,
  doublesTrainingHeadline,
  doublesTrainingTable,
} from "@lib/stats/doubles/doubles-training-lines";
import {
  EMPTY_CARD,
  loadDoublesTrainingCard,
} from "@lib/stats/doubles/doubles-training-fetch";
import { reloadOnPageFilters } from "@lib/stats/sections/period-section";
import type {
  AimTableRow,
  DoublesTrainingCard,
  TrendRangeKey,
} from "@lib/types";

type CardScope = {
  $data: { rangeKey: TrendRangeKey; game: string; variation: number };
  loading: boolean;
  error: string | null;
  card: DoublesTrainingCard;
};

/** Alpine scope of the Doubles Training card: `target-accuracy`, `miss-direction` and `loose-darts` over the page period, joined into one card. */
export function doublesTrainingCardSection() {
  let ticket = 0;
  return {
    loading: true,
    error: null as string | null,
    card: EMPTY_CARD,

    init(this: Parameters<typeof reloadOnPageFilters>[0]) {
      reloadOnPageFilters(this);
      void this.load();
    },

    async load(this: CardScope, now: Date = new Date()) {
      const mine = ++ticket;
      this.loading = true;
      this.error = null;
      const result = await loadDoublesTrainingCard(this.$data, now);
      if (mine !== ticket) return;
      this.card = result.card;
      this.error = result.error;
      this.loading = false;
    },

    get headline(): string {
      return doublesTrainingHeadline(this.card);
    },

    get caption(): string {
      return doublesTrainingCaption(this.card);
    },

    get table(): AimTableRow[] {
      return doublesTrainingTable(this.card);
    },
  };
}
