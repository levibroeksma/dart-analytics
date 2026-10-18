import type { SwitchbladeConfigData } from "@lib/types";
import { SwitchbladeV1Config } from "@lib/training/exercises/rulesets/types";
import type {
  DartIntent,
  EngineFacts,
  SwitchbladeTrackExt,
  TrackSeat,
} from "@modules/types";
import type { TrackRules } from "@modules/interfaces";
import {
  advanceEveryDart,
  anyRingEitherBull,
  boardScorePoints,
  closeAfter,
  passOnWrap,
  pathTarget,
  sectionOf,
  tallyRoundPoints,
} from "@modules/game/track-policies";
import { registerDartExerciseEngineFactory } from "./dart-engine.registry";
import {
  dartExerciseEngineClass,
  dartExerciseEngineFactory,
} from "./dart-exercise-shell.module";
import { trackExerciseSpec } from "./track-exercise-spec.module";
import type { SwitchbladeSlot, SwitchbladeState } from "./types";

const DARTS_PER_ROUND = 3;
const ROUNDS = 5;
const DONE_MESSAGE =
  "A SwitchBlade seat never finishes; only the timer ends the exercise.";

const treble = (number: number): SwitchbladeSlot => ({
  kind: "TREBLE",
  number,
});

/** The fixed path: each round two darts at T20, then T20, T19, T18, T17 or the bull. */
export const SWITCHBLADE_PATH: readonly SwitchbladeSlot[] = [
  treble(20),
  treble(19),
  treble(18),
  treble(17),
  { kind: "BULL" },
].flatMap((third) => [treble(20), treble(20), third]);

/** Round `roundIndex`'s three slots (0-based, wrapping every five rounds). */
export function switchbladeRoundSlots(
  roundIndex: number,
): readonly SwitchbladeSlot[] {
  const start = (roundIndex % ROUNDS) * DARTS_PER_ROUND;
  return SWITCHBLADE_PATH.slice(start, start + DARTS_PER_ROUND);
}

/** The bed each dart is aimed at: its slot's treble, or the bullseye. */
export function switchbladeIntent(slot: SwitchbladeSlot): DartIntent {
  return {
    intendedTargetNumber: sectionOf(slot),
    intendedZoneKey: slot.kind === "BULL" ? "INNER_BULL" : "TREBLE",
  };
}

/**
 * SwitchBlade's Track rules: one path slot per dart; a dart on its slot's
 * number in any ring (either bull on the bull slot) scores its board value;
 * `tallyRoundPoints` books it to its round, `advanceEveryDart` moves on and
 * `passOnWrap` restarts the path after the bull slot.
 */
function switchbladeRules(): TrackRules<SwitchbladeTrackExt> {
  const tally = tallyRoundPoints<SwitchbladeTrackExt>(DARTS_PER_ROUND);
  const wrap = passOnWrap<SwitchbladeTrackExt>(SWITCHBLADE_PATH.length - 1);
  return {
    doneMessage: DONE_MESSAGE,
    target: pathTarget(SWITCHBLADE_PATH),
    hit: anyRingEitherBull,
    points: boardScorePoints,
    onDart: (seat, dart) => wrap(advanceEveryDart(tally(seat, dart))),
    visitOpen: closeAfter(DARTS_PER_ROUND),
  };
}

function projectSwitchblade(
  seat: TrackSeat<SwitchbladeTrackExt>,
  _config: SwitchbladeConfigData,
  complete: boolean,
  facts: EngineFacts,
): SwitchbladeState {
  const darts = facts.turns.flatMap((turn) => turn.darts);
  return {
    currentSlot: SWITCHBLADE_PATH[seat.targetIndex],
    slotIndex: seat.targetIndex,
    round: Math.floor(seat.targetIndex / DARTS_PER_ROUND) + 1,
    total: seat.score,
    roundTotals: seat.ext.roundTotals,
    passes: seat.ext.passes,
    hits: darts.filter(
      (dart) =>
        dart.intendedTargetNumber !== null &&
        dart.hitTargetNumber === dart.intendedTargetNumber,
    ).length,
    dartsThrown: darts.length,
    status: complete ? "COMPLETE" : "IN_PROGRESS",
  };
}

const switchbladeSpec = trackExerciseSpec<
  SwitchbladeConfigData,
  SwitchbladeTrackExt,
  SwitchbladeState
>({
  exerciseRulesetVersionKey: "SWITCHBLADE_V1",
  parse: (config) => SwitchbladeV1Config.parse(config),
  rules: switchbladeRules,
  initialExt: () => ({
    roundTotals: Array.from({ length: ROUNDS }, () => 0),
    passes: 0,
  }),
  project: projectSwitchblade,
  intent: (state) => switchbladeIntent(state.currentSlot),
});

/** SwitchBlade's state from a fact log alone, through the same fold the engine uses. */
export function foldSwitchbladeState(
  facts: EngineFacts,
  config: SwitchbladeConfigData,
  complete: boolean,
): SwitchbladeState {
  return switchbladeSpec.fold(facts, config, complete);
}

/** SwitchBlade exercise engine, built by the exercise shell. */
export class SwitchbladeEngine extends dartExerciseEngineClass(
  switchbladeSpec,
) {}

export const switchbladeEngineFactory = dartExerciseEngineFactory(
  switchbladeSpec,
  SwitchbladeEngine,
);

registerDartExerciseEngineFactory(switchbladeEngineFactory);
