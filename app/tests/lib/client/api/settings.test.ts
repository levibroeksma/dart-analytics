import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@client/api/client", () => ({ apiRequest: vi.fn() }));

import { apiRequest } from "@client/api/client";
import {
  fetchSettings,
  saveSettings,
  SettingsApiError,
} from "@client/api/settings";

describe("fetchSettings", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns the parsed settings on success", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: {
        defaultCaptureModeKey: "RECREATIONAL",
        defaultInputModeKey: "QUICK_SCORE",
      },
    });
    const result = await fetchSettings();
    expect(result.defaultCaptureModeKey).toBe("RECREATIONAL");
    expect(apiRequest).toHaveBeenCalledWith("/api/players/me/settings");
  });

  it("throws SettingsApiError on failure", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      requestId: "r1",
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        retryable: false,
      },
    });
    await expect(fetchSettings()).rejects.toBeInstanceOf(SettingsApiError);
  });
});

describe("saveSettings", () => {
  beforeEach(() => vi.resetAllMocks());

  it("PATCHes the new pair and returns the stored result", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: {
        defaultCaptureModeKey: "ANALYTICS",
        defaultInputModeKey: "VISUAL_BOARD",
      },
    });
    const result = await saveSettings({
      defaultCaptureModeKey: "ANALYTICS",
      defaultInputModeKey: "VISUAL_BOARD",
    });
    expect(result.defaultInputModeKey).toBe("VISUAL_BOARD");
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/players/me/settings",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          defaultCaptureModeKey: "ANALYTICS",
          defaultInputModeKey: "VISUAL_BOARD",
        }),
      }),
    );
  });

  it("throws SettingsApiError with the VALIDATION_FAILED code on an unsupported pair", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      requestId: "r1",
      error: {
        code: "VALIDATION_FAILED",
        message: "no ruleset supports that pair",
        retryable: false,
      },
    });
    await expect(
      saveSettings({
        defaultCaptureModeKey: "ANALYTICS",
        defaultInputModeKey: "QUICK_SCORE",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
});
