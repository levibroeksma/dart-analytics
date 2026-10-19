import { afterEach, describe, expect, it, vi } from "vitest";
import { prefersReducedMotion } from "@lib/ui/motion";

afterEach(() => vi.unstubAllGlobals());

describe("prefersReducedMotion", () => {
  it("is false when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(prefersReducedMotion()).toBe(false);
  });

  it("mirrors matches when matchMedia is present", () => {
    const matchMedia = vi.fn(() => ({ matches: true }));
    vi.stubGlobal("matchMedia", matchMedia);
    expect(prefersReducedMotion()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    expect(prefersReducedMotion()).toBe(false);
  });
});
