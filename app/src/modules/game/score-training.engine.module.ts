import type { ScoreTrainingSnapshot, Seated } from "@lib/types";
import { registerEngineFactory } from "./engine.registry";
import {
  appendCompletedTurn,
  appendResolvedDart,
  cloneTurns,
  exerciseBlockStage,
  openOrCreateTurn,
  openVisit,
  resolveObservation,
  sumDartScores,
  undoLastUnit,
} from "./turn-log.module";
import { activeSeat } from "./seat-rota.module";
import {
  completedByIndex,
  durationSeatComplete,
  otherSeatsComplete,
} from "./seat-state.module";
import { scoreCompareOutcome } from "./match-outcome.module";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  DartObservation,
  EngineFacts,
  ScoreTrainingInput,
  ScoreTrainingSeatState,
  ScoreTrainingState,
  TurnFact,
} from "./types";

const STAGE = exerciseBlockStage();
const DARTS_PER_VISIT = 3;

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

/**
 * Folds the whole fact log into the session's state, mirroring
 * `foldTuodState`. `totalScore` sums every one of a seat's turns, open or
 * closed — a dart-captured visit's `totalScore` is kept live by
 * `recordDart` on every dart, before the visit closes, so a still-open
 * visit's darts already count toward the seat's total (#168); `turnCount`
 * counts only closed turns, so an open visit is never treated as a played
 * round. Score-compare, highest total wins: both seats always play out
 * their own full ROUNDS budget (1v1 offers ROUNDS only — see
 * `score-training-setup.data.ts`). `activeSeat` IS passed a real completion
 * predicate here (the 4-argument form), and it is structurally a no-op for
 * the same reason `foldTuodState`'s is: a uniform per-seat budget under
 * lockstep alternation.
 */
