import { foldFiveOhOneState } from "@modules/game/five-oh-one.engine.module";
import { foldOneTwentyOneState } from "@modules/game/one-twenty-one.engine.module";
import { foldScoreTrainingState } from "@modules/game/score-training.engine.module";
import { foldTuodState } from "@modules/game/tuod.engine.module";
import type {
  SessionContextInput,
  SessionContextOptions,
  SessionContextRow,
} from "@modules/types";
import type {
  FiveOhOneSnapshot,
  ScoreTrainingSnapshot,
  Seated,
  TuodSnapshot,
} from "@lib/types";

type FoldedRow = Omit<SessionContextRow, "title"> & { title: string };

type DurationConfig = {
  durationType: string;
  durationValue?: number | null;
};

function fiveOhOneRow(
  input: SessionContextInput,
  config: Seated<FiveOhOneSnapshot>,
): FoldedRow | null {
  const state = foldFiveOhOneState(input.facts, config);
  const seat = state.seats.find(
    (candidate) => candidate.participantRef === state.activeParticipantRef,
  );
  if (!seat) return null;

  const lastStage = input.facts.stages.at(-1);
  const closedVisits = input.facts.turns.filter(
    (turn) =>
      turn.participantRef === seat.participantRef &&
      turn.completedAt !== null &&
      turn.stageClientKey === lastStage?.clientKey,
  ).length;

  return {
    title: "501",
    stage: `Leg ${Math.max(input.facts.stages.length, 1)}`,
    round: `Round ${closedVisits + 1}`,
    value: String(seat.remainingScore),
  };
}

function oneTwentyOneRow(
  input: SessionContextInput,
  config: Parameters<typeof foldOneTwentyOneState>[1],
): FoldedRow | null {
  const state = foldOneTwentyOneState(input.facts, config, input.timerExpired);
  const seat = state.seats.find(
    (candidate) => candidate.participantRef === state.activeParticipantRef,
  );
  if (!seat) return null;

  return {
    title: "121",
    stage: `Attempt ${seat.attemptsCompleted + 1}`,
    round: `Round ${seat.visitsThisAttempt + 1}`,
    value: String(seat.remainingInAttempt),
  };
}

/**
 * The `word` (`Round`, `Attempt`) after `completed` closed ones in sentence
 * case: `Round 3 of 10` against a ROUNDS budget (held at the last one once it
 * is spent), plain `Round 3` under any other duration.
 */
export function budgetedRound(
  config: DurationConfig,
  completed: number,
  word = "Round",
): string {
  const next = completed + 1;
  if (config.durationType === "ROUNDS" && config.durationValue) {
    return `${word} ${Math.min(next, config.durationValue)} of ${config.durationValue}`;
  }
  return `${word} ${next}`;
}

function tuodRow(
  input: SessionContextInput,
  config: Seated<TuodSnapshot>,
): FoldedRow | null {
  const state = foldTuodState(input.facts, config, input.timerExpired);
  const seat = state.seats.find(
    (candidate) => candidate.participantRef === state.activeParticipantRef,
  );
  if (!seat) return null;

  return {
    title: "TUOD",
    stage: null,
    round: budgetedRound(config, seat.attempts),
    value: String(seat.currentTarget),
  };
}

function scoreTrainingRow(
  input: SessionContextInput,
  config: Seated<ScoreTrainingSnapshot>,
): FoldedRow | null {
  const state = foldScoreTrainingState(input.facts, config, input.timerExpired);
  const seat = state.seats.find(
    (candidate) => candidate.participantRef === state.activeParticipantRef,
  );
  if (!seat) return null;

  return {
    title: "Score training",
    stage: null,
    round: budgetedRound(config, seat.turnCount),
    value: String(seat.totalScore),
  };
}

function foldRow(input: SessionContextInput): FoldedRow | null {
  if (input.configSnapshot === null || input.configSnapshot === undefined) {
    return null;
  }
  switch (input.gameTypeKey) {
    case "501":
      return fiveOhOneRow(
        input,
        input.configSnapshot as Seated<FiveOhOneSnapshot>,
      );
    case "ONE_TWENTY_ONE":
      return oneTwentyOneRow(
        input,
        input.configSnapshot as Parameters<typeof foldOneTwentyOneState>[1],
      );
    case "TUOD":
      return tuodRow(input, input.configSnapshot as Seated<TuodSnapshot>);
    case "SCORE_TRAINING":
      return scoreTrainingRow(
        input,
        input.configSnapshot as Seated<ScoreTrainingSnapshot>,
      );
    default:
      return null;
  }
}

/**
 * Folds the persisted fact log into the row a mid-game sheet shows. Returns
 * the fallback title alone — or null — when the log is not the session in
 * play, has no config, or belongs to a game with no mapping.
 */
export function sessionContextRow(
  input: SessionContextInput,
  options: SessionContextOptions = {},
): SessionContextRow | null {
  const { expectedSessionId, fallbackTitle } = options;
  const belongs =
    expectedSessionId === undefined ||
    (expectedSessionId !== null && expectedSessionId === input.sessionId);

  const folded = belongs ? foldRow(input) : null;
  if (folded) return folded;

  return fallbackTitle
    ? { title: fallbackTitle, stage: null, round: null, value: null }
    : null;
}

/** The left-hand parts of a row, in order, with empty ones dropped. */
export function contextRowParts(row: SessionContextRow | null): string[] {
  if (!row) return [];
  return [row.title, row.stage, row.round].filter((part): part is string =>
    Boolean(part),
  );
}
