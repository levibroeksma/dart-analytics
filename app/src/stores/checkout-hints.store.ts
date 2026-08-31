import type { PersistFactory } from "@alpinejs/persist";

/**
 * Whether the play interface shows a suggested checkout route (501, 121,
 * TUOD). A per-device display preference, not gameplay data, so it stays in
 * $persist rather than round-tripping through player_settings — the same
 * reasoning `boardInputStore`'s handedness field documents.
 *
 * @param persist - Must return a fresh Alpine `$persist` instance per call
 *   (D120).
 */
export function checkoutHintsStore(persist: PersistFactory) {
  return {
    enabled: persist()<boolean>(true).as("checkoutHints.enabled"),
  };
}
