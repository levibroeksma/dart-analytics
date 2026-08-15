import type { AroundTheClockSnapshot } from "@lib/types";
import { newClientKey } from "./client-key.module";
import {
  BULL_TARGET_NUMBER,
  boardScore,
  numbersPath,
  targetAt,
} from "./board-progression.module";
import { registerEngineFactory } from "./engine.registry";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  AroundTheClockState,
  BoardTarget,
  DartFact,
  DartObservation,
  EngineFacts,
  StageFact,
  TurnFact,
} from "./types";

const STAGE: StageFact = {
  clientKey: "block-1",
  stageTypeKey: "EXERCISE_BLOCK",
  parentClientKey: null,
  sequence: 1,
};

const LAST_TARGET_INDEX = 20;

/**
 * Around the Clock starting state: aimed at NUMBER 1, no darts thrown yet.
 */
export function initialAroundTheClockState(): AroundTheClockState {
  return { targetIndex: 0, dartsThisVisit: 0, status: "IN_PROGRESS" };
}

/**
 * `board-progression.module.ts`'s `isHitOn` requires `INNER_BULL` only (the
 * doubles-path rule) — this game accepts either bull ring, so the BULL case
 * is handled here instead. The NUMBER case (any of single/double/treble on
 * the matching number) matches `isHitOn`'s own NUMBER-kind branch.
 */
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

/**
 * Pure reducer: folds one dart observation onto an `AroundTheClockState`. A
 * hit advances the target immediately, mid-visit — unlike Shanghai/Singles
 * Training, a visit's remaining darts aim at whatever target is now active,
 * not the one the visit started on. A hit on the BULL target (index 20)
 * completes the session immediately, whatever `dartsThisVisit` currently is;
 * no further dart is recorded for that visit. Otherwise the visit closes
 * (`dartsThisVisit` resets to 0) once it reaches 3 darts, same as every
 * other engine. Takes no config: v1 has nothing to configure
 * (`AroundTheClockSnapshot` is `{}`).
 * @throws when `state.status` is not `IN_PROGRESS`; undo first to correct it.
 */
export function applyAroundTheClockDart(
  state: AroundTheClockState,
  observation: DartObservation,
): AroundTheClockState {
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a dart once the session has ended; undo first to correct it.",
    );
  }

  const target = targetAt(numbersPath(), state.targetIndex);
  const hit = isAroundTheClockHit(target, observation);

  if (hit && state.targetIndex === LAST_TARGET_INDEX) {
    return {
      targetIndex: LAST_TARGET_INDEX,
      dartsThisVisit: 0,
      status: "COMPLETE",
    };
  }

  const targetIndex = hit ? state.targetIndex + 1 : state.targetIndex;
  const dartsThisVisit =
    state.dartsThisVisit + 1 === 3 ? 0 : state.dartsThisVisit + 1;
  return { targetIndex, dartsThisVisit, status: "IN_PROGRESS" };
}

function sumDartScores(darts: readonly DartFact[]): number {
  return darts.reduce((total, dart) => total + dart.score, 0);
}

function cloneTurns(turns: readonly TurnFact[]): TurnFact[] {
  return turns.map((turn) => ({ ...turn, darts: [...turn.darts] }));
}

/**
 * Around the Clock: a fixed 21-target path (1..20, then BULL) walked with
 * mid-visit advancement — a hit moves to the next target immediately, so a
 * single 3-dart visit can clear several numbers. `state()` derives the
 * current target and completion by folding `facts()` through
 * `applyAroundTheClockDart` — neither is ever stored.
 */
export class AroundTheClockEngine implements GameEngine<
  DartObservation,
  AroundTheClockState
> {
  readonly rulesetVersionKey = "AROUND_THE_CLOCK_V1";
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: AroundTheClockSnapshot,
    prior?: EngineFacts,
  ) {
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): AroundTheClockState {
    let state = initialAroundTheClockState();
    for (const turn of this.turns) {
      for (const dart of turn.darts) {
        state = applyAroundTheClockDart(state, {
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
   * on every dart: single, double and treble of the active number are
   * equally valid intended outcomes, and — although the active target can
   * now change mid-visit, unlike Shanghai/Singles Training — it remains
   * exactly recoverable by replaying `facts()` through
   * `applyAroundTheClockDart` up to that dart, so nothing new needs storing.
   * `completedAt` is stamped when the visit resolves: on its 3rd dart, or
   * immediately when this dart completes the session (a BULL hit can land
   * on dart 1 or 2 of a visit, leaving it permanently short of 3).
   * @throws when the session has already ended; the fact log is left untouched.
   */
  record(observation: DartObservation): AroundTheClockState {
    const before = this.deriveState();
    const after = applyAroundTheClockDart(before, observation);

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
    if (openTurn.darts.length === 3 || after.status === "COMPLETE") {
      openTurn.completedAt = new Date().toISOString();
    }

    return after;
  }

  /**
   * Pops the last recorded dart, including one replayed from persisted
   * facts, and removes the visit entirely once it holds no darts — the
   * exact inverse of the `record()` call that created it, whether that
   * visit closed at 3 darts or early via a BULL completion. A surviving
   * visit is open again by definition, so its `completedAt` is cleared.
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
   * Answers whether recording `observation` would complete the session,
   * without mutating the fact log or the derived state. Unlike Shanghai and
   * Singles Training, no dart-position gating applies: a BULL hit completes
   * the session on any dart of a visit, not only the 3rd.
   */
  wouldComplete(observation: DartObservation): boolean {
    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") return false;

    const after = applyAroundTheClockDart(before, observation);
    return after.status !== "IN_PROGRESS";
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
  AroundTheClockSnapshot,
  DartObservation,
  AroundTheClockState
> = {
  rulesetVersionKey: "AROUND_THE_CLOCK_V1",
  create(config: AroundTheClockSnapshot, prior?: EngineFacts) {
    return new AroundTheClockEngine(config, prior);
  },
};

registerEngineFactory(aroundTheClockEngineFactory);
