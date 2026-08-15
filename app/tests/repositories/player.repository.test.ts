import { describe, it, expect, vi } from "vitest";

function fakeSelect(rows: unknown[]) {
  const fromCalls: unknown[] = [];
  const chain = {
    from: vi.fn((table: unknown) => {
      fromCalls.push(table);
      return chain;
    }),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  return { chain, fromCalls };
}

describe("findPlayerProfile", () => {
  it("reads from v_player_profile and returns the row", async () => {
    const row = {
      displayName: "The Power",
      dartsDescription: "Winmau Pro-Series 23g",
      dartsWeightGrams: 23,
    };
    const { chain, fromCalls } = fakeSelect([row]);
    const db = { select: vi.fn(() => chain) } as any;
    const { vPlayerProfile } = await import("@db/schema");
    const { findPlayerProfile } =
      await import("@repositories/player.repository");

    const result = await findPlayerProfile(db, "p1");

    expect(result).toEqual(row);
    expect(fromCalls).toEqual([vPlayerProfile]);
  });

  it("throws when no row is found", async () => {
    const { chain } = fakeSelect([]);
    const db = { select: vi.fn(() => chain) } as any;
    const { findPlayerProfile } =
      await import("@repositories/player.repository");

    await expect(findPlayerProfile(db, "missing")).rejects.toThrow(
      /no v_player_profile row for player missing/,
    );
  });
});

function fakeUpdate(row: unknown) {
  const state: { table: unknown; values: unknown } = {
    table: undefined,
    values: undefined,
  };
  const chain = {
    set: vi.fn((values: unknown) => {
      state.values = values;
      return chain;
    }),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([row]),
  };
  const db = {
    update: vi.fn((table: unknown) => {
      state.table = table;
      return chain;
    }),
  };
  return { db, state };
}

describe("updatePlayerProfile", () => {
  it("writes the given profile fields and returns the stored row", async () => {
    const stored = {
      displayName: "Levi",
      dartsDescription: "Target Agora 23g",
      dartsWeightGrams: 23,
    };
    const { db, state } = fakeUpdate(stored);
    const { players } = await import("@db/schema");
    const { updatePlayerProfile } =
      await import("@repositories/player.repository");

    const result = await updatePlayerProfile(db as any, "player-1", {
      displayName: "Levi",
      dartsDescription: "Target Agora 23g",
      dartsWeightGrams: 23,
    });

    expect(result).toEqual(stored);
    expect(db.update).toHaveBeenCalledWith(players);
    expect(state.values).toMatchObject({
      displayName: "Levi",
      dartsDescription: "Target Agora 23g",
      dartsWeightGrams: 23,
    });
  });

  it("stores null darts fields to clear them", async () => {
    const stored = {
      displayName: "Levi",
      dartsDescription: null,
      dartsWeightGrams: null,
    };
    const { db, state } = fakeUpdate(stored);
    const { updatePlayerProfile } =
      await import("@repositories/player.repository");

    const result = await updatePlayerProfile(db as any, "player-1", {
      displayName: "Levi",
      dartsDescription: null,
      dartsWeightGrams: null,
    });

    expect(result).toEqual(stored);
    expect(state.values).toMatchObject({
      dartsDescription: null,
      dartsWeightGrams: null,
    });
  });
});
