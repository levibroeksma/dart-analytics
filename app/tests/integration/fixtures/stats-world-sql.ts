import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "@db/schema";

/** The transaction handle every fixture insert and every statistics read uses. */
export type Db = PostgresJsDatabase<typeof schema>;

/** UUIDv7-shaped literal; `n` is the low 48 bits (spec §3.2: `0xa0000`–`0xaffff`). */
export function uuid(n: number): string {
  return `01990000-0000-7000-8000-${n.toString(16).padStart(12, "0")}`;
}

export type ZoneKey =
  "SINGLE" | "DOUBLE" | "TREBLE" | "OUTER_BULL" | "INNER_BULL" | "MISS";

/** One scripted dart: a `MISS` has `target: null` (spec F14). */
export type ScriptDart = {
  target: number | null;
  zone: ZoneKey;
  score: number;
  x: number;
  y: number;
};

/** Turns of darts, in play order. */
export type DartScript = readonly (readonly ScriptDart[])[];

function dart(
  target: number | null,
  zone: ZoneKey,
  score: number,
  x: number,
  y: number,
): ScriptDart {
  return { target, zone, score, x, y };
}

/**
 * Spec §4.3: 3 turns × 3 darts, used by every game except `501` and by every
 * dart-kind routine step. Safe for every walker and fold (spec F19–F21).
 */
export const UNIVERSAL_SCRIPT: DartScript = [
  [
    dart(20, "TREBLE", 60, 0, -103),
    dart(20, "SINGLE", 20, 2, -130),
    dart(20, "DOUBLE", 40, -1, -165),
  ],
  [
    dart(19, "SINGLE", 19, -40, 120),
    dart(25, "OUTER_BULL", 25, 8, 6),
    dart(null, "MISS", 0, 190, 10),
  ],
  [
    dart(25, "INNER_BULL", 50, 1, -2),
    dart(19, "TREBLE", 57, -55, 90),
    dart(16, "DOUBLE", 32, 90, 140),
  ],
];

/** Spec §4.3: one visit that checks out 170 (T20, T20, bull) — the `501` script. */
export const CHECKOUT_170_SCRIPT: DartScript = [
  [
    dart(20, "TREBLE", 60, 0, -103),
    dart(20, "TREBLE", 60, 1, -104),
    dart(25, "INNER_BULL", 50, 1, -2),
  ],
];

/**
 * One completed `exercise_sessions` row and its satellites. `base` is the id
 * block: `+0` session, `+1` stage, `+2` owner seat, `+3` configuration,
 * `+0x10..` turns, `+0x40..` darts (spec §3.2). `captured` selects the
 * `ANALYTICS`/`VISUAL_BOARD` pair; `false` leaves both NULL (a Warm-Up).
 * `play: null` writes no stage, seat, turn or dart.
 */
export type SessionSpec = {
  base: number;
  activityId: string;
  playerId: string;
  exerciseTypeKey: string;
  exerciseRulesetVersionKey: string | null;
  gameTypeKey: string | null;
  rulesetVersionKey: string | null;
  captured: boolean;
  routineStepSequenceNumber: number | null;
  configuration: Record<string, unknown>;
  play: {
    stageTypeKey: "LEG" | "ROUND" | "EXERCISE_BLOCK";
    script: DartScript;
  } | null;
};

async function insertPlay(
  db: Db,
  spec: SessionSpec,
  sessionId: string,
  play: NonNullable<SessionSpec["play"]>,
): Promise<void> {
  const stageId = uuid(spec.base + 1);
  const seatId = uuid(spec.base + 2);
  await db.execute(sql`
    INSERT INTO exercise_stages (id, exercise_session_id, parent_stage_id, stage_type_id, sequence_number, created_at)
    VALUES (${stageId}::uuid, ${sessionId}::uuid, NULL,
      (SELECT id FROM stage_types WHERE implementation_key = ${play.stageTypeKey}), 1, now())`);
  await db.execute(sql`
    INSERT INTO participants (id, exercise_session_id, participant_type_id, player_id, display_name, created_at)
    VALUES (${seatId}::uuid, ${sessionId}::uuid,
      (SELECT id FROM participant_types WHERE implementation_key = 'PLAYER'),
      ${spec.playerId}::uuid, 'Stats World', now())`);
  for (const [turnIndex, turn] of play.script.entries()) {
    const turnId = uuid(spec.base + 0x10 + turnIndex);
    const total = turn.reduce((sum, d) => sum + d.score, 0);
    await db.execute(sql`
      INSERT INTO turns (id, exercise_stage_id, participant_id, sequence_number, total_score, completed_at, created_at)
      VALUES (${turnId}::uuid, ${stageId}::uuid, ${seatId}::uuid, ${turnIndex + 1}, ${total}, now(), now())`);
    for (const [dartIndex, d] of turn.entries()) {
      await db.execute(sql`
        INSERT INTO darts (id, turn_id, dart_number, intended_target_number, intended_zone_id,
          hit_target_number, hit_zone_id, score, location_x, location_y, created_at)
        VALUES (${uuid(spec.base + 0x40 + turnIndex * 3 + dartIndex)}::uuid, ${turnId}::uuid, ${dartIndex + 1},
          NULL, NULL, ${d.target},
          (SELECT id FROM dart_zones WHERE implementation_key = ${d.zone}),
          ${d.score}, ${d.x}, ${d.y}, now())`);
    }
  }
}

/**
 * Inserts one completed session (status `COMPLETED`, started an hour ago,
 * completed now) with its `exercise_configurations` row, then its play.
 * Every lookup is a sub-select on `implementation_key`; a NULL key yields a
 * NULL id, which the NOT NULL columns reject loudly. Returns the session id.
 */
export async function insertSession(
  db: Db,
  spec: SessionSpec,
): Promise<string> {
  const sessionId = uuid(spec.base);
  const captureKey = spec.captured ? "ANALYTICS" : null;
  const inputKey = spec.captured ? "VISUAL_BOARD" : null;
  await db.execute(sql`
    INSERT INTO exercise_sessions (id, activity_id, player_id, exercise_type_id, exercise_ruleset_version_id,
      game_type_id, ruleset_version_id, capture_mode_id, input_mode_id, status_id,
      routine_step_sequence_number, started_at, completed_at, created_at)
    VALUES (${sessionId}::uuid, ${spec.activityId}::uuid, ${spec.playerId}::uuid,
      (SELECT id FROM exercise_types WHERE implementation_key = ${spec.exerciseTypeKey}),
      (SELECT id FROM exercise_ruleset_versions WHERE implementation_key = ${spec.exerciseRulesetVersionKey}),
      (SELECT id FROM game_types WHERE implementation_key = ${spec.gameTypeKey}),
      (SELECT id FROM ruleset_versions WHERE implementation_key = ${spec.rulesetVersionKey}),
      (SELECT id FROM capture_modes WHERE implementation_key = ${captureKey}),
      (SELECT id FROM input_modes WHERE implementation_key = ${inputKey}),
      (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
      ${spec.routineStepSequenceNumber}, now() - interval '1 hour', now(), now())`);
  await db.execute(sql`
    INSERT INTO exercise_configurations (id, exercise_session_id, configuration, created_at)
    VALUES (${uuid(spec.base + 3)}::uuid, ${sessionId}::uuid, ${JSON.stringify(spec.configuration)}::jsonb, now())`);
  if (spec.play !== null) await insertPlay(db, spec, sessionId, spec.play);
  return sessionId;
}
