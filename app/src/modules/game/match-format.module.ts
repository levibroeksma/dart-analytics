import type { FiveOhOneAnySnapshot } from "@lib/types";
import type {
  MatchFold,
  MatchFormat,
  RaceSpec,
  SetFold,
  StageFact,
  WinByTwo,
} from "./types";

/** Legs or sets a side needs: `count` for first to, `(count + 1) / 2` for best of. */
export function raceTarget(race: RaceSpec): number {
  return race.mode === "FIRST_TO" ? race.count : (race.count + 1) / 2;
}

/** `"First to 3"` / `"Best of 5"`. */
export function raceLabel(race: RaceSpec): string {
  return `${race.mode === "FIRST_TO" ? "First to" : "Best of"} ${race.count}`;
}

function tally(
  sideKeys: readonly string[],
  winners: readonly string[],
): Record<string, number> {
  const counts = Object.fromEntries(sideKeys.map((side) => [side, 0]));
  for (const winner of winners) counts[winner] = (counts[winner] ?? 0) + 1;
  return counts;
}

/**
 * The side that has won a leg race, or null. Without a margin, the first side
 * at `target`. With one, a side at `target` must lead every other side by 2;
 * a side at `cap + 1` wins regardless (sudden death).
 */
export function legRaceWinner(
  legsWon: Readonly<Record<string, number>>,
  sideKeys: readonly string[],
  target: number,
  margin: WinByTwo | null,
): string | null {
  for (const side of sideKeys) {
    const own = legsWon[side] ?? 0;
    if (margin === null) {
      if (own >= target) return side;
      continue;
    }
    if (own >= margin.cap + 1) return side;
    if (own < target) continue;
    const leadsAll = sideKeys.every(
      (other) => other === side || own - (legsWon[other] ?? 0) >= 2,
    );
    if (leadsAll) return side;
  }
  return null;
}

function isDecidingSet(
  format: MatchFormat,
  sideKeys: readonly string[],
  setsWon: Readonly<Record<string, number>>,
): boolean {
  if (format.sets === null) return false;
  const target = raceTarget(format.sets);
  return sideKeys.every((side) => (setsWon[side] ?? 0) === target - 1);
}

function marginFor(format: MatchFormat, deciding: boolean): WinByTwo | null {
  if (format.winByTwo === null) return null;
  return format.winByTwo.scope === "EVERY_SET" || deciding
    ? format.winByTwo
    : null;
}

/**
 * Folds leg winners, grouped by the set they were played in, into the match
 * score (`docs/game-rules/rulesets/501.md`). Grouping comes from the stage
 * tree; this never invents a set boundary. A match without sets is one
 * group. The fold stops at the set that decides the match.
 */
export function foldMatch(
  format: MatchFormat,
  sideKeys: readonly string[],
  legWinnersBySet: readonly (readonly string[])[],
): MatchFold {
  const setsWon = tally(sideKeys, []);
  const sets: SetFold[] = [];
  const groups = legWinnersBySet.length > 0 ? legWinnersBySet : [[]];
  const legTarget = raceTarget(format.legs);
  let winner: string | null = null;
  let decidingSet = false;
  let suddenDeath = false;

  for (const winners of groups) {
    decidingSet = isDecidingSet(format, sideKeys, setsWon);
    const margin = marginFor(format, decidingSet);
    const legsWon = tally(sideKeys, winners);
    const setWinner = legRaceWinner(legsWon, sideKeys, legTarget, margin);
    suddenDeath =
      margin !== null &&
      setWinner === null &&
      sideKeys.filter((side) => legsWon[side] === margin.cap).length >= 2;
    sets.push({ legsWon, winner: setWinner });
    if (setWinner === null) continue;
    setsWon[setWinner] = (setsWon[setWinner] ?? 0) + 1;
    if (
      format.sets === null ||
      setsWon[setWinner]! >= raceTarget(format.sets)
    ) {
      winner = setWinner;
      break;
    }
  }

  return { sets, setsWon, winner, decidingSet, suddenDeath };
}

/** Normalises either 501 snapshot; V1 reads as first to `legsToWin` legs, no sets, no margin. */
export function matchFormatOf(config: FiveOhOneAnySnapshot): MatchFormat {
  if ("legsToWin" in config) {
    return {
      legs: { mode: "FIRST_TO", count: config.legsToWin },
      sets: null,
      winByTwo: null,
    };
  }
  return { legs: config.legs, sets: config.sets, winByTwo: config.winByTwo };
}

/**
 * Where play stands: the open set's sequence (null without sets) and the open
 * leg's number — its sequence under a set, its count among root legs otherwise.
 */
export function matchPositionOf(stages: readonly StageFact[]): {
  set: number | null;
  leg: number;
} {
  const openLeg = stages.filter((stage) => stage.stageTypeKey === "LEG").at(-1);
  if (!openLeg) return { set: null, leg: 1 };
  if (openLeg.parentClientKey === null) {
    return {
      set: null,
      leg: stages.filter((stage) => stage.stageTypeKey === "LEG").length,
    };
  }
  const openSet = stages.find(
    (stage) => stage.clientKey === openLeg.parentClientKey,
  );
  return { set: openSet?.sequence ?? null, leg: openLeg.sequence };
}
