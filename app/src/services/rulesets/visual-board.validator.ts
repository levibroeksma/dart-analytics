import { classify } from "@lib/game/board/board-geometry.module";
import type { BoardHit } from "@lib/types";
import type { EventsBatchRequestInput } from "@routes/types";
import type { BatchValidationResult } from "./types";

const VISUAL_BOARD_CAPTURE_MODE = "ANALYTICS";
const VISUAL_BOARD_INPUT_MODE = "VISUAL_BOARD";

/** The mode pair every coordinate-capturing ruleset names in its rejection message. */
export const VISUAL_BOARD_MODES = `${VISUAL_BOARD_CAPTURE_MODE} + ${VISUAL_BOARD_INPUT_MODE}`;

/** Whether a session captures individual darts with a landing coordinate. */
export function isVisualBoardCapture(
  captureModeKey: string,
  inputModeKey: string,
): boolean {
  return (
    captureModeKey === VISUAL_BOARD_CAPTURE_MODE &&
    inputModeKey === VISUAL_BOARD_INPUT_MODE
  );
}

function reject(issue: string): BatchValidationResult {
  return { valid: false, code: "VALIDATION_FAILED", issues: [issue] };
}

type BatchStage = EventsBatchRequestInput["stages"][number];
type BatchTurn = BatchStage["turns"][number];
type BatchDart = BatchTurn["darts"][number];

/**
 * An unseen throw (bounce-out) carries no coordinate, so there is nothing to
 * re-derive it from. It must therefore claim nothing: no score, no target, and
 * zone MISS. Returns the rejection, or `null` when the dart is well-formed.
 */
function rejectMalformedUnseenDart(
  dart: BatchDart,
  turnKey: string,
): BatchValidationResult | null {
  const claimsNothing =
    dart.score === 0 &&
    dart.hitTargetNumber === null &&
    dart.hitZoneKey === "MISS";

  if (claimsNothing) return null;

  return reject(
    `dart ${dart.sequence} in turn ${turnKey} has no location, so it must score 0, name no target, and zone MISS (${VISUAL_BOARD_MODES})`,
  );
}

/**
 * Compares every claim the client made about a located dart against the board
 * fact re-derived from its coordinate. Returns the rejection, or `null` when
 * all three agree.
 */
function rejectMisreportedDart(
  dart: BatchDart,
  turnKey: string,
  resolved: BoardHit,
): BatchValidationResult | null {
  const prefix = `dart ${dart.sequence} in turn ${turnKey} claims`;

  if (dart.hitZoneKey !== resolved.zoneKey) {
    return reject(
      `${prefix} zone ${dart.hitZoneKey}, but its location resolves to ${resolved.zoneKey}`,
    );
  }
  if (dart.hitTargetNumber !== resolved.targetNumber) {
    return reject(
      `${prefix} target ${dart.hitTargetNumber}, but its location resolves to ${resolved.targetNumber}`,
    );
  }
  if (dart.score !== resolved.score) {
    return reject(
      `${prefix} score ${dart.score}, but its location resolves to ${resolved.score}`,
    );
  }

  return null;
}

/**
 * A visit entered on the keypad rather than the board. It carries no darts, so
 * there is no coordinate to re-derive anything from and nothing for a tampered
 * client to misreport — the only claim it makes is its own total, bounded
 * exactly as `validateQuickScoreTurns` bounds it.
 *
 * A visual session accepts these because the keypad is the accessible
 * alternative and stays rendered for every session (D199): a player who cannot
 * use a pointer enters whole visits, and the engines accept a keypad total
 * from any clean visit boundary (D198). Refusing the shape here would make
 * that player's session unuploadable at the moment they finish it, since a
 * batch is posted whole and is all-or-nothing.
 */
function rejectInvalidKeypadTurn(
  turn: BatchTurn,
  maxTurnScore: number,
): BatchValidationResult | null {
  if (turn.totalScore < 0 || turn.totalScore > maxTurnScore) {
    return reject(
      `turn ${turn.clientKey} totalScore must be between 0 and ${maxTurnScore}`,
    );
  }
  return null;
}

/**
 * Validates one visit: every dart against its own coordinate, then the visit
 * total against the sum of what those darts actually scored. A total of 0
 * against scoring darts is a bust and is accepted; any other disagreement is
 * refused. A visit with no darts at all is a keypad entry — see
 * `rejectInvalidKeypadTurn`. Returns the rejection, or `null` when the visit
 * is sound.
 */
function rejectInvalidTurn(
  turn: BatchTurn,
  maxTurnScore: number,
): BatchValidationResult | null {
  if (turn.darts.length === 0) {
    return rejectInvalidKeypadTurn(turn, maxTurnScore);
  }

  let countedTotal = 0;

  for (const dart of turn.darts) {
    const { locationX, locationY } = dart;

    if (locationX === null || locationY === null) {
      const rejection = rejectMalformedUnseenDart(dart, turn.clientKey);
      if (rejection) return rejection;
      continue;
    }

    const resolved = classify(locationX, locationY);
    const rejection = rejectMisreportedDart(dart, turn.clientKey, resolved);
    if (rejection) return rejection;

    countedTotal += resolved.score;
  }

  if (turn.totalScore !== countedTotal && turn.totalScore !== 0) {
    return reject(
      `turn ${turn.clientKey} totalScore ${turn.totalScore} is neither the sum of its darts (${countedTotal}) nor 0 for a void visit`,
    );
  }

  return null;
}

/**
 * Re-derives every submitted dart from its own coordinate and refuses the
 * batch when the client's claim disagrees. The client computes the board fact
 * for immediate feedback, but it is never trusted as the authority — a stale
 * or tampered client would otherwise write permanent, silently wrong rows into
 * the analytical dataset.
 *
 * `maxTurnScore` bounds the dartless keypad visits a visual session may also
 * contain; it is the same bound the ruleset passes to
 * `validateQuickScoreTurns`, so one visit total is judged identically whichever
 * mode the session was created in.
 */
export function validateVisualBoardTurns(
  batch: EventsBatchRequestInput,
  maxTurnScore: number,
): BatchValidationResult {
  for (const stage of batch.stages) {
    for (const turn of stage.turns) {
      const rejection = rejectInvalidTurn(turn, maxTurnScore);
      if (rejection) return rejection;
    }
  }

  return { valid: true };
}
