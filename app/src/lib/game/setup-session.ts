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
 * recovered active session, retry that, continue, leave or abandon it. Spread the
 * result into the controller's returned object. Each call returns fresh
 * state, so two controllers never share `guests` or `bot`.
 *
 * A session held elsewhere opens the same modal with `activeSessionLocal`
 * false: it cannot be continued here, only abandoned or left alone, and the
 * picker stays hidden while it is ACTIVE (single active session, D118; D460).
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
    activeSessionLocal: false,
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

      if (result.action === "no_active") {
        this.showActiveSessionModal = false;
      } else {
        this.activeSession = result.activeSession;
        this.activeSessionLocal = result.action === "match";
        this.showActiveSessionModal = true;
      }
      this.reconciliationFailed = false;
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

    leaveSetup(this: SetupSessionContext) {
      globalThis.location.href = "/games";
    },

    async abandonSession(this: SetupSessionContext) {
      if (!this.activeSession || this.loading) return;
      this.loading = true;
      this.error = "";
      try {
        await completeSession(this.activeSession.sessionId, "ABANDONED");
        if (this.activeSessionLocal) this.$store.game.reset();
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
