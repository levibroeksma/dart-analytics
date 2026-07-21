import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@services/session.service", () => ({ updateSessionStatus: vi.fn() }));

import { updateSessionStatus } from "@services/session.service";
import { PATCH } from "@routes/sessions/[sessionId]/index";

function makeContext(body: unknown) {
  return {
    locals: {
      requestId: "req-1",
      auth: { authUserId: "auth-1", playerId: "player-1" },
    },
    params: { sessionId: "session-1" },
    request: new Request("http://localhost/api/sessions/session-1", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  } as never;
}

describe("PATCH /api/sessions/:sessionId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the updated session on success", async () => {
    vi.mocked(updateSessionStatus).mockResolvedValue({
      ok: true,
      data: {
        sessionId: "session-1",
        statusKey: "COMPLETED",
        completedAt: "2026-07-16T00:00:00.000Z",
      },
    });
    const response = await PATCH(makeContext({ status: "COMPLETED" }));
    expect(response.status).toBe(200);
  });

  it("maps INVALID_STATUS_TRANSITION to 409", async () => {
    vi.mocked(updateSessionStatus).mockResolvedValue({
      ok: false,
      code: "INVALID_STATUS_TRANSITION",
    });
    const response = await PATCH(makeContext({ status: "ACTIVE" }));
    expect(response.status).toBe(409);
  });
});
