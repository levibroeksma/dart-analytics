import type { RulesetVersionKey } from "@lib/types";
import { supportsCaptureMode } from "./capabilities";
import type { GameCardDescriptor } from "./types";

/**
 * The games the page can offer, in display order, independent of mode. Every
 * entry needs a real setup route: a card the filter keeps but the router cannot
 * serve is worse than no card at all, so a ruleset joins this list only once
 * `href` resolves. That is why TUOD is absent despite declaring capabilities.
 *
 * The games page renders straight from this list, so a game added here appears
 * without a second edit to the template.
 */
export const GAME_CARDS: readonly GameCardDescriptor[] = [
  {
    rulesetVersionKey: "SCORE_TRAINING_V1",
    href: "/games/score-training/setup",
    title: "Score training",
    caption: "Exercise your scoring abilities.",
  },
  {
    rulesetVersionKey: "501_V1",
    href: "/games/501/setup",
    title: "501",
    caption: "Classic double-out darts.",
  },
  {
    rulesetVersionKey: "BOBS27_V1",
    href: "/games/bobs27/setup",
    title: "Bob's 27",
    caption: "Running-score doubles training.",
  },
  {
    rulesetVersionKey: "SINGLES_V1",
    href: "/games/singles-training/setup",
    title: "Singles training",
    caption: "Section training, one target at a time.",
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
