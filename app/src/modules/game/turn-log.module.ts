import { newClientKey } from "./client-key.module";
import { classify } from "@lib/game/board/board-geometry.module";
import type { BoardHit } from "@lib/types";
import { BULL_TARGET_NUMBER, boardScore } from "./board-progression.module";
import type {
  BoardTarget,
  DartFact,
  DartIntent,
  DartObservation,
  StageFact,
  TurnFact,
} from "./types";

/**
 * The counted board score of `darts` — what a `TurnFact.totalScore` carries.
 * Never a game-specific point value: a ruleset's own points (Singles
 * Training's ring points, Bob's 27's target values) are derived at read time
 * and never written to the fact log.
 */
export function sumDartScores(darts: readonly DartFact[]): number {
  return darts.reduce((total, dart) => total + dart.score, 0);
}

/**
 * A detached copy of a turn log, darts included. Every engine rehydrates from
 * `prior` facts through this and returns `facts()` through it too, so no
 * caller ever holds a reference into an engine's live log.
 */
export function cloneTurns(turns: readonly TurnFact[]): TurnFact[] {
  return turns.map((turn) => ({ ...turn, darts: [...turn.darts] }));
}

/** How many darts `participantRef` has thrown across the whole log. */
export function dartsThrownBy(
  participantRef: string,
  turns: readonly TurnFact[],
): number {
  return turns
    .filter((turn) => turn.participantRef === participantRef)
    .reduce((sum, turn) => sum + turn.darts.length, 0);
}

/**
 * The visit the next dart belongs to: the log's last turn when `isReusable`
 * accepts it, otherwise a freshly appended one stamped with a new
 * `clientKey` and the next `sequence`.
 *
 * The reuse rule is the caller's, because it is ruleset-specific — a visit
 * may close on its 3rd dart, on the dart that hits its own target, or only
 * for the seat that opened it. Mutates `turns` in place: the engine owns that
 * array and the returned turn is the live one the caller appends to.
 */
export function openOrCreateTurn(
  turns: TurnFact[],
  stageClientKey: string,
  participantRef: string,
  isReusable: (last: TurnFact) => boolean,
): TurnFact {
  const last = turns.at(-1);
  if (last && isReusable(last)) return last;

  const turn: TurnFact = {
    clientKey: newClientKey(),
    stageClientKey,
    participantRef,
    sequence: turns.length + 1,
    completedAt: null,
    totalScore: 0,
    darts: [],
  };
  turns.push(turn);
  return turn;
}

/** No intention recorded — the pair a ruleset without one aimed ring writes. */
const NO_INTENT: DartIntent = {
  intendedTargetNumber: null,
  intendedZoneKey: null,
};

/**
 * What a dart aimed at a doubles-path target intended: the target's own
 * double, or the inner bull where the path reaches BULL. Bob's 27 and Doubles
 * Training both walk such a path and both record the intention, because
 * exactly one ring on the current target counts as a hit.
 */
export function doubleTargetIntent(target: BoardTarget): DartIntent {
  return target.kind === "BULL"
    ? {
        intendedTargetNumber: BULL_TARGET_NUMBER,
        intendedZoneKey: "INNER_BULL",
      }
    : { intendedTargetNumber: target.number, intendedZoneKey: "DOUBLE" };
}

/**
 * Appends one observed dart to `turn` and recomputes the visit's total from
 * the darts it now holds. `score` is always the board score of what was hit,
 * whatever the ruleset makes of it. Does not stamp `completedAt` — when a
 * visit resolves is the ruleset's own rule, so the caller stamps it.
 * @returns the appended fact, for a caller that needs to read it back.
 */
export function appendObservedDart(
  turn: TurnFact,
  observation: DartObservation,
  intent: DartIntent = NO_INTENT,
): DartFact {
  const dart: DartFact = {
    sequence: turn.darts.length + 1,
    intendedTargetNumber: intent.intendedTargetNumber,
    intendedZoneKey: intent.intendedZoneKey,
    hitTargetNumber: observation.hitTargetNumber,
    hitZoneKey: observation.hitZoneKey,
    score: boardScore(observation.hitTargetNumber, observation.hitZoneKey),
    locationX: observation.locationX,
    locationY: observation.locationY,
  };

  turn.darts.push(dart);
  turn.totalScore = sumDartScores(turn.darts);
  return dart;
}

/**
 * Appends a turn that is complete the moment it is written — a whole visit
 * reported by the keypad, which carries no darts of its own and therefore
 * never reopens.
 */
export function appendCompletedTurn(
  turns: TurnFact[],
  stageClientKey: string,
  participantRef: string,
  totalScore: number,
): TurnFact {
  const turn: TurnFact = {
    clientKey: newClientKey(),
    stageClientKey,
    participantRef,
    sequence: turns.length + 1,
    completedAt: new Date().toISOString(),
    totalScore,
    darts: [],
  };
  turns.push(turn);
  return turn;
}

