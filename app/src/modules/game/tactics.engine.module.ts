import type { Seated, TacticsSnapshot } from "@lib/types";
import { BULL_TARGET_NUMBER } from "./board-progression.module";
import { registerEngineFactory } from "./engine.registry";
import { foldMarksSeats } from "./marks-duel.module";
import { MarksEngine, marksEngineFactory } from "./marks-engine.module";
import {
  applyMarksDart,
  BULL_RING_MARKS,
  initialMarksSeat,
  MARKS_TO_CLOSE,
  NUMBER_RING_MARKS,
} from "./marks-close.module";
import type {
  DartObservation,
  DartZoneKey,
  EngineFacts,
  MarksDuelSpec,
  MarksHit,
  TacticsObjective,
  TacticsSeatState,
  TacticsState,
} from "./types";

/** The nine Tactics objectives in display order; the bull is `BULL_TARGET_NUMBER`. */
export const TACTICS_OBJECTIVES: readonly TacticsObjective[] = [
  20,
  19,
  18,
  17,
  16,
  15,
  BULL_TARGET_NUMBER,
  "DOUBLES",
  "TRIPLES",
];

const BULL_INDEX = TACTICS_OBJECTIVES.indexOf(BULL_TARGET_NUMBER);

const CATEGORY_INDEX: Partial<Record<DartZoneKey, number>> = {
  DOUBLE: TACTICS_OBJECTIVES.indexOf("DOUBLES"),
  TREBLE: TACTICS_OBJECTIVES.indexOf("TRIPLES"),
};

/**
 * The objective a dart marks given the seat's marks before it — the V1
 * dual-purpose auto rule: a 15–20 hit marks its number while open; a double
 * or treble on a closed 15–20, or on 1–14, marks Doubles / Triples by one.
 * The bull is keyed on the ring alone, so a visual-board bull hit marks it
 * whatever number the hit carries, and never feeds a category.
 * With `opponentOpen` (1v1) the rule is points first: a hit on a 15–20 number
 * the opponent still has open stays on that number, so its spare marks score;
 * only a number dead for both feeds a category.
 */
export function tacticsMarksOf(
  seat: TacticsSeatState,
  observation: DartObservation,
  opponentOpen: (objectiveIndex: number) => boolean = () => false,
): MarksHit {
  const bullMarks = BULL_RING_MARKS[observation.hitZoneKey];
  if (bullMarks !== undefined) {
    return { objectiveIndex: BULL_INDEX, marks: bullMarks };
  }
  const number = observation.hitTargetNumber;
  const marks = NUMBER_RING_MARKS[observation.hitZoneKey];
  if (number === null || number < 1 || number > 20 || !marks) return null;
  const numberIndex = TACTICS_OBJECTIVES.indexOf(number);
  if (
    numberIndex !== -1 &&
    (seat.marks[numberIndex] < MARKS_TO_CLOSE || opponentOpen(numberIndex))
  ) {
    return { objectiveIndex: numberIndex, marks };
  }
  const categoryIndex = CATEGORY_INDEX[observation.hitZoneKey];
  return categoryIndex === undefined
    ? null
    : { objectiveIndex: categoryIndex, marks: 1 };
}

/** Whether a dart can mark any objective on an empty board — the visit preview's hit/miss. */
export function isTacticsTarget(observation: DartObservation): boolean {
  return (
    tacticsMarksOf(
      initialSeatState({ participantRef: "", sideKey: "" }),
      observation,
    ) !== null
  );
}

function initialSeatState(seat: {
  participantRef: string;
  sideKey: string;
}): TacticsSeatState {
  return { ...initialMarksSeat(seat, TACTICS_OBJECTIVES.length), points: 0 };
}

/** Tactics' starting state: every seat with no marks, seat 0 active. */
export function initialTacticsState(
  config: Seated<TacticsSnapshot>,
): TacticsState {
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
    winnerParticipantRef: null,
    seats: config.seats.map(initialSeatState),
  };
}

/**
 * Pure reducer: folds one dart onto one seat through `tacticsMarksOf`, which
 * reads the seat's marks before the dart, and `applyMarksDart`.
 * @throws when the seat is already complete; undo first to correct it.
 */
export function applyTacticsDart(
  state: TacticsSeatState,
  observation: DartObservation,
): TacticsSeatState {
  return {
    ...state,
    ...applyMarksDart(state, tacticsMarksOf(state, observation)),
  };
}

const TACTICS_DUEL: MarksDuelSpec<TacticsSeatState> = {
  initialSeat: initialSeatState,
  hitOf: (seat, opponent, observation) =>
    tacticsMarksOf(
      seat,
      observation,
      (index) => opponent.marks[index] < MARKS_TO_CLOSE,
    ),
  valueOf: (index) => {
    const objective = TACTICS_OBJECTIVES[index];
    return typeof objective === "number" ? objective : null;
  },
};

/**
 * Folds the whole fact log into the session's state — what the engine's own
 * `state()` and the play controller's `state()` both call. One seat: complete
 * once it is closed out. Two seats: the duel fold, complete once a seat
 * closes out with points at least equal to its opponent's.
 */
export function foldTacticsState(
  facts: EngineFacts,
  config: Seated<TacticsSnapshot>,
): TacticsState {
  return foldMarksSeats(facts, config.seats, TACTICS_DUEL, applyTacticsDart);
}

/**
 * Tactics: close 20–15, the bull, Doubles and Triples in as few darts as
 * possible, alone or against one opponent. The engine owns the fact log;
 * marks, closures, points and the winner are folded from it on every read
 * and never stored. Darts carry no intent: any
 * objective is a legitimate aim on any dart.
 */
export class TacticsEngine extends MarksEngine<
  Seated<TacticsSnapshot>,
  TacticsState,
  "TACTICS_V1" | "TACTICS_V2"
> {
  constructor(
    config: Seated<TacticsSnapshot>,
    prior?: EngineFacts,
    rulesetVersionKey: "TACTICS_V1" | "TACTICS_V2" = "TACTICS_V1",
  ) {
    super(config, prior, rulesetVersionKey);
  }

  protected fold(facts: EngineFacts): TacticsState {
    return foldTacticsState(facts, this.config);
  }

  protected fork(): { record(observation: DartObservation): TacticsState } {
    return new TacticsEngine(this.config, this.facts(), this.rulesetVersionKey);
  }
}

export const tacticsEngineFactory = marksEngineFactory({
  rulesetVersionKey: "TACTICS_V1",
  build: (config: Seated<TacticsSnapshot>, prior) =>
    new TacticsEngine(config, prior, "TACTICS_V1"),
});

export const tacticsV2EngineFactory = marksEngineFactory({
  rulesetVersionKey: "TACTICS_V2",
  build: (config: Seated<TacticsSnapshot>, prior) =>
    new TacticsEngine(config, prior, "TACTICS_V2"),
});

registerEngineFactory(tacticsEngineFactory);
registerEngineFactory(tacticsV2EngineFactory);
