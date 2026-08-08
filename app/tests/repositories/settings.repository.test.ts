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

describe("findSettings", () => {
  it("reads from v_player_settings and returns the row when present", async () => {
    const row = {
      defaultCaptureModeKey: "ANALYTICS",
      defaultInputModeKey: "VISUAL_BOARD",
    };
    const { chain, fromCalls } = fakeSelect([row]);
    const db = { select: vi.fn(() => chain) } as any;
    const { vPlayerSettings } = await import("@db/schema");
    const { findSettings } = await import("@repositories/settings.repository");

    const result = await findSettings(db, "p1");

    expect(result).toEqual(row);
    expect(fromCalls).toEqual([vPlayerSettings]);
  });

  it("returns null when no row exists", async () => {
    const { chain, fromCalls } = fakeSelect([]);
    const db = { select: vi.fn(() => chain) } as any;
    const { vPlayerSettings } = await import("@db/schema");
    const { findSettings } = await import("@repositories/settings.repository");

    const result = await findSettings(db, "p1");

    expect(result).toBeNull();
    expect(fromCalls).toEqual([vPlayerSettings]);
  });
});

vi.mock("@db/client", () => ({
  withTransaction: vi.fn(async (_fn: (tx: unknown) => unknown) => {
    throw new Error(
      "withTransaction must be mocked per test via mockImplementationOnce",
    );
  }),
}));

interface TxState {
  insertTable: unknown;
  insertValues: unknown;
  conflictArg: unknown;
}

function makeTx(captureRows: { id: number }[], inputRows: { id: number }[]) {
  const state: TxState = {
    insertTable: undefined,
    insertValues: undefined,
    conflictArg: undefined,
  };
  const tx = {
    select: (_cols: unknown) => ({
      from: (table: unknown) => ({
        where: (_cond: unknown) => ({
          limit: async (_n: number) => {
            const { captureModes, inputModes } = await import("@db/schema");
            if (table === captureModes) return captureRows;
            if (table === inputModes) return inputRows;
            return [];
          },
        }),
      }),
    }),
    insert: (table: unknown) => {
      state.insertTable = table;
      return {
        values: (values: unknown) => {
          state.insertValues = values;
          return {
            onConflictDoUpdate: (conflict: unknown) => {
              state.conflictArg = conflict;
              return Promise.resolve();
            },
          };
        },
      };
    },
  };
  return { tx, state };
}

describe("upsertSettings", () => {
  it("resolves both mode keys to ids and writes the expected values", async () => {
    const { withTransaction } = await import("@db/client");
    const { playerSettings } = await import("@db/schema");
    const { tx, state } = makeTx([{ id: 2 }], [{ id: 7 }]);
    vi.mocked(withTransaction).mockImplementationOnce((async (
      fn: (tx: unknown) => unknown,
    ) => fn(tx)) as any);

    const { upsertSettings } =
      await import("@repositories/settings.repository");
    await upsertSettings("player-1", {
      defaultCaptureModeKey: "ANALYTICS",
      defaultInputModeKey: "VISUAL_BOARD",
    });

    expect(state.insertTable).toBe(playerSettings);
    expect(state.insertValues).toMatchObject({
      playerId: "player-1",
      defaultCaptureModeId: 2,
      defaultInputModeId: 7,
    });
    expect((state.insertValues as { createdAt: string }).createdAt).toEqual(
      (state.insertValues as { updatedAt: string }).updatedAt,
    );
  });

  it("updates an existing row on conflict instead of failing, keyed on player_id", async () => {
    const { withTransaction } = await import("@db/client");
    const { playerSettings } = await import("@db/schema");
    const { tx, state } = makeTx([{ id: 3 }], [{ id: 9 }]);
    vi.mocked(withTransaction).mockImplementationOnce((async (
      fn: (tx: unknown) => unknown,
    ) => fn(tx)) as any);

    const { upsertSettings } =
      await import("@repositories/settings.repository");
    await upsertSettings("player-2", {
      defaultCaptureModeKey: "RECREATIONAL",
      defaultInputModeKey: "QUICK_SCORE",
    });

    expect(state.conflictArg).toMatchObject({
      target: playerSettings.playerId,
      set: {
        defaultCaptureModeId: 3,
        defaultInputModeId: 9,
      },
    });
  });

  it("throws when the capture mode key is not found", async () => {
    const { withTransaction } = await import("@db/client");
    const { tx } = makeTx([], [{ id: 9 }]);
    vi.mocked(withTransaction).mockImplementationOnce((async (
      fn: (tx: unknown) => unknown,
    ) => fn(tx)) as any);

    const { upsertSettings } =
      await import("@repositories/settings.repository");

    await expect(
      upsertSettings("player-3", {
        defaultCaptureModeKey: "UNKNOWN_CAPTURE",
        defaultInputModeKey: "QUICK_SCORE",
      }),
    ).rejects.toThrow(/unknown captureModeKey UNKNOWN_CAPTURE/);
  });

  it("throws when the input mode key is not found", async () => {
    const { withTransaction } = await import("@db/client");
    const { tx } = makeTx([{ id: 2 }], []);
    vi.mocked(withTransaction).mockImplementationOnce((async (
      fn: (tx: unknown) => unknown,
    ) => fn(tx)) as any);

    const { upsertSettings } =
      await import("@repositories/settings.repository");

    await expect(
      upsertSettings("player-4", {
        defaultCaptureModeKey: "RECREATIONAL",
        defaultInputModeKey: "UNKNOWN_INPUT",
      }),
    ).rejects.toThrow(/unknown inputModeKey UNKNOWN_INPUT/);
  });
});
