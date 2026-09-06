import type { PlayerVisitFactRow, ScoreBandCounts } from "./types";

/** The real dart count where it's known, else the visit's configured max, else 3. */
export function effectiveDartsForVisit(row: PlayerVisitFactRow): number {
  if (row.dartCount > 0) return row.dartCount;
  return row.configuredMaxDartsPerTurn ?? 3;
}

export function totalDartsThrown(rows: readonly PlayerVisitFactRow[]): number {
  return rows.reduce((sum, row) => sum + effectiveDartsForVisit(row), 0);
}

export function scoreBandCounts(
  rows: readonly PlayerVisitFactRow[],
): ScoreBandCounts {
  const counts: ScoreBandCounts = {
    hundredPlus: 0,
    oneTwentyPlus: 0,
    oneFortyPlus: 0,
    oneEighties: 0,
  };
  for (const row of rows) {
    const score = row.totalScore;
    if (score >= 180) counts.oneEighties += 1;
    else if (score >= 140) counts.oneFortyPlus += 1;
    else if (score >= 120) counts.oneTwentyPlus += 1;
    else if (score >= 100) counts.hundredPlus += 1;
  }
  return counts;
}

export function medianVisitScore(rows: readonly PlayerVisitFactRow[]): number {
  if (rows.length === 0) return 0;
  const sorted = rows.map((row) => row.totalScore).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function groupBySession(
  rows: readonly PlayerVisitFactRow[],
): Map<string, PlayerVisitFactRow[]> {
  const bySession = new Map<string, PlayerVisitFactRow[]>();
  for (const row of rows) {
    const list = bySession.get(row.sessionId) ?? [];
    list.push(row);
    bySession.set(row.sessionId, list);
  }
  return bySession;
}

export function highestGameAverage(
  rows: readonly PlayerVisitFactRow[],
): number {
  let highest = 0;
  for (const sessionRows of groupBySession(rows).values()) {
    const totalScore = sessionRows.reduce(
      (sum, row) => sum + row.totalScore,
      0,
    );
    const totalDarts = sessionRows.reduce(
      (sum, row) => sum + effectiveDartsForVisit(row),
      0,
    );
    if (totalDarts === 0) continue;
    highest = Math.max(highest, (totalScore / totalDarts) * 3);
  }
  return highest;
}

export function firstNineCareerAverage(
  rows: readonly PlayerVisitFactRow[],
): number {
  const pooled: number[] = [];
  for (const sessionRows of groupBySession(rows).values()) {
    const firstThree = [...sessionRows]
      .sort((a, b) => a.turnSequence - b.turnSequence)
      .slice(0, 3);
    pooled.push(...firstThree.map((row) => row.totalScore));
  }
  if (pooled.length === 0) return 0;
  return pooled.reduce((sum, score) => sum + score, 0) / pooled.length;
}
