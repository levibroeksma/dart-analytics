import type { ScoreTrainingSnapshot, Seated } from "@lib/types";
import { newClientKey } from "./client-key.module";
import { classify } from "@lib/game/board/board-geometry.module";
import { registerEngineFactory } from "./engine.registry";
import { activeSeat } from "./seat-rota.module";
import { scoreCompareWinner } from "./match-outcome.module";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  DartObservation,
  EngineFacts,
  ScoreTrainingInput,
  ScoreTrainingSeatState,
  ScoreTrainingState,
  StageFact,
  TurnFact,
} from "./types";

const STAGE: StageFact = {
  clientKey: "block-1",
  stageTypeKey: "EXERCISE_BLOCK",
  parentClientKey: null,
  sequence: 1,
};
const DARTS_PER_VISIT = 3;

function cloneTurns(turns: readonly TurnFact[]): TurnFact[] {
  return turns.map((turn) => ({ ...turn, darts: [...turn.darts] }));
}

/**
 * Discriminates `ScoreTrainingInput` by shape, never by session mode: a
 * keypad total is always a `number`, so anything else is a `DartObservation`
 * no matter which mode the session was created in. `record()` and
 * `wouldComplete()` both dispatch on this, so a keypad-shaped input can never
 * reach the dart-classification path. The engine holds no mode of its own to
 * disagree with the input it is handed.
 */
function isDartObservation(
  input: ScoreTrainingInput,
): input is DartObservation {
  return typeof input !== "number";
}

function seatCompletesAt(
  config: ScoreTrainingSnapshot,
  turnCount: number,
  timerExpired: boolean,
): boolean {
  if (config.durationType === "ROUNDS") {
    return turnCount >= config.durationValue;
  }
  return timerExpired && turnCount >= 1;
}

/**
 * Folds the whole fact log into the session's state, mirroring
 * `foldTuodState`. Score-compare, highest total wins: both seats always play
 * out their own full ROUNDS budget (1v1 offers ROUNDS only — see
 * `score-training-setup.data.ts`); `activeSeat` never needs a completion
 * predicate here for the same reason Task 11's TUOD fold does not.
 */
export function foldScoreTrainingState(
  facts: EngineFacts,
  config: Seated<ScoreTrainingSnapshot>,
  timerExpired: boolean,
): ScoreTrainingState {
  const seats: ScoreTrainingSeatState[] = config.seats.map((seat) => {
    const closed = facts.turns.filter(
      (turn) =>
        turn.participantRef === seat.participantRef &&
        turn.completedAt !== null,
    );
    return {
      participantRef: seat.participantRef,
      sideKey: seat.sideKey,
      turnCount: closed.length,
      totalScore: closed.reduce((sum, turn) => sum + turn.totalScore, 0),
    };
  });

  const completedSeats = seats.map((seat) =>
    seatCompletesAt(config, seat.turnCount, timerExpired),
  );
  const allComplete = completedSeats.every(Boolean);

  const winningSideKey =
    seats.length === 1
      ? null
      : scoreCompareWinner(
          seats.map((seat, index) => ({
            sideKey: seat.sideKey,
            completed: completedSeats[index],
            metric: seat.totalScore,
          })),
          "HIGHEST",
        );

  const status: ScoreTrainingState["status"] =
    seats.length === 1
      ? "IN_PROGRESS"
      : !allComplete
        ? "IN_PROGRESS"
        : winningSideKey !== null
          ? "COMPLETE"
          : "TIE";

  return {
    activeParticipantRef: activeSeat(
      facts,
      config.seats,
      "PER_SEAT",
      (candidate) => {
        const index = seats.findIndex(
          (seat) => seat.participantRef === candidate.participantRef,
        );
        return index === -1 ? false : completedSeats[index];
      },
    ).participantRef,
    status,
    winningSideKey,
    timerExpired,
    seats,
  };
}

