import { toSnapshot } from "@lib/game/rulesets/config-codec";
import type { RulesetVersionKey, SeatFact } from "@lib/types";
import {
  fiveOhOneCheckoutVisits,
  oneTwentyOneCheckoutVisits,
  tuodCheckoutVisits,
} from "@modules/game/checkout-visits.module";
import type {
  CheckoutVisitDarts,
  EngineFacts,
  StageFact,
  TurnFact,
  X01CheckoutDartRow,
} from "@modules/types";

type SessionRows = {
  rows: X01CheckoutDartRow[];
};

/** Rebuilds one session's stage list, newest row wins nothing -- stages are unique by id. */
function stagesOf(rows: readonly X01CheckoutDartRow[]): StageFact[] {
  const byId = new Map<string, StageFact>();
  for (const row of rows) {
    if (byId.has(row.stageId)) continue;
    byId.set(row.stageId, {
      clientKey: row.stageId,
      stageTypeKey: row.stageTypeKey as StageFact["stageTypeKey"],
      parentClientKey: row.parentStageId,
      sequence: row.stageSequence,
    });
  }
  return [...byId.values()].sort((a, b) => a.sequence - b.sequence);
}

/**
 * Rebuilds one session's turns, each carrying its own darts in dart order.
 * `totalScore` is the counted total the engine wrote, so a busted visit
 * arrives here as the zero it was recorded as.
 */
function turnsOf(rows: readonly X01CheckoutDartRow[]): TurnFact[] {
  const byId = new Map<string, TurnFact>();
  for (const row of rows) {
    let turn = byId.get(row.turnId);
    if (!turn) {
      turn = {
        clientKey: row.turnId,
        stageClientKey: row.stageId,
        participantRef: row.participantId,
        sequence: row.turnSequence,
        completedAt: row.turnCompletedAt,
        totalScore: row.turnTotalScore,
        darts: [],
      };
      byId.set(row.turnId, turn);
    }
    turn.darts.push({
      sequence: row.dartNumber,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: row.hitTargetNumber,
      hitZoneKey: row.hitZoneKey,
      score: row.score,
      locationX: null,
      locationY: null,
    });
  }
  return [...byId.values()].sort((a, b) => a.sequence - b.sequence);
}

/**
 * The session's stored configuration decoded back into the seated camelCase
 * snapshot its engine folds. `seats` is stored alongside the ruleset's own
 * snake_case fields and is already camelCase, so it is lifted out before the
 * codec runs and put back afterwards.
 */
function snapshotOf(
  rulesetVersionKey: string,
  configuration: Record<string, unknown> | null,
): Record<string, unknown> & { seats: readonly SeatFact[] } {
  const { seats = [], ...wire } = (configuration ?? {}) as {
    seats?: readonly SeatFact[];
  } & Record<string, unknown>;
  return {
    ...(toSnapshot(rulesetVersionKey as RulesetVersionKey, wire) as Record<
      string,
      unknown
    >),
    seats,
  };
}

/**
 * A session `v_x01_checkout_darts` left-joins `exercise_configurations` and
 * never filters a miss, so a real session can carry no stored snapshot at
 * all. Without it there is no starting score for 501 and no ladder
 * configuration for TUOD or 121 -- nothing to replay, only something to
 * invent -- so such a session contributes no checkout visits rather than
 * guessing at a default. This is the same outcome the view it replaces
 * produced by accident (a starting score read as 0 makes every remaining
 * non-finishable, so `classifyDart` never counted a hit or a miss either);
 * this just says so directly instead of relying on that arithmetic coincidence.
 */
function visitsForSession(
  rows: readonly X01CheckoutDartRow[],
): CheckoutVisitDarts[] {
  const first = rows[0];
  if (!first) return [];
  if (first.configuration === null) return [];

  const facts: EngineFacts = { stages: stagesOf(rows), turns: turnsOf(rows) };
  const participantRef = first.participantId;
  const seatTurns = facts.turns.filter(
    (turn) => turn.participantRef === participantRef,
  );
  const config = snapshotOf(first.rulesetVersionKey, first.configuration);

  if (first.gameTypeKey === "501") {
    return fiveOhOneCheckoutVisits(
      seatTurns,
      Number(config.startingScore ?? 0),
    );
  }
  if (first.gameTypeKey === "TUOD") {
    return tuodCheckoutVisits(
      seatTurns,
      facts,
      config as Parameters<typeof tuodCheckoutVisits>[2],
      participantRef,
    );
  }
  return oneTwentyOneCheckoutVisits(
    seatTurns,
    facts.stages,
    facts.turns,
    config as Parameters<typeof oneTwentyOneCheckoutVisits>[3],
    participantRef,
  );
}

/**
 * Every checkout visit the player owns, across every X01 session
 * `v_x01_checkout_darts` returns -- one fold per session, through the same
 * builders the live result modals use, so the career number can never
 * disagree with the per-game ones.
 */
export function checkoutVisitsFromRows(
  rows: readonly X01CheckoutDartRow[],
): CheckoutVisitDarts[] {
  const bySession = new Map<string, SessionRows>();
  for (const row of rows) {
    const bucket = bySession.get(row.sessionId) ?? { rows: [] };
    bucket.rows.push(row);
    bySession.set(row.sessionId, bucket);
  }
  return [...bySession.values()].flatMap((bucket) =>
    visitsForSession(bucket.rows),
  );
}
