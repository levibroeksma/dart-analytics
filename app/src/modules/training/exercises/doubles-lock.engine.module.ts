import type { DoublesLockConfigData } from "@lib/types";
import { DoublesLockV1Config } from "@lib/training/exercises/rulesets/types";
import type {
  BoardTarget,
  DartFact,
  DoublesLockTrackExt,
  EngineFacts,
  LockBonus,
  TrackSeat,
} from "@modules/types";
import type { TrackRules } from "@modules/interfaces";
import { doublesPath, isHitOn } from "@modules/game/board-progression.module";
import {
  closeAfter,
  lockCheckpoint,
  noPoints,
  passOnWrap,
  pathTarget,
} from "@modules/game/track-policies";
import { doubleTargetIntent } from "@modules/game/turn-log.module";
import {
  dartExerciseEngineClass,
  registerDartExercise,
} from "./dart-exercise-shell.module";
import { trackExerciseSpec } from "./track-exercise-spec.module";
import type { DoublesLockState } from "./types";

const DARTS_PER_VISIT = 3;
const DONE_MESSAGE =
  "A Doubles Lock seat never finishes; only the timer ends the exercise.";

/**
 * The ladder a config walks: every double or the ten even ones, D20 down
 * or D1 up. The empty config is D20 down to D1.
 */
export function doublesLockPath(
  config: DoublesLockConfigData,
): readonly BoardTarget[] {
  const numbers = Array.from({ length: 20 }, (_, i) => 20 - i).filter(
    (n) => config.doubles !== "EVEN" || n % 2 === 0,
  );
  return doublesPath(
    config.order === "ASCENDING" ? numbers.reverse() : numbers,
  );
}

/** The ladder: D20 down to D1. */
export const DOUBLES_LOCK_PATH: readonly BoardTarget[] = doublesLockPath({});

/** Two hits lock for 50, three for 100. */
export const DOUBLES_LOCK_BONUS: LockBonus = { 2: 50, 3: 100 };

function tallyPassDarts(
  seat: TrackSeat<DoublesLockTrackExt>,
): TrackSeat<DoublesLockTrackExt> {
  return {
    ...seat,
    ext: {
      ...seat.ext,
      dartsThisPass: seat.ext.dartsThisPass + seat.dartsThisVisit,
    },
  };
}

function closePass(
  seat: TrackSeat<DoublesLockTrackExt>,
  lastIndex: number,
): TrackSeat<DoublesLockTrackExt> {
  if (seat.targetIndex <= lastIndex) return seat;
  const wrapped = passOnWrap<DoublesLockTrackExt>(lastIndex)(seat);
  return {
    ...wrapped,
    ext: {
      ...wrapped.ext,
      lastLock: null,
      dartsPerPass: [...wrapped.ext.dartsPerPass, wrapped.ext.dartsThisPass],
      dartsThisPass: 0,
    },
  };
}

/**
 * Doubles Lock's Track rules: the config's doubles in order; a dart hits
 * only in the double (`isHitOn`) and scores nothing per dart. At a visit's
 * close the pass's darts are tallied, `lockCheckpoint` locks, advances or
 * retreats, and past the last double `closePass` starts a new pass with no lock.
 */
function doublesLockRules(
  config: DoublesLockConfigData,
): TrackRules<DoublesLockTrackExt> {
  const path = doublesLockPath(config);
  const lock = lockCheckpoint<DoublesLockTrackExt>(DOUBLES_LOCK_BONUS);
  return {
    doneMessage: DONE_MESSAGE,
    target: pathTarget(path),
    hit: isHitOn,
    points: noPoints,
    visitOpen: closeAfter(DARTS_PER_VISIT),
    onVisitClose: (seat) =>
      closePass(lock(tallyPassDarts(seat)), path.length - 1),
  };
}

function onIntendedDouble(dart: DartFact): boolean {
  return (
    dart.hitZoneKey === "DOUBLE" &&
    dart.hitTargetNumber === dart.intendedTargetNumber
  );
}

function projectDoublesLock(
  seat: TrackSeat<DoublesLockTrackExt>,
  config: DoublesLockConfigData,
  complete: boolean,
  facts: EngineFacts,
): DoublesLockState {
  const darts = facts.turns.flatMap((turn) => turn.darts);
  const { lastLock, dartsPerPass } = seat.ext;
  const path = doublesLockPath(config);
  return {
    currentDouble: path[seat.targetIndex],
    targetIndex: seat.targetIndex,
    lastLock: lastLock === null ? null : path[lastLock],
    bonus: seat.score,
    locks: seat.ext.locks,
    passes: seat.ext.passes,
    dartsPerPass,
    bestPassDarts: dartsPerPass.length ? Math.min(...dartsPerPass) : null,
    dartsThisPass: seat.ext.dartsThisPass + seat.dartsThisVisit,
    hits: darts.filter(onIntendedDouble).length,
    dartsThrown: darts.length,
    status: complete ? "COMPLETE" : "IN_PROGRESS",
  };
}

const doublesLockSpec = trackExerciseSpec<
  DoublesLockConfigData,
  DoublesLockTrackExt,
  DoublesLockState
>({
  exerciseRulesetVersionKey: "DOUBLES_LOCK_V1",
  parse: (config) => DoublesLockV1Config.parse(config),
  rules: doublesLockRules,
  initialExt: () => ({
    lastLock: null,
    locks: 0,
    passes: 0,
    dartsThisPass: 0,
    dartsPerPass: [],
  }),
  project: projectDoublesLock,
  intent: (state) => doubleTargetIntent(state.currentDouble),
});

/** Doubles Lock's state from a fact log alone, through the same fold the engine uses. */
export const foldDoublesLockState = doublesLockSpec.fold;

/** Doubles Lock exercise engine, built by the exercise shell. */
export class DoublesLockEngine extends dartExerciseEngineClass(
  doublesLockSpec,
) {}

export const doublesLockEngineFactory = registerDartExercise(
  doublesLockSpec,
  DoublesLockEngine,
).factory;
