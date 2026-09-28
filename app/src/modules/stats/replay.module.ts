import { fromBase64Url, toBase64Url } from "./sections/series.module";
import type {
  DartFact,
  DartZoneKey,
  EngineFacts,
  ReplayCursor,
  ReplayDart,
  ReplayRow,
  ReplayStageRow,
  ReplayTurn,
  StageTypeKey,
  TurnFact,
} from "@modules/types";
import type {
  ReplayHeaderSchemaData,
  ReplayTurnSchemaData,
} from "@routes/types";

/**
 * Pure helpers a replay page is built from: stage play order, the cursor
 * codec (R2), rows-to-turns grouping, and the loaded-replay-to-engine-facts
 * conversion (`replayFacts`, moved here from `lib/stats/replay-fold.ts` —
 * phase 6b Task 4 Step 2 — so the phase 6b step-result fold can reuse it
 * without reaching into `lib/`). No I/O; isomorphic.
 */

const REPLAY_CURSOR_VERSION = "v1";

/**
 * Pre-order over `stages`: each root by `sequence`, then its own children in
 * the same order, at any depth (D371 decision 3). Throws on a cycle or a
 * `parentStageId` absent from `stages` — both impossible under the FKs, so a
 * throw here means corrupt input.
 */
export function stageOrder(
  stages: readonly ReplayStageRow[],
): ReplayStageRow[] {
  const byId = new Map(stages.map((s) => [s.stageId, s]));
  const childrenOf = new Map<string | null, ReplayStageRow[]>();
  for (const stage of stages) {
    if (stage.parentStageId !== null && !byId.has(stage.parentStageId)) {
      throw new Error(
        `stageOrder: stage ${stage.stageId} has unknown parent ${stage.parentStageId}`,
      );
    }
    const siblings = childrenOf.get(stage.parentStageId) ?? [];
    siblings.push(stage);
    childrenOf.set(stage.parentStageId, siblings);
  }
  for (const siblings of childrenOf.values()) {
    siblings.sort((a, b) => a.sequence - b.sequence);
  }

  const ordered: ReplayStageRow[] = [];
  const visit = (stage: ReplayStageRow): void => {
    ordered.push(stage);
    for (const child of childrenOf.get(stage.stageId) ?? []) {
      visit(child);
    }
  };
  for (const root of childrenOf.get(null) ?? []) {
    visit(root);
  }

  if (ordered.length !== stages.length) {
    throw new Error("stageOrder: cycle detected among stages");
  }
  return ordered;
}

/** Opaque replay-page cursor: the last turn's `(stageId, turnSequence)` (R2, D371 decision 4). */
export function encodeReplayCursor(cursor: ReplayCursor): string {
  return toBase64Url(
    `${REPLAY_CURSOR_VERSION}:${cursor.stageId}:${cursor.turnSequence}`,
  );
}

/** The largest `turns.sequence_number` Postgres `integer` holds. */
const MAX_TURN_SEQUENCE = 2147483647;

/**
 * Returns `null` on any malformed input rather than throwing — a client
 * never constructs this string. A turn sequence outside `1..2147483647` is
 * malformed too, so a crafted cursor is `VALIDATION_FAILED`, never a
 * Postgres "integer out of range".
 */
export function decodeReplayCursor(value: string): ReplayCursor | null {
  const decoded = fromBase64Url(value);
  if (decoded === null) return null;

  const parts = decoded.split(":");
  if (parts.length !== 3) return null;

  const [version, stageId, turnSequenceText] = parts;
  if (version !== REPLAY_CURSOR_VERSION || stageId.length === 0) return null;
  if (!/^\d+$/.test(turnSequenceText)) return null;

  const turnSequence = Number(turnSequenceText);
  if (
    !Number.isSafeInteger(turnSequence) ||
    turnSequence < 1 ||
    turnSequence > MAX_TURN_SEQUENCE
  ) {
    return null;
  }
  return { stageId, turnSequence };
}

/**
 * Groups consecutive `rows` by `(stageId, turnSequence)` in input order
 * (`v_game_replay`'s own order: stage, turn, dart number). A `dartNumber ===
 * null` row yields a turn with `darts: []` — the turn-total-only shape the
 * view's `LEFT JOIN` produces. Throws if a dart row (`dartNumber` non-null)
 * has a `null` `score` or `hitZoneKey` (R3), or if a `null`-`dartNumber` row
 * shares a turn with a real dart in either order — both impossible from the
 * view.
 */
