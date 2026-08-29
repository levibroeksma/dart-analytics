import type {
  RulesetVersionKey,
  Seated,
  SeatFact,
  SinglesSnapshot,
  SinglesV2Snapshot,
} from "@lib/types";
import {
  BULL_TARGET_NUMBER,
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
  exerciseBlockStage,
  openOrCreateTurn,
  undoLastDart,
} from "./turn-log.module";
import { eliminationWinner, scoreCompareOutcome } from "./match-outcome.module";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  BoardTarget,
  DartObservation,
  DartZoneKey,
  EngineFacts,
  SinglesTrainingSeatState,
  SinglesTrainingState,
  TurnFact,
} from "./types";

const STAGE = exerciseBlockStage();

type SinglesEngineConfig = Seated<SinglesSnapshot> | Seated<SinglesV2Snapshot>;

function initialSeatState(seat: SeatFact): SinglesTrainingSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    targetIndex: 0,
    totalPoints: 0,
    dartsThisVisit: 0,
    hitsThisVisit: 0,
    status: "IN_PROGRESS",
  };
}

/** Singles Training starting state: every configured seat aimed at NUMBER 1, no darts thrown. */
export function initialSinglesTrainingState(
  config: SinglesEngineConfig,
): SinglesTrainingState {
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
    winningSideKey: null,
    seats: config.seats.map(initialSeatState),
  };
}

/**
 * Every `DartZoneKey` a single ring can produce: the unbanded value keypad
 * capture records, plus the two bands coordinate capture resolves to. Singles
 * Training treats all three as equally valid single hits, differing only from
 * DOUBLE and TREBLE in point value.
 */
const SINGLE_ZONE_KEYS: ReadonlySet<DartZoneKey> = new Set([
  "SINGLE",
  "INNER_SINGLE",
  "OUTER_SINGLE",
]);

function requiredHitsFor(
  difficulty: SinglesEngineConfig["difficulty"],
): number {
  if (difficulty === "HARD") return 1;
  if (difficulty === "EXTREME") return 2;
  return 0;
}

/**
 * Whether `observation` landed on `target`'s section at all — single, double
 * or treble on a NUMBER target, outer or inner on BULL — independent of the
 * ring's point value, so a HARD/EXTREME mandatory-hit count never depends on
 * a configured `pointsSingle`/`pointsDouble`/`pointsTreble` staying nonzero.
 */
function isHitOnTarget(
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
    (SINGLE_ZONE_KEYS.has(observation.hitZoneKey) ||
      observation.hitZoneKey === "DOUBLE" ||
      observation.hitZoneKey === "TREBLE")
  );
}

function trainingPointsFor(
  target: BoardTarget,
  config: SinglesEngineConfig,
  observation: DartObservation,
): number {
  if (target.kind === "BULL") {
    if (observation.hitTargetNumber !== BULL_TARGET_NUMBER) return 0;
    if (observation.hitZoneKey === "OUTER_BULL") return config.pointsSingle;
    if (observation.hitZoneKey === "INNER_BULL") return config.pointsDouble;
    return 0;
  }
  if (observation.hitTargetNumber !== target.number) return 0;
  if (SINGLE_ZONE_KEYS.has(observation.hitZoneKey)) return config.pointsSingle;
  if (observation.hitZoneKey === "DOUBLE") return config.pointsDouble;
  if (observation.hitZoneKey === "TREBLE") return config.pointsTreble;
  return 0;
}

/**
 * Pure reducer: folds one dart observation onto one seat's
 * `SinglesTrainingSeatState`.
 * @throws when `state.status` is not `IN_PROGRESS`; undo first to correct it.
 */
export function applySinglesTrainingDart(
  config: SinglesEngineConfig,
  state: SinglesTrainingSeatState,
  observation: DartObservation,
): SinglesTrainingSeatState {
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a dart once the session is complete; undo first to correct it.",
    );
  }

  const target = targetAt(numbersPath(config.targetOrder), state.targetIndex);
  const totalPoints =
    state.totalPoints + trainingPointsFor(target, config, observation);
  const dartsThisVisit = state.dartsThisVisit + 1;
  const hitsThisVisit =
    state.hitsThisVisit + (isHitOnTarget(target, observation) ? 1 : 0);

  if (dartsThisVisit < 3) {
    return { ...state, totalPoints, dartsThisVisit, hitsThisVisit };
  }
  if (hitsThisVisit < requiredHitsFor(config.difficulty)) {
    return {
      ...state,
      totalPoints,
      dartsThisVisit: 0,
      hitsThisVisit: 0,
      status: "LOST",
    };
  }
  if (state.targetIndex === 20) {
    return {
      ...state,
      totalPoints,
      dartsThisVisit: 0,
      hitsThisVisit: 0,
      status: "COMPLETE",
    };
  }
  return {
    ...state,
    totalPoints,
    dartsThisVisit: 0,
    hitsThisVisit: 0,
    targetIndex: state.targetIndex + 1,
  };
}

