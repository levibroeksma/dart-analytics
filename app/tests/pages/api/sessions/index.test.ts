import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@services/session.service", () => ({ createSession: vi.fn() }));

import { createSession } from "@services/session.service";
import { POST } from "@routes/sessions/index";

function makeContext(body: unknown) {
  return {
    locals: {
      requestId: "req-1",
      auth: { authUserId: "auth-1", playerId: "player-1" },
    },
    request: new Request("http://localhost/api/sessions", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  } as never;
}

describe("POST /api/sessions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 201 with the created session on success", async () => {
    vi.mocked(createSession).mockResolvedValue({
      ok: true,
      data: {
        sessionId: "s1",
        participants: [
          { ref: "p1", participantTypeKey: "PLAYER", displayName: "Levi" },
        ],
      },
    });
    const response = await POST(
      makeContext({
        gameTypeKey: "SCORE_TRAINING",
        rulesetVersionKey: "SCORE_TRAINING_V1",
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
        config: {
          source: "inline",
          config: {
            duration_type: "ROUNDS",
            duration_value: 10,
            max_darts_per_turn: 3,
          },
        },
      }),
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.sessionId).toBe("s1");
  });

  it("returns 422 for a malformed request body", async () => {
    const response = await POST(makeContext({ gameTypeKey: "SCORE_TRAINING" }));
    expect(response.status).toBe(422);
    expect(createSession).not.toHaveBeenCalled();
  });
});
