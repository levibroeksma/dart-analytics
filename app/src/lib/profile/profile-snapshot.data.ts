import type { ProfileSnapshotContext, ProfileStats } from "@lib/types";

const STATS: ProfileStats = { games: 412, darts: 18342, minutes: 3680 };

const NUMBER = new Intl.NumberFormat("en-US");

/** `412 games · 18,342 darts · 61h 20m`. */
export function formatStatsLine({
  games,
  darts,
  minutes,
}: ProfileStats): string {
  const hours = Math.floor(minutes / 60);
  return `${NUMBER.format(games)} games · ${NUMBER.format(darts)} darts · ${hours}h ${minutes % 60}m`;
}

/** Upper-case first letters of the first two words; blank → `""`. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

/**
 * Profile identity stats. Fixture values from the design until the data
 * pass replaces them with reads; the returned shape is the contract.
 */
export function profileSnapshot(): ProfileSnapshotContext {
  return { stats: STATS, statsLine: formatStatsLine(STATS), initials };
}
