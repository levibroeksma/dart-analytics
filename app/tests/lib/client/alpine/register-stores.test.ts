import { describe, it, expect, vi } from "vitest";
import type { Alpine } from "alpinejs";
import type { Persist } from "@alpinejs/persist";
import { registerStores } from "@lib/client/alpine/register-stores";

function fakeAlpine(): { alpine: Alpine; stores: Record<string, unknown> } {
  const stores: Record<string, unknown> = {};
  const persist = ((initial: unknown) => ({ as: () => initial })) as Persist;
  const alpine = {
    store: vi.fn((name: string, value: unknown) => {
      stores[name] = value;
    }),
    $persist: persist,
  } as unknown as Alpine;

  return { alpine, stores };
}

describe("registerStores", () => {
  it("registers every store, including checkoutHints defaulted to enabled", () => {
    const { alpine, stores } = fakeAlpine();

    registerStores(alpine);

    expect(Object.keys(stores)).toEqual([
      "auth",
      "settings",
      "profile",
      "game",
      "boardInput",
      "checkoutHints",
    ]);
    expect(stores.checkoutHints).toEqual({ enabled: true });
  });
});
