import { toSnapshot } from "@lib/game/rulesets/config-codec";
import type { RulesetVersionKey, SeatFact } from "@lib/types";
import {
  fiveOhOneCheckoutVisits,
  oneTwentyOneCheckoutVisits,
  tuodCheckoutVisits,
} from "@modules/game/checkout-visits.module";
import type {
  CheckoutVisitTotals,
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

/** A rebuilt turn alongside the stage sequence its own `sequence` is relative to. */
type StagedTurn = {
  stageSequence: number;
  turn: TurnFact;
};

/**
 * Rebuilds one session's turns in play order, each carrying its own darts in
 * dart order. `totalScore` is the counted total the engine wrote, so a busted
 * visit arrives here as the zero it was recorded as.
 *
 * Ordered by `(stageSequence, turnSequence)`, never by `turnSequence` alone:
 * `turns.sequence_number` restarts at 1 in every stage (both
 * `one-twenty-one.engine.module.ts` and `five-oh-one.engine.module.ts` write
 * `turnCountIn(stage) + 1`), so sorting on it alone interleaves the rounds of
 * a 121 session or the legs of a 501 one. `oneTwentyOneCheckoutVisits` and
 * `tuodCheckoutVisits` slice the log by array index (`turnsBeforeVisit`), so
 * an interleaved log folds every visit over a turn set holding future turns
 * and missing past ones. The sort is done here rather than left to the
 * repository's `ORDER BY` so this module is correct for any row order; the
 * SQL order is pinned by `statistics.repository.test.ts` as well.
 */
function turnsOf(rows: readonly X01CheckoutDartRow[]): TurnFact[] {
  const byId = new Map<string, StagedTurn>();
  for (const row of rows) {
    let staged = byId.get(row.turnId);
    if (!staged) {
      staged = {
        stageSequence: row.stageSequence,
        turn: {
          clientKey: row.turnId,
          stageClientKey: row.stageId,
          participantRef: row.participantId,
          sequence: row.turnSequence,
          completedAt: row.turnCompletedAt,
          totalScore: row.turnTotalScore,
          darts: [],
        },
      };
      byId.set(row.turnId, staged);
    }
    staged.turn.darts.push({
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
  for (const staged of byId.values()) {
    staged.turn.darts.sort((a, b) => a.sequence - b.sequence);
  }
  return [...byId.values()]
    .sort(
      (a, b) =>
        a.stageSequence - b.stageSequence || a.turn.sequence - b.turn.sequence,
    )
    .map((staged) => staged.turn);
}

/**
 * The session's stored configuration decoded back into the seated camelCase
 * snapshot its engine folds. `seats` is stored alongside the ruleset's own
 * snake_case fields and is already camelCase, so it is lifted out before the
 * codec runs and put back afterwards.
 *
 * `null` when the snapshot cannot be decoded at all: every ruleset schema is
 * `.strict()` with required fields (and TUOD's carries a `superRefine`), and
 * an unrecognised `ruleset_version_key` has no schema to parse against, so a
 * historical session whose stored snapshot has since drifted makes
 * `toSnapshot` throw. That throw is contained here rather than left to
 * propagate: `getStatisticsOverview` folds every X01 session in one batch, so
 * one undecodable snapshot would otherwise 500 the whole
 * `/api/statistics/overview` response -- every card on `/statistics`, not
 * just Checkout %.
 */
function snapshotOf(
  rulesetVersionKey: string,
  configuration: Record<string, unknown> | null,
): (Record<string, unknown> & { seats: readonly SeatFact[] }) | null {
  const { seats = [], ...wire } = (configuration ?? {}) as {
    seats?: readonly SeatFact[];
  } & Record<string, unknown>;
  try {
    return {
      ...(toSnapshot(rulesetVersionKey as RulesetVersionKey, wire) as Record<
        string,
        unknown
      >),
      seats,
    };
  } catch {
    return null;
  }
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
 *
 * A snapshot that exists but no longer decodes is the same kind of session
 * and gets the same answer -- see `snapshotOf`. The `configuration === null`
 * check stays separate from it: "the session never stored one" and "the one
 * it stored no longer validates" are different facts about the data, and
 * only the second is a drift to be noticed.
 *
 * A snapshot that decodes but names no seats is a third shape, and unlike
 * the other two it does not apply to every game: `fiveOhOneCheckoutVisits`
 * never reads `seats`, so a seatless 501 session replays exactly as before.
 * 121 and TUOD fold their seat list to derive each visit's opening
 * remaining/target, and an empty one is "nothing to replay" for them too --
 * skip rather than fold. These are historical sessions that predate `seats`
 * being stored in the snapshot at all.
 *
 * The first row's `participantId` is taken as *the* participant, which is
 * sound for two reasons neither of which is visible from this module:
 * `session-seats.service.ts` allows exactly one `PLAYER` seat per session,
 * and `v_x01_checkout_darts` filters `p.player_id = es.player_id`, so every
 * row a session contributes here belongs to its owner. Do not "fix" this
 * into a per-participant grouping without changing one of those two first.
 */
function visitsForSession(
  rows: readonly X01CheckoutDartRow[],
): CheckoutVisitTotals[] {
  const first = rows[0];
  if (!first) return [];
  if (first.configuration === null) return [];

  const config = snapshotOf(first.rulesetVersionKey, first.configuration);
  if (config === null) return [];
  if (config.seats.length === 0 && first.gameTypeKey !== "501") return [];

  const facts: EngineFacts = { stages: stagesOf(rows), turns: turnsOf(rows) };
  const participantRef = first.participantId;
  const seatTurns = facts.turns.filter(
    (turn) => turn.participantRef === participantRef,
  );

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
): CheckoutVisitTotals[] {
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
