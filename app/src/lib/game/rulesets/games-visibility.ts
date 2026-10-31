import type { RulesetVersionKey } from "@lib/types";
import { GAME_TYPE_BY_RULESET, supportsCaptureMode } from "./capabilities";
import type { GameCardDescriptor, GameGroupKey } from "./types";

/**
 * The games the page can offer, in display order (grouped as `GAME_GROUPS`),
 * independent of mode. Every
 * entry needs a real setup route: a card the filter keeps but the router cannot
 * serve is worse than no card at all, so a ruleset joins this list only once
 * `href` resolves.
 *
 * The games page renders straight from this list, so a game added here appears
 * without a second edit to the template.
 */
export const GAME_CARDS: readonly GameCardDescriptor[] = [
  {
    rulesetVersionKey: "501_V2",
    gameTypeKey: "501",
    group: "MATCH_PLAY",
    href: "/games/501/setup",
    title: "501",
    caption: "Classic double-out darts.",
  },
  {
    rulesetVersionKey: "121_V1",
    gameTypeKey: "ONE_TWENTY_ONE",
    group: "MATCH_PLAY",
    href: "/games/121/setup",
    title: "121",
    caption: "Climb the checkout ladder.",
  },
  {
    rulesetVersionKey: "CRICKET_V1",
    gameTypeKey: "CRICKET",
    group: "MATCH_PLAY",
    href: "/games/cricket/setup",
    title: "Cricket",
    caption: "Close 20 to 15 and the bull.",
  },
  {
    rulesetVersionKey: "TACTICS_V1",
    gameTypeKey: "TACTICS",
    group: "MATCH_PLAY",
    href: "/games/tactics/setup",
    title: "Tactics",
    caption: "Close 20 to 15, the bull, doubles and trebles.",
  },
  {
    rulesetVersionKey: "MICKEY_MOUSE_V1",
    gameTypeKey: "MICKEY_MOUSE",
    group: "MATCH_PLAY",
    href: "/games/mickey-mouse/setup",
    title: "Mickey Mouse",
    caption: "Close 20 to 12, doubles, trebles and the bull.",
  },
  {
    rulesetVersionKey: "SCORE_TRAINING_V1",
    gameTypeKey: "SCORE_TRAINING",
    group: "TRAINING",
    href: "/games/score-training/setup",
    title: "Score training",
    caption: "Exercise your scoring abilities.",
  },
  {
    rulesetVersionKey: "SINGLES_V1",
    gameTypeKey: "SINGLES_TRAINING",
    group: "TRAINING",
    href: "/games/singles-training/setup",
    title: "Singles training",
    caption: "Section training, one target at a time.",
  },
  {
    rulesetVersionKey: "DOUBLES_TRAINING_V1",
    gameTypeKey: "DOUBLES_TRAINING",
    group: "TRAINING",
    href: "/games/doubles-training/setup",
    title: "Doubles training",
    caption: "Trebles for show, doubles for dough!",
  },
  {
    rulesetVersionKey: "BOBS27_V1",
    gameTypeKey: "BOBS27",
    group: "TRAINING",
    href: "/games/bobs27/setup",
    title: "Bob's 27",
    caption: "Running-score doubles training.",
  },
  {
    rulesetVersionKey: "TUOD_V1",
    gameTypeKey: "TUOD",
    group: "TRAINING",
    href: "/games/tuod/setup",
    title: "Ten Up One Down",
    caption: "Climb the checkout ladder.",
  },
  {
    rulesetVersionKey: "SHANGHAI_V1",
    gameTypeKey: "SHANGHAI",
    group: "CLASSICS",
    href: "/games/shanghai/setup",
    title: "Shanghai",
    caption: "Single, double, treble, Shanghai!",
  },
  {
    rulesetVersionKey: "AROUND_THE_CLOCK_V1",
    gameTypeKey: "AROUND_THE_CLOCK",
    group: "CLASSICS",
    href: "/games/around-the-clock/setup",
    title: "Around the Clock",
    caption: "A pub classic, and great practice.",
  },
  {
    rulesetVersionKey: "AROUND_THE_CLOCK_V3",
    gameTypeKey: "AROUND_THE_CLOCK",
    group: "CLASSICS",
    href: "/games/around-the-clock/setup?lives=3",
    title: "Nine Lives",
    caption: "Three lives. Miss a whole visit and one goes.",
  },
  {
    rulesetVersionKey: "BASEBALL_V1",
    gameTypeKey: "BASEBALL",
    group: "CLASSICS",
    href: "/games/baseball/setup",
    title: "Baseball Darts",
    caption: "Nine innings, runs by the ring.",
  },
  {
    rulesetVersionKey: "KILLER_V1",
    gameTypeKey: "KILLER",
    group: "CLASSICS",
    href: "/games/killer/setup",
    title: "Killer",
    caption: "Hit your double, then hunt theirs.",
  },
  {
    rulesetVersionKey: "FOLLOW_THE_LEADER_V1",
    gameTypeKey: "FOLLOW_THE_LEADER",
    group: "CLASSICS",
    href: "/games/follow-the-leader/setup",
    title: "Follow the Leader",
    caption: "Hit the bed they set, or lose a life.",
  },
];

