import type { FivesSnapshot, Seated } from "@lib/types";
import { registerEngineFactory } from "./engine.registry";
import { NO_INTENT, endedRefusal } from "./turn-log.module";
import { boardScore } from "./board-progression.module";
import {
  dartGameEngineClass,
  dartGameEngineFactory,
} from "./dart-engine-shell.module";
import { foldVisitPoints } from "./visit-points-kernel.module";
import { activeSeat } from "./seat-rota.module";
import type { DartGameSpec, VisitPointsRules } from "./interfaces";
import type {
  DartFact,
  EngineFacts,
  FivesSeatState,
  FivesState,
} from "./types";

/** The running total a seat must reach exactly to win. */
export const FIVES_TARGET = 51;

const DARTS_PER_VISIT = 3;

const GAME_ENDED = endedRefusal("game has ended");

/** A visit total divisible by 5 scores total ÷ 5 fives points; any other total scores 0. */
export function fivesPoints(total: number): number {
  return total % 5 === 0 ? total / 5 : 0;
}

/** Fives V1 as Visit points rules: a dart scoring 0 is off the board and voids the visit; passing 51 busts. */
export const FIVES_RULES: VisitPointsRules = {
  dartsPerVisit: DARTS_PER_VISIT,
  goal: FIVES_TARGET,
  points: fivesPoints,
  voids: (darts) => darts.some((dart) => dart.score === 0),
};

/**
 * Folds the whole fact log into Fives' state: each seat's turns through the
 * Visit points kernel. The first seat on exactly 51 wins at once, so a later
 * seat never throws.
 */
export function foldFivesState(
  facts: EngineFacts,
  config: Seated<FivesSnapshot>,
): FivesState {
  const seats: FivesSeatState[] = config.seats.map((seat) => {
    const kernel = foldVisitPoints(
      facts.turns.filter((turn) => turn.participantRef === seat.participantRef),
      FIVES_RULES,
    );
    return {
      participantRef: seat.participantRef,
      sideKey: seat.sideKey,
      total: kernel.points,
      visits: kernel.visits,
      voids: kernel.voids,
      busts: kernel.busts,
      scoringVisits: kernel.scoringVisits,
      openTotal: kernel.openTotal,
      dartsInVisit: kernel.dartsInVisit,
    };
  });
  const winner = seats.find((seat) => seat.total === FIVES_TARGET);
  return {
    activeParticipantRef:
      winner?.participantRef ??
      activeSeat(facts, config.seats, "SHARED").participantRef,
    status: winner ? "COMPLETE" : "IN_PROGRESS",
    winningSideKey: winner?.sideKey ?? null,
    seats,
  };
}

/**
 * Fives' rules for the dart engine shell over one `SHARED` stage
 * (`fives.md`): three darts a visit, closed early by the winning dart.
 */
const fivesSpec: DartGameSpec<Seated<FivesSnapshot>, FivesState> = {
  rulesetVersionKey: "FIVES_V1",
  stageOwnership: "SHARED",
  fold: foldFivesState,
  refusal: (state) => (state.status === "IN_PROGRESS" ? null : GAME_ENDED),
  intent: () => NO_INTENT,
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
        score: boardScore(observation.hitTargetNumber, observation.hitZoneKey),
      } as DartFact,
    ];
    const total = darts.reduce((sum, dart) => sum + dart.score, 0);
    const earned = FIVES_RULES.voids!(darts) ? 0 : fivesPoints(total);
    return seat.total + earned === FIVES_TARGET;
  },
};

/** Fives engine (Pattern 18), built by the dart engine shell on the Visit points kernel. */
export class FivesEngine extends dartGameEngineClass(fivesSpec) {}

export const fivesEngineFactory = dartGameEngineFactory(fivesSpec, FivesEngine);

registerEngineFactory(fivesEngineFactory);
