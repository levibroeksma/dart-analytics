import { foldFiveOhOneState } from "@modules/game/five-oh-one.engine.module";
import {
  durationOf,
  foldOneTwentyOneState,
} from "@modules/game/one-twenty-one.engine.module";
import {
  CRICKET_OBJECTIVES,
  foldCricketState,
} from "@modules/game/cricket.engine.module";
import {
  TACTICS_OBJECTIVES,
  foldTacticsState,
} from "@modules/game/tactics.engine.module";
import { foldScoreTrainingState } from "@modules/game/score-training.engine.module";
import { foldSinglesTrainingState } from "@modules/game/singles-training.engine.module";
import { foldDoublesTrainingState } from "@modules/game/doubles-training.engine.module";
import { foldBobs27State } from "@modules/game/bobs27.engine.module";
import { foldTuodState } from "@modules/game/tuod.engine.module";
import { foldShanghaiState } from "@modules/game/shanghai.engine.module";
import {
  foldAroundTheClockState,
  rulesOf,
} from "@modules/game/around-the-clock.engine.module";
import {
  doublesPath,
  numbersPath,
} from "@modules/game/board-progression.module";
import { budgetedRound } from "@modules/game/session-context.module";
import { ORDER_MODE_LABELS, joinSubtitle } from "@lib/game/play-subtitle";
import type {
  BoardTarget,
  EngineFacts,
  MultiSeatState,
  SeatState,
  SessionProgress,
} from "@modules/types";
import type {
  AroundTheClockEngineConfig,
  Bobs27Snapshot,
  DoublesTrainingSnapshot,
  FiveOhOneSnapshot,
  ScoreTrainingSnapshot,
  Seated,
  SeatFact,
  TargetOrderMode,
  TuodSnapshot,
} from "@lib/types";

type Summarizer = (config: never, facts: EngineFacts) => SessionProgress;

/** Shanghai is played over numbers 1–20, one round each. */
const SHANGHAI_ROUNDS = 20;

/** A fact log with nothing recorded — the server's view of a session it has not replayed. */
export const EMPTY_FACTS: EngineFacts = { stages: [], turns: [] };

function activeOf<TSeat extends SeatState>(
  state: MultiSeatState<TSeat>,
): TSeat | undefined {
  return state.seats.find(
    (seat) => seat.participantRef === state.activeParticipantRef,
  );
}

/** A path target's label (`BULL`, `D16`, `20`); null past the path's end. */
function targetLabel(
  path: readonly BoardTarget[],
  index: number | undefined,
): string | null {
  const target = index === undefined ? undefined : path[index];
  if (!target) return null;
  if (target.kind === "BULL") return "BULL";
  return target.kind === "DOUBLE" ? `D${target.number}` : String(target.number);
}

function big(
  value: string | number | null | undefined,
  label: string,
): SessionProgress["big"] {
  return value === null || value === undefined
    ? null
    : { value: String(value), label };
}

function orderLabel(mode: TargetOrderMode | undefined): string {
  return mode && Object.hasOwn(ORDER_MODE_LABELS, mode)
    ? ORDER_MODE_LABELS[mode]
    : "";
}

/** The owning player's seat: the first PLAYER seat, else the first seat. */
function ownSeatOf(seats: readonly SeatFact[]): SeatFact {
  return seats.find((seat) => seat.participantTypeKey === "PLAYER") ?? seats[0];
}

function fiveOhOne(
  config: Seated<FiveOhOneSnapshot>,
  facts: EngineFacts,
): SessionProgress {
  const state = foldFiveOhOneState(facts, config);
  const own = ownSeatOf(config.seats);
  const opponents = config.seats.filter((seat) => seat !== own);
  const legsOf = (sideKey: string) =>
    state.sides.find((side) => side.sideKey === sideKey)?.legsWon ?? 0;
  const others = state.sides.filter((side) => side.sideKey !== own.sideKey);
  const best = Math.max(0, ...others.map((side) => side.legsWon));
  return {
    detail: joinSubtitle([
      opponents.length > 0
        ? `vs ${opponents.map((seat) => seat.displayName).join(" & ")}`
        : "",
      `Leg ${Math.max(facts.stages.length, 1)}`,
      `First to ${config.legsToWin}`,
      state.sides.length > 1 ? `${legsOf(own.sideKey)}–${best}` : "",
    ]),
    big: big(
      state.seats.find((seat) => seat.participantRef === own.participantRef)
        ?.remainingScore,
      "TO GO",
    ),
  };
}

function oneTwentyOne(
  config: Parameters<typeof foldOneTwentyOneState>[1],
  facts: EngineFacts,
): SessionProgress {
  const seat = activeOf(foldOneTwentyOneState(facts, config, false));
  return {
    detail: budgetedRound(durationOf(config), seat?.attemptsCompleted ?? 0),
    big: big(seat?.currentTarget, "TARGET"),
  };
}

function cricket(
  config: Parameters<typeof foldCricketState>[1],
  facts: EngineFacts,
): SessionProgress {
  return {
    detail: joinSubtitle(["Solo", `${CRICKET_OBJECTIVES.length} objectives`]),
    big: big(activeOf(foldCricketState(facts, config))?.dartsThrown, "DARTS"),
  };
}

