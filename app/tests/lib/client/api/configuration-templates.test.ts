import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@client/api/client", () => ({ apiRequest: vi.fn() }));

import { apiRequest } from "@client/api/client";
import { fetchConfigurationPresets } from "@client/api/configuration-templates";

describe("fetchConfigurationPresets", () => {
  beforeEach(() => vi.resetAllMocks());

  it("requests presets for the given game type", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: [],
    });
    await fetchConfigurationPresets("SCORE_TRAINING");
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/configuration-templates?gameType=SCORE_TRAINING",
      undefined,
    );
  });

  it("throws a SessionApiError that keeps requestId and details", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      requestId: "r2",
      error: { code: "VALIDATION_ERROR", message: "bad", details: [{ a: 1 }] },
    } as never);

    await expect(fetchConfigurationPresets("X")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "bad",
      requestId: "r2",
      details: [{ a: 1 }],
    });
  });
});
