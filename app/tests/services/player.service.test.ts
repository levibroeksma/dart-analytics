import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@db/client", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@lib/id", () => ({ generateId: vi.fn(() => "generated-id") }));
vi.mock("@repositories/player.repository", () => ({
  upsertPlayerByAuthUserId: vi.fn(),
  findPlayerProfile: vi.fn(),
  updatePlayerProfile: vi.fn(),
}));

import * as repo from "@repositories/player.repository";
import { readProfile, writeProfile } from "@services/player.service";

const playerId = "0198f200-0000-7000-8000-000000000001";

describe("readProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the stored profile", async () => {
    vi.mocked(repo.findPlayerProfile).mockResolvedValue({
      displayName: "The Power",
      dartsDescription: "Winmau Pro-Series 23g",
      dartsWeightGrams: 23,
    });

    await expect(readProfile(playerId)).resolves.toEqual({
      displayName: "The Power",
      dartsDescription: "Winmau Pro-Series 23g",
      dartsWeightGrams: 23,
    });
  });
});

describe("writeProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores the given profile and returns it", async () => {
    const next = {
      displayName: "Levi",
      dartsDescription: null,
      dartsWeightGrams: null,
    };
    vi.mocked(repo.updatePlayerProfile).mockResolvedValue(next);

    const result = await writeProfile(playerId, next);

    expect(result).toEqual({ ok: true, data: next });
    expect(repo.updatePlayerProfile).toHaveBeenCalledWith({}, playerId, next);
  });
});
