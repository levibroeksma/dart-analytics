import { doublesPath, targetAt } from "@modules/game/board-progression.module";
import { doubleTargetIntent } from "@modules/game/turn-log.module";
import { formatTargetKey, targetLabel } from "./target-key";
import type { GameTypeKey } from "@lib/types";
import type { HeatmapTargetOption, IntentZoneKey, TargetKey } from "./types";

/** Game types whose `heatmap` takes a `target` (stored intent, or derived by the fold): the section offers a target picker. */
export const HEATMAP_TARGET_GAMES: ReadonlySet<string> = new Set([
  "DOUBLES_TRAINING",
  "BOBS27",
  "SINGLES_TRAINING",
  "SHANGHAI",
  "AROUND_THE_CLOCK",
]);

const NUMBER_KEYS: readonly TargetKey[] = Array.from({ length: 20 }, (_, i) =>
  formatTargetKey(i + 1, "NUMBER"),
);

const BULL_KEY: TargetKey = formatTargetKey(25, "BULL");

/** Derived games' picker keys: `NUMBER:1..20`, plus `BULL:25` where the game can aim at the bull (Shanghai never does). */
const DERIVED_KEYS: Readonly<Record<string, readonly TargetKey[]>> = {
  SINGLES_TRAINING: [...NUMBER_KEYS, BULL_KEY],
  AROUND_THE_CLOCK: [...NUMBER_KEYS, BULL_KEY],
  SHANGHAI: NUMBER_KEYS,
};

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

/** Picker options for a game type: empty when it has no picker, else "All targets" plus the game's target keys. */
export function heatmapTargetOptions(
  gameTypeKey: GameTypeKey | undefined,
): HeatmapTargetOption[] {
  if (gameTypeKey === undefined || !HEATMAP_TARGET_GAMES.has(gameTypeKey)) {
    return [];
  }
  return [
    { value: null, label: "All targets" },
    ...(DERIVED_KEYS[gameTypeKey] ?? DOUBLES_PATH_KEYS).map((key) => ({
      value: key,
      label: targetLabel(key),
    })),
  ];
}
