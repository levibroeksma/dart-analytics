import type { SnakesLaddersConfigData } from "@lib/types";
import { SnakesLaddersV1Config } from "@lib/training/exercises/rulesets/types";
import type {
  BoardTarget,
  MoveTable,
  SnakesLaddersTrackExt,
  TrackSeat,
} from "@modules/types";
import type { TrackRules } from "@modules/interfaces";
import { doublesPath, isHitOn } from "@modules/game/board-progression.module";
import { doubleTargetIntent } from "@modules/game/turn-log.module";
import {
  closeAfter,
  finishOnHits,
  moveTable,
  noPoints,
  pathTarget,
  tallyOnTarget,
} from "@modules/game/track-policies";
import {
  dartExerciseEngineClass,
  registerDartExercise,
} from "./dart-exercise-shell.module";
import { tallyTotals, trackExerciseSpec } from "./track-exercise-spec.module";
import type { SnakesLaddersState } from "./types";

const DARTS_PER_VISIT = 3;
const DONE_MESSAGE = "A finished Snakes & Ladders run takes no more darts.";

/** The ladder: D1 up to D20, then the bullseye. */
export const SNAKES_LADDERS_PATH: readonly BoardTarget[] = doublesPath();

/** Hits in a visit to level change: none back two, one back one, two stay, three up one. */
export const SNAKES_LADDERS_MOVES: MoveTable = { 0: -2, 1: -1, 2: 0, 3: 1 };

/** Bullseyes in one visit, on the last level, that finish the run. */
export const SNAKES_LADDERS_FINISH = 3;

const LAST_INDEX = SNAKES_LADDERS_PATH.length - 1;

function countRound(
  seat: TrackSeat<SnakesLaddersTrackExt>,
): TrackSeat<SnakesLaddersTrackExt> {
  return { ...seat, ext: { ...seat.ext, rounds: seat.ext.rounds + 1 } };
}

/**
 * Snakes & Ladders' Track rules: only the level's double (the bullseye on
 * the last level) hits (`isHitOn`) and nothing scores. At a visit's close
 * the round is counted, three bullseyes on the last level finish the run
 * (`finishOnHits`), and any other visit moves by its hits (`moveTable`).
 */
function snakesLaddersRules(): TrackRules<SnakesLaddersTrackExt> {
  const finish = finishOnHits<SnakesLaddersTrackExt>(
    SNAKES_LADDERS_FINISH,
    LAST_INDEX,
  );
  const move = moveTable<SnakesLaddersTrackExt>(
    SNAKES_LADDERS_MOVES,
    LAST_INDEX,
  );
  return {
    doneMessage: DONE_MESSAGE,
    target: pathTarget(SNAKES_LADDERS_PATH),
    hit: isHitOn,
    points: noPoints,
    onDart: tallyOnTarget,
    visitOpen: closeAfter(DARTS_PER_VISIT),
    onVisitClose: (seat) => move(finish(countRound(seat))),
  };
}

function projectSnakesLadders(
  seat: TrackSeat<SnakesLaddersTrackExt>,
  _config: SnakesLaddersConfigData,
  expired: boolean,
  facts: Parameters<typeof tallyTotals>[1],
): SnakesLaddersState {
  return {
    currentLevel: SNAKES_LADDERS_PATH[seat.targetIndex],
    levelIndex: seat.targetIndex,
    highestLevel: SNAKES_LADDERS_PATH[seat.ext.highestIndex],
    highestLevelNumber: seat.ext.highestIndex + 1,
    rounds: seat.ext.rounds,
    finishes: seat.status === "DONE" ? 1 : 0,
    ...tallyTotals(seat.ext.hitsPerTarget, facts),
    status: expired || seat.status === "DONE" ? "COMPLETE" : "IN_PROGRESS",
  };
}

const snakesLaddersSpec = trackExerciseSpec<
  SnakesLaddersConfigData,
  SnakesLaddersTrackExt,
  SnakesLaddersState
>({
  exerciseRulesetVersionKey: "DOUBLES_SNAKES_LADDERS_V1",
  parse: (config) => SnakesLaddersV1Config.parse(config),
  rules: snakesLaddersRules,
  initialExt: () => ({
    dartsOnTarget: 0,
    hitsPerTarget: SNAKES_LADDERS_PATH.map(() => 0),
    highestIndex: 0,
    rounds: 0,
  }),
  project: projectSnakesLadders,
  intent: (state) => doubleTargetIntent(state.currentLevel),
  ends: (state) => state.finishes === 1,
});

/** Snakes & Ladders' state from a fact log alone, through the same fold the engine uses. */
export const foldSnakesLaddersState = snakesLaddersSpec.fold;

/** Doubles Snakes & Ladders exercise engine, built by the exercise shell. */
export class SnakesLaddersEngine extends dartExerciseEngineClass(
  snakesLaddersSpec,
) {}

export const snakesLaddersEngineFactory = registerDartExercise(
  snakesLaddersSpec,
  SnakesLaddersEngine,
).factory;
