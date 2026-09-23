import type {
  AroundTheClockEngineConfig,
  AroundTheClockSnapshot,
  AroundTheClockV2Snapshot,
  Seated,
  SeatFact,
} from "@lib/types";
import {
  BULL_TARGET_NUMBER,
  clockPath,
  numbersPath,
  targetAt,
} from "./board-progression.module";
import { registerEngineFactory } from "./engine.registry";
import { activeSeat } from "./seat-rota.module";
import {
  activeSeatState,
  foldSeatStates,
  otherSeatsComplete,
} from "./seat-state.module";
import {
  appendObservedDart,
  cloneTurns,
  dartsThrownBy,
  exerciseBlockStage,
  openOrCreateTurn,
  undoLastDart,
} from "./turn-log.module";
import { scoreCompareOutcome } from "./match-outcome.module";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  AroundTheClockRules,
  AroundTheClockSeatState,
  AroundTheClockState,
  BoardTarget,
  DartObservation,
  EngineFacts,
  TurnFact,
} from "./types";

const STAGE = exerciseBlockStage();

const HITS_REQUIRED = { EASY: 0, INTERMEDIATE: 1, HARD: 2, PRO: 3 } as const;

const V1_RULES: AroundTheClockRules = {
  path: numbersPath(),
  segmentRule: "ANY",
  hitsRequired: 0,
  timed: false,
};

/**
 * Resolves a snapshot to its rules. Presence check: a snapshot without
 * `pathDirection` is V1 (mirrors Singles' `scoringModeOf`), so V1 folds
 * exactly as before.
 */
export function rulesOf(
  config: AroundTheClockEngineConfig,
): AroundTheClockRules {
  if (!("pathDirection" in config)) return V1_RULES;
  return {
    path: numbersPath(clockPath(config.pathDirection, config.oddsFirst)),
    segmentRule: config.segmentRule,
    hitsRequired: HITS_REQUIRED[config.difficulty],
    timed: config.durationType === "MINUTES",
  };
}

function initialSeatState(seat: SeatFact): AroundTheClockSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    targetIndex: 0,
    dartsThisVisit: 0,
    hitsThisVisit: 0,
    laps: 0,
    status: "IN_PROGRESS",
  };
}

/** Around the Clock starting state: every configured seat aimed at its path's first target, no darts thrown. */
export function initialAroundTheClockState(
  config: AroundTheClockEngineConfig,
): AroundTheClockState {
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
    winningSideKey: null,
    timerExpired: false,
    seats: config.seats.map(initialSeatState),
  };
}

export function isAroundTheClockHit(
  target: BoardTarget,
  observation: DartObservation,
): boolean {
  if (target.kind === "BULL") {
    return (
      observation.hitTargetNumber === BULL_TARGET_NUMBER &&
      (observation.hitZoneKey === "OUTER_BULL" ||
        observation.hitZoneKey === "INNER_BULL")
    );
  }
  return (
    observation.hitTargetNumber === target.number &&
    observation.hitZoneKey !== "MISS"
  );
}

/** Outer single only: the number's outer single, or either bull ring on BULL. */
export function isClockHit(
  rules: AroundTheClockRules,
  target: BoardTarget,
  observation: DartObservation,
): boolean {
  if (rules.segmentRule === "ANY" || target.kind === "BULL") {
    return isAroundTheClockHit(target, observation);
  }
  return (
    observation.hitTargetNumber === target.number &&
    observation.hitZoneKey === "OUTER_SINGLE"
  );
}

/**
 * Pure reducer: folds one dart observation onto one seat's
 * `AroundTheClockSeatState` under `rules` (V1's when omitted). Easy: a hit
 * advances the target immediately, mid-visit. 1/2/3-dart difficulty: the
 * visit is judged when it closes on its 3rd dart — enough hits move up one,
 * too few step back one, never below the path's first target. At the path's
 * end (BULL) an untimed seat completes; a timed seat adds a lap and restarts
 * at the first target, and that dart closes the visit. `dartsThisVisit`
 * reads 0 after a dart exactly when that dart closed the visit.
 * @throws when `state.status` is not `IN_PROGRESS`; undo first to correct it.
 */