export function rowsToTurns(rows: readonly ReplayRow[]): ReplayTurn[] {
  const turns: ReplayTurn[] = [];
  let current: ReplayTurn | null = null;
  let currentIsTurnTotalOnly = false;

  for (const row of rows) {
    if (
      current === null ||
      current.stageId !== row.stageId ||
      current.turnSequence !== row.turnSequence
    ) {
      current = {
        stageId: row.stageId,
        turnSequence: row.turnSequence,
        participantId: row.participantId,
        turnTotalScore: row.turnTotalScore,
        darts: [],
      };
      turns.push(current);
      currentIsTurnTotalOnly = false;
    }

    if (row.dartNumber === null) {
      if (current.darts.length > 0) {
        throw new Error(
          `rowsToTurns: turn ${row.stageId}:${row.turnSequence} mixes a NULL dart-number row with real darts`,
        );
      }
      currentIsTurnTotalOnly = true;
      continue;
    }

    if (currentIsTurnTotalOnly) {
      throw new Error(
        `rowsToTurns: turn ${row.stageId}:${row.turnSequence} mixes a NULL dart-number row with real darts`,
      );
    }
    if (row.score === null || row.hitZoneKey === null) {
      throw new Error(
        `rowsToTurns: dart ${row.dartNumber} of turn ${row.stageId}:${row.turnSequence} is missing score or hitZoneKey`,
      );
    }

    const dart: ReplayDart = {
      dartNumber: row.dartNumber,
      intendedTargetNumber: row.intendedTargetNumber,
      intendedZoneKey: row.intendedZoneKey,
      hitTargetNumber: row.hitTargetNumber,
      hitZoneKey: row.hitZoneKey,
      score: row.score,
      locationX: row.locationX,
      locationY: row.locationY,
    };
    current.darts.push(dart);
  }

  return turns;
}

/**
 * Every replayed turn's `completedAt`. A replay page carries no per-turn
 * completion time, and the engines read `completedAt` only as open (`null`)
 * or closed, never its value: 121, TUOD and Score Training fold closed
 * visits only, and the seat rota hands an open visit back to its thrower.
 * So every loaded turn replays as a closed visit, an abandoned session's
 * unfinished last visit included.
 */
const REPLAYED_TURN_CLOSED_AT = new Date(0).toISOString();

/** One `ReplayTurnSchemaData` turn's own dart shape — the wire schema's element type, named apart from `ReplayDart` (`@modules/types`) to avoid shadowing it. */
type ReplayWireDart = ReplayTurnSchemaData["darts"][number];

function dartFactOf(dart: ReplayWireDart): DartFact {
  return {
    sequence: dart.dartNumber,
    intendedTargetNumber: dart.intendedTargetNumber,
    intendedZoneKey: dart.intendedZoneKey as DartZoneKey | null,
    hitTargetNumber: dart.hitTargetNumber,
    hitZoneKey: dart.hitZoneKey as DartZoneKey,
    score: dart.score,
    locationX: dart.locationX,
    locationY: dart.locationY,
  };
}

function turnFactOf(turn: ReplayTurnSchemaData): TurnFact {
  return {
    clientKey: `${turn.stageId}:${turn.turnSequence}`,
    stageClientKey: turn.stageId,
    participantRef: turn.participantId,
    sequence: turn.turnSequence,
    completedAt: REPLAYED_TURN_CLOSED_AT,
    totalScore: turn.turnTotalScore,
    darts: turn.darts.map(dartFactOf),
  };
}

/**
 * The loaded replay as the engine fact log it was played as (D371 decision
 * 8): a stage's client key is its id, a turn's is `stageId:turnSequence`,
 * and a dart's sequence is its dart number.
 */
export function replayFacts(
  stages: ReplayHeaderSchemaData["stages"],
  turns: readonly ReplayTurnSchemaData[],
): EngineFacts {
  return {
    stages: stages.map((stage) => ({
      clientKey: stage.stageId,
      stageTypeKey: stage.stageTypeKey as StageTypeKey,
      parentClientKey: stage.parentStageId,
      sequence: stage.sequence,
    })),
    turns: turns.map(turnFactOf),
  };
}
