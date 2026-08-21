import type { ShanghaiSnapshot, Seated } from "@lib/types";
import { newClientKey } from "./client-key.module";
import { boardScore, numbersPath, targetAt } from "./board-progression.module";
import { registerEngineFactory } from "./engine.registry";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  DartFact,
  DartObservation,
  DartZoneKey,
  EngineFacts,
  ShanghaiState,
  StageFact,
  TurnFact,
} from "./types";

const STAGE: StageFact = {
  clientKey: "block-1",
  stageTypeKey: "EXERCISE_BLOCK",
  parentClientKey: null,
  sequence: 1,
};

const LAST_TARGET_INDEX = 19;

/**
 * Shanghai starting state: round 1 (index 0), zero score, no darts thrown.
 */
export function initialShanghaiState(): ShanghaiState {
  return {
    targetIndex: 0,
    totalScore: 0,
    dartsThisVisit: [],
    status: "IN_PROGRESS",
  };
}

const SINGLE_ZONE_KEYS: ReadonlySet<DartZoneKey> = new Set([
  "SINGLE",
  "INNER_SINGLE",
  "OUTER_SINGLE",
]);

function zoneBucketOf(
  zone: DartZoneKey,
): "SINGLE" | "DOUBLE" | "TREBLE" | null {
  if (SINGLE_ZONE_KEYS.has(zone)) return "SINGLE";
  if (zone === "DOUBLE") return "DOUBLE";
  if (zone === "TREBLE") return "TREBLE";
  return null;
}

/**
 * Rounds 1..20 never reach `numbersPath()`'s 21st (BULL) entry — the throw
 * documents that invariant rather than letting `.number` read `undefined`
 * off a BULL target.
 */
function activeNumberAt(targetIndex: number): number {
  const target = targetAt(numbersPath(), targetIndex);
  if (target.kind === "BULL") {
    throw new Error("Shanghai never reaches the BULL target");
  }
  return target.number;
}

function isShanghai(dartsThisVisit: readonly (DartZoneKey | null)[]): boolean {
  const buckets = new Set(
    dartsThisVisit
      .filter((zone): zone is DartZoneKey => zone !== null)
      .map(zoneBucketOf),
  );
  return (
    buckets.has("SINGLE") && buckets.has("DOUBLE") && buckets.has("TREBLE")
  );
}

/**
 * Pure reducer: folds one dart observation onto a `ShanghaiState`. Only a hit
 * on the round's own active number scores — anything else (wrong number,
 * BULL, miss) adds 0 and still counts as one of the visit's three darts. A
 * visit resolves on its 3rd dart: if it hit single, double and treble of the
 * active number (any order) that is a Shanghai — instant win, regardless of
 * round. Otherwise the last round (index 19, number 20) completes the
 * session; any other round just advances to the next number. Takes no
 * config: v1 has nothing to configure (`ShanghaiSnapshot` is `{}`).
 * @throws when `state.status` is not `IN_PROGRESS`; undo first to correct it.
 */
export function applyShanghaiDart(
  state: ShanghaiState,
  observation: DartObservation,
): ShanghaiState {
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a dart once the session has ended; undo first to correct it.",
    );
  }

  const targetNumber = activeNumberAt(state.targetIndex);
  const onTarget =
    observation.hitTargetNumber === targetNumber &&
    zoneBucketOf(observation.hitZoneKey) !== null;
  const totalScore = onTarget
    ? state.totalScore + boardScore(targetNumber, observation.hitZoneKey)
    : state.totalScore;
  const dartsThisVisit = [
    ...state.dartsThisVisit,
    onTarget ? observation.hitZoneKey : null,
  ];

  if (dartsThisVisit.length < 3) {
    return { ...state, totalScore, dartsThisVisit };
  }

  if (isShanghai(dartsThisVisit)) {
    return { ...state, totalScore, dartsThisVisit: [], status: "SHANGHAI" };
  }
  if (state.targetIndex === LAST_TARGET_INDEX) {
    return { ...state, totalScore, dartsThisVisit: [], status: "COMPLETE" };
  }
  return {
    ...state,
    totalScore,
    dartsThisVisit: [],
    targetIndex: state.targetIndex + 1,
  };
}

function sumDartScores(darts: readonly DartFact[]): number {
  return darts.reduce((total, dart) => total + dart.score, 0);
}

function cloneTurns(turns: readonly TurnFact[]): TurnFact[] {
  return turns.map((turn) => ({ ...turn, darts: [...turn.darts] }));
}