/**
 * Folds the whole fact log into the session's state, mirroring
 * `foldAroundTheClockState`. Under EASY, score-compare (highest
 * training-point total) decides the match exactly as before. Under
 * HARD/EXTREME, the instant any seat fails its mandatory-hit requirement
 * (`status: "LOST"`), the match ends immediately via `eliminationWinner` —
 * the same Bob's-27 pattern — regardless of any other seat's own progress.
 */
function foldSinglesTrainingState(
  facts: EngineFacts,
  config: SinglesEngineConfig,
): SinglesTrainingState {
  const seats = foldSeatStates(
    facts.turns,
    config.seats,
    initialSeatState,
    (state, observation) =>
      applySinglesTrainingDart(config, state, observation),
  );

  const failedSeats = seats.filter((seat) => seat.status === "LOST");
  const outcome: {
    status: SinglesTrainingState["status"];
    winningSideKey: string | null;
  } =
    seats.length === 1
      ? { status: seats[0].status, winningSideKey: null }
      : failedSeats.length > 0
        ? {
            status: "COMPLETE",
            winningSideKey: eliminationWinner(
              seats.map((seat) => ({
                sideKey: seat.sideKey,
                failed: seat.status === "LOST",
              })),
            ),
          }
        : scoreCompareOutcome(
            seats.map((seat) => ({
              sideKey: seat.sideKey,
              completed: seat.status === "COMPLETE",
              metric: seat.totalPoints,
            })),
            "HIGHEST",
            "IN_PROGRESS",
          );

  return {
    activeParticipantRef: activeSeat(facts, config.seats, "PER_SEAT")
      .participantRef,
    status: outcome.status,
    winningSideKey: outcome.winningSideKey,
    seats,
  };
}

/**
 * Singles Training: a fixed path of 21 targets (1..20, then BULL), each
 * visit scored by ring quality relative to its own target, per seat. Under
 * EASY (V1 and V2), score-compare decides the match: both seats always play
 * the fixed number of visits, then whichever totalled the higher
 * training-point score wins. Under V2's HARD/EXTREME, a seat can instead
 * fail its mandatory-hit requirement and end the match immediately by
 * elimination. Both ruleset versions are served by this one class (Pattern
 * 18), exactly like `ShanghaiEngine`'s V1/V2 split.
 */
export class SinglesTrainingEngine implements GameEngine<
  DartObservation,
  SinglesTrainingState
