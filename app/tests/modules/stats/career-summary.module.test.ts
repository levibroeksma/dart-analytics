import { describe, expect, it } from "vitest";
import {
  currentPlayStreakDays,
  favoriteGameTypeKey,
  longestPlayStreakDays,
  totalGamesPlayed,
  totalPlayTimeSeconds,
} from "@modules/stats/career-summary.module";
import type { PlayerSessionSummaryRow } from "@modules/types";

function session(
  overrides: Partial<PlayerSessionSummaryRow> = {},
): PlayerSessionSummaryRow {
  return {
    gameTypeKey: "501",
    statusKey: "COMPLETED",
    startedAt: "2026-09-01T10:00:00.000Z",
    durationSeconds: 600,
    ...overrides,
  };
}

describe("totalGamesPlayed", () => {
  it("returns 0 for no sessions", () => {
    expect(totalGamesPlayed([])).toBe(0);
  });

  it("counts only COMPLETED sessions", () => {
    const rows = [
      session({ statusKey: "COMPLETED" }),
      session({ statusKey: "ABANDONED" }),
      session({ statusKey: "ACTIVE" }),
    ];
    expect(totalGamesPlayed(rows)).toBe(1);
  });
});

describe("totalPlayTimeSeconds", () => {
  it("sums duration across COMPLETED sessions only", () => {
    const rows = [
      session({ durationSeconds: 300 }),
      session({ durationSeconds: 700, statusKey: "ABANDONED" }),
      session({ durationSeconds: 200 }),
    ];
    expect(totalPlayTimeSeconds(rows)).toBe(500);
  });
});

describe("favoriteGameTypeKey", () => {
  it("returns null for no sessions", () => {
    expect(favoriteGameTypeKey([])).toBeNull();
  });

  it("returns the most-played COMPLETED game type", () => {
    const rows = [
      session({ gameTypeKey: "501" }),
      session({ gameTypeKey: "TUOD" }),
      session({ gameTypeKey: "501" }),
      session({ gameTypeKey: "501", statusKey: "ABANDONED" }),
    ];
    expect(favoriteGameTypeKey(rows)).toBe("501");
  });

  it("breaks ties by first-seen order", () => {
    const rows = [
      session({ gameTypeKey: "TUOD" }),
      session({ gameTypeKey: "501" }),
    ];
    expect(favoriteGameTypeKey(rows)).toBe("TUOD");
  });
});

describe("longestPlayStreakDays", () => {
  it("returns 0 for no sessions", () => {
    expect(longestPlayStreakDays([])).toBe(0);
  });

  it("counts a run of consecutive calendar days once per day", () => {
    const rows = [
      session({ startedAt: "2026-09-01T09:00:00.000Z" }),
      session({ startedAt: "2026-09-01T21:00:00.000Z" }),
      session({ startedAt: "2026-09-02T09:00:00.000Z" }),
      session({ startedAt: "2026-09-03T09:00:00.000Z" }),
    ];
    expect(longestPlayStreakDays(rows)).toBe(3);
  });

  it("finds the longest of several runs separated by gaps", () => {
    const rows = [
      session({ startedAt: "2026-09-01T09:00:00.000Z" }),
      session({ startedAt: "2026-09-05T09:00:00.000Z" }),
      session({ startedAt: "2026-09-06T09:00:00.000Z" }),
      session({ startedAt: "2026-09-07T09:00:00.000Z" }),
    ];
    expect(longestPlayStreakDays(rows)).toBe(3);
  });
});

describe("currentPlayStreakDays", () => {
  it("returns 0 for no sessions", () => {
    expect(
      currentPlayStreakDays([], new Date("2026-09-06T12:00:00.000Z")),
    ).toBe(0);
  });

  it("counts the run ending today", () => {
    const rows = [
      session({ startedAt: "2026-09-04T09:00:00.000Z" }),
      session({ startedAt: "2026-09-05T09:00:00.000Z" }),
      session({ startedAt: "2026-09-06T09:00:00.000Z" }),
    ];
    expect(
      currentPlayStreakDays(rows, new Date("2026-09-06T18:00:00.000Z")),
    ).toBe(3);
  });

  it("still counts the run when the reference date is the day after last play", () => {
    const rows = [
      session({ startedAt: "2026-09-04T09:00:00.000Z" }),
      session({ startedAt: "2026-09-05T09:00:00.000Z" }),
    ];
    expect(
      currentPlayStreakDays(rows, new Date("2026-09-06T08:00:00.000Z")),
    ).toBe(2);
  });

  it("returns 0 when the last play is more than a day before the reference date", () => {
    const rows = [session({ startedAt: "2026-09-01T09:00:00.000Z" })];
    expect(
      currentPlayStreakDays(rows, new Date("2026-09-06T08:00:00.000Z")),
    ).toBe(0);
  });
});
