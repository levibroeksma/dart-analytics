import { describe, it, expect } from "vitest";
import { formatTargetKey, parseTargetKey } from "@lib/stats/target-key";

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
});
