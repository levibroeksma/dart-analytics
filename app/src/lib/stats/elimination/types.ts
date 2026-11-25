import type { AceMeasure } from "../ace/types";
import type { AimTableRow } from "../x01/types";

/**
 * The Elimination comparison measures over the page period against the
 * preceding period of equal length: win rate (wins over finished games),
 * darts to Killer (over Killer games), darts per life taken, lives lost per
 * game, match rate (matched over match visits), darts per match, advance
 * rate and prison rate (over darts), and numbers completed per game.
 */
export type EliminationComparison = Record<
  | "wins"
  | "dartsToKiller"
  | "dartsPerLife"
  | "livesLost"
  | "matchRate"
  | "matchDarts"
  | "advance"
  | "prison"
  | "reached",
  AceMeasure
>;

/** The Elimination page card for one game and period: its comparison, the Follow the Leader bed rows and the Prisoner dart result rows (empty for the other games). */
export type EliminationCard = {
  comparison: EliminationComparison;
  beds: AimTableRow[];
  results: AimTableRow[];
};
