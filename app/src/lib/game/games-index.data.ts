import { GAME_CARDS, visibleGames } from "@lib/game/rulesets/games-visibility";
import { fetchCatalogTags } from "@client/api/catalog";
import { cardTags } from "@lib/catalog/tags";
import type {
  CatalogTag,
  CatalogTagsResponse,
  DifficultyLevel,
  GameGroupKey,
  GamesIndexContext,
  RulesetVersionKey,
} from "@lib/types";

const ANALYTICS_CAPTURE_MODE_KEY = "ANALYTICS";

/**
 * Games-page state: which cards the player's current app mode leaves visible.
 *
 * Mode comes from the `settings` store, which loads itself; the active sessions
 * come from the shared `activeSessions` store, because a card whose session is still ACTIVE must stay
 * reachable even under a mode its ruleset does not support — the setup page it
 * links to owns the Continue/Abandon recovery flow, and this page is the only
 * way in. `uq_sessions_single_active` keys on `(player_id, game_type_id)`, so
 * more than one session can be active at once and every one of them keeps its
 * own card.
 *
 * A failed fetch falls back to "no active session" rather than blocking the
 * page: the worst case is a card the player must switch modes to reach, which
 * beats an empty games page whenever the network is down.
 *
 * An active session with no ruleset version — a training exercise step, which
 * `v_active_sessions` returns since migration `0033` — gates no card and is
 * dropped here rather than widening `activeRulesetKeys` to hold NULL.
 *
 * The group helpers drive the grouped list's section visibility;
 * the in-progress deck runs in its own `resumeDeck()` scope.
 * `loading()` holds the rows' skeleton until both the sessions fetch and the
 * settings store settle, so the page swaps data in once, in place.
 *
 * The catalog tags load in parallel with the sessions and never gate
 * `loading()`: the cards render their title at once and the pills and meter
 * fill in when the tags arrive. A failed tags fetch leaves `catalogTags` null,
 * so `gameTags` is empty and `gameLevel` null — cards stay usable untagged.
 */
export function gamesIndex() {
  return {
    activeRulesetKeys: [] as string[],
    sessionsLoading: true,
    catalogTags: null as CatalogTagsResponse | null,

    async init(this: GamesIndexContext) {
      void fetchCatalogTags().then(
        (tags) => {
          this.catalogTags = tags;
        },
        () => {},
      );
      await this.$store.activeSessions.load();
      this.activeRulesetKeys = this.$store.activeSessions.sessions
        .map((session) => session.rulesetVersionKey)
        .filter((key) => key !== null);
      this.sessionsLoading = false;
    },

    gameTags(this: GamesIndexContext, gameTypeKey: string): CatalogTag[] {
      const set = this.catalogTags?.games[gameTypeKey]?.standalone;
      return set ? cardTags(set, "game") : [];
    },

    gameLevel(
      this: GamesIndexContext,
      gameTypeKey: string,
    ): DifficultyLevel | null {
      return (
        this.catalogTags?.games[gameTypeKey]?.standalone.difficultyLevel ?? null
      );
    },

    loading(this: GamesIndexContext) {
      return this.sessionsLoading || this.$store.settings.loading === true;
    },

    isVisible(this: GamesIndexContext, rulesetVersionKey: RulesetVersionKey) {
      const activeKey = this.activeRulesetKeys.includes(rulesetVersionKey)
        ? rulesetVersionKey
        : null;
      return visibleGames(this.$store.settings.captureModeKey, activeKey).some(
        (game) => game.rulesetVersionKey === rulesetVersionKey,
      );
    },

    analyticsMode(this: GamesIndexContext) {
      return this.$store.settings.captureModeKey === ANALYTICS_CAPTURE_MODE_KEY;
    },

    groupVisible(this: GamesIndexContext, groupKey: GameGroupKey) {
      return GAME_CARDS.some(
        (game) =>
          game.group === groupKey && this.isVisible(game.rulesetVersionKey),
      );
    },

    noneVisible(this: GamesIndexContext) {
      return GAME_CARDS.every(
        (game) => !this.isVisible(game.rulesetVersionKey),
      );
    },
  };
}
