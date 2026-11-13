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

/**
 * The 501 `/statistics` "Variations" picker's options: the owner's starting
 * scores with their completed-session counts, `501` first. The pick lives in
 * the page scope's `variation`, remembered through `$store.statsVariation`;
 * a remembered score absent from the list, or a game change, resets it to 501.
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
      this.options = await readOptions(this.$data.game).catch(() => [
        { value: DEFAULT_VARIATION, label: String(DEFAULT_VARIATION) },
      ]);
      this.loading = false;
      const listed = this.options.some((o) => o.value === this.$data.variation);
      if (!listed) this.$data.variation = DEFAULT_VARIATION;
    },
  };
}