/**
 * The visit still being thrown, or null when the last one closed. Reads
 * `completedAt`, not dart count — a keypad-recorded turn always has
 * `darts: []` and is complete the instant it is pushed, so a dart-count check
 * alone would wrongly treat it as still open and let the next dart append
 * into it.
 */
export function openVisit(turns: readonly TurnFact[]): TurnFact | null {
  const last = turns.at(-1);
  if (!last || last.completedAt !== null) return null;
  return last;
}

/**
 * What one board observation struck, resolved from its coordinates. A miss
 * carries no coordinates, so it resolves to a scoreless hit using the
 * observation's own zone key rather than going through `classify()`.
 */
export function resolveObservation(observation: DartObservation): BoardHit {
  return observation.locationX === null || observation.locationY === null
    ? { targetNumber: null, zoneKey: observation.hitZoneKey, score: 0 }
    : classify(observation.locationX, observation.locationY);
}

/**
 * Appends one already-resolved board dart to `turn`, recording no intention:
 * a coordinate-captured dart says where it landed, never where it was aimed.
 * Leaves `turn.totalScore` alone — a ruleset that busts, checks out, or caps
 * a visit decides that total itself, so the caller settles the visit.
 * @returns the appended fact, for a caller that needs to read it back.
 */
export function appendResolvedDart(
  turn: TurnFact,
  observation: DartObservation,
  resolved: BoardHit,
): DartFact {
  const dart: DartFact = {
    sequence: turn.darts.length + 1,
    intendedTargetNumber: null,
    intendedZoneKey: null,
    hitTargetNumber: resolved.targetNumber,
    hitZoneKey: resolved.zoneKey,
    score: resolved.score,
    locationX: observation.locationX,
    locationY: observation.locationY,
  };
  turn.darts.push(dart);
  return dart;
}

/**
 * Pops the last recorded unit from an UNSTAGED log — a whole visit where that
 * turn came from the keypad (no darts), a single dart where it came from the
 * board, taking the turn with it when that dart was its only one. A surviving
 * visit is open again by definition, so its `completedAt` is cleared and its
 * total recomputed. Dispatches on the shape of the last turn because undo has
 * no input to read a shape from.
 * @returns true if something was removed; false if there was nothing to undo.
 */
export function undoLastUnit(turns: TurnFact[]): boolean {
  const last = turns.at(-1);
  if (!last) return false;

  if (last.darts.length === 0) {
    turns.pop();
    return true;
  }

  last.darts.pop();
  if (last.darts.length === 0) {
    turns.pop();
    return true;
  }

  last.totalScore = sumDartScores(last.darts);
  last.completedAt = null;
  return true;
}

function popStageOpenedBy(stages: StageFact[], stageClientKey: string): void {
  const openStage = stages.at(-1);
  if (
    stages.length > 1 &&
    openStage &&
    openStage.clientKey !== stageClientKey
  ) {
    stages.pop();
  }
}

/**
 * Pops the last recorded turn from a STAGED log — one whose engine opens a
 * new stage (a 501 leg, a 121 round) as play crosses into it. Dispatches on
 * the shape of that turn, because undo has no input to read a shape from: a
 * turn built from a keypad total always has `darts: []` and is removed
 * whole; a turn built from a board dart always holds at least one dart from
 * the moment it exists in the log, and gives up one dart at a time, taking
 * the visit with it once the last dart goes. Either way the stage the undone
 * turn opened is popped with it, so undo stays the exact inverse of the
 * `record()` that wrote it.
 * @returns true if a dart or a visit was removed; false if there was nothing
 *   to undo.
 */
export function undoStagedTurn(
  turns: TurnFact[],
  stages: StageFact[],
): boolean {
  const last = turns.at(-1);
  if (!last) return false;

  if (last.darts.length === 0) {
    turns.pop();
    popStageOpenedBy(stages, last.stageClientKey);
    return true;
  }

  last.darts.pop();
  popStageOpenedBy(stages, last.stageClientKey);
  if (last.darts.length === 0) {
    turns.pop();
    return true;
  }

  last.totalScore = sumDartScores(last.darts);
  last.completedAt = null;
  return true;
}

/**
 * Pops the last recorded dart, removing the visit entirely once it holds no
 * darts — the exact inverse of the `appendObservedDart` call that created it.
 * A surviving visit is open again by definition, so its `completedAt` is
 * cleared and its total recomputed from what is left. No seat-awareness
 * needed: this always operates on the tail of `turns`, whichever seat threw
 * it. Unlike `undoLastUnit`, a trailing dartless turn is NOT removed: a
 * ruleset that only ever records darts has no keypad turn to pop, so an empty
 * tail means there is nothing left to undo.
 * @returns true if a dart was removed; false if there was nothing to undo.
 */
export function undoLastDart(turns: TurnFact[]): boolean {
  const openTurn = turns.at(-1);
  if (!openTurn || openTurn.darts.length === 0) return false;

  openTurn.darts.pop();
  if (openTurn.darts.length === 0) {
    turns.pop();
  } else {
    openTurn.completedAt = null;
    openTurn.totalScore = sumDartScores(openTurn.darts);
  }
  return true;
}
