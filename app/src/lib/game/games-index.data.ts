import { fetchActiveSessions } from "@client/api/sessions";
import { GAME_CARDS, visibleGames } from "@lib/game/rulesets/games-visibility";
import type { GamesIndexContext, RulesetVersionKey } from "@lib/types";

const ANALYTICS_CAPTURE_MODE_KEY = "ANALYTICS";

/**
 * Games-page state: which cards the player's current app mode leaves visible.
 *
 * Mode comes from the `settings` store, which loads itself; the active sessions
 * come from the server, because a card whose session is still ACTIVE must stay
 * reachable even under a mode its ruleset does not support — the setup page it
 * links to owns the Continue/Abandon recovery flow, and this page is the only
 * way in. `uq_sessions_single_active` keys on `(player_id, game_type_id)`, so
 * more than one session can be active at once and every one of them keeps its
 * own card.
 *
 * A failed fetch falls back to "no active session" rather than blocking the
 * page: the worst case is a card the player must switch modes to reach, which
 * beats an empty games page whenever the network is down.
 */
export function gamesIndex() {
  return {
    activeRulesetKeys: [] as string[],

    async init(this: GamesIndexContext) {
      try {
        this.activeRulesetKeys = (await fetchActiveSessions()).map(
          (session) => session.rulesetVersionKey,
        );
      } catch {
        this.activeRulesetKeys = [];
      }
    },

    isVisible(this: GamesIndexContext, rulesetVersionKey: RulesetVersionKey) {
      const activeKey = this.activeRulesetKeys.includes(rulesetVersionKey)
        ? rulesetVersionKey
        : null;
      return visibleGames(
        this.$store.settings.captureModeKey,
        this.$store.settings.inputModeKey,
        activeKey,
      ).some((game) => game.rulesetVersionKey === rulesetVersionKey);
    },

    analyticsMode(this: GamesIndexContext) {
      return this.$store.settings.captureModeKey === ANALYTICS_CAPTURE_MODE_KEY;
    },

    noneVisible(this: GamesIndexContext) {
      return GAME_CARDS.every(
        (game) => !this.isVisible(game.rulesetVersionKey),
      );
    },
  };
}
