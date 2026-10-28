import type { KillerSnapshot, Seated } from "@lib/types";
import { registerEngineFactory } from "./engine.registry";
import { NO_INTENT, endedRefusal } from "./turn-log.module";
import { eliminationWinner } from "./match-outcome.module";
import {
  dartGameEngineClass,
  dartGameEngineFactory,
} from "./dart-engine-shell.module";
import {
  applyEliminationDart,
  foldElimination,
} from "./elimination-kernel.module";
import { killerHit } from "./elimination-policies";
import type { DartGameSpec, EliminationRules } from "./interfaces";
import type {
  EliminationSeat,
  EngineFacts,
  KillerExt,
  KillerSeatState,
  KillerState,
} from "./types";

const GAME_ENDED = endedRefusal("game has ended");

/** Killer V1 as Elimination rules: three lives, each seat's number from the snapshot, `killerHit` per dart. */
function killerRules(config: KillerSnapshot): EliminationRules<KillerExt> {
  return {
    startingLives: config.lives,
    initExt: (_seat, index) => ({
      number: config.seatNumbers[index],
      killer: false,
      livesTaken: 0,
      dartsToKiller: null,
      dartsThrown: 0,
    }),
    onDart: killerHit,
  };
}

function toKillerSeat(seat: EliminationSeat<KillerExt>): KillerSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    lives: seat.lives,
    out: seat.out,
    ...seat.ext,
  };
}

function toEliminationSeat(seat: KillerSeatState): EliminationSeat<KillerExt> {
  const { participantRef, sideKey, lives, out, ...ext } = seat;
  return { participantRef, sideKey, lives, out, ext };
}

/**
 * Folds the whole fact log into Killer's state via the Elimination kernel;
 * the play controller folds against it directly.
 */
export function foldKillerState(
  facts: EngineFacts,
  config: Seated<KillerSnapshot>,
): KillerState {
  const match = foldElimination(facts.turns, config.seats, killerRules(config));
  return {
    activeParticipantRef: match.activeParticipantRef,
    status: match.status,
    winningSideKey: match.winningSideKey,
    outOrder: match.outOrder,
    seats: match.seats.map(toKillerSeat),
  };
}

/**
 * Killer's rules for the dart engine shell over one `SHARED` stage (`killer.md`):
 * up to three darts a visit, closed early by the game's last life.
 */
const killerSpec: DartGameSpec<Seated<KillerSnapshot>, KillerState> = {
  rulesetVersionKey: "KILLER_V1",
  stageOwnership: "SHARED",
  fold: foldKillerState,
  refusal: (state) => (state.status === "IN_PROGRESS" ? null : GAME_ENDED),
  intent: () => NO_INTENT,
  isVisitOpen: (turn, state) =>
    turn.completedAt === null &&
    turn.darts.length < 3 &&
    state.status === "IN_PROGRESS",
  wouldComplete: (state, observation, config) => {
    if (state.status !== "IN_PROGRESS") return false;
    const after = applyEliminationDart(
      state.seats.map(toEliminationSeat),
      state.activeParticipantRef,
      observation,
      killerRules(config),
    );
    return (
      eliminationWinner(
        after.map((seat) => ({ sideKey: seat.sideKey, failed: seat.out })),
      ) !== null
    );
  },
};

/** Killer engine (Pattern 18), built by the dart engine shell on the Elimination kernel. */
export class KillerEngine extends dartGameEngineClass(killerSpec) {}

export const killerEngineFactory = dartGameEngineFactory(
  killerSpec,
  KillerEngine,
);

registerEngineFactory(killerEngineFactory);
