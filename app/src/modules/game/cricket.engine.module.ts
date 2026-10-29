import type { CricketSnapshot, Seated } from "@lib/types";
import { BULL_TARGET_NUMBER } from "./board-progression.module";
import { registerEngineFactory } from "./engine.registry";
import { foldMarks } from "./marks-kernel.module";
import { MarksEngine, marksEngineFactory } from "./marks-engine.module";
import {
  applyMarksDart,
  BULL_RING_MARKS,
  initialMarksSeat,
  NUMBER_RING_MARKS,
} from "./marks-close.module";
import type {
  CricketSeatState,
  CricketState,
  DartObservation,
  EngineFacts,
  MarksHit,
  MarksRules,
} from "./types";

export { effectiveMarks, marksPerRound } from "./marks-close.module";

/** The seven Classic Cricket objectives in display order; the bull is `BULL_TARGET_NUMBER`. */
export const CRICKET_OBJECTIVES: readonly number[] = [
  20,
  19,
  18,
  17,
  16,
  15,
  BULL_TARGET_NUMBER,
];

const BULL_INDEX = CRICKET_OBJECTIVES.indexOf(BULL_TARGET_NUMBER);

/**
 * The objective a dart marks and how many marks it adds, or null for a dart
 * that marks nothing (1–14, a miss). The bull is keyed on the ring alone, so a
 * visual-board bull hit marks it whatever number the hit carries.
 */
export function cricketMarksOf(observation: DartObservation): MarksHit {
  const bullMarks = BULL_RING_MARKS[observation.hitZoneKey];
  if (bullMarks !== undefined) {
    return { objectiveIndex: BULL_INDEX, marks: bullMarks };
  }
  if (observation.hitTargetNumber === null) return null;
  const objectiveIndex = CRICKET_OBJECTIVES.indexOf(
    observation.hitTargetNumber,
  );
  const marks = NUMBER_RING_MARKS[observation.hitZoneKey];
  if (objectiveIndex === -1 || objectiveIndex === BULL_INDEX || !marks) {
    return null;
  }
  return { objectiveIndex, marks };
}

function initialSeatState(seat: {
  participantRef: string;
  sideKey: string;
}): CricketSeatState {
  return { ...initialMarksSeat(seat, CRICKET_OBJECTIVES.length), points: 0 };
}

/** Cricket's starting state: every seat with no marks, seat 0 active. */
export function initialCricketState(
  config: Seated<CricketSnapshot>,
): CricketState {
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
    winnerParticipantRef: null,
    seats: config.seats.map(initialSeatState),
  };
}

/**
 * Pure reducer: folds one dart onto one seat through `cricketMarksOf` and
 * `applyMarksDart`.
 * @throws when the seat is already complete; undo first to correct it.
 */
export function applyCricketDart(
  state: CricketSeatState,
  observation: DartObservation,
): CricketSeatState {
  return {
    ...state,
    ...applyMarksDart(state, cricketMarksOf(observation)),
  };
}

/** Cricket as marks rules: a dart's hit never depends on either seat; every objective scores its own number. */
export const CRICKET_RULES: MarksRules<CricketSeatState> = {
  initialSeat: initialSeatState,
  hitOf: (_seat, _opponent, observation) => cricketMarksOf(observation),
  valueOf: (index) => CRICKET_OBJECTIVES[index],
};

/**
 * Folds the whole fact log into the session's state — what the engine's own
 * `state()` and the play controller's `state()` both call. One seat: complete
 * once it is closed out. Two seats: the duel fold, complete once a seat
 * closes out with points at least equal to its opponent's.
 */
export function foldCricketState(
  facts: EngineFacts,
  config: Seated<CricketSnapshot>,
): CricketState {
  return foldMarks(facts, config.seats, CRICKET_RULES);
}

/**
 * Cricket: close 20–15 and the bull in as few darts as possible, alone (V1)
 * or against one opponent (V2). The engine owns the fact log; marks, closures,
 * points and the winner are folded from it on every read and never stored.
 * Darts carry no intent: any objective is a legitimate aim on any dart.
 */
export class CricketEngine<
  TKey extends "CRICKET_V1" | "CRICKET_V2" = "CRICKET_V1" | "CRICKET_V2",
> extends MarksEngine<Seated<CricketSnapshot>, CricketState, TKey> {
  constructor(
    config: Seated<CricketSnapshot>,
    prior?: EngineFacts,
    rulesetVersionKey: TKey = "CRICKET_V1" as TKey,
  ) {
    super(config, prior, rulesetVersionKey);
  }

  protected fold(facts: EngineFacts): CricketState {
    return foldCricketState(facts, this.config);
  }

  protected fork(): CricketEngine<TKey> {
    return new CricketEngine(this.config, this.facts(), this.rulesetVersionKey);
  }
}

export const cricketEngineFactory = marksEngineFactory({
  rulesetVersionKey: "CRICKET_V1",
  build: (config: Seated<CricketSnapshot>, prior) =>
    new CricketEngine(config, prior, "CRICKET_V1"),
});

export const cricketV2EngineFactory = marksEngineFactory({
  rulesetVersionKey: "CRICKET_V2",
  build: (config: Seated<CricketSnapshot>, prior) =>
    new CricketEngine(config, prior, "CRICKET_V2"),
});

registerEngineFactory(cricketEngineFactory);
registerEngineFactory(cricketV2EngineFactory);
