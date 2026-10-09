import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { findVisitScoring } from "@repositories/statistics.repository";
import { inRolledBackTx, uuid } from "./fixtures/itest-db";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

type Db = Parameters<typeof findVisitScoring>[0];

const OWNER = "01990000-0000-7000-8000-000000069701";
const ACTIVITY = "01990000-0000-7000-8000-000000069702";
const RANGE = { from: "2020-01-01T00:00:00Z", to: "2030-01-01T00:00:00Z" };
const BANDS = [100, 140, 180] as const;

type SessionSeed = {
  base: number;
  ruleset: string;
  stageType: string;
  ownerScores: number[];
  guestScores: number[];
};

/**
 * Seeds one completed VISUAL_BOARD session. Turn numbers are stage-wide, so
 * the seats interleave: owner on odd numbers, guest on even. Each turn gets
 * one dart, so darts equal visits.
 */
async function seedSession(db: Db, s: SessionSeed) {
  const [session, stage, ownerSeat, guestSeat] = [1, 2, 3, 4].map((i) =>
    uuid(s.base + i),
  );
  await db.execute(sql`
    INSERT INTO exercise_sessions (
      id, activity_id, player_id, exercise_type_id, game_type_id, capture_mode_id,
      input_mode_id, status_id, ruleset_version_id, started_at, completed_at, created_at
    )
    SELECT ${session}::uuid, ${ACTIVITY}::uuid, ${OWNER}::uuid,
      (SELECT id FROM exercise_types WHERE implementation_key = 'GAME'),
      rv.game_type_id,
      (SELECT id FROM capture_modes WHERE implementation_key = 'ANALYTICS'),
      (SELECT id FROM input_modes WHERE implementation_key = 'VISUAL_BOARD'),
      (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
      rv.id, now() - interval '1 hour', now(), now()
    FROM ruleset_versions rv WHERE rv.implementation_key = ${s.ruleset}`);
  await db.execute(sql`
    INSERT INTO exercise_stages (id, exercise_session_id, stage_type_id, sequence_number, created_at)
    VALUES (${stage}::uuid, ${session}::uuid,
      (SELECT id FROM stage_types WHERE implementation_key = ${s.stageType}), 1, now())`);
  await db.execute(sql`
    INSERT INTO participants (id, exercise_session_id, participant_type_id, player_id, display_name, created_at)
    VALUES (${ownerSeat}::uuid, ${session}::uuid,
        (SELECT id FROM participant_types WHERE implementation_key = 'PLAYER'), ${OWNER}::uuid, 'Itest Owner', now()),
      (${guestSeat}::uuid, ${session}::uuid,
        (SELECT id FROM participant_types WHERE implementation_key = 'GUEST'), NULL, 'Itest Guest', now())`);
  const turns = [
    ...s.ownerScores.map((score, i) => ({
      seat: ownerSeat,
      seq: i * 2 + 1,
      score,
    })),
    ...s.guestScores.map((score, i) => ({
      seat: guestSeat,
      seq: i * 2 + 2,
      score,
    })),
  ];
  for (const [i, t] of turns.entries()) {
    const turn = uuid(s.base + 0x100 + i);
    await db.execute(sql`
      INSERT INTO turns (id, exercise_stage_id, participant_id, sequence_number, total_score, completed_at, created_at)
      VALUES (${turn}::uuid, ${stage}::uuid, ${t.seat}::uuid, ${t.seq}, ${t.score}, now(), now())`);
    await db.execute(sql`
      INSERT INTO darts (id, turn_id, dart_number, hit_target_number, hit_zone_id, score, created_at)
      VALUES (${uuid(s.base + 0x200 + i)}::uuid, ${turn}::uuid, 1, 20,
        (SELECT id FROM dart_zones WHERE implementation_key = 'TREBLE'), ${t.score}, now())`);
  }
}

async function seedWorld(db: Db) {
  await db.execute(sql`
    INSERT INTO players (id, auth_user_id, display_name, created_at, updated_at)
    VALUES (${OWNER}::uuid, 'itest-697-owner', 'Itest Owner', now(), now())`);
  await db.execute(sql`
    INSERT INTO activities (id, player_id, status_id, started_at, created_at)
    VALUES (${ACTIVITY}::uuid, ${OWNER}::uuid,
      (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'), now(), now())`);
}

function scoring(db: Db, gameTypeKey: "501" | "SCORE_TRAINING") {
  return findVisitScoring(db, {
    playerId: OWNER,
    gameTypeKey,
    ...RANGE,
    statuses: ["COMPLETED"],
    context: "all",
    bucket: "none",
    tz: undefined,
    bands: BANDS,
  });
}

describe("findVisitScoring first nine (#697)", () => {
  it("counts the owner's first three visits per LEG, with 1v1 seats interleaved", async () => {
    const rows = await inRolledBackTx(async (db: Db) => {
      await seedWorld(db);
      await seedSession(db, {
        base: 0x69710,
        ruleset: "501_V1",
        stageType: "LEG",
        ownerScores: [10, 20, 30, 40],
        guestScores: [100, 100, 100, 100],
      });
      return scoring(db, "501");
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      points: 100,
      darts: 4,
      firstNinePoints: 60,
      firstNineDarts: 3,
    });
  });

  it("counts the owner's first three visits per EXERCISE_BLOCK in Score Training", async () => {
    const rows = await inRolledBackTx(async (db: Db) => {
      await seedWorld(db);
      await seedSession(db, {
        base: 0x69720,
        ruleset: "SCORE_TRAINING_V1",
        stageType: "EXERCISE_BLOCK",
        ownerScores: [5, 6, 7, 8],
        guestScores: [90, 90, 90, 90],
      });
      return scoring(db, "SCORE_TRAINING");
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      points: 26,
      darts: 4,
      firstNinePoints: 18,
      firstNineDarts: 3,
    });
  });
});
