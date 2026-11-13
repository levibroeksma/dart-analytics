import { describe, it, expect } from "vitest";
import type { Persist } from "@alpinejs/persist";
import { statsVariationStore } from "@stores/stats-variation.store";

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

describe("statsVariationStore", () => {
  it("statsVariation defaults to 501 and persists a set value", () => {
    const store = statsVariationStore(stubPersistFactory());
    expect(store.value).toBe(501);
    store.set(301);
    expect(store.value).toBe(301);
  });

  it("rehydrates the remembered variation", () => {
    const store = statsVariationStore(
      rehydratingPersistFactory({ "statsVariation.value": 701 }),
    );
    expect(store.value).toBe(701);
  });
});
