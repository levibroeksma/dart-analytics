import type { PrisonerSnapshot, Seated } from "@lib/types";
import { registerEngineFactory } from "./engine.registry";
import { endedRefusal, openVisit, resolveObservation } from "./turn-log.module";
import {
  dartGameEngineClass,
  dartGameEngineFactory,
} from "./dart-engine-shell.module";
import { foldElimination } from "./elimination-kernel.module";
import {
  initialPrisonerExt,
  prisonerWinner,
  resolveDart,
  resolveVisit,
} from "./prisoner-policy";
import type { DartGameSpec, EliminationRules } from "./interfaces";
import type {
  DartObservation,
  EliminationSeat,
  EngineFacts,
  PrisonerExt,
  PrisonerSeatState,
  PrisonerShared,
  PrisonerState,
  TurnFact,
} from "./types";

type Config = Seated<PrisonerSnapshot>;
type Seat = EliminationSeat<PrisonerExt>;

const GAME_ENDED = endedRefusal("game has ended");
const WON_TARGET = 21;

/** Prisoner V1 as Elimination rules: darts held are lives, every dart resolved in order (`resolveDart`), the budget and skip walk at visit close (`resolveVisit`). */
function prisonerRules(
  config: PrisonerSnapshot,
): EliminationRules<PrisonerExt, PrisonerShared> {
  return {
    startingLives: config.darts,
    initExt: () => initialPrisonerExt(config.darts),
    onDart: () => [],
    reduceDart: (thrower, _seats, shared, dart) =>
      resolveDart(thrower, shared, dart),
    initShared: () => ({ lodged: {}, next: null }),
    onVisitClose: resolveVisit,
    activeOverride: (_seats, shared) => shared.next,
    decidedWinner: prisonerWinner,
  };
}

function toSeat(seat: Seat): PrisonerSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    held: seat.lives,
    out: seat.out,
    target: seat.ext.target,
    sitting: seat.ext.sitting,
    budget: seat.ext.budget,
    captured: seat.ext.captured,
    imprisoned: seat.ext.imprisoned,
  };
}

/** A projected seat back as the policy's seat; `missed` restarts at 0, as it does at every visit's start. */
function policySeat(seat: PrisonerSeatState): Seat {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    lives: seat.held,
    out: seat.out,
    ext: {
      target: seat.target,
      missed: 0,
      sitting: seat.sitting,
      budget: seat.budget,
      captured: seat.captured,
      imprisoned: seat.imprisoned,
    },
  };
}

/** The numbers holding at least one prisoner, with their counts. */
function lodgedNow(lodged: PrisonerShared["lodged"]): Record<number, number> {
  return Object.fromEntries(
    Object.entries(lodged).filter(([, count]) => count > 0),
  );
}

function wonByOf(
  status: PrisonerState["status"],
  seats: readonly Seat[],
): PrisonerState["wonBy"] {
  if (status !== "COMPLETE") return null;
  return seats.some((seat) => seat.ext.target >= WON_TARGET)
    ? "COMPLETED_20"
    : "LAST_IN";
}

function seatIn(state: PrisonerState, ref: string): PrisonerSeatState {
  const seat = state.seats.find((s) => s.participantRef === ref);
  if (!seat) throw new Error(`Unknown seat ${ref}`);
  return seat;
}

/**
 * Folds the whole fact log into Prisoner's state via the Elimination kernel;
 * a turn counts as closed only once `completedAt` is set. `dartsLeft` is the
 * active seat's budget less the open visit's darts, 0 once the game is over.
 */
export function foldPrisonerState(
  facts: EngineFacts,
  config: Config,
): PrisonerState {
  const match = foldElimination(
    facts.turns,
    config.seats,
    prisonerRules(config),
  );
  const seats = match.seats.map(toSeat);
  const status = match.status;
  const active = seats.find(
    (seat) => seat.participantRef === match.activeParticipantRef,
  );
  const thrown = openVisit(facts.turns)?.darts.length ?? 0;
  return {
    activeParticipantRef: match.activeParticipantRef,
    status,
    winningSideKey: match.winningSideKey,
    outOrder: match.outOrder,
    seats,
    lodged: lodgedNow(match.shared.lodged),
    dartsLeft: status === "IN_PROGRESS" && active ? active.budget - thrown : 0,
    wonBy: wonByOf(status, match.seats),
  };
}

