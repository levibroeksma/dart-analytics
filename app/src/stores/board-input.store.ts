import type { PersistFactory } from "@alpinejs/persist";
import type { Handedness } from "@modules/types";

/**
 * The player's throwing hand, read by `boardInputData()` and passed into
 * `boardInput()` so the magnifier opens on the side away from the throwing
 * hand instead of picking a fixed default and flipping only once a press
 * nears the viewport edge. A per-device rendering preference, not gameplay
 * data, so it stays in `$persist` rather than round-tripping through
 * `player_settings`.
 *
 * @param persist - Must return a fresh Alpine `$persist` instance per call
 *   (D120).
 */
export function boardInputStore(persist: PersistFactory) {
  return {
    handedness: persist()<Handedness>("RIGHT").as("boardInput.handedness"),
  };
}
