import { GAME_TYPE_BY_RULESET } from "@lib/game/rulesets/capabilities";
import { fetchGameVariations } from "@client/api/statistics";
import type { RulesetVersionKey } from "@lib/types";

type VariationOption = { value: number; label: string };

type VariationsScope = {
  $data: { game: string; variation: number };
  $store: { statsVariation: { set(score: number): void } };
  $watch(key: "variation", callback: (value: number) => void): void;
  $watch(key: "game", callback: () => void): void;
  options: VariationOption[];
  loading: boolean;
  load(): Promise<void>;
};

const DEFAULT_VARIATION = 501;

async function readOptions(game: string): Promise<VariationOption[]> {
  const gameTypeKey = GAME_TYPE_BY_RULESET[game as RulesetVersionKey];
  const { variations } = await fetchGameVariations(gameTypeKey);
  return variations.map((row) => ({
    value: row.startingScore,
    label: `${row.startingScore} (${row.sessions})`,
  }));
}

function keptOptions(
  options: VariationOption[],
  variation: number,
): VariationOption[] {
  return options.length > 0
    ? options
    : [{ value: variation, label: String(variation) }];
}

/**
 * The 501 `/statistics` "Variations" picker's options: the owner's starting
 * scores with their completed-session counts, `501` first. The pick lives in
 * the page scope's `variation`, remembered through `$store.statsVariation`;
 * a remembered score absent from the list, or a game change, resets it to 501.
 * A failed read keeps the pick and the options already shown.
 */
export function gameVariations() {
  return {
    options: [] as VariationOption[],
    loading: true,

    init(this: VariationsScope) {
      this.$watch("variation", (value) =>
        this.$store.statsVariation.set(value),
      );
      this.$watch("game", () => {
        this.$data.variation = DEFAULT_VARIATION;
        void this.load();
      });
      void this.load();
    },

    async load(this: VariationsScope) {
      this.loading = true;
      const options = await readOptions(this.$data.game).catch(() => null);
      this.loading = false;
      if (options === null) {
        this.options = keptOptions(this.options, this.$data.variation);
        return;
      }
      this.options = options;
      const listed = options.some((o) => o.value === this.$data.variation);
      if (!listed) this.$data.variation = DEFAULT_VARIATION;
    },
  };
}