/**
 * Shanghai: rounds 1..20, three darts each at that round's own number.
 * `state()` derives the running score, current round and Shanghai/completion
 * status by folding `facts()` through `applyShanghaiDart` — none of them is
 * ever stored.
 */
export class ShanghaiEngine implements GameEngine<
  DartObservation,
  ShanghaiState
> {
  readonly rulesetVersionKey = "SHANGHAI_V1";
  readonly stageOwnership = "PER_SEAT" as const;
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: Seated<ShanghaiSnapshot>,
    prior?: EngineFacts,
  ) {
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): ShanghaiState {
    let state = initialShanghaiState();
    for (const turn of this.turns) {
      for (const dart of turn.darts) {
        state = applyShanghaiDart(state, {
          hitTargetNumber: dart.hitTargetNumber,
          hitZoneKey: dart.hitZoneKey,
          locationX: dart.locationX,
          locationY: dart.locationY,
        });
      }
    }
    return state;
  }

  private openOrCreateTurn(): TurnFact {
    const last = this.turns.at(-1);
    if (last && last.darts.length < 3) return last;

    const turn: TurnFact = {
      clientKey: newClientKey(),
      stageClientKey: STAGE.clientKey,
      participantRef: this.config.seats[0].participantRef,
      sequence: this.turns.length + 1,
      completedAt: null,
      totalScore: 0,
      darts: [],
    };
    this.turns.push(turn);
    return turn;
  }

  /**
   * Appends one dart to the open visit, opening a new one when the last is
   * already 3 darts deep. `intendedTargetNumber`/`intendedZoneKey` stay null
   * on every dart — single, double and treble of the round's own number are
   * equally valid intended outcomes, and the active number is always
   * recoverable from the round index since v1 has no order config, same
   * reasoning as Singles Training. The fact's `score` is the dart's real
   * board value, never the Shanghai-restricted round points the derived
   * total adds. `completedAt` is stamped only by the dart that resolves the
   * visit.
   * @throws when the session has already ended; the fact log is left untouched.
   */
  record(observation: DartObservation): ShanghaiState {
    const before = this.deriveState();
    const after = applyShanghaiDart(before, observation);

    const openTurn = this.openOrCreateTurn();
    const dart: DartFact = {
      sequence: openTurn.darts.length + 1,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: observation.hitTargetNumber,
      hitZoneKey: observation.hitZoneKey,
      score: boardScore(observation.hitTargetNumber, observation.hitZoneKey),
      locationX: observation.locationX,
      locationY: observation.locationY,
    };

    openTurn.darts.push(dart);
    openTurn.totalScore = sumDartScores(openTurn.darts);
    if (openTurn.darts.length === 3) {
      openTurn.completedAt = new Date().toISOString();
    }

    return after;
  }

  /**
   * Pops the last recorded dart, including one replayed from persisted
   * facts, and removes the visit entirely once it holds no darts — the
   * exact inverse of the `record()` call that created it. A surviving visit
   * is open again by definition, so its `completedAt` is cleared.
   * @returns true if a dart was removed; false if there was nothing to undo.
   */
  undo(): boolean {
    const openTurn = this.turns.at(-1);
    if (!openTurn || openTurn.darts.length === 0) return false;

    openTurn.darts.pop();
    if (openTurn.darts.length === 0) {
      this.turns.pop();
    } else {
      openTurn.completedAt = null;
      openTurn.totalScore = sumDartScores(openTurn.darts);
    }
    return true;
  }

  /**
   * Answers whether recording `observation` would resolve the open visit
   * into a Shanghai or a session completion, without mutating the fact log
   * or the derived state. Only a visit's 3rd dart can ever complete the
   * session.
   */
  wouldComplete(observation: DartObservation): boolean {
    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") return false;
    if (before.dartsThisVisit.length < 2) return false;

    const after = applyShanghaiDart(before, observation);
    return after.status !== "IN_PROGRESS";
  }

  isComplete(): boolean {
    return this.deriveState().status !== "IN_PROGRESS";
  }

  state(): ShanghaiState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const shanghaiEngineFactory: GameEngineFactory<
  Seated<ShanghaiSnapshot>,
  DartObservation,
  ShanghaiState
> = {
  rulesetVersionKey: "SHANGHAI_V1",
  stageOwnership: "PER_SEAT",
  create(config: Seated<ShanghaiSnapshot>, prior?: EngineFacts) {
    return new ShanghaiEngine(config, prior);
  },
};

registerEngineFactory(shanghaiEngineFactory);
