import type { ScoreTrainingSnapshot, Seated } from "@lib/types";
import {
  dartGameEngineClass,
  dartGameEngineFactory,
} from "./dart-engine-shell.module";
import { registerEngineFactory } from "./engine.registry";
import { endedRefusal, NO_INTENT } from "./turn-log.module";
import { foldVisitPoints } from "./visit-points-kernel.module";
import { activeSeat } from "./seat-rota.module";
import {
  completedByIndex,
  durationSeatComplete,
  otherSeatsComplete,
} from "./seat-state.module";
import { scoreCompareOutcome } from "./match-outcome.module";
import type { DartGameSpec, VisitPointsRules } from "./interfaces";
import type {
  DartObservation,
  EngineFacts,
  ScoreTrainingSeatState,
  ScoreTrainingState,
  TurnFact,
} from "./types";

const DARTS_PER_VISIT = 3;

const RULES: VisitPointsRules = {
  dartsPerVisit: DARTS_PER_VISIT,
  points: (total) => total,
};

const MATCH_DECIDED =
  "Cannot record a visit once the match is complete; undo first to correct it.";

const OPEN_VISIT_REFUSAL =
  "Finish the open visit on the board before entering a keypad total.";

/**
 * Folds the whole fact log into the session's state: each seat's turns
 * through the Visit points kernel, a visit scoring its own total.
 * `totalScore` counts a still-open board visit's darts (#168); `turnCount`
 * counts closed visits only. Score-compare, highest total wins: both seats
 * play out their own ROUNDS budget (1v1 offers ROUNDS only — see
 * `score-training-setup.data.ts`).
 */
export function foldScoreTrainingState(
  facts: EngineFacts,
  config: Seated<ScoreTrainingSnapshot>,
  timerExpired: boolean,
): ScoreTrainingState {
  const seats: ScoreTrainingSeatState[] = config.seats.map((seat) => {
    const kernel = foldVisitPoints(
      facts.turns.filter((turn) => turn.participantRef === seat.participantRef),
      RULES,
    );
    return {
      participantRef: seat.participantRef,
      sideKey: seat.sideKey,
      turnCount: kernel.visits,
      totalScore: kernel.points + kernel.openTotal,
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
 * Whether a 1v1 match's outcome is settled. A solo session is exempt: its
 * MINUTES expiry can arrive mid-visit, and the finishing visit must still
 * record (see `score-training-play.data.ts`'s `submitVisit`).
 */
function matchDecided(state: ScoreTrainingState): boolean {
  return state.seats.length > 1 && state.status !== "IN_PROGRESS";
}

function isPlayable(
  visitScore: number,
  config: Seated<ScoreTrainingSnapshot>,
): boolean {
  return (
    Number.isInteger(visitScore) &&
    visitScore >= 0 &&
    visitScore <= config.maxVisitScore
  );
}

function keypadRefusal(
  state: ScoreTrainingState,
  visitScore: number,
  config: Seated<ScoreTrainingSnapshot>,
  open: TurnFact | null,
): string | null {
  if (matchDecided(state)) return MATCH_DECIDED;
  if (open !== null) return OPEN_VISIT_REFUSAL;
  if (!isPlayable(visitScore, config))
    return `Enter a score between 0 and ${config.maxVisitScore}.`;
  return null;
}

/**
 * Whether `input` ends the whole session: the active seat's last visit with
 * every other seat already done. False once a 1v1 match is decided.
 */
function wouldCompleteSession(
  state: ScoreTrainingState,
  input: DartObservation | number,
  config: Seated<ScoreTrainingSnapshot>,
  open: TurnFact | null,
): boolean {
  if (matchDecided(state)) return false;
  if (typeof input === "number") {
    if (!isPlayable(input, config) || open !== null) return false;
  } else if (open?.darts.length !== DARTS_PER_VISIT - 1) {
    return false;
  }
  const seat = state.seats.find(
    (candidate) => candidate.participantRef === state.activeParticipantRef,
  )!;
  return (
    durationSeatComplete(config, seat.turnCount + 1, state.timerExpired) &&
    otherSeatsComplete(state.seats, seat.participantRef, (other) =>
      durationSeatComplete(config, other.turnCount, state.timerExpired),
    )
  );
}

const scoreTrainingSpec: DartGameSpec<
  Seated<ScoreTrainingSnapshot>,
  ScoreTrainingState,
  number
> = {
  rulesetVersionKey: "SCORE_TRAINING_V1",
  stageOwnership: "PER_SEAT",
  fold: foldScoreTrainingState,
  refusal: (state) =>
    matchDecided(state) ? endedRefusal("match is complete") : null,
  intent: () => NO_INTENT,
  isVisitOpen: (turn) =>
    turn.completedAt === null && turn.darts.length < DARTS_PER_VISIT,
  wouldComplete: wouldCompleteSession,
  visitInput: {
    isVisit: (input): input is number => typeof input === "number",
    refusal: keypadRefusal,
    total: (_state, input) => input,
  },
  coordinateCapture: true,
  liveTotal: true,
  complete: (state, config) =>
    state.seats.length === 1
      ? durationSeatComplete(
          config,
          state.seats[0].turnCount,
          state.timerExpired,
        )
      : state.status !== "IN_PROGRESS",
};

/**
 * Score Training: every visit is one turn, per seat, under a single exercise
 * block, played for a ROUNDS duration in 1v1 (MINUTES stays solo-only).
 * Score-compare: both seats play their own full round budget, then the
 * higher total wins. On the Visit points kernel and the game shell; a board
 * visit or a keypad total is one visit.
 */
export class ScoreTrainingEngine extends dartGameEngineClass(
  scoreTrainingSpec,
) {}

export const scoreTrainingEngineFactory = dartGameEngineFactory(
  scoreTrainingSpec,
  ScoreTrainingEngine,
);

registerEngineFactory(scoreTrainingEngineFactory);