/** The board fact a coordinate-captured dart resolves to, as an observation. */
function resolved(dart: DartObservation): DartObservation {
  const hit = resolveObservation(dart);
  return {
    hitTargetNumber: hit.targetNumber,
    hitZoneKey: hit.zoneKey,
    locationX: dart.locationX,
    locationY: dart.locationY,
  };
}

/** What one dart did, from the thrower's seat before and after it. */
function dartResult(before: Seat, after: Seat): string {
  const advanced = after.ext.target > before.ext.target;
  const captured = after.ext.captured > before.ext.captured;
  if (advanced && captured) return "Advance and capture";
  if (advanced) return "Advance";
  if (captured) return "Capture";
  if (after.ext.imprisoned > before.ext.imprisoned) return "Prison";
  return "Miss";
}

/**
 * Each dart of a visit by `ref`, thrown from `state`, as `Advance`,
 * `Capture`, `Advance and capture`, `Prison` or `Miss` (a plain miss and a
 * bounce-out alike).
 */
export function prisonerDartResults(
  state: PrisonerState,
  ref: string,
  darts: readonly DartObservation[],
): string[] {
  let thrower = policySeat(seatIn(state, ref));
  let shared: PrisonerShared = { lodged: state.lodged, next: null };
  return darts.map((dart) => {
    const outcome = resolveDart(thrower, shared, dart);
    const change = outcome.changes[0];
    const after: Seat = change
      ? {
          ...thrower,
          lives: thrower.lives + (change.livesDelta ?? 0),
          ext: change.ext ?? thrower.ext,
        }
      : thrower;
    const result = dartResult(thrower, after);
    thrower = after;
    shared = outcome.shared;
    return result;
  });
}

/** Whether `dart`, thrown now by the active seat, completes 20 or leaves one seat in. */
function dartEndsGame(state: PrisonerState, dart: DartObservation): boolean {
  const thrower = policySeat(seatIn(state, state.activeParticipantRef));
  const outcome = resolveDart(
    thrower,
    { lodged: state.lodged, next: null },
    resolved(dart),
  );
  const change = outcome.changes[0];
  if (!change) return false;
  if ((change.ext?.target ?? 0) >= WON_TARGET) return true;
  const throwerOut = thrower.lives + (change.livesDelta ?? 0) <= 0;
  const othersIn = state.seats.filter(
    (seat) => !seat.out && seat.participantRef !== thrower.participantRef,
  ).length;
  return throwerOut && othersIn === 1;
}

/** Whether `turn` still takes darts: open, the game undecided, its thrower in and under its budget. */
function visitOpen(turn: TurnFact, state: PrisonerState): boolean {
  if (turn.completedAt !== null || state.status !== "IN_PROGRESS") return false;
  const thrower = seatIn(state, turn.participantRef);
  return !thrower.out && turn.darts.length < thrower.budget;
}

/**
 * Prisoner's rules for the dart engine shell over one `SHARED` stage
 * (`prisoner.md`): each dart resolves from its coordinates; a visit holds
 * the budget fixed when it opened and closes early on a win or a seat out.
 */
const prisonerSpec: DartGameSpec<Config, PrisonerState> = {
  rulesetVersionKey: "PRISONER_V1",
  stageOwnership: "SHARED",
  coordinateCapture: true,
  fold: foldPrisonerState,
  refusal: (state) => (state.status === "IN_PROGRESS" ? null : GAME_ENDED),
  isVisitOpen: visitOpen,
  wouldComplete: (state, input) =>
    state.status === "IN_PROGRESS" && dartEndsGame(state, input),
};

/** Prisoner engine (Pattern 18), built by the dart engine shell on the Elimination kernel. */
export class PrisonerEngine extends dartGameEngineClass(prisonerSpec) {}

export const prisonerEngineFactory = dartGameEngineFactory(
  prisonerSpec,
  PrisonerEngine,
);

registerEngineFactory(prisonerEngineFactory);