> {
  readonly rulesetVersionKey: RulesetVersionKey;
  readonly stageOwnership = "PER_SEAT" as const;
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: SinglesEngineConfig,
    prior?: EngineFacts,
    rulesetVersionKey: RulesetVersionKey = "SINGLES_V1",
  ) {
    this.rulesetVersionKey = rulesetVersionKey;
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): SinglesTrainingState {
    return foldSinglesTrainingState(
      { stages: [{ ...STAGE }], turns: this.turns },
      this.config,
    );
  }

  private openOrCreateTurn(activeParticipantRef: string): TurnFact {
    return openOrCreateTurn(
      this.turns,
      STAGE.clientKey,
      activeParticipantRef,
      (last) => last.darts.length < 3,
    );
  }

  /**
   * Appends one dart to the active seat's open visit. Both
   * `intendedTargetNumber` and `intendedZoneKey` are always `null` — the
   * whole intention pair, not just the zone. Unlike Bob's 27, Singles
   * Training treats single, double and treble on the current segment as
   * equally valid intentional outcomes (differing only in point value), so
   * no single ring is "the" intended one; recording a target number without
   * a ring would still assert an intention the player never held, and a
   * target number with a null zone is rejected outright by
   * `chk_dart_target_consistency` (migration `0007`), which only admits both
   * intention columns NULL or the zone NOT NULL. Nothing analytic is lost:
   * Singles plays exactly one target per visit in a fixed, configured order,
   * so the intended target is always recoverable from the visit index
   * (`targetIndex`) without storing it per dart. Do not restore either
   * field. The fact's `score` is the dart's board score, never the training
   * points the derived total adds. `completedAt` is stamped only by the
   * dart that resolves the visit — the client-observed end of it — so an
   * open visit carries none.
   *
   * Guarded at both the match and seat level. EASY difficulty alone would
   * let the per-seat guard suffice (every seat's own visit count is fixed at
   * 21 and every visit is exactly 3 darts, so both seats always finish in
   * strict lockstep with no race/instant-win shortcut). HARD/EXTREME's
   * elimination breaks that: the match can now end the instant one seat
   * fails while the OTHER seat's own status still reads `IN_PROGRESS` —
   * exactly the `ShanghaiEngine`-style race this file used to disclaim. The
   * top-level `before.status !== "IN_PROGRESS"` check below (mirroring
   * `Bobs27Engine.record()`) catches that case; the seat-level check still
   * rejects a stray call once the match has normally decided by
   * score-compare.
   * @throws when the match has already ended, or the active seat has already
   *   completed its own session; the fact log is left untouched.
   */
  record(observation: DartObservation): SinglesTrainingState {
    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") {
      throw new Error(
        "Cannot record a dart once the match has ended; undo first to correct it.",
      );
    }
    const seatBefore = activeSeatState(before);
    if (seatBefore.status !== "IN_PROGRESS") {
      throw new Error(
        "Cannot record a dart once the session is complete; undo first to correct it.",
      );
    }

    const openTurn = this.openOrCreateTurn(before.activeParticipantRef);
    appendObservedDart(openTurn, observation);
    if (openTurn.darts.length === 3) {
      openTurn.completedAt = new Date().toISOString();
    }

    return this.deriveState();
  }

  /**
   * Pops the last recorded dart, including one replayed from persisted
   * facts, and removes the visit entirely once it holds no darts — the
   * exact inverse of the `record()` call that created it. A surviving visit
   * is open again by definition, so its `completedAt` is cleared.
   * @returns true if a dart was removed; false if there was nothing to undo.
   */
  undo(): boolean {
    return undoLastDart(this.turns);
  }

  /**
   * Answers whether recording `observation` would end the WHOLE session —
   * this dart is the active seat's 21st target's 3rd dart, and every other
   * seat has already reached COMPLETE. Also reports true for a dart that
   * would eliminate the active seat under HARD/EXTREME — the match ends the
   * instant that happens, regardless of any other seat's own status.
   */
  wouldComplete(observation: DartObservation): boolean {
    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") return false;
    const seatBefore = activeSeatState(before);
    if (seatBefore.status !== "IN_PROGRESS") return false;
    if (seatBefore.dartsThisVisit < 2) return false;

    const after = applySinglesTrainingDart(
      this.config,
      seatBefore,
      observation,
    );
    if (after.status === "LOST") return true;
    if (after.status !== "COMPLETE") return false;

    return otherSeatsComplete(
      before.seats,
      seatBefore.participantRef,
      (seat) => seat.status === "COMPLETE",
    );
  }

  isComplete(): boolean {
    return this.deriveState().status !== "IN_PROGRESS";
  }

  state(): SinglesTrainingState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const singlesTrainingEngineFactory: GameEngineFactory<
  Seated<SinglesSnapshot>,
  DartObservation,
  SinglesTrainingState
> = {
  rulesetVersionKey: "SINGLES_V1",
  stageOwnership: "PER_SEAT",
  create(config: Seated<SinglesSnapshot>, prior?: EngineFacts) {
    return new SinglesTrainingEngine(config, prior);
  },
};

registerEngineFactory(singlesTrainingEngineFactory);

export const singlesTrainingV2EngineFactory: GameEngineFactory<
  Seated<SinglesV2Snapshot>,
  DartObservation,
  SinglesTrainingState
> = {
  rulesetVersionKey: "SINGLES_V2",
  stageOwnership: "PER_SEAT",
  create(config: Seated<SinglesV2Snapshot>, prior?: EngineFacts) {
    return new SinglesTrainingEngine(config, prior, "SINGLES_V2");
  },
};

registerEngineFactory(singlesTrainingV2EngineFactory);
