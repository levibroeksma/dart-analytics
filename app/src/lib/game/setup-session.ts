import {
  fetchActiveSessions,
  completeSession,
  type SessionActiveData,
} from "@client/api/sessions";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import { DEFAULT_BOT_LEVEL } from "@lib/game/rulesets/capabilities";
import type { SetupSessionContext } from "./types";

/**
 * The part of every setup controller that never varies by game: the modal,
 * alert and guest/bot chooser state, and the methods that reconcile a
 * recovered active session, retry that, continue or abandon it. Spread the
 * result into the controller's returned object. Each call returns fresh
 * state, so two controllers never share `guests` or `bot`.
 *
 * `abandon_failed` blocks session creation instead of silently resetting: the
 * orphan session is still ACTIVE server-side, so showing the picker would let
 * a new session violate the single-active-session constraint (D118).
 *
 * `start()`, `init()` and `addGuest()`/`addBot()` stay in each controller;
 * they differ per game.
 */
export function createSetupSession(options: {
  gameTypeKey: string;
  playHref: string;
}) {
  const { gameTypeKey, playHref } = options;

  return {
    loading: false,
    error: "",
    activeSession: null as SessionActiveData | null,
    showActiveSessionModal: false,
    loadingReconciliation: false,
    reconciliationFailed: false,
    guests: [] as { displayName: string }[],
    showAddGuestModal: false,
    newGuestName: "",
    bot: null as { level: number } | null,
    showOpponentChooser: false,
    pendingBotLevel: DEFAULT_BOT_LEVEL as number,
    showBotLevelPicker: false,

    async reconcile(
      this: SetupSessionContext,
      activeSessions: SessionActiveData[],
    ) {
      const result = await reconcileActiveSession(
        gameTypeKey,
        this.$store.game.sessionId,
        activeSessions,
        this.$store.game,
      );

      if (result.action === "match") {
        this.activeSession = result.activeSession;
        this.showActiveSessionModal = true;
        this.reconciliationFailed = false;
      } else if (result.action === "abandon_failed") {
        this.showActiveSessionModal = false;
        this.reconciliationFailed = true;
      } else {
        this.showActiveSessionModal = false;
        this.reconciliationFailed = false;
      }
    },

    async retryReconciliation(this: SetupSessionContext) {
      this.loadingReconciliation = true;
      try {
        const activeSessions = await fetchActiveSessions();
        await this.reconcile(activeSessions);
      } finally {
        this.loadingReconciliation = false;
      }
    },

    continueSession(this: SetupSessionContext) {
      this.showActiveSessionModal = false;
      globalThis.location.href = playHref;
    },

    async abandonSession(this: SetupSessionContext) {
      if (!this.activeSession || this.loading) return;
      this.loading = true;
      this.error = "";
      try {
        await completeSession(this.activeSession.sessionId, "ABANDONED");
        this.$store.game.reset();
        this.showActiveSessionModal = false;
        this.activeSession = null;
      } catch {
        this.error = "Could not abandon session. Try again.";
      } finally {
        this.loading = false;
      }
    },

    removeGuest(this: SetupSessionContext, index: number) {
      this.guests.splice(index, 1);
    },

    removeBot(this: SetupSessionContext) {
      this.bot = null;
    },
  };
}
