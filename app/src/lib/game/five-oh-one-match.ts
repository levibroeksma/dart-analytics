import {
  matchFormatOf,
  matchPositionOf,
  raceLabel,
  raceTarget,
} from "@modules/game/match-format.module";
import type { FiveOhOneAnySnapshot } from "@lib/types";
import type { FiveOhOneState, StageFact } from "@modules/types";
import { joinSubtitle } from "./play-subtitle";

/** Play-header subtitle: `SET k · LEG n · FIRST TO S SETS`, or `LEG n · FIRST TO N` without sets, plus `SUDDEN DEATH` / `DECIDING SET`. */
export function fiveOhOneSubtitle(
  config: FiveOhOneAnySnapshot,
  stages: readonly StageFact[],
  state: FiveOhOneState | null,
): string {
  const format = matchFormatOf(config);
  const position = matchPositionOf(stages);
  const race =
    format.sets === null
      ? raceLabel(format.legs)
      : `${raceLabel(format.sets)} sets`;
  const flag = state?.suddenDeath
    ? "SUDDEN DEATH"
    : state?.decidingSet
      ? "DECIDING SET"
      : "";
  return joinSubtitle([
    position.set === null ? "" : `SET ${position.set}`,
    `LEG ${position.leg}`,
    race.toUpperCase(),
    flag,
  ]);
}

/** Leg bars to draw: the leg target, or `cap + 1` once a side passes it under win by 2. */
export function legBarCount(
  config: FiveOhOneAnySnapshot,
  state: FiveOhOneState | null,
): number {
  const format = matchFormatOf(config);
  const target = raceTarget(format.legs);
  const most = Math.max(0, ...(state?.sides ?? []).map((side) => side.legsWon));
  return format.winByTwo !== null && most >= target
    ? format.winByTwo.cap + 1
    : target;
}

/** Sets won per side in seat order (`"2–1"`); blank without sets. */
export function setScoreText(
  config: FiveOhOneAnySnapshot,
  state: FiveOhOneState | null,
  seats: readonly { sideKey: string }[],
): string {
  if (matchFormatOf(config).sets === null || !state) return "";
  return seats
    .map(
      (seat) =>
        state.sides.find((side) => side.sideKey === seat.sideKey)?.setsWon ?? 0,
    )
    .join("–");
}
