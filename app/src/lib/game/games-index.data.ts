import { fetchActiveSessions } from "@client/api/sessions";
import { GAME_CARDS, visibleGames } from "@lib/game/rulesets/games-visibility";
import type { SessionActiveData } from "@client/api/types";
import type {
  GameCardDescriptor,
  GameGroupKey,
  GamesIndexContext,
  ResumeTarget,
  RulesetVersionKey,
} from "@lib/types";

const ANALYTICS_CAPTURE_MODE_KEY = "ANALYTICS";

/**
 * The most recently started active session that has a game card, as that
 * card's title and setup route (the setup page owns the Continue/Abandon
 * recovery flow); `null` when no active session has a card.
 */
export function resumeTarget(
  sessions: SessionActiveData[],
  cards: readonly GameCardDescriptor[] = GAME_CARDS,
): ResumeTarget | null {
  const card = [...sessions]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .map((session) =>
      cards.find(
        (game) => game.rulesetVersionKey === session.rulesetVersionKey,
      ),
    )
    .find((game) => game !== undefined);
  return card ? { title: card.title, href: card.href } : null;
}

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
 *
 * An active session with no ruleset version — a training exercise step, which
 * `v_active_sessions` returns since migration `0033` — gates no card and is
 * dropped here rather than widening `activeRulesetKeys` to hold NULL.
 *
 * `activeSession` is the in-progress card's target (`resumeTarget`); the
 * group helpers drive the grouped list's section and divider visibility.
 */
export function gamesIndex() {
  return {
    activeRulesetKeys: [] as string[],
    activeSession: null as ResumeTarget | null,

    async init(this: GamesIndexContext) {
      try {
        const sessions = await fetchActiveSessions();
        this.activeRulesetKeys = sessions
          .map((session) => session.rulesetVersionKey)
          .filter((key) => key !== null);
        this.activeSession = resumeTarget(sessions);
      } catch {
        this.activeRulesetKeys = [];
        this.activeSession = null;
      }
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

    isFirstVisible(
      this: GamesIndexContext,
      groupKey: GameGroupKey,
      rulesetVersionKey: RulesetVersionKey,
    ) {
      const first = GAME_CARDS.find(
        (game) =>
          game.group === groupKey && this.isVisible(game.rulesetVersionKey),
      );
      return first?.rulesetVersionKey === rulesetVersionKey;
    },

    noneVisible(this: GamesIndexContext) {
      return GAME_CARDS.every(
        (game) => !this.isVisible(game.rulesetVersionKey),
      );
    },
  };
}