/**
 * Which game cards to show for a capture mode. A game with an active session
 * is always shown, whatever the mode: that session snapshotted its own modes
 * at start and is unaffected by a later preference change, but hiding its
 * card would strand it — the recovery flow is reachable only from here.
 *
 * Filtering on `supportsCaptureMode` rather than the exact declared pair is
 * deliberate: the app's mode picker only ever sets one of two canonical
 * pairs (`RECREATIONAL`+`QUICK_SCORE`, `ANALYTICS`+`VISUAL_BOARD`), never a
 * ruleset-specific input mode like `DETAILED_DARTS`. A ruleset that pairs
 * `RECREATIONAL` with `DETAILED_DARTS` instead of `QUICK_SCORE` (`BOBS27_V1`)
 * would otherwise never show a card under `RECREATIONAL`, even though
 * `resolveSessionModePair` already starts it correctly under that capture
 * mode via its own-first-pair fallback. Exact-pair enforcement stays in
 * `supportsMode` (session creation, `session.service.ts`) — this function
 * only governs whether a card renders.
 *
 * Filtering on capability rather than on the engine registry is deliberate.
 * The registry is populated by `*.engine.module.ts` import side effects, and
 * this page imports no engine, so a registry-backed filter would hide every
 * card on the one page that never loads an engine.
 */
export function visibleGames(
  captureModeKey: string,
  activeRulesetKey: RulesetVersionKey | null,
): readonly GameCardDescriptor[] {
  return GAME_CARDS.filter(
    (game) =>
      supportsCaptureMode(game.rulesetVersionKey, captureModeKey) ||
      game.rulesetVersionKey === activeRulesetKey,
  );
}

/** The games page's sections, in display order. */
export const GAME_GROUPS: readonly { key: GameGroupKey; title: string }[] = [
  { key: "MATCH_PLAY", title: "MATCH PLAY" },
  { key: "TRAINING", title: "TRAINING" },
  { key: "CLASSICS", title: "CLASSICS" },
];

/** `cards` bucketed by `GAME_GROUPS` order, keeping card order; empty groups dropped. */
export function groupedGames(
  cards: readonly GameCardDescriptor[] = GAME_CARDS,
): { key: GameGroupKey; title: string; games: GameCardDescriptor[] }[] {
  return GAME_GROUPS.map((group) => ({
    ...group,
    games: cards.filter((card) => card.group === group.key),
  })).filter((group) => group.games.length > 0);
}

/** The first card of each game type: a preset card of an existing game (Nine Lives) is not a game of its own for pickers and titles. */
export function primaryCards(
  cards: readonly GameCardDescriptor[] = GAME_CARDS,
): GameCardDescriptor[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    if (seen.has(card.gameTypeKey)) return false;
    seen.add(card.gameTypeKey);
    return true;
  });
}

/**
 * The card a session's ruleset resumes through: its own, else its game type's
 * first card (`501_V1` resumes through the 501 card, `SHANGHAI_V2` through
 * Shanghai's).
 */
export function cardForRuleset(
  cards: readonly GameCardDescriptor[],
  rulesetVersionKey: string | null,
): GameCardDescriptor | undefined {
  const own = cards.find(
    (game) => game.rulesetVersionKey === rulesetVersionKey,
  );
  if (own || rulesetVersionKey === null) return own;
  const gameTypeKey =
    GAME_TYPE_BY_RULESET[rulesetVersionKey as RulesetVersionKey];
  return primaryCards(cards).find((game) => game.gameTypeKey === gameTypeKey);
}
