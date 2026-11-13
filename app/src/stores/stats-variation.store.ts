import type { PersistFactory } from "@alpinejs/persist";

/**
 * The 501 statistics page's picked variation (a starting score), read into
 * the page scope and written back by `gameVariations()`. A per-viewer
 * convenience, so it stays in `$persist`; a remembered score absent from the
 * owner's list falls back to 501.
 *
 * @param persist - Must return a fresh Alpine `$persist` instance per call
 *   (D120).
 */
export function statsVariationStore(persist: PersistFactory) {
  return {
    value: persist()<number>(501).as("statsVariation.value"),

    set(score: number): void {
      this.value = score;
    },
  };
}
