import type { CricketSnapshot, Seated } from "@lib/types";
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
import type {
  CricketSeatState,
  CricketState,
  DartObservation,
  DartZoneKey,
  EngineFacts,
  TurnFact,
} from "./types";

const STAGE = exerciseBlockStage();
const MARKS_TO_CLOSE = 3;
const DARTS_PER_VISIT = 3;

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

const NUMBER_MARKS: Partial<Record<DartZoneKey, number>> = {
  SINGLE: 1,
  INNER_SINGLE: 1,
  OUTER_SINGLE: 1,
  DOUBLE: 2,
  TREBLE: 3,
};

const BULL_MARKS: Partial<Record<DartZoneKey, number>> = {
  OUTER_BULL: 1,
  INNER_BULL: 2,
};

/**
 * The objective a dart marks and how many marks it adds, or null for a dart
 * that marks nothing (1–14, a miss). The bull is keyed on the ring alone, so a
 * visual-board bull hit marks it whatever number the hit carries.
 */
export function cricketMarksOf(
  observation: DartObservation,
): { objectiveIndex: number; marks: number } | null {
  const bullMarks = BULL_MARKS[observation.hitZoneKey];
  if (bullMarks !== undefined) {
    return { objectiveIndex: BULL_INDEX, marks: bullMarks };
  }
  if (observation.hitTargetNumber === null) return null;
  const objectiveIndex = CRICKET_OBJECTIVES.indexOf(
    observation.hitTargetNumber,
  );
  const marks = NUMBER_MARKS[observation.hitZoneKey];
  if (objectiveIndex === -1 || objectiveIndex === BULL_INDEX || !marks) {
    return null;
  }
  return { objectiveIndex, marks };
}

function initialSeatState(seat: {
  participantRef: string;
  sideKey: string;
}): CricketSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    marks: CRICKET_OBJECTIVES.map(() => 0),
    closedAtDart: CRICKET_OBJECTIVES.map(() => null),
    dartsThrown: 0,
    dartsThisVisit: 0,
    status: "IN_PROGRESS",
  };
}

/** Cricket's starting state: every seat with no marks, seat 0 active. */
export function initialCricketState(
  config: Seated<CricketSnapshot>,
): CricketState {
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
    seats: config.seats.map(initialSeatState),
  };
}

/**
 * Pure reducer: folds one dart onto one seat. Marks add to their objective,
 * capped at 3; overflow is discarded. Every dart counts as thrown. The dart
 * that closes the last open objective completes the seat immediately, on
 * any dart of the visit.
 * @throws when the seat is already complete; undo first to correct it.
 */
export function applyCricketDart(
  state: CricketSeatState,
  observation: DartObservation,
): CricketSeatState {
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a dart once the game has ended; undo first to correct it.",
    );
  }
  const dartsThrown = state.dartsThrown + 1;
  const marks = [...state.marks];
  const closedAtDart = [...state.closedAtDart];
  const hit = cricketMarksOf(observation);
  if (hit && marks[hit.objectiveIndex] < MARKS_TO_CLOSE) {
    marks[hit.objectiveIndex] = Math.min(
      MARKS_TO_CLOSE,
      marks[hit.objectiveIndex] + hit.marks,
    );
    if (marks[hit.objectiveIndex] === MARKS_TO_CLOSE) {
      closedAtDart[hit.objectiveIndex] = dartsThrown;
    }
  }
  const complete = marks.every((count) => count === MARKS_TO_CLOSE);
  const visitDarts = state.dartsThisVisit + 1;
  return {
    ...state,
    marks,
    closedAtDart,
    dartsThrown,
    dartsThisVisit: complete || visitDarts === DARTS_PER_VISIT ? 0 : visitDarts,
    status: complete ? "COMPLETE" : "IN_PROGRESS",
  };
}

/** Marks that counted toward closing — at most 21. */
export function effectiveMarks(seat: CricketSeatState): number {
  return seat.marks.reduce((sum, count) => sum + count, 0);
}

/** Marks per round of 3 darts; 0 before the first dart. */
export function marksPerRound(seat: CricketSeatState): number {
  return seat.dartsThrown === 0
    ? 0
    : (effectiveMarks(seat) / seat.dartsThrown) * DARTS_PER_VISIT;
}

/**
 * Folds the whole fact log into the session's state — what the engine's own
 * `deriveState()` and the play controller's `state()` both call. Complete
 * once every seat is complete.
 */
export function foldCricketState(
  facts: EngineFacts,
  config: Seated<CricketSnapshot>,
): CricketState {
  const seats = foldSeatStates(
    facts.turns,
    config.seats,
    initialSeatState,
    applyCricketDart,
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
 * Cricket V1: close 20–15 and the bull in as few darts as possible. The
 * engine owns the fact log; marks, closures and completion are folded from
 * it on every read and never stored. Darts carry no intent: any objective is
 * a legitimate aim on any dart.
 */
export class CricketEngine implements GameEngine<
  DartObservation,
  CricketState
> {
  readonly rulesetVersionKey = "CRICKET_V1";
  readonly stageOwnership = "PER_SEAT" as const;
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: Seated<CricketSnapshot>,
    prior?: EngineFacts,
  ) {
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): CricketState {
    return foldCricketState(
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
  record(observation: DartObservation): CricketState {
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
    return applyCricketDart(seat, observation).status === "COMPLETE";
  }

  isComplete(): boolean {
    return this.deriveState().status !== "IN_PROGRESS";
  }

  state(): CricketState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const cricketEngineFactory: GameEngineFactory<
  Seated<CricketSnapshot>,
  DartObservation,
  CricketState
> = {
  rulesetVersionKey: "CRICKET_V1",
  stageOwnership: "PER_SEAT",
  create(config: Seated<CricketSnapshot>, prior?: EngineFacts) {
    return new CricketEngine(config, prior);
  },
};

registerEngineFactory(cricketEngineFactory);
