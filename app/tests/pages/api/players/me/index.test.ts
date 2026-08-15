import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@services/player.service", () => ({
  readProfile: vi.fn(),
  writeProfile: vi.fn(),
}));

import { readProfile, writeProfile } from "@services/player.service";
import { GET, PATCH } from "@routes/players/me/index";

const locals = {
  requestId: "req-1",
  auth: { authUserId: "auth-1", playerId: "player-1" },
};

function patchRequest(body: unknown): Request {
  return new Request("https://example.test/api/players/me", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("GET /api/players/me", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the caller's profile", async () => {
    vi.mocked(readProfile).mockResolvedValue({
      displayName: "The Power",
      dartsDescription: "Winmau Pro-Series 23g",
      dartsWeightGrams: 23,
    });

    const response = await GET({ locals } as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual({
      displayName: "The Power",
      dartsDescription: "Winmau Pro-Series 23g",
      dartsWeightGrams: 23,
    });
    expect(readProfile).toHaveBeenCalledWith("player-1");
  });
});

describe("PATCH /api/players/me", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores the requested profile", async () => {
    const next = {
      displayName: "Levi",
      dartsDescription: null,
      dartsWeightGrams: null,
    };
    vi.mocked(writeProfile).mockResolvedValue({ ok: true, data: next });

    const response = await PATCH({
      locals,
      request: patchRequest(next),
    } as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual(next);
    expect(writeProfile).toHaveBeenCalledWith("player-1", next);
  });

  it("rejects a blank display name without calling the service", async () => {
    const response = await PATCH({
      locals,
      request: patchRequest({
        displayName: "",
        dartsDescription: null,
        dartsWeightGrams: null,
      }),
    } as never);

    expect(response.status).toBe(422);
    expect(writeProfile).not.toHaveBeenCalled();
  });

  it("rejects a weight outside 1-100 without calling the service", async () => {
    const response = await PATCH({
      locals,
      request: patchRequest({
        displayName: "Levi",
        dartsDescription: null,
        dartsWeightGrams: 500,
      }),
    } as never);

    expect(response.status).toBe(422);
    expect(writeProfile).not.toHaveBeenCalled();
  });
});
