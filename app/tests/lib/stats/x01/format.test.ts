import { describe, expect, it } from "vitest";
import {
  formatDelta,
  formatPointDelta,
  formatRate,
} from "@lib/stats/x01/format";

describe("formatRate", () => {
  it("formats a ratio as one-decimal percent", () => {
    expect(formatRate(0.3)).toBe("30.0%");
  });
  it("shows a dash for null", () => {
    expect(formatRate(null)).toBe("—");
  });
});

describe("formatPointDelta", () => {
  it("signs the value in percentage points", () => {
    expect(formatPointDelta(5)).toBe("+5.0 pp");
    expect(formatPointDelta(-1.2)).toBe("-1.2 pp");
  });
  it("is empty for null", () => {
    expect(formatPointDelta(null)).toBe("");
  });
});

describe("formatDelta", () => {
  it("signs the percent change", () => {
    expect(formatDelta(2.5)).toBe("+2.5%");
    expect(formatDelta(-3)).toBe("-3.0%");
  });
  it("is empty for null", () => {
    expect(formatDelta(null)).toBe("");
  });
});
