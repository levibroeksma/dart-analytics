import { eliminationCard } from "@lib/stats/elimination/elimination-cards";
import { eliminationTiles } from "@lib/stats/elimination/elimination-comparison-lines";
import { GAME_TYPE_BY_RULESET } from "@lib/game/rulesets/capabilities";
import { sumElimination } from "@lib/stats/elimination/elimination-comparison";
import { loadGameSection } from "@lib/stats/load-game-section";
import { ELIMINATION_GAMES } from "@modules/stats/sections/elimination.module";
import {
  comparisonSection,
  periodComparison,
} from "@lib/stats/sections/comparison-section";
import type {
  EliminationCard,
  EliminationComparison,
  GameTypeKey,
  RulesetVersionKey,
  TrackTile,
} from "@lib/types";
import type { EliminationGameKey, EliminationMetrics } from "@modules/types";

const NONE = { current: { part: 0, whole: 0 }, previous: null };

const EMPTY_CARD: EliminationCard = {
  comparison: {
    wins: NONE,
    dartsToKiller: NONE,
    dartsPerLife: NONE,
    livesLost: NONE,
    matchRate: NONE,
    matchDarts: NONE,
    advance: NONE,
    prison: NONE,
    reached: NONE,
  } satisfies EliminationComparison,
  beds: [],
  results: [],
};

async function readElimination(
  gameTypeKey: GameTypeKey,
  span: { from: string; to: string },
): Promise<EliminationMetrics> {
  const series = await loadGameSection<EliminationMetrics>(
    gameTypeKey,
    "elimination",
    { ...span, bucket: "none" },
  );
  return sumElimination(series.buckets);
}

const fetchEliminationCard = periodComparison(
  readElimination,
  (current, previous, gameTypeKey) =>
    eliminationCard(gameTypeKey as EliminationGameKey, current, previous),
  EMPTY_CARD,
);

/** The page game's four tiles over `card`, none for a game outside the section. */
function tilesFor(card: EliminationCard, game: string): TrackTile[] {
  const gameTypeKey = GAME_TYPE_BY_RULESET[game as RulesetVersionKey];
  if (!(ELIMINATION_GAMES as readonly string[]).includes(gameTypeKey))
    return [];
  return eliminationTiles(gameTypeKey as EliminationGameKey, card.comparison);
}

/** Alpine scope of the Elimination layout: the page game's win rate and three game tiles over the page period against the preceding period, plus the Follow the Leader bed rows and the Prisoner dart result rows on `card`. */
export function eliminationSection() {
  return comparisonSection(fetchEliminationCard, EMPTY_CARD, tilesFor);
}
