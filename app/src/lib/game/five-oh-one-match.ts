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

/**
 * Leg bars to draw: the leg target, or `cap + 1` when the margin applies to
 * this set and the sides are contesting it (leader past the target, or at it
 * with the runner-up within 1 or sudden death flagged).
 */
export function legBarCount(
  config: FiveOhOneAnySnapshot,
  state: FiveOhOneState | null,
): number {
  const format = matchFormatOf(config);
  const target = raceTarget(format.legs);
  const margin = format.winByTwo;
  if (margin === null || !state) return target;
  const applies = margin.scope === "EVERY_SET" || state.decidingSet;
  const ranked = state.sides.map((side) => side.legsWon).sort((a, b) => b - a);
  const leader = ranked[0] ?? 0;
  const runnerUp = ranked[1] ?? 0;
  const contested =
    leader > target ||
    (leader >= target && (state.suddenDeath || leader - runnerUp < 2));
  return applies && contested ? margin.cap + 1 : target;
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

/** Legs won per side in each played set, seat order (`"3–1 · 2–3"`); blank without sets. */
export function setLegScoresText(
  config: FiveOhOneAnySnapshot,
  state: FiveOhOneState | null,
  seats: readonly { sideKey: string }[],
): string {
  if (matchFormatOf(config).sets === null || !state) return "";
  return state.sets
    .filter((set) => Object.values(set.legsWon).some((legs) => legs > 0))
    .map((set) => seats.map((seat) => set.legsWon[seat.sideKey] ?? 0).join("–"))
    .join(" · ");
}