export function foldScoreTrainingState(
  facts: EngineFacts,
  config: Seated<ScoreTrainingSnapshot>,
  timerExpired: boolean,
): ScoreTrainingState {
  const seats: ScoreTrainingSeatState[] = config.seats.map((seat) => {
    const seatTurns = facts.turns.filter(
      (turn) => turn.participantRef === seat.participantRef,
    );
    const closedCount = seatTurns.filter(
      (turn) => turn.completedAt !== null,
    ).length;
    return {
      participantRef: seat.participantRef,
      sideKey: seat.sideKey,
      turnCount: closedCount,
      totalScore: seatTurns.reduce((sum, turn) => sum + turn.totalScore, 0),
    };
  });

  const completedSeats = seats.map((seat) =>
    durationSeatComplete(config, seat.turnCount, timerExpired),
  );
  const outcome = scoreCompareOutcome(
    seats.map((seat, index) => ({
      sideKey: seat.sideKey,
      completed: completedSeats[index],
      metric: seat.totalScore,
    })),
    "HIGHEST",
    "IN_PROGRESS",
  );

  return {
    activeParticipantRef: activeSeat(
      facts,
      config.seats,
      "PER_SEAT",
      completedByIndex(seats, completedSeats),
    ).participantRef,
    status: outcome.status,
    winningSideKey: outcome.winningSideKey,
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
   * Whether a 1v1 match's score-compare outcome is already settled — every
   * seat's own round budget exhausted and `winningSideKey` (or a tie) fixed.
   * Guards `record()` against a stray extra call that would otherwise push
   * a seat's `totalScore` past the fold's own budget cap and flip
   * `winningSideKey`, mirroring `TuodEngine`'s completion guard.
   *
   * Deliberately narrower than `isComplete()`: a solo session is exempt here
   * because MINUTES completion there is driven by `timerExpired`, an
   * external signal `expireTimer()` can set mid-visit — `isComplete()` can
   * already read true before the one finishing visit `confirmFinish` still
   * must record (see `score-training-play.data.ts`'s `submitVisit`), so a
   * solo session's own boundary is that turnCount-based `isComplete()`
   * reading, left to callers to consult directly, never enforced here. A 1v1
   * match carries no such risk: it is ROUNDS-only, so `status` only turns
   * terminal as the direct result of the very record call that reaches the
   * last seat's budget — never ahead of it.
   */
  private isMatchDecided(): boolean {
    const state = this.deriveState();
    return state.seats.length > 1 && state.status !== "IN_PROGRESS";
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
   * @throws when a 1v1 match's outcome is already decided; the log is left
   *   untouched.
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
   * @throws when a 1v1 match's outcome is already decided; the log is left
   *   untouched. Checked before any other guard so a decided match's fact
   *   log — and the score-compare `winningSideKey` it is folded into — can
   *   never be mutated after the outcome is settled.
   * @throws when a dart-based turn is still open — a whole-visit total and a
   *   part-thrown board visit are not composable, so this refuses loudly
   *   rather than guess how to merge them. A clean visit boundary (no open
   *   board turn) always accepts a keypad total, so the keypad stays usable
   *   as the accessible alternative from any resting state.
   * @throws when the total is not a whole number within the ruleset's
   *   `0..maxVisitScore` range.
   */
  private recordVisitTotal(visitScore: number): ScoreTrainingState {
    if (this.isMatchDecided()) {
      throw new Error(
        "Cannot record a visit once the match is complete; undo first to correct it.",
      );
    }
    if (openVisit(this.turns) !== null) {
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
    appendCompletedTurn(
      this.turns,
      STAGE.clientKey,
      activeParticipantRef,
      visitScore,
    );
    return this.deriveState();
  }

  /**
   * @throws when a 1v1 match's outcome is already decided; the log is left
   *   untouched. Checked before any other work so a decided match's fact
   *   log — and the score-compare `winningSideKey` it is folded into — can
   *   never be mutated after the outcome is settled.
   */
  private recordDart(observation: DartObservation): ScoreTrainingState {
    if (this.isMatchDecided()) {
      throw new Error(
        "Cannot record a dart once the match is complete; undo first to correct it.",
      );
    }
    const resolved = resolveObservation(observation);

    const turn =
      openVisit(this.turns) ??
      openOrCreateTurn(
        this.turns,
        STAGE.clientKey,
        this.deriveState().activeParticipantRef,
        () => false,
      );

    appendResolvedDart(turn, observation, resolved);

    turn.totalScore = sumDartScores(turn.darts);
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
    return undoLastUnit(this.turns);
  }

  /**
   * Answers whether recording `input` would end the WHOLE session — the
   * active seat's last round, and every other seat already at a terminal
   * status. Mirrors Task 11's `TuodEngine.wouldComplete`. Once a 1v1 match's
   * outcome is already decided there is nothing left for `input` to
   * complete, so this answers false rather than throwing — mirrors
   * `TuodEngine.wouldCompleteDart` — leaving `record()` as the sole throwing
   * guard for that case. Solo sessions are unaffected: `isMatchDecided()`
   * never trips for one seat, so a MINUTES session's already-`isComplete()`
   * reading ahead of its one finishing visit (see `isMatchDecided()`'s own
   * doc) still reports that visit as completing here, exactly as before.
   */
  wouldComplete(input: ScoreTrainingInput): boolean {
    if (this.isMatchDecided()) return false;

    const before = this.deriveState();
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;

    if (isDartObservation(input)) {
      const turn = openVisit(this.turns);
      if (!turn || turn.darts.length !== DARTS_PER_VISIT - 1) return false;
    } else {
      if (!this.isPlayable(input) || openVisit(this.turns) !== null)
        return false;
    }

    const allOtherSeatsComplete = otherSeatsComplete(
      before.seats,
      activeSeatState.participantRef,
      (seat) =>
        durationSeatComplete(this.config, seat.turnCount, this.timerExpired),
    );
    return (
      durationSeatComplete(
        this.config,
        activeSeatState.turnCount + 1,
        this.timerExpired,
      ) && allOtherSeatsComplete
    );
  }

  isComplete(): boolean {
    const state = this.deriveState();
    if (state.seats.length === 1) {
      return durationSeatComplete(
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