function tactics(
  config: Parameters<typeof foldTacticsState>[1],
  facts: EngineFacts,
): SessionProgress {
  return {
    detail: joinSubtitle(["Solo", `${TACTICS_OBJECTIVES.length} objectives`]),
    big: big(activeOf(foldTacticsState(facts, config))?.dartsThrown, "DARTS"),
  };
}

function scoreTraining(
  config: Seated<ScoreTrainingSnapshot>,
  facts: EngineFacts,
): SessionProgress {
  const seat = activeOf(foldScoreTrainingState(facts, config, false));
  return {
    detail: budgetedRound(config, seat?.turnCount ?? 0),
    big: big(seat?.totalScore, "POINTS"),
  };
}

function singles(
  config: Parameters<typeof foldSinglesTrainingState>[1],
  facts: EngineFacts,
): SessionProgress {
  const seat = activeOf(foldSinglesTrainingState(facts, config));
  return {
    detail: orderLabel(config.orderMode),
    big: big(
      targetLabel(numbersPath(config.targetOrder), seat?.targetIndex),
      "TARGET",
    ),
  };
}

function doublesTraining(
  config: Seated<DoublesTrainingSnapshot>,
  facts: EngineFacts,
): SessionProgress {
  const seat = activeOf(foldDoublesTrainingState(facts, config));
  return {
    detail: orderLabel(config.orderMode),
    big: big(
      targetLabel(doublesPath(config.targetOrder), seat?.targetIndex),
      "TARGET",
    ),
  };
}

function bobs27(
  config: Seated<Bobs27Snapshot>,
  facts: EngineFacts,
): SessionProgress {
  const seat = activeOf(foldBobs27State(facts, config));
  const doubles = doublesPath().length;
  const double = Math.min((seat?.targetIndex ?? 0) + 1, doubles);
  return {
    detail: `Double ${double} of ${doubles}`,
    big: big(seat?.score, "POINTS"),
  };
}

function tuod(
  config: Seated<TuodSnapshot>,
  facts: EngineFacts,
): SessionProgress {
  const seat = activeOf(foldTuodState(facts, config, false));
  return {
    detail: budgetedRound(config, seat?.attempts ?? 0),
    big: big(seat?.currentTarget, "TARGET"),
  };
}

function shanghai(
  config: Parameters<typeof foldShanghaiState>[1],
  facts: EngineFacts,
): SessionProgress {
  const seat = activeOf(foldShanghaiState(facts, config));
  const round = Math.min((seat?.targetIndex ?? 0) + 1, SHANGHAI_ROUNDS);
  return {
    detail: `Round ${round} of ${SHANGHAI_ROUNDS}`,
    big: big(targetLabel(numbersPath(), seat?.targetIndex), "TARGET"),
  };
}

function aroundTheClock(
  config: AroundTheClockEngineConfig,
  facts: EngineFacts,
): SessionProgress {
  const seat = activeOf(foldAroundTheClockState(facts, config, false));
  const { path } = rulesOf(config);
  const numbers = path.flatMap((target) =>
    target.kind === "BULL" ? [] : [target.number],
  );
  return {
    detail: joinSubtitle([
      `Lap ${(seat?.laps ?? 0) + 1}`,
      `${numbers[0]} → ${numbers.at(-1)}`,
    ]),
    big: big(targetLabel(path, seat?.targetIndex), "TARGET"),
  };
}

const SUMMARIZERS: Readonly<Record<string, Summarizer>> = {
  "501_V1": fiveOhOne,
  "121_V1": oneTwentyOne,
  "121_V2": oneTwentyOne,
  CRICKET_V1: cricket,
  TACTICS_V1: tactics,
  SCORE_TRAINING_V1: scoreTraining,
  SINGLES_V1: singles,
  SINGLES_V2: singles,
  SINGLES_V3: singles,
  DOUBLES_TRAINING_V1: doublesTraining,
  BOBS27_V1: bobs27,
  TUOD_V1: tuod,
  SHANGHAI_V1: shanghai,
  SHANGHAI_V2: shanghai,
  AROUND_THE_CLOCK_V1: aroundTheClock,
  AROUND_THE_CLOCK_V2: aroundTheClock,
};

function isSeatedConfig(config: unknown): config is { seats: SeatFact[] } {
  if (typeof config !== "object" || config === null) return false;
  const { seats } = config as { seats?: unknown };
  return Array.isArray(seats) && seats.length > 0;
}

/**
 * Folds a session's facts into its active-session card progress (`detail`
 * plus an optional headline value). Pure and isomorphic: the server passes
 * `EMPTY_FACTS`, the client its live turns. Returns null for a ruleset with
 * no summarizer, a missing or seatless config, or any fold that throws.
 */
export function summarizeProgress(
  rulesetVersionKey: string,
  config: unknown,
  facts: EngineFacts,
): SessionProgress | null {
  const summarize = Object.hasOwn(SUMMARIZERS, rulesetVersionKey)
    ? SUMMARIZERS[rulesetVersionKey]
    : undefined;
  if (!summarize || !isSeatedConfig(config)) return null;
  try {
    return summarize(config as never, facts);
  } catch {
    return null;
  }
}
