/** Career totals shown under the player's name on `/profile`. */
export type ProfileStats = { games: number; darts: number; minutes: number };

/** Alpine scope of `profileSnapshot()`. */
export type ProfileSnapshotContext = {
  stats: ProfileStats;
  statsLine: string;
  initials: (name: string) => string;
};