export function applyAroundTheClockDart(
  state: AroundTheClockSeatState,
  observation: DartObservation,
  rules: AroundTheClockRules = V1_RULES,
): AroundTheClockSeatState {
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a dart once the session has ended; undo first to correct it.",
    );
  }

  const lastIndex = rules.path.length - 1;
  const hit = isClockHit(
    rules,
    targetAt(rules.path, state.targetIndex),
    observation,
  );
  const closes = state.dartsThisVisit + 1 === 3;
  const pathEnd = (): AroundTheClockSeatState =>
    rules.timed
      ? {
          ...state,
          laps: state.laps + 1,
          targetIndex: 0,
          dartsThisVisit: 0,
          hitsThisVisit: 0,
          status: "IN_PROGRESS",
        }
      : {
          ...state,
          targetIndex: lastIndex,
          dartsThisVisit: 0,
          hitsThisVisit: 0,
          status: "COMPLETE",
        };

  if (rules.hitsRequired === 0) {
    if (hit && state.targetIndex === lastIndex) return pathEnd();
    return {
      ...state,
      targetIndex: hit ? state.targetIndex + 1 : state.targetIndex,
      dartsThisVisit: closes ? 0 : state.dartsThisVisit + 1,
      status: "IN_PROGRESS",
    };
  }

  const hits = state.hitsThisVisit + (hit ? 1 : 0);
  if (!closes) {
    return {
      ...state,
      dartsThisVisit: state.dartsThisVisit + 1,
      hitsThisVisit: hits,
    };
  }
  if (hits >= rules.hitsRequired) {
    if (state.targetIndex === lastIndex) return pathEnd();
    return {
      ...state,
      targetIndex: state.targetIndex + 1,
      dartsThisVisit: 0,
      hitsThisVisit: 0,
    };
  }
  return {
    ...state,
    targetIndex: Math.max(0, state.targetIndex - 1),
    dartsThisVisit: 0,
    hitsThisVisit: 0,
  };
}

/**
 * Folds the whole fact log into the session's state — the function the
 * engine's own `deriveState()` delegates to, and the play controller's own
 * `state()` folds directly against `$store.game`'s reactive fields, exactly
 * like `foldTuodState`/`foldFiveOhOneState`.
 *
 * Score-compare, fewest darts wins: both seats always play out their own
 * full circuit — a completed seat is skipped by `activeSeat`'s completion
 * predicate, handing every remaining turn to the other, so a miss's extra
 * visit never steals a turn from a seat that has already finished. The
 * match resolves only once both seats are `COMPLETE`.
 *
 * Timed (V2 MINUTES): no seat completes on darts — the bull restarts the lap.
 * Once `timerExpired`, a seat is `COMPLETE` when it has at least one closed
 * visit and no open one, so the visit in hand when time runs out still
 * finishes.
 */
export function foldAroundTheClockState(
  facts: EngineFacts,
  config: AroundTheClockEngineConfig,
  timerExpired = false,
): AroundTheClockState {
  const rules = rulesOf(config);
  const folded = foldSeatStates(
    facts.turns,
    config.seats,
    initialSeatState,
    (state, observation) => applyAroundTheClockDart(state, observation, rules),
  );
  const seats =
    rules.timed && timerExpired
      ? folded.map((seat) =>
          timedSeatDone(seat.participantRef, facts.turns)
            ? { ...seat, status: "COMPLETE" as const }
            : seat,
        )
      : folded;

  const outcome = scoreCompareOutcome(
    seats.map((seat) => ({
      sideKey: seat.sideKey,
      completed: seat.status === "COMPLETE",
      metric: dartsThrownBy(seat.participantRef, facts.turns),
    })),
    "LOWEST",
    seats[0].status,
  );

  return {
    activeParticipantRef: activeSeat(
      facts,
      config.seats,
      "PER_SEAT",
      (candidate) =>
        seats.find((seat) => seat.participantRef === candidate.participantRef)
          ?.status === "COMPLETE",
    ).participantRef,
    status: outcome.status,
    winningSideKey: outcome.winningSideKey,
    timerExpired,
    seats,
  };
}

/** A timed seat is done after expiry once it has a closed visit and no open one. */
function timedSeatDone(
  participantRef: string,
  turns: readonly TurnFact[],
): boolean {
  const own = turns.filter((turn) => turn.participantRef === participantRef);
  return (
    own.some((turn) => turn.completedAt !== null) &&
    own.every((turn) => turn.completedAt !== null)
  );
}

/**
 * Around the Clock: a 21-target path (V1: 1..20, then BULL; V2: direction and
 * odds-first order, BULL last) walked per seat under the snapshot's rules.
 * One class serves both versions; the key is read off the snapshot's shape.
 * Score-compare: both seats always play their whole circuit, then whichever
 * finished in fewer darts wins — a miss costs an extra visit, so seats can
 * finish in different visit counts, which is why `activeSeat` needs the
 * completion predicate this engine passes. A timed V2 run ends only through
 * `expireTimer()`.
 */
export class AroundTheClockEngine implements GameEngine<
  DartObservation,
  AroundTheClockState
