import { meanTile, ratioTile } from "@lib/stats/sections/comparison-tile";
import type { EliminationComparison, TrackTile } from "@lib/types";
import type { EliminationGameKey } from "@modules/types";

const NO_GAMES = "No finished games yet";
const NO_DARTS = "No darts yet";

const GAME_TILES: Record<
  EliminationGameKey,
  (c: EliminationComparison) => TrackTile[]
> = {
  KILLER: (c) => [
    meanTile("Darts to Killer", c.dartsToKiller, "Not a Killer yet", 1),
    meanTile("Darts per life taken", c.dartsPerLife, "No lives taken", 1),
    meanTile("Lives lost per game", c.livesLost, NO_GAMES, 1),
  ],
  FOLLOW_THE_LEADER: (c) => [
    ratioTile("Match rate", c.matchRate, "No match visits yet"),
    meanTile("Darts per match", c.matchDarts, "No matches yet", 1),
    meanTile("Lives lost per game", c.livesLost, NO_GAMES, 1),
  ],
  PRISONER: (c) => [
    ratioTile("Advance rate", c.advance, NO_DARTS),
    ratioTile("Prison rate", c.prison, NO_DARTS),
    meanTile("Numbers completed per game", c.reached, NO_GAMES, 1),
  ],
};

/** `game`'s four comparison tiles, win rate first, each with its change once both periods reach `MIN_TARGET_SAMPLE`. */
export function eliminationTiles(
  game: EliminationGameKey,
  c: EliminationComparison,
): TrackTile[] {
  return [ratioTile("Win rate", c.wins, NO_GAMES), ...GAME_TILES[game](c)];
}
