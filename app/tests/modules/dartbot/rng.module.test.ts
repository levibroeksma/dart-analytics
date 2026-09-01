import { describe, expect, it, vi } from "vitest";
import { createDartRng } from "@modules/dartbot/rng.module";

describe("createDartRng", () => {
  it("produces a byte-identical stream for the same seed and dart index", () => {
    const a = createDartRng(42, 3);
    const b = createDartRng(42, 3);
    const drawsA = [a.uniform(), a.uniform(), ...a.gaussianPair()];
    const drawsB = [b.uniform(), b.uniform(), ...b.gaussianPair()];
    expect(drawsA).toEqual(drawsB);
  });

  it("produces a different stream for a different dart index with the same seed", () => {
    const first = createDartRng(42, 0);
    const second = createDartRng(42, 1);
    expect(first.uniform()).not.toBe(second.uniform());
  });

  it("keeps uniform() draws inside [0, 1)", () => {
    const rng = createDartRng(7, 0);
    for (let i = 0; i < 50; i++) {
      const value = rng.uniform();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("never calls Math.random", () => {
    const spy = vi.spyOn(Math, "random");
    const rng = createDartRng(1, 0);
    rng.uniform();
    rng.gaussianPair();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