> {
  readonly rulesetVersionKey: "AROUND_THE_CLOCK_V1" | "AROUND_THE_CLOCK_V2";
  readonly stageOwnership = "PER_SEAT" as const;
  private readonly turns: TurnFact[];
  private readonly rules: AroundTheClockRules;
  private timerExpired = false;

  constructor(
    private readonly config: AroundTheClockEngineConfig,
    prior?: EngineFacts,
  ) {
    this.turns = prior ? cloneTurns(prior.turns) : [];
    this.rules = rulesOf(config);
    this.rulesetVersionKey =
      "pathDirection" in config ? "AROUND_THE_CLOCK_V2" : "AROUND_THE_CLOCK_V1";
  }

  private deriveState(): AroundTheClockState {
    return foldAroundTheClockState(
      { stages: [{ ...STAGE }], turns: this.turns },
      this.config,
      this.timerExpired,
    );
  }

  private openOrCreateTurn(activeParticipantRef: string): TurnFact {
    return openOrCreateTurn(
      this.turns,
      STAGE.clientKey,
      activeParticipantRef,
      (last) =>
        last.participantRef === activeParticipantRef &&
        last.darts.length < 3 &&
        last.completedAt === null,
    );
  }

  /**
   * Appends one dart to the active seat's open visit, opening a new one when
   * the last is already 3 darts deep, closed, or belongs to a different seat
   * — a completing BULL hit or a timed lap restart can close a visit short
   * (1 or 2 darts), and that closed visit must never be reused, by the other
   * seat or the same one. `completedAt` is stamped when the dart closes the
   * visit, which the reducer signals by `dartsThisVisit` reading 0.
   * @throws when the active seat has already completed its own circuit; the
   *   fact log is left untouched.
   */
  record(observation: DartObservation): AroundTheClockState {
    const before = this.deriveState();
    const seatBefore = activeSeatState(before);
    if (seatBefore.status !== "IN_PROGRESS") {
      throw new Error(
        "Cannot record a dart once the session has ended; undo first to correct it.",
      );
    }
    const after = applyAroundTheClockDart(seatBefore, observation, this.rules);

    const openTurn = this.openOrCreateTurn(before.activeParticipantRef);
    appendObservedDart(openTurn, observation);
    if (after.dartsThisVisit === 0) {
      openTurn.completedAt = new Date().toISOString();
    }

    return this.deriveState();
  }

  undo(): boolean {
    return undoLastDart(this.turns);
  }

  /**
   * Answers whether recording `observation` would complete the WHOLE
   * session, not merely the active seat's own circuit: for a solo session
   * (the only other seat set is empty) those are the same thing; for 1v1 the
   * match only completes once every other seat has already finished. A timed
   * seat completes only on the dart that closes its visit after expiry.
   */
  wouldComplete(observation: DartObservation): boolean {
    const before = this.deriveState();
    const seatBefore = activeSeatState(before);
    if (seatBefore.status !== "IN_PROGRESS") return false;

    const after = applyAroundTheClockDart(seatBefore, observation, this.rules);
    const seatDone = this.rules.timed
      ? this.timerExpired && after.dartsThisVisit === 0
      : after.status === "COMPLETE";
    if (!seatDone) return false;

    return otherSeatsComplete(
      before.seats,
      seatBefore.participantRef,
      (seat) => seat.status === "COMPLETE",
    );
  }

  /**
   * Marks a timed run's clock as run out. The play controller calls this from
   * its countdown; the seat still finishes its open visit before the session
   * reads complete. Must be called on the engine itself, never through the
   * derived object `state()` returns.
   */
  expireTimer(): void {
    this.timerExpired = true;
  }

  isComplete(): boolean {
    return this.deriveState().status !== "IN_PROGRESS";
  }

  state(): AroundTheClockState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const aroundTheClockEngineFactory: GameEngineFactory<
  Seated<AroundTheClockSnapshot>,
  DartObservation,
  AroundTheClockState
> = {
  rulesetVersionKey: "AROUND_THE_CLOCK_V1",
  stageOwnership: "PER_SEAT",
  create(config: Seated<AroundTheClockSnapshot>, prior?: EngineFacts) {
    return new AroundTheClockEngine(config, prior);
  },
};

export const aroundTheClockV2EngineFactory: GameEngineFactory<
  Seated<AroundTheClockV2Snapshot>,
  DartObservation,
  AroundTheClockState
> = {
  rulesetVersionKey: "AROUND_THE_CLOCK_V2",
  stageOwnership: "PER_SEAT",
  create(config: Seated<AroundTheClockV2Snapshot>, prior?: EngineFacts) {
    return new AroundTheClockEngine(config, prior);
  },
};

registerEngineFactory(aroundTheClockEngineFactory);
registerEngineFactory(aroundTheClockV2EngineFactory);
