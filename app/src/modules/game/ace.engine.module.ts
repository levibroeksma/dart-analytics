import type { AceSnapshot, Seated } from "@lib/types";
import { registerEngineFactory } from "./engine.registry";
import { NO_INTENT, endedRefusal } from "./turn-log.module";
import { BULL_TARGET_NUMBER } from "./board-progression.module";
import {
  dartGameEngineClass,
  dartGameEngineFactory,
} from "./dart-engine-shell.module";
import { foldVisitPoints } from "./visit-points-kernel.module";
import { activeSeat } from "./seat-rota.module";
import { completedByIndex } from "./seat-state.module";
import { scoreCompareOutcome } from "./match-outcome.module";
import { seededPoolDraw } from "./checkout-policies";
import type { DartGameSpec, VisitPointsRules } from "./interfaces";
import type {
  AceSeatState,
  AceState,
  DartFact,
  DartZoneKey,
  EngineFacts,
  TurnFact,
} from "./types";

const DARTS_PER_VISIT = 3;

/** Every round's target comes from 1-20 and the bull (25), repeats allowed. */
export const ACE_TARGET_POOL: readonly number[] = [
  ...Array.from({ length: 20 }, (_, index) => index + 1),
  BULL_TARGET_NUMBER,
];

const GAME_ENDED = endedRefusal("game has ended");

const RING_POINTS: Partial<Record<DartZoneKey, number>> = {
  SINGLE: 1,
  INNER_SINGLE: 1,
  OUTER_SINGLE: 1,
  DOUBLE: 2,
  TREBLE: 3,
};

/**
 * The target (a number, or 25 for the bull) every seat throws at in `round`
 * (zero-based). Keyed by `(drawSeed, round)` alone, so undo and replay
 * redraw it exactly.
 */
export function aceTargetFor(drawSeed: number, round: number): number {
  return seededPoolDraw(drawSeed, ACE_TARGET_POOL, round);
}

/**
 * What one dart earns against `target`: a single 1, a double 2, a treble 3
 * on a number; outer bull 4, inner bull 6 on the bull; anything else 0.
 */
export function aceDartPoints(
  target: number,
  dart: Pick<DartFact, "hitTargetNumber" | "hitZoneKey">,
): number {
  if (target === BULL_TARGET_NUMBER) {
    if (dart.hitZoneKey === "OUTER_BULL") return 4;
    return dart.hitZoneKey === "INNER_BULL" ? 6 : 0;
  }
  return dart.hitTargetNumber === target
    ? (RING_POINTS[dart.hitZoneKey] ?? 0)
    : 0;
}

function visitAcePoints(
  darts: readonly DartFact[],
  drawSeed: number,
  round: number,
): number {
  const target = aceTargetFor(drawSeed, round);
  return darts.reduce((sum, dart) => sum + aceDartPoints(target, dart), 0);
}

/** Ace V1 as Visit points rules: a visit earns the sum of its darts' Ace points on the round's target. */
function aceRules(drawSeed: number): VisitPointsRules {
  return {
    dartsPerVisit: DARTS_PER_VISIT,
    visitPoints: (darts, round) => visitAcePoints(darts, drawSeed, round),
  };
}

function seatTurns(
  facts: EngineFacts,
  participantRef: string,
): readonly TurnFact[] {
  return facts.turns.filter((turn) => turn.participantRef === participantRef);
}

/**
 * Folds the whole fact log into Ace's state: each seat's turns through the
 * Visit points kernel with the round's target. The game ends when every seat
 * has thrown `rounds` visits; the highest total wins and equal highest
 * totals share it (`TIE`).
 */
export function foldAceState(
  facts: EngineFacts,
  config: Seated<AceSnapshot>,
): AceState {
  const rules = aceRules(config.drawSeed);
  const seats: AceSeatState[] = config.seats.map((seat) => {
    const turns = seatTurns(facts, seat.participantRef);
    const kernel = foldVisitPoints(turns, rules);
    const open = kernel.dartsInVisit > 0 ? turns.at(-1)! : null;
    return {
      participantRef: seat.participantRef,
      sideKey: seat.sideKey,
      total: kernel.points,
      visits: kernel.visits,
      scoringVisits: kernel.scoringVisits,
      openPoints: open
        ? visitAcePoints(open.darts, config.drawSeed, kernel.visits)
        : 0,
      dartsInVisit: kernel.dartsInVisit,
    };
  });
  const completed = seats.map((seat) => seat.visits >= config.rounds);
  const outcome = scoreCompareOutcome(
    seats.map((seat, index) => ({
      sideKey: seat.sideKey,
      completed: completed[index],
      metric: seat.total,
    })),
    "HIGHEST",
    "IN_PROGRESS",
  );
  const active = activeSeat(
    facts,
    config.seats,
    "PER_SEAT",
    completedByIndex(seats, completed),
  );
  const activeVisits = seats.find(
    (seat) => seat.participantRef === active.participantRef,
  )!.visits;
  return {
    activeParticipantRef: active.participantRef,
    status: outcome.status,
    winningSideKey: outcome.winningSideKey,
    target:
      outcome.status === "IN_PROGRESS"
        ? aceTargetFor(config.drawSeed, activeVisits)
        : null,
    seats,
  };
}

/**
 * One seat's closed rounds, each with its target and the Ace points it
 * scored (`round` is 1-based): what the result lists beside each target.
 */
export function aceRoundScores(
  facts: EngineFacts,
  config: Seated<AceSnapshot>,
  participantRef: string,
): { round: number; target: number; points: number }[] {
  return seatTurns(facts, participantRef)
    .filter((turn) => turn.darts.length === DARTS_PER_VISIT)
    .map((turn, index) => ({
      round: index + 1,
      target: aceTargetFor(config.drawSeed, index),
      points: visitAcePoints(turn.darts, config.drawSeed, index),
    }));
}

const isLive = (state: AceState): boolean => state.status === "IN_PROGRESS";

/**
 * Ace's rules for the dart engine shell, one `PER_SEAT` stage per seat
 * (`ace.md`): three darts a visit, no early close.
 */
const aceSpec: DartGameSpec<Seated<AceSnapshot>, AceState> = {
  rulesetVersionKey: "ACE_V1",
  stageOwnership: "PER_SEAT",
  fold: foldAceState,
  refusal: (state) => (isLive(state) ? null : GAME_ENDED),
  intent: () => NO_INTENT,
  isVisitOpen: (turn, state) =>
    isLive(state) &&
    turn.completedAt === null &&
    turn.darts.length < DARTS_PER_VISIT,
  wouldComplete: (state, _observation, config, open) => {
    if (!isLive(state)) return false;
    if ((open?.darts.length ?? 0) !== DARTS_PER_VISIT - 1) return false;
    const rounds = config.rounds;
    return state.seats.every(
      (seat) =>
        seat.visits >=
        rounds - (seat.participantRef === state.activeParticipantRef ? 1 : 0),
    );
  },
};

/** Ace engine (Pattern 18), built by the dart engine shell on the Visit points kernel. */
export class AceEngine extends dartGameEngineClass(aceSpec) {}

export const aceEngineFactory = dartGameEngineFactory(aceSpec, AceEngine);

registerEngineFactory(aceEngineFactory);
