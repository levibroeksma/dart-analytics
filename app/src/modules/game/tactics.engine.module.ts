import type { Seated, TacticsSnapshot } from "@lib/types";
import { BULL_TARGET_NUMBER } from "./board-progression.module";
import { registerEngineFactory } from "./engine.registry";
import { activeSeat } from "./seat-rota.module";
import { activeSeatState, foldSeatStates } from "./seat-state.module";
import {
  appendObservedDart,
  cloneTurns,
  exerciseBlockStage,
  openOrCreateTurn,
  undoLastDart,
} from "./turn-log.module";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import {
  applyMarksDart,
  BULL_RING_MARKS,
  DARTS_PER_VISIT,
  initialMarksSeat,
  MARKS_TO_CLOSE,
  NUMBER_RING_MARKS,
} from "./marks-close.module";
import type {
  DartObservation,
  DartZoneKey,
  EngineFacts,
  MarksHit,
  TacticsObjective,
  TacticsSeatState,
  TacticsState,
  TurnFact,
} from "./types";

const STAGE = exerciseBlockStage();

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
 */
export function tacticsMarksOf(
  seat: TacticsSeatState,
  observation: DartObservation,
): MarksHit {
  const bullMarks = BULL_RING_MARKS[observation.hitZoneKey];
  if (bullMarks !== undefined) {
    return { objectiveIndex: BULL_INDEX, marks: bullMarks };
  }
  const number = observation.hitTargetNumber;
  const marks = NUMBER_RING_MARKS[observation.hitZoneKey];
  if (number === null || number < 1 || number > 20 || !marks) return null;
  const numberIndex = TACTICS_OBJECTIVES.indexOf(number);
  if (numberIndex !== -1 && seat.marks[numberIndex] < MARKS_TO_CLOSE) {
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
      initialMarksSeat(
        { participantRef: "", sideKey: "" },
        TACTICS_OBJECTIVES.length,
      ),
      observation,
    ) !== null
  );
}

function initialSeatState(seat: {
  participantRef: string;
  sideKey: string;
}): TacticsSeatState {
  return initialMarksSeat(seat, TACTICS_OBJECTIVES.length);
}

/** Tactics' starting state: every seat with no marks, seat 0 active. */
export function initialTacticsState(
  config: Seated<TacticsSnapshot>,
): TacticsState {
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
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
  return applyMarksDart(state, tacticsMarksOf(state, observation));
}

/**
 * Folds the whole fact log into the session's state — what the engine's own
 * `deriveState()` and the play controller's `state()` both call. Complete
 * once every seat is complete.
 */
export function foldTacticsState(
  facts: EngineFacts,
  config: Seated<TacticsSnapshot>,
): TacticsState {
  const seats = foldSeatStates(
    facts.turns,
    config.seats,
    initialSeatState,
    applyTacticsDart,
  );
  return {
    activeParticipantRef: activeSeat(facts, config.seats, "PER_SEAT")
      .participantRef,
    status: seats.every((seat) => seat.status === "COMPLETE")
      ? "COMPLETE"
      : "IN_PROGRESS",
    seats,
  };
}

/**
 * Tactics V1: close 20–15, the bull, Doubles and Triples in as few darts as
 * possible. The engine owns the fact log; marks, closures and completion are
 * folded from it on every read and never stored. Darts carry no intent: any
 * objective is a legitimate aim on any dart.
 */
export class TacticsEngine implements GameEngine<
  DartObservation,
  TacticsState
> {
  readonly rulesetVersionKey = "TACTICS_V1";
  readonly stageOwnership = "PER_SEAT" as const;
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: Seated<TacticsSnapshot>,
    prior?: EngineFacts,
  ) {
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): TacticsState {
    return foldTacticsState(
      { stages: [{ ...STAGE }], turns: this.turns },
      this.config,
    );
  }

  /**
   * Appends one dart to the open visit, opening a new one when the last is
   * closed. `completedAt` is stamped by a visit's 3rd dart or by the dart
   * that completes the run. Validated against derived state first, so a
   * throw leaves the fact log untouched.
   * @throws when the active seat has already completed.
   */
  record(observation: DartObservation): TacticsState {
    const before = this.deriveState();
    if (activeSeatState(before).status !== "IN_PROGRESS") {
      throw new Error(
        "Cannot record a dart once the game has ended; undo first to correct it.",
      );
    }
    const openTurn = openOrCreateTurn(
      this.turns,
      STAGE.clientKey,
      before.activeParticipantRef,
      (last) =>
        last.completedAt === null && last.darts.length < DARTS_PER_VISIT,
    );
    appendObservedDart(openTurn, observation);
    const after = this.deriveState();
    if (
      openTurn.darts.length === DARTS_PER_VISIT ||
      activeSeatState(after).status === "COMPLETE"
    ) {
      openTurn.completedAt = new Date().toISOString();
    }
    return this.deriveState();
  }

  /** Pops the last dart; a surviving visit reopens (`undoLastDart`). */
  undo(): boolean {
    return undoLastDart(this.turns);
  }

  /** Whether `observation` would close the active seat's last open objective. */
  wouldComplete(observation: DartObservation): boolean {
    const seat = activeSeatState(this.deriveState());
    if (seat.status !== "IN_PROGRESS") return false;
    return applyTacticsDart(seat, observation).status === "COMPLETE";
  }

  isComplete(): boolean {
    return this.deriveState().status !== "IN_PROGRESS";
  }

  state(): TacticsState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const tacticsEngineFactory: GameEngineFactory<
  Seated<TacticsSnapshot>,
  DartObservation,
  TacticsState
> = {
  rulesetVersionKey: "TACTICS_V1",
  stageOwnership: "PER_SEAT",
  create(config: Seated<TacticsSnapshot>, prior?: EngineFacts) {
    return new TacticsEngine(config, prior);
  },
};

registerEngineFactory(tacticsEngineFactory);
