import { describe, expect, it, vi } from "vitest";
import { generateBotSeed } from "@lib/id";

describe("generateBotSeed", () => {
  it("returns an integer seed in the Uint32 range", () => {
    const seed = generateBotSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0xffffffff);
  });

  it("draws from crypto.getRandomValues, not Math.random", () => {
    const spy = vi.spyOn(crypto, "getRandomValues");
    generateBotSeed();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("returns different values across calls", () => {
    const seeds = new Set(Array.from({ length: 20 }, () => generateBotSeed()));
    expect(seeds.size).toBeGreaterThan(1);
  });
});
