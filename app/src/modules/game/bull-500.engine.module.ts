import type { Bull500Snapshot, Seated } from "@lib/types";
import { BULL_TARGET_NUMBER, boardScore } from "./board-progression.module";
import {
  dartGameEngineClass,
  dartGameEngineFactory,
} from "./dart-engine-shell.module";
import { registerEngineFactory } from "./engine.registry";
import { endedRefusal } from "./turn-log.module";
import { foldVisitPoints } from "./visit-points-kernel.module";
import { activeSeat } from "./seat-rota.module";
import type { DartGameSpec, VisitPointsRules } from "./interfaces";
import type {
  Bull500SeatState,
  Bull500State,
  DartFact,
  DartIntent,
  EngineFacts,
} from "./types";

const GAME_ENDED = endedRefusal("game has ended");

/** The running total a seat must reach, or pass, to finish. */
export const BULL_500_TARGET = 500;

/** The one number that scores once a visit is unlocked. */
export const BULL_500_LIVE_NUMBER = 20;

const DARTS_PER_VISIT = 3;

function isBull(dart: DartFact): boolean {
  return dart.hitTargetNumber === BULL_TARGET_NUMBER;
}

/** Whether a bull (outer or inner) is among a visit's darts. */
export function bull500Unlocked(darts: readonly DartFact[]): boolean {
  return darts.some(isBull);
}

/**
 * A visit's Bull 500 points: the first bull unlocks and scores nothing; each
 * later dart on the 20 scores its board score; every other dart scores 0.
 */
export function bull500VisitPoints(darts: readonly DartFact[]): number {
  let unlocked = false;
  let points = 0;
  for (const dart of darts) {
    if (isBull(dart)) {
      unlocked = true;
    } else if (unlocked && dart.hitTargetNumber === BULL_500_LIVE_NUMBER) {
      points += dart.score;
    }
  }
  return points;
}

/** Bull 500 V1 as Visit points rules: points come from the ordered darts. */
export const BULL_500_RULES: VisitPointsRules = {
  dartsPerVisit: DARTS_PER_VISIT,
  points: (total) => total,
  pointsOf: bull500VisitPoints,
};

function isClosed(turn: { darts: readonly DartFact[] }): boolean {
  return turn.darts.length >= DARTS_PER_VISIT;
}

/**
 * Folds the whole fact log into Bull 500's state: each seat's turns through
 * the Visit points kernel with `BULL_500_RULES`. A seat whose closed visits
 * total `BULL_500_TARGET` or more has won; an open visit never decides it.
 */
export function foldBull500State(
  facts: EngineFacts,
  config: Seated<Bull500Snapshot>,
): Bull500State {
  const seats: Bull500SeatState[] = config.seats.map((seat) => {
    const turns = facts.turns.filter(
      (turn) => turn.participantRef === seat.participantRef,
    );
    const kernel = foldVisitPoints(turns, BULL_500_RULES);
    const open = kernel.dartsInVisit > 0 ? turns.at(-1)! : null;
    return {
      participantRef: seat.participantRef,
      sideKey: seat.sideKey,
      total: kernel.points,
      visits: kernel.visits,
      dartsThrown: kernel.dartsThrown,
      bestVisit: turns
        .filter(isClosed)
        .reduce(
          (best, turn) => Math.max(best, bull500VisitPoints(turn.darts)),
          0,
        ),
      scoringVisits: kernel.scoringVisits,
      openTotal: kernel.openTotal,
      dartsInVisit: kernel.dartsInVisit,
      unlocked: open !== null && bull500Unlocked(open.darts),
    };
  });
  const winner = seats.find((seat) => seat.total >= BULL_500_TARGET);
  return {
    activeParticipantRef: activeSeat(facts, config.seats, "PER_SEAT")
      .participantRef,
    status: winner ? "COMPLETE" : "IN_PROGRESS",
    winningSideKey: winner?.sideKey ?? null,
    seats,
  };
}

/** The intent of the next dart: the bull until the visit unlocks, then the 20, never a ring. */
function bull500Intent(state: Bull500State): DartIntent {
  const seat = state.seats.find(
    (candidate) => candidate.participantRef === state.activeParticipantRef,
  )!;
  return {
    intendedTargetNumber: seat.unlocked
      ? BULL_500_LIVE_NUMBER
      : BULL_TARGET_NUMBER,
    intendedZoneKey: null,
  };
}

/**
 * Bull 500's rules for the dart engine shell over one `PER_SEAT` stage
 * (`bull-500.md`): three darts a visit, always all three, including the
 * visit that reaches 500.
 */
const bull500Spec: DartGameSpec<Seated<Bull500Snapshot>, Bull500State> = {
  rulesetVersionKey: "BULL_500_V1",
  stageOwnership: "PER_SEAT",
  fold: foldBull500State,
  refusal: (state) => (state.status === "IN_PROGRESS" ? null : GAME_ENDED),
  intent: bull500Intent,
  isVisitOpen: (turn, state) =>
    turn.completedAt === null &&
    turn.darts.length < DARTS_PER_VISIT &&
    state.status === "IN_PROGRESS",
  wouldComplete: (state, observation, _config, open) => {
    if (state.status !== "IN_PROGRESS") return false;
    if (open?.darts.length !== DARTS_PER_VISIT - 1) return false;
    const seat = state.seats.find(
      (candidate) => candidate.participantRef === state.activeParticipantRef,
    )!;
    const darts = [
      ...open.darts,
      {
        hitTargetNumber: observation.hitTargetNumber,
        hitZoneKey: observation.hitZoneKey,
        score: boardScore(observation.hitTargetNumber, observation.hitZoneKey),
      } as DartFact,
    ];
    return seat.total + bull500VisitPoints(darts) >= BULL_500_TARGET;
  },
};

/** Bull 500 engine (Pattern 18), built by the dart engine shell on the Visit points kernel. */
export class Bull500Engine extends dartGameEngineClass(bull500Spec) {}

export const bull500EngineFactory = dartGameEngineFactory(
  bull500Spec,
  Bull500Engine,
);

registerEngineFactory(bull500EngineFactory);
