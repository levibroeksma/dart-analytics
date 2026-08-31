import { describe, it, expect } from "vitest";
import type { Persist } from "@alpinejs/persist";
import { checkoutHintsStore } from "@stores/checkout-hints.store";

function stubPersistFactory(): () => Persist {
  return () => ((initial: unknown) => ({ as: () => initial })) as Persist;
}

function rehydratingPersistFactory(
  stored: Record<string, unknown>,
): () => Persist {
  return () =>
    ((initial: unknown) => ({
      as: (alias: string) => (alias in stored ? stored[alias] : initial),
    })) as Persist;
}

describe("checkoutHintsStore", () => {
  it("defaults to enabled with no persisted value", () => {
    const store = checkoutHintsStore(stubPersistFactory());

    expect(store.enabled).toBe(true);
  });

  it("rehydrates a persisted false value", () => {
    const store = checkoutHintsStore(
      rehydratingPersistFactory({ "checkoutHints.enabled": false }),
    );

    expect(store.enabled).toBe(false);
  });
});
