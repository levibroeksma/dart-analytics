import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@db/client", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@lib/id", () => ({
  generateId: vi.fn(() => "generated-id"),
  generateBotSeed: vi.fn(() => 424242),
}));
vi.mock("@repositories/session.repository", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@repositories/session.repository")>();
  return {
    ...actual,
    findGameTypeAndRuleset: vi.fn(),
    findCaptureModeId: vi.fn(),
    findInputModeId: vi.fn(),
    findGameStatusId: vi.fn(),
    findParticipantTypeId: vi.fn(),
    findPlayerDisplayName: vi.fn(),
    findConfigurationTemplate: vi.fn(),
    insertSessionRecords: vi.fn(),
    findSessionRow: vi.fn(),
    findSessionConfiguration: vi.fn(),
    findSessionParticipantIds: vi.fn(),
    countTurnsForSession: vi.fn(),
    findIdempotencyRecord: vi.fn(),
    findStageTypeIdMap: vi.fn(),
    findDartZoneIdMap: vi.fn(),
    insertBatchRecords: vi.fn(),
    findActiveSessions: vi.fn(),
    findActiveSessionForGameType: vi.fn(),
    findConfigurationPresets: vi.fn(),
    updateSessionStatusRecord: vi.fn(),
  };
});
vi.mock("@services/rulesets/registry", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@services/rulesets/registry")>();
  return { ...actual, getRulesetValidator: vi.fn(actual.getRulesetValidator) };
});

import * as repo from "@repositories/session.repository";
import * as registry from "@services/rulesets/registry";
import {
  appendBatch,
  canonicalize,
  hashBatchPayload,
  createSession,
  updateSessionStatus,
  listActiveSessions,
  listConfigurationPresets,
} from "@services/session.service";
import type { DartFactInput } from "@routes/types";

const inlineRequest = {
  gameTypeKey: "SCORE_TRAINING",
  rulesetVersionKey: "SCORE_TRAINING_V1",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "QUICK_SCORE",
  config: {
    source: "inline" as const,
    config: {
      duration_type: "ROUNDS",
      duration_value: 10,
      max_darts_per_turn: 3,
    },
  },
};

const fiveOhOneRequest = {
  gameTypeKey: "501",
  rulesetVersionKey: "501_V1",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "QUICK_SCORE",
  config: {
    source: "inline" as const,
    config: {
      starting_score: 501,
      legs_to_win: 1,
      check_in: "STRAIGHT_IN",
      check_out: "DOUBLE_OUT",
      max_darts_per_turn: 3,
    },
  },
};

const bobs27Request = {
  gameTypeKey: "BOBS27",
  rulesetVersionKey: "BOBS27_V1",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "DETAILED_DARTS",
  config: { source: "inline" as const, config: {} },
};

