import type { HalveItConfigData } from "@lib/types";
import { HalveItV1Config } from "@lib/training/exercises/rulesets/types";
import type {
  DartIntent,
  EngineFacts,
  HalveItTrackExt,
  TrackSeat,
  TrackTarget,
} from "@modules/types";
import type { TrackRules } from "@modules/interfaces";
import {
  advanceAfterDarts,
  anyRingEitherBull,
  boardScorePoints,
  closeAfter,
  halveOnBlank,
  passOnWrap,
  pathTarget,
  tallyOnTarget,
} from "@modules/game/track-policies";
import {
  dartExerciseEngineClass,
  registerDartExercise,
} from "./dart-exercise-shell.module";
import { trackExerciseSpec } from "./track-exercise-spec.module";
import type { HalveItState } from "./types";

const DARTS_PER_VISIT = 3;
const DONE_MESSAGE =
  "A Halve-It seat never finishes; only the timer ends the exercise.";

/** The V1 list: 20, 16, any double, 17, 18, any treble, 19, 20, bull. */
export const HALVE_IT_PATH: readonly TrackTarget[] = [
  { kind: "NUMBER", number: 20 },
  { kind: "NUMBER", number: 16 },
  { kind: "ANY_DOUBLE" },
  { kind: "NUMBER", number: 17 },
  { kind: "NUMBER", number: 18 },
  { kind: "ANY_TREBLE" },
  { kind: "NUMBER", number: 19 },
  { kind: "NUMBER", number: 20 },
  { kind: "BULL" },
];

const LAST_INDEX = HALVE_IT_PATH.length - 1;

/** The bed a dart is aimed at: none on a number or the bull (any ring scores), the ring alone on a zone. */
export function halveItIntent(target: TrackTarget): DartIntent {
  if (target.kind === "ANY_DOUBLE")
    return { intendedTargetNumber: null, intendedZoneKey: "DOUBLE" };
  if (target.kind === "ANY_TREBLE")
    return { intendedTargetNumber: null, intendedZoneKey: "TREBLE" };
  return { intendedTargetNumber: null, intendedZoneKey: null };
}

function countHalving(
  seat: TrackSeat<HalveItTrackExt>,
): TrackSeat<HalveItTrackExt> {
  return seat.hitsThisVisit === 0
    ? { ...seat, ext: { ...seat.ext, halvings: seat.ext.halvings + 1 } }
    : seat;
}

/**
 * Halve-It's Track rules: the fixed list in order; a dart hits on any ring
 * of the number, either bull on the bull, or the named zone
 * (`anyRingEitherBull`) and scores its board value; at a visit's close a
 * blank visit is counted and halves the total (`halveOnBlank`), the list
 * moves on, and past the bull `passOnWrap` starts it again.
 */
function halveItRules(): TrackRules<HalveItTrackExt, TrackTarget> {
  const advance = advanceAfterDarts<HalveItTrackExt>(DARTS_PER_VISIT);
  const wrap = passOnWrap<HalveItTrackExt>(LAST_INDEX);
  return {
    doneMessage: DONE_MESSAGE,
    target: pathTarget(HALVE_IT_PATH),
    hit: anyRingEitherBull,
    points: boardScorePoints,
    onDart: tallyOnTarget,
    visitOpen: closeAfter(DARTS_PER_VISIT),
    onVisitClose: (seat) => wrap(advance(halveOnBlank(countHalving(seat)))),
  };
}

function projectHalveIt(
  seat: TrackSeat<HalveItTrackExt>,
  _config: HalveItConfigData,
  complete: boolean,
  facts: EngineFacts,
): HalveItState {
  const hitsPerTarget = HALVE_IT_PATH.map((target, index) => ({
    target,
    hits: seat.ext.hitsPerTarget[index] ?? 0,
  }));
  return {
    currentTarget: HALVE_IT_PATH[seat.targetIndex],
    targetIndex: seat.targetIndex,
    round: seat.targetIndex + 1,
    total: seat.score,
    passes: seat.ext.passes,
    halvings: seat.ext.halvings,
    hits: hitsPerTarget.reduce((sum, entry) => sum + entry.hits, 0),
    dartsThrown: facts.turns.reduce(
      (count, turn) => count + turn.darts.length,
      0,
    ),
    hitsPerTarget,
    status: complete ? "COMPLETE" : "IN_PROGRESS",
  };
}

const halveItSpec = trackExerciseSpec<
  HalveItConfigData,
  HalveItTrackExt,
  HalveItState,
  TrackTarget
>({
  exerciseRulesetVersionKey: "HALVE_IT_V1",
  parse: (config) => HalveItV1Config.parse(config),
  rules: halveItRules,
  initialExt: () => ({
    dartsOnTarget: 0,
    hitsPerTarget: HALVE_IT_PATH.map(() => 0),
    passes: 0,
    halvings: 0,
  }),
  project: projectHalveIt,
  intent: (state) => halveItIntent(state.currentTarget),
});

/** Halve-It's state from a fact log alone, through the same fold the engine uses. */
export const foldHalveItState = halveItSpec.fold;

/** Halve-It exercise engine, built by the exercise shell. */
export class HalveItEngine extends dartExerciseEngineClass(halveItSpec) {}

export const halveItEngineFactory = registerDartExercise(
  halveItSpec,
  HalveItEngine,
).factory;
