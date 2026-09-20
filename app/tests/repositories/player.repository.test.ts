import { describe, it, expect, vi } from "vitest";
import { renderingDb, onlyStatement } from "./render-sql";

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

  it("returns the driver's own row object, not a copy of it", async () => {
    const row = {
      displayName: "The Power",
      dartsDescription: null,
      dartsWeightGrams: null,
    };
    const { chain } = fakeSelect([row]);
    const db = { select: vi.fn(() => chain) } as any;
    const { findPlayerProfile } =
      await import("@repositories/player.repository");

    expect(await findPlayerProfile(db, "p1")).toBe(row);
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

/**
 * Rendered-statement coverage for the two write paths — the mocked builders
 * above never render SQL, so a malformed statement passes them (issue #397).
 *
 * Column order follows `players`' declaration order in `schema.ts`, which is
 * the live table's column order: `darts_description`/`darts_weight_grams`
 * were added after `created_at`/`updated_at` and sort last.
 */
describe("player.repository rendered SQL", () => {
  it("renders the provisioning upsert with its xmax created-flag", async () => {
    const { db, statements } = renderingDb([["p1", "u1", "0"]]);
    const { upsertPlayerByAuthUserId } =
      await import("@repositories/player.repository");
    await upsertPlayerByAuthUserId(db, "u1", "p1", "Levi");
    expect(onlyStatement(statements)).toBe(
      'insert into "players" ("id", "auth_user_id", "display_name", "created_at", "updated_at", "darts_description", "darts_weight_grams") values ($1, $2, $3, $4, $5, default, default) on conflict ("auth_user_id") do update set "updated_at" = $6 returning "id", "auth_user_id", xmax::text',
    );
  });

  it("renders the profile update scoped to one player", async () => {
    const { db, statements } = renderingDb([["Levi", "Target 24g", 24]]);
    const { updatePlayerProfile } =
      await import("@repositories/player.repository");
    await updatePlayerProfile(db, "p1", {
      displayName: "Levi",
      dartsDescription: "Target 24g",
      dartsWeightGrams: 24,
    } as never);
    expect(onlyStatement(statements)).toBe(
      'update "players" set "display_name" = $1, "updated_at" = $2, "darts_description" = $3, "darts_weight_grams" = $4 where "players"."id" = $5 returning "display_name", "darts_description", "darts_weight_grams"',
    );
  });
});