describe("createSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(repo.findGameTypeAndRuleset).mockResolvedValue({
      gameTypeId: "gt1",
      rulesetVersionId: "rv1",
    });
    vi.mocked(repo.findCaptureModeId).mockResolvedValue(1);
    vi.mocked(repo.findInputModeId).mockResolvedValue(1);
    vi.mocked(repo.findGameStatusId).mockResolvedValue(1);
    vi.mocked(repo.findParticipantTypeId).mockImplementation(
      async (_db: unknown, key: string) =>
        key === "PLAYER" ? 1 : key === "GUEST" ? 2 : 3,
    );
    vi.mocked(repo.findPlayerDisplayName).mockResolvedValue("Levi");
    vi.mocked(repo.insertSessionRecords).mockResolvedValue({
      sessionId: "generated-id",
    });
    vi.mocked(repo.findActiveSessionForGameType).mockResolvedValue(undefined);
  });

  it("creates a session from inline config", async () => {
    const result = await createSession("player-1", inlineRequest);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sessionId).toBe("generated-id");
      expect(result.data.participants).toEqual([
        {
          ref: "generated-id",
          participantTypeKey: "PLAYER",
          displayName: "Levi",
        },
      ]);
    }
  });

  it("mints one PLAYER participant when participants is omitted", async () => {
    const result = await createSession("player-1", inlineRequest);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.participants).toHaveLength(1);
    expect(result.data.participants[0].participantTypeKey).toBe("PLAYER");
  });

  it("mints one participant per requested seat and returns them in order", async () => {
    const result = await createSession("player-1", {
      ...fiveOhOneRequest,
      participants: [
        { participantTypeKey: "PLAYER", sideKey: "A" },
        { participantTypeKey: "GUEST", displayName: "Dad", sideKey: "B" },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.data.participants.map((p) => [
        p.participantTypeKey,
        p.displayName,
      ]),
    ).toEqual([
      ["PLAYER", "Levi"],
      ["GUEST", "Dad"],
    ]);
  });

  it("copies the PLAYER display name from the player row, ignoring the request", async () => {
    const result = await createSession("player-1", {
      ...inlineRequest,
      participants: [
        { participantTypeKey: "PLAYER", displayName: "Spoofed", sideKey: "A" },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.participants[0].displayName).toBe("Levi");
  });

  it("writes the seats into the configuration snapshot, matching the minted ids", async () => {
    const result = await createSession("player-1", {
      ...fiveOhOneRequest,
      participants: [
        { participantTypeKey: "PLAYER", sideKey: "A" },
        { participantTypeKey: "GUEST", displayName: "Dad", sideKey: "B" },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const written = vi.mocked(repo.insertSessionRecords).mock.calls[0][0];
    expect(written.configuration.seats).toEqual(
      result.data.participants.map((participant, index) => ({
        participantRef: participant.ref,
        displayName: participant.displayName,
        sideKey: index === 0 ? "A" : "B",
        participantTypeKey: participant.participantTypeKey,
      })),
    );
  });

  describe("a DARTBOT seat", () => {
    it("mints a DARTBOT participant with display name DartBot, ignoring a spoofed displayName", async () => {
      const result = await createSession("player-1", {
        ...bobs27Request,
        participants: [
          { participantTypeKey: "PLAYER", sideKey: "A" },
          {
            participantTypeKey: "DARTBOT",
            displayName: "Spoofed",
            sideKey: "B",
          },
        ],
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.participants[1]).toEqual({
        ref: "generated-id",
        participantTypeKey: "DARTBOT",
        displayName: "DartBot",
        dartbot: { level: 8, seed: 424242, levelSource: "MANUAL" },
      });
    });

    it("defaults the level to 8 when the request omits it", async () => {
      const result = await createSession("player-1", {
        ...bobs27Request,
        participants: [
          { participantTypeKey: "PLAYER", sideKey: "A" },
          { participantTypeKey: "DARTBOT", sideKey: "B" },
        ],
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.participants[1].dartbot?.level).toBe(8);
    });

    it("uses the requested level when one is given", async () => {
      const result = await createSession("player-1", {
        ...bobs27Request,
        participants: [
          { participantTypeKey: "PLAYER", sideKey: "A" },
          { participantTypeKey: "DARTBOT", level: 13, sideKey: "B" },
        ],
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.participants[1].dartbot?.level).toBe(13);
    });

    it("writes the same dartbot payload into the configuration snapshot's seat", async () => {
      const result = await createSession("player-1", {
        ...bobs27Request,
        participants: [
          { participantTypeKey: "PLAYER", sideKey: "A" },
          { participantTypeKey: "DARTBOT", sideKey: "B" },
        ],
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const written = vi.mocked(repo.insertSessionRecords).mock.calls[0][0];
      expect((written.configuration.seats as unknown[])[1]).toEqual({
        participantRef: "generated-id",
        displayName: "DartBot",
        sideKey: "B",
        participantTypeKey: "DARTBOT",
        dartbot: { level: 8, seed: 424242, levelSource: "MANUAL" },
      });
    });

    it("rejects a DARTBOT seat for a ruleset that does not admit one", async () => {
      const result = await createSession("player-1", {
        ...fiveOhOneRequest,
        participants: [
          { participantTypeKey: "PLAYER", sideKey: "A" },
          { participantTypeKey: "DARTBOT", sideKey: "B" },
        ],
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("VALIDATION_FAILED");
      expect(repo.insertSessionRecords).not.toHaveBeenCalled();
    });
  });

  it("rejects a seat request the seat rules refuse, without writing anything", async () => {
    const result = await createSession("player-1", {
      ...inlineRequest,
      participants: [
        { participantTypeKey: "GUEST", displayName: "Dad", sideKey: "A" },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("VALIDATION_FAILED");
    expect(repo.insertSessionRecords).not.toHaveBeenCalled();
  });

  it("rejects an unknown gameTypeKey/rulesetVersionKey combination", async () => {
    vi.mocked(repo.findGameTypeAndRuleset).mockResolvedValue(undefined);
    const result = await createSession("player-1", inlineRequest);
    expect(result).toMatchObject({ ok: false, code: "VALIDATION_FAILED" });
  });

  it("rejects an invalid inline config via the ruleset validator", async () => {
    const result = await createSession("player-1", {
      ...inlineRequest,
      config: {
        source: "inline",
        config: {
          duration_type: "ROUNDS",
          duration_value: 10,
          max_darts_per_turn: 4,
        },
      },
    });
    expect(result).toMatchObject({ ok: false, code: "VALIDATION_FAILED" });
  });

  it("accepts an inline config with duration_value: 100, the ROUNDS ceiling", async () => {
    const result = await createSession("player-1", {
      ...inlineRequest,
      config: {
        source: "inline",
        config: {
          duration_type: "ROUNDS",
          duration_value: 100,
          max_darts_per_turn: 3,
        },
      },
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an inline config with duration_value: 101, one past the ROUNDS ceiling", async () => {
    const result = await createSession("player-1", {
      ...inlineRequest,
      config: {
        source: "inline",
        config: {
          duration_type: "ROUNDS",
          duration_value: 101,
          max_darts_per_turn: 3,
        },
      },
    });
    expect(result).toMatchObject({ ok: false, code: "VALIDATION_FAILED" });
  });

  it("rejects an inline config with duration_value: 2, one below the MINUTES floor", async () => {
    const result = await createSession("player-1", {
      ...inlineRequest,
      config: {
        source: "inline",
        config: {
          duration_type: "MINUTES",
          duration_value: 2,
          max_darts_per_turn: 3,
        },
      },
    });
    expect(result).toMatchObject({ ok: false, code: "VALIDATION_FAILED" });
  });

  it("accepts an inline config with duration_value: 3, the MINUTES floor", async () => {
    const result = await createSession("player-1", {
      ...inlineRequest,
      config: {
        source: "inline",
        config: {
          duration_type: "MINUTES",
          duration_value: 3,
          max_darts_per_turn: 3,
        },
      },
    });
    expect(result.ok).toBe(true);
  });

  it("accepts an inline config with duration_value: 30, the MINUTES ceiling", async () => {
    const result = await createSession("player-1", {
      ...inlineRequest,
      config: {
        source: "inline",
        config: {
          duration_type: "MINUTES",
          duration_value: 30,
          max_darts_per_turn: 3,
        },
      },
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an inline config with duration_value: 31, one past the MINUTES ceiling", async () => {
    const result = await createSession("player-1", {
      ...inlineRequest,
      config: {
        source: "inline",
        config: {
          duration_type: "MINUTES",
          duration_value: 31,
          max_darts_per_turn: 3,
        },
      },
    });
    expect(result).toMatchObject({ ok: false, code: "VALIDATION_FAILED" });
  });

  it("resolves a template config, merging overrides", async () => {
    vi.mocked(repo.findConfigurationTemplate).mockResolvedValue({
      id: "tmpl-1",
      configuration: {
        duration_type: "ROUNDS",
        duration_value: 10,
        max_darts_per_turn: 3,
      },
    });
    const result = await createSession("player-1", {
      ...inlineRequest,
      config: {
        source: "template",
        templateRef: "tmpl-1",
        overrides: { duration_value: 20 },
      },
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an unknown templateRef", async () => {
    vi.mocked(repo.findConfigurationTemplate).mockResolvedValue(undefined);
    const result = await createSession("player-1", {
      ...inlineRequest,
      config: { source: "template", templateRef: "missing" },
    });
    expect(result).toMatchObject({ ok: false, code: "VALIDATION_FAILED" });
  });

  it("returns SESSION_ALREADY_ACTIVE with details when one is active (pre-check)", async () => {
    vi.mocked(repo.findActiveSessionForGameType).mockResolvedValue({
      sessionId: "active-1",
      startedAt: "2026-07-22T10:00:00.000Z",
    });
    const result = await createSession("player-1", inlineRequest);
    expect(result).toMatchObject({
      ok: false,
      code: "SESSION_ALREADY_ACTIVE",
      details: { sessionId: "active-1", startedAt: "2026-07-22T10:00:00.000Z" },
    });
    expect(repo.insertSessionRecords).not.toHaveBeenCalled();
  });

  it("returns SESSION_ALREADY_ACTIVE on a unique-violation race", async () => {
    vi.mocked(repo.findActiveSessionForGameType)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        sessionId: "active-2",
        startedAt: "2026-07-22T11:00:00.000Z",
      });
    vi.mocked(repo.insertSessionRecords).mockRejectedValue(
      Object.assign(
        new Error(
          'duplicate key value violates unique constraint "uq_sessions_single_active"',
        ),
        { code: "23505", constraint: "uq_sessions_single_active" },
      ),
    );
    const result = await createSession("player-1", inlineRequest);
    expect(result).toMatchObject({
      ok: false,
      code: "SESSION_ALREADY_ACTIVE",
      details: { sessionId: "active-2" },
    });
  });

  it("re-throws a non-conflict insert error for the middleware boundary", async () => {
    vi.mocked(repo.insertSessionRecords).mockRejectedValue(
      new Error("Connection terminated"),
    );
    await expect(createSession("player-1", inlineRequest)).rejects.toThrow(
      "Connection terminated",
    );
  });

  it("rejects a mode pair the ruleset does not declare", async () => {
    // SCORE_TRAINING_V1's real validator already refuses RECREATIONAL +
    // DETAILED_DARTS on its own (a different reason: "only supports ...
    // QUICK_SCORE"), which would mask whether the capabilities guard under
    // test is doing anything. Swap in a permissive validator for this one
    // call so the guard is the only thing standing between this request and
    // a database write.
    vi.mocked(registry.getRulesetValidator).mockReturnValueOnce({
      validateConfig: () => ({ valid: true, config: {} }),
      validateBatch: () => ({ valid: true }),
    });
    const result = await createSession("player-1", {
      ...inlineRequest,
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ code: "VALIDATION_FAILED" });
    expect(repo.insertSessionRecords).not.toHaveBeenCalled();
  });

  it("accepts a mode pair the ruleset declares", async () => {
    // SINGLES_V1 declares exactly RECREATIONAL + DETAILED_DARTS, and its real
    // validator accepts this config too, so this is a genuine end-to-end
    // happy path the guard must not block — it fails a guard that is
    // over-broad (rejects everything) as surely as the previous test fails
    // one that is missing entirely.
    const result = await createSession("player-1", {
      gameTypeKey: "SINGLES",
      rulesetVersionKey: "SINGLES_V1",
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
      config: {
        source: "inline",
        config: {
          order_mode: "LOW_TO_HIGH",
          target_order: [
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
            20, 25,
          ],
          difficulty: "EASY",
        },
      },
    });
    expect(result.ok).toBe(true);
  });
});

function sampleBatch(
  overrides: Partial<{ participantRef: string; darts: DartFactInput[] }> = {},
) {
  return {
    stages: [
      {
        clientKey: "s1",
        stageTypeKey: "EXERCISE_BLOCK",
        parentClientKey: null,
        sequence: 1,
        turns: [
          {
            clientKey: "t1",
            participantRef: overrides.participantRef ?? "participant-1",
            sequence: 1,
            totalScore: 45,
            completedAt: null,
            darts: overrides.darts ?? [],
          },
        ],
      },
    ],
  };
}

describe("canonicalize / hashBatchPayload", () => {
  it("produces the same hash regardless of key order", async () => {
    const a = await hashBatchPayload({ stages: [{ b: 1, a: 2 }] } as never);
    const b = await hashBatchPayload({ stages: [{ a: 2, b: 1 }] } as never);
    expect(a).toBe(b);
  });

  it("produces different hashes for different payloads", async () => {
    const a = await hashBatchPayload(sampleBatch());
    const b = await hashBatchPayload(
      sampleBatch({ participantRef: "participant-2" }),
    );
    expect(a).not.toBe(b);
  });
});

describe("canonicalize", () => {
  it("recursively sorts object keys", () => {
    expect(canonicalize({ b: 1, a: { d: 2, c: 3 } })).toEqual({
      a: { c: 3, d: 2 },
      b: 1,
    });
    expect(JSON.stringify(canonicalize({ b: 1, a: 2 }))).toBe('{"a":2,"b":1}');
  });

  it("preserves array order", () => {
    expect(canonicalize([3, 1, 2])).toEqual([3, 1, 2]);
  });
});

describe("appendBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(repo.findSessionRow).mockResolvedValue({
      id: "session-1",
      playerId: "player-1",
      statusId: 1,
      rulesetVersionKey: "SCORE_TRAINING_V1",
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    vi.mocked(repo.findGameStatusId).mockResolvedValue(1);
    vi.mocked(repo.findIdempotencyRecord).mockResolvedValue(undefined);
    vi.mocked(repo.findSessionParticipantIds).mockResolvedValue([
      "participant-1",
    ]);
    vi.mocked(repo.findSessionConfiguration).mockResolvedValue({
      duration_type: "ROUNDS",
      duration_value: 10,
      max_darts_per_turn: 3,
    });
    vi.mocked(repo.countTurnsForSession).mockResolvedValue({});
    vi.mocked(repo.findStageTypeIdMap).mockResolvedValue(
      new Map([["EXERCISE_BLOCK", 5]]),
    );
    vi.mocked(repo.findDartZoneIdMap).mockResolvedValue(new Map());
    vi.mocked(repo.insertBatchRecords).mockResolvedValue({
      stages: 1,
      turns: 1,
      darts: 0,
    });
  });

  it("inserts a valid batch", async () => {
    const result = await appendBatch(
      "player-1",
      "session-1",
      "idem-1",
      sampleBatch(),
    );
    expect(result).toEqual({
      ok: true,
      data: { created: { stages: 1, turns: 1, darts: 0 } },
    });
  });

  it("returns NOT_FOUND for an unknown session", async () => {
    vi.mocked(repo.findSessionRow).mockResolvedValue(undefined);
    const result = await appendBatch(
      "player-1",
      "missing",
      "idem-1",
      sampleBatch(),
    );
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("returns SESSION_OWNERSHIP_MISMATCH for a different player", async () => {
    const result = await appendBatch(
      "someone-else",
      "session-1",
      "idem-1",
      sampleBatch(),
    );
    expect(result).toMatchObject({
      ok: false,
      code: "SESSION_OWNERSHIP_MISMATCH",
    });
  });

  it("returns SESSION_ALREADY_COMPLETED for a non-active session", async () => {
    vi.mocked(repo.findSessionRow).mockResolvedValue({
      id: "session-1",
      playerId: "player-1",
      statusId: 2,
      rulesetVersionKey: "SCORE_TRAINING_V1",
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    const result = await appendBatch(
      "player-1",
      "session-1",
      "idem-1",
      sampleBatch(),
    );
    expect(result).toMatchObject({
      ok: false,
      code: "SESSION_ALREADY_COMPLETED",
    });
  });

  it("returns BATCH_REFERENCE_MISSING for an unknown participantRef", async () => {
    const result = await appendBatch(
      "player-1",
      "session-1",
      "idem-1",
      sampleBatch({ participantRef: "ghost" }),
    );
    expect(result).toMatchObject({
      ok: false,
      code: "BATCH_REFERENCE_MISSING",
    });
  });

  it("returns BATCH_INCONSISTENT_ORDERING for a duplicate turn sequence", async () => {
    const batch = sampleBatch();
    batch.stages[0].turns.push({
      ...batch.stages[0].turns[0],
      clientKey: "t2",
    });
    const result = await appendBatch("player-1", "session-1", "idem-1", batch);
    expect(result).toMatchObject({
      ok: false,
      code: "BATCH_INCONSISTENT_ORDERING",
    });
  });

  it("returns VALIDATION_FAILED for an unknown stageTypeKey", async () => {
    const batch = sampleBatch();
    batch.stages[0].stageTypeKey = "NOT_A_STAGE_TYPE";
    const result = await appendBatch("player-1", "session-1", "idem-1", batch);
    expect(result).toMatchObject({ ok: false, code: "VALIDATION_FAILED" });
  });

  it("rejects a batch the ruleset validator rejects (dart rows present)", async () => {
    const result = await appendBatch(
      "player-1",
      "session-1",
      "idem-1",
      sampleBatch({
        darts: [
          {
            sequence: 1,
            intendedTargetNumber: null,
            intendedZoneKey: null,
            hitTargetNumber: 20,
            hitZoneKey: "SINGLE",
            score: 20,
            locationX: null,
            locationY: null,
          },
        ],
      }),
    );
    expect(result).toMatchObject({ ok: false, code: "VALIDATION_FAILED" });
  });

  it("accepts dart rows for a visual-board session", async () => {
    vi.mocked(repo.findSessionRow).mockResolvedValue({
      id: "session-1",
      playerId: "player-1",
      statusId: 1,
      rulesetVersionKey: "SCORE_TRAINING_V1",
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    vi.mocked(repo.findDartZoneIdMap).mockResolvedValue(
      new Map([["TREBLE", 9]]),
    );
    const result = await appendBatch("player-1", "session-1", "idem-1", {
      stages: [
        {
          clientKey: "s1",
          stageTypeKey: "EXERCISE_BLOCK",
          parentClientKey: null,
          sequence: 1,
          turns: [
            {
              clientKey: "t1",
              participantRef: "participant-1",
              sequence: 1,
              totalScore: 60,
              completedAt: null,
              darts: [
                {
                  sequence: 1,
                  intendedTargetNumber: null,
                  intendedZoneKey: null,
                  hitTargetNumber: 20,
                  hitZoneKey: "TREBLE",
                  score: 60,
                  locationX: 0,
                  locationY: -102,
                },
              ],
            },
          ],
        },
      ],
    });
    expect(result).toMatchObject({ ok: true });
    expect(vi.mocked(repo.insertBatchRecords)).toHaveBeenCalledWith(
      expect.objectContaining({
        turns: [
          expect.objectContaining({
            darts: [
              expect.objectContaining({
                locationX: 0,
                locationY: -102,
              }),
            ],
          }),
        ],
      }),
    );
  });

  it("returns the stored result on idempotent retry with the same payload", async () => {
    const batch = sampleBatch();
    const hash = await hashBatchPayload(batch);
    vi.mocked(repo.findIdempotencyRecord).mockResolvedValue({
      normalizedPayloadHash: hash,
      result: { created: { stages: 1, turns: 1, darts: 0 } },
    });
    const result = await appendBatch("player-1", "session-1", "idem-1", batch);
    expect(result).toEqual({
      ok: true,
      data: { created: { stages: 1, turns: 1, darts: 0 } },
    });
    expect(repo.insertBatchRecords).not.toHaveBeenCalled();
  });

  it("rejects idempotency key reuse with a different payload", async () => {
    vi.mocked(repo.findIdempotencyRecord).mockResolvedValue({
      normalizedPayloadHash: "different-hash",
      result: {},
    });
    const result = await appendBatch(
      "player-1",
      "session-1",
      "idem-1",
      sampleBatch(),
    );
    expect(result).toMatchObject({
      ok: false,
      code: "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD",
    });
  });
});

describe("updateSessionStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(repo.findSessionRow).mockResolvedValue({
      id: "session-1",
      playerId: "player-1",
      statusId: 1,
      rulesetVersionKey: "SCORE_TRAINING_V1",
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    vi.mocked(repo.findGameStatusId).mockImplementation(
      async (_db, key) => ({ ACTIVE: 1, COMPLETED: 2, ABANDONED: 3 })[key],
    );
    vi.mocked(repo.updateSessionStatusRecord).mockResolvedValue(undefined);
  });

  it("completes an active session", async () => {
    const result = await updateSessionStatus("player-1", "session-1", {
      status: "COMPLETED",
    });
    expect(result.ok).toBe(true);
    expect(repo.updateSessionStatusRecord).toHaveBeenCalledWith(
      expect.anything(),
      "session-1",
      2,
      expect.any(String),
    );
  });

  it("returns NOT_FOUND for an unknown session", async () => {
    vi.mocked(repo.findSessionRow).mockResolvedValue(undefined);
    const result = await updateSessionStatus("player-1", "missing", {
      status: "COMPLETED",
    });
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("returns SESSION_OWNERSHIP_MISMATCH for a different player", async () => {
    const result = await updateSessionStatus("someone-else", "session-1", {
      status: "COMPLETED",
    });
    expect(result).toMatchObject({
      ok: false,
      code: "SESSION_OWNERSHIP_MISMATCH",
    });
  });

  it("returns INVALID_STATUS_TRANSITION for an unsupported target", async () => {
    const result = await updateSessionStatus("player-1", "session-1", {
      status: "ACTIVE",
    });
    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_STATUS_TRANSITION",
    });
  });

  it("returns SESSION_ALREADY_COMPLETED for a non-active session", async () => {
    vi.mocked(repo.findSessionRow).mockResolvedValue({
      id: "session-1",
      playerId: "player-1",
      statusId: 2,
      rulesetVersionKey: "SCORE_TRAINING_V1",
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    const result = await updateSessionStatus("player-1", "session-1", {
      status: "COMPLETED",
    });
    expect(result).toMatchObject({
      ok: false,
      code: "SESSION_ALREADY_COMPLETED",
    });
  });
});

describe("listActiveSessions / listConfigurationPresets", () => {
  it("returns rows from the repository as-is", async () => {
    vi.mocked(repo.findActiveSessions).mockResolvedValue([
      { sessionId: "s1", playerId: "p1" } as never,
    ]);
    const rows = await listActiveSessions("p1");
    expect(rows).toHaveLength(1);
  });

  it("returns preset rows from the repository as-is", async () => {
    vi.mocked(repo.findConfigurationPresets).mockResolvedValue([
      { configurationTemplateId: "c1" } as never,
    ]);
    const rows = await listConfigurationPresets("p1", "SCORE_TRAINING");
    expect(rows).toHaveLength(1);
  });
});
