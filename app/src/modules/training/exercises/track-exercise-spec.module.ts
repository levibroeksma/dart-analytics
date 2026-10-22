import type { BoardTarget, EngineFacts, TrackTarget } from "@modules/types";
import {
  foldTrackDarts,
  initialTrackSeat,
} from "@modules/game/track-kernel.module";
import type { DartExerciseSpec, TrackExerciseDefinition } from "./interfaces";
import { SOLO_PARTICIPANT_REF } from "./solo-participant.module";

const DARTS_PER_VISIT = 3;
const SOLO_SEAT = {
  participantRef: SOLO_PARTICIPANT_REF,
  sideKey: SOLO_PARTICIPANT_REF,
};

/** A Track exercise's projected totals: hits summed from the fold's per-target tally, darts counted from the log. */
export function tallyTotals(
  hitsPerTarget: readonly number[],
  facts: EngineFacts,
): { hits: number; dartsThrown: number } {
  return {
    hits: hitsPerTarget.reduce((sum, hits) => sum + hits, 0),
    dartsThrown: facts.turns.reduce(
      (count, turn) => count + turn.darts.length,
      0,
    ),
  };
}

/**
 * Binds a Track-family exercise to the exercise shell: `fold` replays every
 * dart through `foldTrackDarts` from the solo seat and hands the seat to
 * `project`; visits close at three darts (Track wave T1 spec §2.1).
 */
export function trackExerciseSpec<
  TConfig,
  TExt,
  TState,
  TTarget extends TrackTarget = BoardTarget,
>(
  definition: TrackExerciseDefinition<TConfig, TExt, TState, TTarget>,
): DartExerciseSpec<TConfig, TState> {
  const fold = (facts: EngineFacts, config: TConfig, expired: boolean) => {
    const rules = definition.rules(config);
    const initial = initialTrackSeat(
      SOLO_SEAT,
      definition.initialExt(config),
      rules.startScore,
    );
    const seat = foldTrackDarts(facts.turns, initial, rules);
    return definition.project(seat, config, expired, facts);
  };
  return {
    exerciseRulesetVersionKey: definition.exerciseRulesetVersionKey,
    parse: definition.parse,
    fold,
    intent: definition.intent,
    isVisitOpen: (turn) => turn.darts.length < DARTS_PER_VISIT,
    ends: definition.ends,
  };
}
