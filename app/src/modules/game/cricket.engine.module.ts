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
import {
  applyMarksDart,
  BULL_RING_MARKS,
  DARTS_PER_VISIT,
  initialMarksSeat,
  NUMBER_RING_MARKS,
} from "./marks-close.module";
import type {
  CricketSeatState,
  CricketState,
  DartObservation,
  EngineFacts,
  MarksHit,
  TurnFact,
} from "./types";

export { effectiveMarks, marksPerRound } from "./marks-close.module";

const STAGE = exerciseBlockStage();

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
  return initialMarksSeat(seat, CRICKET_OBJECTIVES.length);
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
 * Pure reducer: folds one dart onto one seat through `cricketMarksOf` and
 * `applyMarksDart`.
 * @throws when the seat is already complete; undo first to correct it.
 */
export function applyCricketDart(
  state: CricketSeatState,
  observation: DartObservation,
): CricketSeatState {
  return applyMarksDart(state, cricketMarksOf(observation));
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