/**
 * Score Training: every visit is one turn, per seat, under a single exercise
 * block, played for a ROUNDS duration in 1v1 (MINUTES stays solo-only, same
 * reasoning as TUOD). Score-compare: both seats always play their own full
 * round budget, then whichever totalled the higher score wins.
 */
export class ScoreTrainingEngine implements GameEngine<
  ScoreTrainingInput,
  ScoreTrainingState
> {
  readonly rulesetVersionKey = "SCORE_TRAINING_V1";
  readonly stageOwnership = "PER_SEAT" as const;
  private readonly turns: TurnFact[];
  private timerExpired = false;

  constructor(
    private readonly config: Seated<ScoreTrainingSnapshot>,
    prior?: EngineFacts,
  ) {
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  /** A visit score is playable only as a whole number in `0..maxVisitScore`. */
  private isPlayable(visitScore: number): boolean {
    return (
      Number.isInteger(visitScore) &&
      visitScore >= 0 &&
      visitScore <= this.config.maxVisitScore
    );
  }

  private deriveState(): ScoreTrainingState {
    return foldScoreTrainingState(
      { stages: [STAGE], turns: this.turns },
      this.config,
      this.timerExpired,
    );
  }

  /**
   * Records that the MINUTES countdown has elapsed. The countdown itself lives
   * in `game.store.ts`, not the engine, so expiry arrives as an explicit call
   * rather than as a write through the object `state()` returned — that object
   * is a derived copy, and writing to it changes nothing.
   */
  expireTimer(): void {
    this.timerExpired = true;
  }

  /**
   * Appends one visit total, or one dart, depending on the session's input
   * mode.
   * @throws when a quick-score visit is not a whole number within the
   *   ruleset's `0..maxVisitScore` range; the log is left untouched.
   */
  record(input: ScoreTrainingInput): ScoreTrainingState {
    if (isDartObservation(input)) {
      return this.recordDart(input);
    }
    return this.recordVisitTotal(input);
  }

  /**
   * @throws when a dart-based turn is still open — a whole-visit total and a
   *   part-thrown board visit are not composable, so this refuses loudly
   *   rather than guess how to merge them. A clean visit boundary (no open
   *   board turn) always accepts a keypad total, so the keypad stays usable
   *   as the accessible alternative from any resting state.
   * @throws when the total is not a whole number within the ruleset's
   *   `0..maxVisitScore` range.
   */
  private recordVisitTotal(visitScore: number): ScoreTrainingState {
    if (this.openTurn() !== null) {
      throw new Error(
        "Finish the open visit on the board before entering a keypad total.",
      );
    }
    if (!this.isPlayable(visitScore)) {
      throw new Error(
        `Enter a score between 0 and ${this.config.maxVisitScore}.`,
      );
    }

    const activeParticipantRef = this.deriveState().activeParticipantRef;
    this.turns.push({
      clientKey: newClientKey(),
      stageClientKey: STAGE.clientKey,
      participantRef: activeParticipantRef,
      sequence: this.turns.length + 1,
      completedAt: new Date().toISOString(),
      totalScore: visitScore,
      darts: [],
    });
    return this.deriveState();
  }

  /**
   * The visit still being thrown, or null when the last one closed. Reads
   * `completedAt`, not dart count — a keypad-recorded turn always has
   * `darts: []` and is complete the instant it is pushed, so a dart-count
   * check alone would wrongly treat it as still open and let `recordDart`
   * append into it.
   */
  private openTurn(): TurnFact | null {
    const last = this.turns.at(-1);
    if (!last || last.completedAt !== null) return null;
    return last;
  }

  private recordDart(observation: DartObservation): ScoreTrainingState {
    const resolved =
      observation.locationX === null || observation.locationY === null
        ? { targetNumber: null, zoneKey: observation.hitZoneKey, score: 0 }
        : classify(observation.locationX, observation.locationY);

    let turn = this.openTurn();
    if (!turn) {
      const activeParticipantRef = this.deriveState().activeParticipantRef;
      turn = {
        clientKey: newClientKey(),
        stageClientKey: STAGE.clientKey,
        participantRef: activeParticipantRef,
        sequence: this.turns.length + 1,
        completedAt: null,
        totalScore: 0,
        darts: [],
      };
      this.turns.push(turn);
    }

    turn.darts.push({
      sequence: turn.darts.length + 1,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: resolved.targetNumber,
      hitZoneKey: resolved.zoneKey,
      score: resolved.score,
      locationX: observation.locationX,
      locationY: observation.locationY,
    });

    turn.totalScore = turn.darts.reduce((sum, dart) => sum + dart.score, 0);
    if (turn.darts.length === DARTS_PER_VISIT) {
      turn.completedAt = new Date().toISOString();
    }

    return this.deriveState();
  }

  /**
   * Pops the last recorded unit — a whole visit under quick score, a single
   * dart under visual capture, taking the turn with it when that dart was the
   * only one in it.
   *
   * Dispatches on the shape of the last recorded turn: `record()` already
   * discriminates its input by shape, and both shapes can appear in one
   * session's log, so undo — which has no input to read a shape from — reads
   * the shape of what `record()` actually wrote instead. A turn built from a
   * keypad total always has `darts: []`; a turn built from a board dart
   * always holds at least one dart from the moment it exists in the log
   * (`recordDart` opens a turn and appends its first dart in the same call,
   * so a zero-dart board turn is never observable outside that call).
   * @returns true if something was removed; false if there was nothing to undo.
   */
  undo(): boolean {
    const turn = this.turns.at(-1);
    if (!turn) return false;

    if (turn.darts.length === 0) {
      this.turns.pop();
      return true;
    }

    turn.darts.pop();
    if (turn.darts.length === 0) {
      this.turns.pop();
      return true;
    }

    turn.totalScore = turn.darts.reduce((sum, dart) => sum + dart.score, 0);
    turn.completedAt = null;
    return true;
  }

  /**
   * Answers whether recording `input` would end the WHOLE session — the
   * active seat's last round, and every other seat already at a terminal
   * status. Mirrors Task 11's `TuodEngine.wouldComplete`.
   */
  wouldComplete(input: ScoreTrainingInput): boolean {
    const before = this.deriveState();
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;

    if (isDartObservation(input)) {
      const turn = this.openTurn();
      if (!turn || turn.darts.length !== DARTS_PER_VISIT - 1) return false;
    } else {
      if (!this.isPlayable(input) || this.openTurn() !== null) return false;
    }

    const otherSeatsComplete = before.seats
      .filter((seat) => seat.participantRef !== activeSeatState.participantRef)
      .every((seat) =>
        seatCompletesAt(this.config, seat.turnCount, this.timerExpired),
      );
    return (
      seatCompletesAt(
        this.config,
        activeSeatState.turnCount + 1,
        this.timerExpired,
      ) && otherSeatsComplete
    );
  }

  isComplete(): boolean {
    const state = this.deriveState();
    if (state.seats.length === 1) {
      return seatCompletesAt(
        this.config,
        state.seats[0].turnCount,
        this.timerExpired,
      );
    }
    return state.status !== "IN_PROGRESS";
  }

  state(): ScoreTrainingState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const scoreTrainingEngineFactory: GameEngineFactory<
  Seated<ScoreTrainingSnapshot>,
  ScoreTrainingInput,
  ScoreTrainingState
> = {
  rulesetVersionKey: "SCORE_TRAINING_V1",
  stageOwnership: "PER_SEAT",
  create(config: Seated<ScoreTrainingSnapshot>, prior?: EngineFacts) {
    return new ScoreTrainingEngine(config, prior);
  },
};

registerEngineFactory(scoreTrainingEngineFactory);
