import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@db/client", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@repositories/settings.repository", () => ({
  findSettings: vi.fn(),
  upsertSettings: vi.fn(),
}));

import * as repo from "@repositories/settings.repository";
import { readSettings, writeSettings } from "@services/settings.service";

const playerId = "0198f200-0000-7000-8000-000000000001";

describe("readSettings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the stored preference", async () => {
    vi.mocked(repo.findSettings).mockResolvedValue({
      defaultCaptureModeKey: "ANALYTICS",
      defaultInputModeKey: "VISUAL_BOARD",
    });

    await expect(readSettings(playerId)).resolves.toEqual({
      defaultCaptureModeKey: "ANALYTICS",
      defaultInputModeKey: "VISUAL_BOARD",
    });
  });

  it("falls back to quick score when no row exists", async () => {
    vi.mocked(repo.findSettings).mockResolvedValue(null);

    await expect(readSettings(playerId)).resolves.toEqual({
      defaultCaptureModeKey: "RECREATIONAL",
      defaultInputModeKey: "QUICK_SCORE",
    });
  });

  it("falls back when the row exists with null columns", async () => {
    vi.mocked(repo.findSettings).mockResolvedValue({
      defaultCaptureModeKey: null,
      defaultInputModeKey: null,
    });

    await expect(readSettings(playerId)).resolves.toEqual({
      defaultCaptureModeKey: "RECREATIONAL",
      defaultInputModeKey: "QUICK_SCORE",
    });
  });
});

describe("writeSettings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores a pair some ruleset supports", async () => {
    vi.mocked(repo.upsertSettings).mockResolvedValue(undefined);

    const result = await writeSettings(playerId, {
      defaultCaptureModeKey: "ANALYTICS",
      defaultInputModeKey: "VISUAL_BOARD",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        defaultCaptureModeKey: "ANALYTICS",
        defaultInputModeKey: "VISUAL_BOARD",
      },
    });
    expect(repo.upsertSettings).toHaveBeenCalledOnce();
  });

  it("persists exactly the pair it was given", async () => {
    vi.mocked(repo.upsertSettings).mockResolvedValue(undefined);

    await writeSettings(playerId, {
      defaultCaptureModeKey: "RECREATIONAL",
      defaultInputModeKey: "DETAILED_DARTS",
    });

    expect(repo.upsertSettings).toHaveBeenCalledWith(playerId, {
      defaultCaptureModeKey: "RECREATIONAL",
      defaultInputModeKey: "DETAILED_DARTS",
    });
  });

  it("refuses a pair no ruleset supports", async () => {
    const result = await writeSettings(playerId, {
      defaultCaptureModeKey: "ANALYTICS",
      defaultInputModeKey: "QUICK_SCORE",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a rejected write");
    expect(result.code).toBe("VALIDATION_FAILED");
    expect(repo.upsertSettings).not.toHaveBeenCalled();
  });
});
