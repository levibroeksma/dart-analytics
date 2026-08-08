import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@services/settings.service", () => ({
  readSettings: vi.fn(),
  writeSettings: vi.fn(),
}));

import { readSettings, writeSettings } from "@services/settings.service";
import { GET, PATCH } from "@routes/players/me/settings";

const locals = {
  requestId: "req-1",
  auth: { authUserId: "auth-1", playerId: "player-1" },
};

function patchRequest(body: unknown): Request {
  return new Request("https://example.test/api/players/me/settings", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("GET /api/players/me/settings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the caller's settings", async () => {
    vi.mocked(readSettings).mockResolvedValue({
      defaultCaptureModeKey: "ANALYTICS",
      defaultInputModeKey: "VISUAL_BOARD",
    });

    const response = await GET({ locals } as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual({
      defaultCaptureModeKey: "ANALYTICS",
      defaultInputModeKey: "VISUAL_BOARD",
    });
    expect(readSettings).toHaveBeenCalledWith("player-1");
  });
});

describe("PATCH /api/players/me/settings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores the requested modes", async () => {
    const next = {
      defaultCaptureModeKey: "ANALYTICS",
      defaultInputModeKey: "VISUAL_BOARD",
    };
    vi.mocked(writeSettings).mockResolvedValue({ ok: true, data: next });

    const response = await PATCH({
      locals,
      request: patchRequest(next),
    } as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual(next);
    expect(writeSettings).toHaveBeenCalledWith("player-1", next);
  });

  it("maps a service refusal onto the error envelope", async () => {
    vi.mocked(writeSettings).mockResolvedValue({
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "no ruleset supports it" },
    });

    const response = await PATCH({
      locals,
      request: patchRequest({
        defaultCaptureModeKey: "ANALYTICS",
        defaultInputModeKey: "QUICK_SCORE",
      }),
    } as never);

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_FAILED");
  });

  it("rejects a body missing a mode key without calling the service", async () => {
    const response = await PATCH({
      locals,
      request: patchRequest({ defaultCaptureModeKey: "ANALYTICS" }),
    } as never);

    expect(response.status).toBe(422);
    expect(writeSettings).not.toHaveBeenCalled();
  });
});
