import { describe, it, expect } from "vitest";
import {
  formatTargetKey,
  isAimHit,
  parseTargetKey,
} from "@lib/stats/target-key";

describe("target key", () => {
  it("round-trips DOUBLE:16", () => {
    const key = formatTargetKey(16, "DOUBLE");
    expect(key).toBe("DOUBLE:16");
    expect(parseTargetKey(key)).toEqual({ number: 16, zone: "DOUBLE" });
  });

  it("round-trips INNER_BULL:25", () => {
    const key = formatTargetKey(25, "INNER_BULL");
    expect(key).toBe("INNER_BULL:25");
    expect(parseTargetKey(key)).toEqual({ number: 25, zone: "INNER_BULL" });
  });

  it("rejects a numbered ring outside 1-20", () => {
    expect(parseTargetKey("DOUBLE:21")).toBeNull();
  });

  it("rejects a bull with a number other than 25", () => {
    expect(parseTargetKey("INNER_BULL:20")).toBeNull();
  });

  it("rejects an unknown zone", () => {
    expect(parseTargetKey("MISS:0")).toBeNull();
  });

  it("rejects a lowercase zone", () => {
    expect(parseTargetKey("double:16")).toBeNull();
  });

  it("rejects a missing number", () => {
    expect(parseTargetKey("DOUBLE:")).toBeNull();
  });

  it("accepts NUMBER:20", () => {
    expect(parseTargetKey("NUMBER:20")).toEqual({ number: 20, zone: "NUMBER" });
  });

  it("accepts BULL:25", () => {
    expect(parseTargetKey("BULL:25")).toEqual({ number: 25, zone: "BULL" });
  });

  it("rejects NUMBER:25", () => {
    expect(parseTargetKey("NUMBER:25")).toBeNull();
  });

  it("rejects BULL:20", () => {
    expect(parseTargetKey("BULL:20")).toBeNull();
  });

  it("rejects NUMBER:0", () => {
    expect(parseTargetKey("NUMBER:0")).toBeNull();
  });
});

describe("isAimHit", () => {
  it("NUMBER:20 is hit by any ring of 20", () => {
    expect(
      isAimHit({ number: 20, zone: "NUMBER" }, { number: 20, zone: "TREBLE" }),
    ).toBe(true);
  });

  it("NUMBER:20 is not hit by a different number", () => {
    expect(
      isAimHit(
        { number: 20, zone: "NUMBER" },
        { number: 1, zone: "OUTER_SINGLE" },
      ),
    ).toBe(false);
  });

  it("NUMBER:20 is not hit by a MISS on 20", () => {
    expect(
      isAimHit({ number: 20, zone: "NUMBER" }, { number: 20, zone: "MISS" }),
    ).toBe(false);
  });

  it("BULL:25 is hit by the outer bull", () => {
    expect(
      isAimHit(
        { number: 25, zone: "BULL" },
        { number: 25, zone: "OUTER_BULL" },
      ),
    ).toBe(true);
  });

  it("BULL:25 is hit by the inner bull", () => {
    expect(
      isAimHit(
        { number: 25, zone: "BULL" },
        { number: 25, zone: "INNER_BULL" },
      ),
    ).toBe(true);
  });

  it("a stored zone aim is hit only by the exact pair", () => {
    expect(
      isAimHit({ number: 16, zone: "DOUBLE" }, { number: 16, zone: "DOUBLE" }),
    ).toBe(true);
  });

  it("a stored zone aim is not hit by a different ring on the same number", () => {
    expect(
      isAimHit(
        { number: 16, zone: "DOUBLE" },
        { number: 16, zone: "OUTER_SINGLE" },
      ),
    ).toBe(false);
  });
});
