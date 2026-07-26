import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@services/session.service", () => ({ appendBatch: vi.fn() }));

import { appendBatch } from "@services/session.service";
import { POST } from "@routes/sessions/[sessionId]/events/batch";

function makeContext(
  body: unknown,
  headers: Record<string, string> = { "idempotency-key": "idem-1" },
) {
  return {
    locals: {
      requestId: "req-1",
      auth: { authUserId: "auth-1", playerId: "player-1" },
    },
    params: { sessionId: "session-1" },
    request: new Request(
      "http://localhost/api/sessions/session-1/events/batch",
      {
        method: "POST",
        body: JSON.stringify(body),
        headers,
      },
    ),
  } as never;
}

const validBatch = {
  stages: [
    {
      clientKey: "s1",
      stageTypeKey: "EXERCISE_BLOCK",
      parentClientKey: null,
      sequence: 1,
      turns: [
        {
          clientKey: "t1",
          participantRef: "p1",
          sequence: 1,
          totalScore: 45,
          completedAt: null,
          darts: [],
        },
      ],
    },
  ],
};

describe("POST /api/sessions/:sessionId/events/batch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the created counts on success", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      ok: true,
      data: { created: { stages: 1, turns: 1, darts: 0 } },
    });
    const response = await POST(makeContext(validBatch));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.created.turns).toBe(1);
  });

  it("returns 422 when the Idempotency-Key header is missing", async () => {
    const response = await POST(makeContext(validBatch, {}));
    expect(response.status).toBe(422);
    expect(appendBatch).not.toHaveBeenCalled();
  });

  it("maps SESSION_ALREADY_COMPLETED to 409", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      ok: false,
      code: "SESSION_ALREADY_COMPLETED",
    });
    const response = await POST(makeContext(validBatch));
    expect(response.status).toBe(409);
  });
});

type RawDart = {
  sequence: number;
  intendedTargetNumber: number | null;
  intendedZoneKey: string | null;
  hitTargetNumber: number | null;
  hitZoneKey: string;
  score: number;
};

type RawTurn = {
  clientKey: string;
  participantRef: string;
  sequence: number;
  totalScore: number;
  completedAt: string | null;
  darts: RawDart[];
};

type RawStage = {
  clientKey: string;
  stageTypeKey: string;
  parentClientKey: string | null;
  sequence: number;
  turns: RawTurn[];
};

type RawBatch = { stages: RawStage[] };

type DartOverrides = Partial<RawDart>;

function batchWithDart(overrides: DartOverrides): RawBatch {
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
            participantRef: "p1",
            sequence: 1,
            totalScore: 20,
            completedAt: null,
            darts: [
              {
                sequence: 1,
                intendedTargetNumber: null,
                intendedZoneKey: null,
                hitTargetNumber: 20,
                hitZoneKey: "SINGLE",
                score: 20,
                ...overrides,
              },
            ],
          },
        ],
      },
    ],
  };
}

async function rejectionIssues(body: unknown) {
  const response = await POST(makeContext(body));
  const payload = await response.json();
  return { response, payload };
}

/**
 * Every column CHECK the batch write path can violate is enforced by the
 * request schema, so a value the database would reject is answered with
 * `VALIDATION_FAILED` and never reaches `appendBatch`'s transaction.
 */
describe("POST /api/sessions/:sessionId/events/batch — database CHECK bounds", () => {
  beforeEach(() => vi.clearAllMocks());

  const dartCases: Array<[string, DartOverrides, string]> = [
    [
      "hitTargetNumber above 25 (chk_hit_target)",
      { hitTargetNumber: 60 },
      "hitTargetNumber",
    ],
    [
      "hitTargetNumber below 1 (chk_hit_target)",
      { hitTargetNumber: 0 },
      "hitTargetNumber",
    ],
    [
      "intendedTargetNumber above 25 (chk_intended_target)",
      { intendedTargetNumber: 26, intendedZoneKey: "DOUBLE" },
      "intendedTargetNumber",
    ],
    [
      "intendedTargetNumber below 1 (chk_intended_target)",
      { intendedTargetNumber: 0, intendedZoneKey: "DOUBLE" },
      "intendedTargetNumber",
    ],
    ["dart sequence 0 (chk_dart_number_positive)", { sequence: 0 }, "sequence"],
    [
      "dart sequence negative (chk_dart_number_positive)",
      { sequence: -1 },
      "sequence",
    ],
    ["negative dart score (chk_dart_score_positive)", { score: -1 }, "score"],
    [
      "target number without a zone (chk_dart_target_consistency)",
      { intendedTargetNumber: 5, intendedZoneKey: null },
      "intendedZoneKey",
    ],
  ];

  it.each(dartCases)(
    "rejects %s before the service is called",
    async (_label, overrides, field) => {
      const { response, payload } = await rejectionIssues(
        batchWithDart(overrides),
      );

      expect(response.status).toBe(422);
      expect(payload.error.code).toBe("VALIDATION_FAILED");
      expect(appendBatch).not.toHaveBeenCalled();
      expect(payload.error.details.issues).toContainEqual(
        expect.objectContaining({
          path: ["stages", 0, "turns", 0, "darts", 0, field],
        }),
      );
    },
  );

  it("accepts BULL (25) and a null target number", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      ok: true,
      data: { created: { stages: 1, turns: 1, darts: 1 } },
    });
    const response = await POST(
      makeContext(
        batchWithDart({
          hitTargetNumber: 25,
          hitZoneKey: "INNER_BULL",
          score: 50,
        }),
      ),
    );
    expect(response.status).toBe(200);
    expect(appendBatch).toHaveBeenCalledTimes(1);
  });

  it("rejects a non-positive turn sequence (chk_turn_sequence_positive)", async () => {
    const body = batchWithDart({});
    body.stages[0].turns[0].sequence = 0;

    const { response, payload } = await rejectionIssues(body);

    expect(response.status).toBe(422);
    expect(payload.error.code).toBe("VALIDATION_FAILED");
    expect(appendBatch).not.toHaveBeenCalled();
    expect(payload.error.details.issues).toContainEqual(
      expect.objectContaining({ path: ["stages", 0, "turns", 0, "sequence"] }),
    );
  });

  it("rejects a non-positive stage sequence (chk_stage_sequence_positive)", async () => {
    const body = batchWithDart({});
    body.stages[0].sequence = 0;

    const { response, payload } = await rejectionIssues(body);

    expect(response.status).toBe(422);
    expect(payload.error.code).toBe("VALIDATION_FAILED");
    expect(appendBatch).not.toHaveBeenCalled();
    expect(payload.error.details.issues).toContainEqual(
      expect.objectContaining({ path: ["stages", 0, "sequence"] }),
    );
  });

  it("rejects a stage that parents itself (chk_stage_not_self_parent)", async () => {
    const body = batchWithDart({});
    body.stages[0].parentClientKey = "s1";

    const { response, payload } = await rejectionIssues(body);

    expect(response.status).toBe(422);
    expect(payload.error.code).toBe("VALIDATION_FAILED");
    expect(appendBatch).not.toHaveBeenCalled();
    expect(payload.error.details.issues).toContainEqual(
      expect.objectContaining({ path: ["stages", 0, "parentClientKey"] }),
    );
  });
});
