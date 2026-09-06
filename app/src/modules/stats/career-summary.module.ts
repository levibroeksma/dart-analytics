import type { PlayerSessionSummaryRow } from "./types";

function completedRows(
  rows: readonly PlayerSessionSummaryRow[],
): PlayerSessionSummaryRow[] {
  return rows.filter((row) => row.statusKey === "COMPLETED");
}

export function totalGamesPlayed(
  rows: readonly PlayerSessionSummaryRow[],
): number {
  return completedRows(rows).length;
}

export function totalPlayTimeSeconds(
  rows: readonly PlayerSessionSummaryRow[],
): number {
  return completedRows(rows).reduce((sum, row) => sum + row.durationSeconds, 0);
}

export function favoriteGameTypeKey(
  rows: readonly PlayerSessionSummaryRow[],
): string | null {
  const counts = new Map<string, number>();
  for (const row of completedRows(rows)) {
    counts.set(row.gameTypeKey, (counts.get(row.gameTypeKey) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [gameTypeKey, count] of counts) {
    if (count > bestCount) {
      best = gameTypeKey;
      bestCount = count;
    }
  }
  return best;
}

function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function daysBetween(earlier: string, later: string): number {
  const msPerDay = 86_400_000;
  return Math.round((Date.parse(later) - Date.parse(earlier)) / msPerDay);
}

function distinctSortedPlayDates(
  rows: readonly PlayerSessionSummaryRow[],
): string[] {
  const dates = new Set(
    completedRows(rows).map((row) => toDateOnly(row.startedAt)),
  );
  return Array.from(dates).sort();
}

export function longestPlayStreakDays(
  rows: readonly PlayerSessionSummaryRow[],
): number {
  const dates = distinctSortedPlayDates(rows);
  if (dates.length === 0) return 0;
  let longest = 1;
  let current = 1;
  for (let i = 1; i < dates.length; i += 1) {
    current = daysBetween(dates[i - 1], dates[i]) === 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

/** `referenceDate` defaults to now; pass an explicit date for deterministic tests. */
export function currentPlayStreakDays(
  rows: readonly PlayerSessionSummaryRow[],
  referenceDate: Date = new Date(),
): number {
  const dates = distinctSortedPlayDates(rows);
  if (dates.length === 0) return 0;
  const today = referenceDate.toISOString().slice(0, 10);
  const lastPlayed = dates[dates.length - 1];
  if (daysBetween(lastPlayed, today) > 1) return 0;
  let streak = 1;
  for (let i = dates.length - 1; i > 0; i -= 1) {
    if (daysBetween(dates[i - 1], dates[i]) === 1) streak += 1;
    else break;
  }
  return streak;
}
