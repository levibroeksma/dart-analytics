import { describe, expect, it } from "vitest";
import {
  bestLeavingScore,
  isGoodLeave,
  LEAVE_RANK,
} from "@modules/stats/x01-leave-rank.module";

describe("leave rank", () => {
  it("ranks leaves", () => {
    expect(LEAVE_RANK).toEqual([32, 16, 40, 24, 8, 36, 28, 20, 12, 4]);
    expect([4, 12, 40].every(isGoodLeave)).toBe(true);
    expect([2, 6, 34, 44, 50].some(isGoodLeave)).toBe(false);
  });

  it("picks the score whose leave ranks best, in any input order", () => {
    expect(bestLeavingScore([1, 9, 17], 41)).toBe(9);
    expect(bestLeavingScore([17, 9, 1], 41)).toBe(9);
    expect(bestLeavingScore([5, 1], 45)).toBe(5);
  });

  it("has no best score when no score leaves a good leave", () => {
    expect(bestLeavingScore([1, 3], 40)).toBeUndefined();
    expect(bestLeavingScore([], 40)).toBeUndefined();
    expect(bestLeavingScore([20], 20)).toBeUndefined();
  });
});
