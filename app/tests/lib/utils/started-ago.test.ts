import { describe, it, expect } from "vitest";
import { startedAgo } from "@utils/started-ago";

const now = new Date("2026-10-10T12:00:00.000Z");
const at = (ms: number) => new Date(now.getTime() - ms).toISOString();
const MIN = 60_000,
  H = 60 * MIN,
  D = 24 * H;

describe("startedAgo", () => {
  it.each([
    [at(0), "JUST NOW"],
    [at(59_000), "JUST NOW"],
    [at(MIN), "1 MIN AGO"],
    [at(18 * MIN), "18 MIN AGO"],
    [at(H - 1), "59 MIN AGO"],
    [at(59 * MIN), "59 MIN AGO"],
    [at(H), "1 H AGO"],
    [at(23 * H), "23 H AGO"],
    [at(D - 1), "23 H AGO"],
    [at(D), "YESTERDAY"],
    [at(2 * D - 1), "YESTERDAY"],
    [at(2 * D), "2 D AGO"],
    [new Date(now.getTime() + 5 * MIN).toISOString(), "JUST NOW"],
    ["not-a-date", "JUST NOW"],
  ])("%s → %s", (iso, label) => {
    expect(startedAgo(iso, now)).toBe(label);
  });
});
