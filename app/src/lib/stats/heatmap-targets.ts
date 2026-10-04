import { doublesPath, targetAt } from "@modules/game/board-progression.module";
import { doubleTargetIntent } from "@modules/game/turn-log.module";
import { formatTargetKey, targetLabel } from "./target-key";
import type { GameTypeKey } from "@lib/types";
import type { HeatmapTargetOption, IntentZoneKey, TargetKey } from "./types";

/** Game types whose `heatmap` takes a `target` (stored intent): the section offers a target picker. */
export const HEATMAP_TARGET_GAMES: ReadonlySet<string> = new Set([
  "DOUBLES_TRAINING",
  "BOBS27",
]);

/**
 * The doubles path (D1..D20, BULL) as stored-intent `TargetKey`s: Bob's 27's
 * own path and every target Doubles Training can aim at.
 */
export const DOUBLES_PATH_KEYS: readonly TargetKey[] = doublesPath().map(
  (_, index) => {
    const intent = doubleTargetIntent(targetAt(doublesPath(), index));
    return formatTargetKey(
      intent.intendedTargetNumber!,
      intent.intendedZoneKey as IntentZoneKey,
    );
  },
);

/** Picker options for a game type: empty when it has no picker, else "All targets" plus the doubles path. */
export function heatmapTargetOptions(
  gameTypeKey: GameTypeKey | undefined,
): HeatmapTargetOption[] {
  if (gameTypeKey === undefined || !HEATMAP_TARGET_GAMES.has(gameTypeKey)) {
    return [];
  }
  return [
    { value: null, label: "All targets" },
    ...DOUBLES_PATH_KEYS.map((key) => ({
      value: key,
      label: targetLabel(key),
    })),
  ];
}
