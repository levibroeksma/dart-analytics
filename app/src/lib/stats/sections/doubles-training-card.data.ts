import {
  doublesTrainingCaption,
  doublesTrainingHeadline,
  doublesTrainingTable,
} from "@lib/stats/doubles/doubles-training-lines";
import {
  EMPTY_CARD,
  loadDoublesTrainingCard,
} from "@lib/stats/doubles/doubles-training-fetch";
import {
  latestCardLoad,
  reloadOnPageFilters,
} from "@lib/stats/sections/period-section";
import type { AimTableRow } from "@lib/types";

/** Alpine scope of the Doubles Training card: `target-accuracy`, `miss-direction` and `loose-darts` over the page period, joined into one card. */
export function doublesTrainingCardSection() {
  return {
    loading: true,
    error: null as string | null,
    card: EMPTY_CARD,

    init(this: Parameters<typeof reloadOnPageFilters>[0]) {
      reloadOnPageFilters(this);
      void this.load();
    },

    load: latestCardLoad((_game, rangeKey, now) =>
      loadDoublesTrainingCard(rangeKey, now),
    ),

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
