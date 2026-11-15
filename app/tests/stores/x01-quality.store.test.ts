import { describe, expect, it } from "vitest";
import { x01QualityStore } from "@stores/x01-quality.store";

describe("x01QualityStore", () => {
  it("starts at zero", () => {
    expect(x01QualityStore().skipped).toBe(0);
  });

  it("reports the maximum across sections, not the sum", () => {
    const store = x01QualityStore();
    store.report("aim-drift", 3);
    store.report("large-target-accuracy", 5);
    expect(store.skipped).toBe(5);
  });

  it("a later report for the same section replaces its earlier one", () => {
    const store = x01QualityStore();
    store.report("aim-drift", 5);
    store.report("aim-drift", 0);
    expect(store.skipped).toBe(0);
  });

  it("clear resets", () => {
    const store = x01QualityStore();
    store.report("aim-drift", 5);
    store.clear();
    expect(store.skipped).toBe(0);
  });
});
