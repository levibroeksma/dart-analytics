import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@client/api/client", () => ({ apiRequest: vi.fn() }));

import { apiRequest } from "@client/api/client";
import {
  fetchProfile,
  saveProfile,
  ProfileApiError,
} from "@client/api/profile";

describe("fetchProfile", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns the parsed profile on success", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: {
        displayName: "The Power",
        dartsDescription: "Winmau Pro-Series 23g",
        dartsWeightGrams: 23,
      },
    });
    const result = await fetchProfile();
    expect(result.displayName).toBe("The Power");
    expect(apiRequest).toHaveBeenCalledWith("/api/players/me");
  });

  it("throws ProfileApiError on failure", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      requestId: "r1",
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        retryable: false,
      },
    });
    await expect(fetchProfile()).rejects.toBeInstanceOf(ProfileApiError);
  });
});

describe("saveProfile", () => {
  beforeEach(() => vi.resetAllMocks());

  it("PATCHes the new profile and returns the stored result", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      requestId: "r1",
      data: {
        displayName: "Levi",
        dartsDescription: null,
        dartsWeightGrams: null,
      },
    });
    const result = await saveProfile({
      displayName: "Levi",
      dartsDescription: null,
      dartsWeightGrams: null,
    });
    expect(result.displayName).toBe("Levi");
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/players/me",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          displayName: "Levi",
          dartsDescription: null,
          dartsWeightGrams: null,
        }),
      }),
    );
  });

  it("throws ProfileApiError with the server's error code on a failed request", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      requestId: "r1",
      error: {
        code: "VALIDATION_FAILED",
        message: "invalid profile",
        retryable: false,
      },
    });
    await expect(
      saveProfile({
        displayName: "Levi",
        dartsDescription: null,
        dartsWeightGrams: 23,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
});
