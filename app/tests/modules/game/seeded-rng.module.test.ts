import { describe, expect, it, vi } from "vitest";
import { seededUniform } from "@modules/game/seeded-rng.module";

describe("seededUniform", () => {
  it("matches the pinned stream for seed 42, index 3", () => {
    const next = seededUniform(42, 3);
    expect([next(), next(), next()]).toEqual([
      0.19645014265552163, 0.3891592698637396, 0.07527352776378393,
    ]);
  });

  it("repeats for the same seed and index", () => {
    const a = seededUniform(9, 4);
    const b = seededUniform(9, 4);
    expect([a(), a()]).toEqual([b(), b()]);
  });

  it("differs for a different index", () => {
    expect(seededUniform(42, 0)()).not.toBe(seededUniform(42, 1)());
  });

  it("stays inside [0, 1)", () => {
    const next = seededUniform(0xffffffff, 7);
    for (let i = 0; i < 100; i++) {
      const value = next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("never calls Math.random", () => {
    const spy = vi.spyOn(Math, "random");
    seededUniform(1, 0)();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
