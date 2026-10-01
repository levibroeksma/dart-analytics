import { describe, it, expect, vi } from "vitest";
import { renderingDb } from "./render-sql";

const rendered = renderingDb();

vi.mock("@db/client", () => ({
  getDb: () => rendered.db,
  withTransaction: (fn: (tx: unknown) => unknown) => fn(rendered.db),
}));

const BATCH = {
  sessionId: "s1",
  idempotencyRecordId: "i1",
  idempotencyKey: "k1",
  normalizedPayloadHash: "h1",
  stages: [
    { id: "st1", parentStageId: null, stageTypeId: 1, sequenceNumber: 1 },
  ],
  turns: [
    {
      id: "t1",
      stageId: "st1",
      participantId: "pt1",
      sequenceNumber: 1,
      totalScore: 60,
      completedAt: "2026-01-01T00:00:00.000Z",
      darts: [
        {
          id: "d1",
          dartNumber: 1,
          intendedTargetNumber: 20,
          intendedZoneId: 1,
          hitTargetNumber: 20,
          hitZoneId: 1,
          score: 60,
          locationX: 0.5,
          locationY: 0.25,
        },
      ],
    },
  ],
};

/**
 * The gameplay batch write is the one path where a malformed statement would
 * lose recorded darts rather than merely fail a screen, and it opens its own
 * transaction — so `@db/client` is mocked to hand it the rendering client
 * (issue #397).
 */
describe("insertBatchRecords rendered SQL", () => {
  it("writes stages, turns, darts and the idempotency record in that order", async () => {
    const { insertBatchRecords } =
      await import("@repositories/session.repository");
    const result = await insertBatchRecords(BATCH as never);

    expect(result).toEqual({ stages: 1, turns: 1, darts: 1 });
    expect(rendered.statements.map((statement) => statement.sql)).toEqual([
      'insert into "exercise_stages" ("id", "exercise_session_id", "parent_stage_id", "stage_type_id", "sequence_number", "created_at") values ($1, $2, $3, $4, $5, $6)',
      'insert into "turns" ("id", "exercise_stage_id", "participant_id", "sequence_number", "total_score", "completed_at", "created_at") values ($1, $2, $3, $4, $5, $6, $7)',
      'insert into "darts" ("id", "turn_id", "dart_number", "intended_target_number", "intended_zone_id", "hit_target_number", "hit_zone_id", "score", "created_at", "location_x", "location_y") values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
      'insert into "session_write_idempotency" ("id", "session_id", "idempotency_key", "normalized_payload_hash", "result", "created_at") values ($1, $2, $3, $4, $5, $6)',
    ]);
  });
});

describe("finishSessionRecords rendered SQL", () => {
  it("updates the session, then closes only a standalone activity with the same status and instant", async () => {
    rendered.statements.length = 0;
    const { finishSessionRecords } =
      await import("@repositories/session.repository");
    await finishSessionRecords("s1", 2, "2026-01-01T00:00:00.000Z");

    const [sessionUpdate, activityUpdate] = rendered.statements;
    expect(rendered.statements).toHaveLength(2);
    expect(sessionUpdate.sql).toBe(
      'update "exercise_sessions" set "status_id" = $1, "completed_at" = $2 where "exercise_sessions"."id" = $3',
    );
    expect(activityUpdate.sql).toContain('update "activities"');
    expect(activityUpdate.sql).toContain('"completed_at" is null');
    expect(activityUpdate.sql).toContain('"activity_configurations"');
    expect(activityUpdate.sql).toContain("not exists");
    expect(activityUpdate.params).toEqual(
      expect.arrayContaining([2, "2026-01-01T00:00:00.000Z", "s1"]),
    );
  });
});
