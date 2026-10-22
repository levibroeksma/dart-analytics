import type { HitCountConfigData, HitCountTarget } from "@lib/types";
import { HitCountV1Config } from "@lib/training/exercises/rulesets/types";
import type {
  BoardTarget,
  DartIntent,
  DartObservation,
  DartZoneKey,
  EngineFacts,
  HitCountTrackExt,
  TrackSeat,
} from "@modules/types";
import type { TrackRules } from "@modules/interfaces";
import { isHitOn } from "@modules/game/board-progression.module";
import {
  advanceAfterDarts,
  closeAfter,
  passOnWrap,
  pathTarget,
  sectionOf,
  tallyOnTarget,
} from "@modules/game/track-policies";
import {
  dartExerciseEngineClass,
  registerDartExercise,
} from "./dart-exercise-shell.module";
import { trackExerciseSpec } from "./track-exercise-spec.module";
import type { HitCountState } from "./types";

const DARTS_PER_VISIT = 3;
const DONE_MESSAGE =
  "A Hit Count seat never finishes; only the timer ends the exercise.";

const INTENDED_ZONE: Record<HitCountTarget["kind"], DartZoneKey> = {
  TREBLE: "TREBLE",
  DOUBLE: "DOUBLE",
  BULL: "INNER_BULL",
};

/** The bed each dart is aimed at: the target's treble or double, or the bullseye. */
export function hitCountIntent(target: HitCountTarget): DartIntent {
  return {
    intendedTargetNumber: sectionOf(target),
    intendedZoneKey: INTENDED_ZONE[target.kind],
  };
}

function hitPoint(
  _target: BoardTarget,
  _observation: DartObservation,
  hit: boolean,
): number {
  return hit ? 1 : 0;
}

/**
 * Hit Count's Track rules: the config's targets in order; a dart hits only
 * in the target's named bed (`isHitOn`) and scores 1; `tallyOnTarget`
 * counts it; at a visit's close `advanceAfterDarts` moves on after
 * `dartsPerTarget` darts and `passOnWrap` restarts the list past its end.
 */
function hitCountRules(
  config: HitCountConfigData,
): TrackRules<HitCountTrackExt> {
  const advance = advanceAfterDarts<HitCountTrackExt>(config.dartsPerTarget);
  const wrap = passOnWrap<HitCountTrackExt>(config.targets.length - 1);
  return {
    doneMessage: DONE_MESSAGE,
    target: pathTarget(config.targets),
    hit: isHitOn,
    points: hitPoint,
    onDart: tallyOnTarget,
    visitOpen: closeAfter(DARTS_PER_VISIT),
    onVisitClose: (seat) => wrap(advance(seat)),
  };
}

function projectHitCount(
  seat: TrackSeat<HitCountTrackExt>,
  config: HitCountConfigData,
  complete: boolean,
  facts: EngineFacts,
): HitCountState {
  return {
    currentTarget: config.targets[seat.targetIndex],
    targetIndex: seat.targetIndex,
    dartsLeftOnTarget: config.dartsPerTarget - seat.ext.dartsOnTarget,
    hits: seat.score,
    dartsThrown: facts.turns.reduce(
      (count, turn) => count + turn.darts.length,
      0,
    ),
    hitsPerTarget: config.targets.map((target, index) => ({
      target,
      hits: seat.ext.hitsPerTarget[index] ?? 0,
    })),
    passes: seat.ext.passes,
    status: complete ? "COMPLETE" : "IN_PROGRESS",
  };
}

const hitCountSpec = trackExerciseSpec<
  HitCountConfigData,
  HitCountTrackExt,
  HitCountState
>({
  exerciseRulesetVersionKey: "HIT_COUNT_V1",
  parse: (config) => HitCountV1Config.parse(config),
  rules: hitCountRules,
  initialExt: (config) => ({
    dartsOnTarget: 0,
    hitsPerTarget: config.targets.map(() => 0),
    passes: 0,
  }),
  project: projectHitCount,
  intent: (state) => hitCountIntent(state.currentTarget),
});

/** Hit Count's state from a fact log alone, through the same fold the engine uses. */
export const foldHitCountState = hitCountSpec.fold;

/** Hit Count exercise engine, built by the exercise shell. */
export class HitCountEngine extends dartExerciseEngineClass(hitCountSpec) {}

export const hitCountEngineFactory = registerDartExercise(
  hitCountSpec,
  HitCountEngine,
).factory;
