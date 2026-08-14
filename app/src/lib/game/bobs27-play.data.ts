import { getEngineFactory } from "@modules/game/engine.registry";
import { resolveSessionModePair } from "@lib/game/session-mode-resolution";
import {
  appendBatch,
  completeSession,
  createSession,
  fetchActiveSessions,
} from "@client/api/sessions";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import { boardInputData, markersForTurns } from "@lib/game/board-input.data";
import { doublesPath, targetAt } from "@modules/game/board-progression.module";
import {
  doublesPathObservation,
  doublesPathPreviewSegments,
  doublesPathTargetLabel,
} from "@lib/game/doubles-path-play";
import type { RulesetVersionKey } from "@lib/types";
import type {
  Bobs27State,
  DartObservation,
  EngineFacts,
  TurnFact,
} from "@modules/types";
import type { BoardMarker } from "./types";
import type { Bobs27PlayContext, Bobs27PreviewSegment } from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// bobs27EngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import { Bobs27Engine } from "@modules/game/bobs27.engine.module";

const GAME_TYPE_KEY = "BOBS27";
const RULESET_VERSION_KEY: RulesetVersionKey = "BOBS27_V1";

function computeStats(
  state: Bobs27State,
  turns: readonly TurnFact[],
): { status: "WON" | "LOST"; score: number; darts: number } {
  const darts = turns.reduce((sum, turn) => sum + turn.darts.length, 0);
  return {
    status: state.status === "WON" ? "WON" : "LOST",
    score: state.score,
    darts,
  };
}

/**
 * Rebuilds the engine for the persisted session, replaying the store's fact
 * log so a reload restores the game exactly. Mirrors
 * `five-oh-one-play.data.ts`'s `resumeEngine`.
 */
function resumeEngine(
  game: Bobs27PlayContext["$store"]["game"],
): Bobs27Engine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (!configSnapshot || rulesetVersionKey !== RULESET_VERSION_KEY) return null;
  const factory = getEngineFactory(RULESET_VERSION_KEY);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof Bobs27Engine ? engine : null;
}

/**
 * The engine owns the fact log while a session is live; the store mirrors
 * it. Upload paths that can run without a live engine fall back to the
 * persisted mirror — mirrors `five-oh-one-play.data.ts`'s `currentFacts`.
 */
function currentFacts(context: Bobs27PlayContext): EngineFacts {
  return (
    context.engine?.facts() ?? {
      stages: context.$store.game.stages,
      turns: context.$store.game.turns,
    }
  );
}

/**
 * `self` exists only so `boardInputData`'s `onCommit` callback can reach this
 * page's own `recordDart` with the live, reactive `this` — see
 * `five-oh-one-play.data.ts`'s identical comment for the full reasoning.
 */
export function bobs27Play() {
  let self: Bobs27PlayContext;

  return {
    loading: false,
    error: "",
    finished: false,
    hasActiveSession: false,
    loadingReconciliation: false,
    reconciliationFailed: false,
    completionStatus: "pending" as
      "pending" | "saving" | "succeeded" | "failed",
    completionError: "",
    playAgainError: "",
    playAgainLoading: false,
    resultsSnapshot: null as {
      status: "WON" | "LOST";
      score: number;
      darts: number;
    } | null,
    hiddenTurnKey: null as string | null,
    hiddenTimer: null as ReturnType<typeof setTimeout> | null,
    engine: null as Bobs27Engine | null,
    ...boardInputData((observation) => self.recordDart(observation)),

    currentTargetLabel(this: Bobs27PlayContext): string {
      if (!this.engine) return "";
      return doublesPathTargetLabel(
        targetAt(doublesPath(), this.engine.state().targetIndex),
      );
    },

    currentScore(this: Bobs27PlayContext): string {
      if (!this.engine) return "";
      return String(this.engine.state().score);
    },

    previewSegments(this: Bobs27PlayContext): Bobs27PreviewSegment[] {
      return doublesPathPreviewSegments(
        this.$store.game.turns,
        this.hiddenTurnKey,
      );
    },

    /** Overrides `boardInputData`'s own `visitMarkers` — object-literal key
     * order means this later definition wins, so the shared module needs no
     * change. Hides the last turn's markers once its reveal-then-clear timer
     * has fired. */
    visitMarkers(this: Bobs27PlayContext): BoardMarker[] {
      if (this.$store.game.turns.at(-1)?.clientKey === this.hiddenTurnKey) {
        return [];
      }
      return markersForTurns(this.$store.game.turns);
    },

    async init(this: Bobs27PlayContext) {
      self = this;
      this.loadingReconciliation = true;
      try {
        const activeSessions = await fetchActiveSessions();
        const result = await reconcileActiveSession(
          GAME_TYPE_KEY,
          this.$store.game.sessionId,
          activeSessions,
          this.$store.game,
        );

        if (result.action === "abandon_failed") {
          this.reconciliationFailed = true;
          this.hasActiveSession = false;
          return;
        }
        this.reconciliationFailed = false;

        if (result.action === "no_active" || !result.activeSession) {
          this.hasActiveSession = false;
          return;
        }

        this.$store.game.setSessionModes(result.activeSession);

        const config = this.$store.game.configSnapshot;
        const engine = resumeEngine(this.$store.game);
        if (!config || !engine) {
          this.hasActiveSession = false;
          return;
        }
        this.engine = engine;
        this.$store.game.recordFacts(engine.facts());
        this.hasActiveSession = true;

        if (engine.isComplete()) {
          this.finished = true;
          this.completionStatus = "pending";
          await this.uploadAndCompleteSession();
        }
      } catch {
        this.reconciliationFailed = true;
        this.hasActiveSession = false;
      } finally {
        this.loadingReconciliation = false;
      }
    },

    async retryReconciliation(this: Bobs27PlayContext) {
      await this.init();
    },

    /** The recreational tap row's entry point: synthesizes the observation
     * for a hit or miss on the current target and funnels it through
     * `commitDart`, exactly as the board's per-dart `recordDart` does. */
    async recordTap(this: Bobs27PlayContext, hit: boolean) {
      if (!this.engine || this.finished) return;
      const target = targetAt(doublesPath(), this.engine.state().targetIndex);
      await this.commitDart(doublesPathObservation(target, hit));
    },

    async recordDart(this: Bobs27PlayContext, observation: DartObservation) {
      if (!this.engine || this.finished) return;
      await this.commitDart(observation);
    },

    /**
     * Records one dart and refreshes displayed state, shared by the
     * recreational tap path (`recordTap`) and the board's per-dart path
     * (`recordDart`). Bob's 27 has no bust/double ambiguity, so unlike 501
     * there is no confirm gate here — every dart commits immediately.
     *
     * A dart that resolves a visit (closes its 3rd dart) under VISUAL_BOARD
     * input schedules the 1.5s reveal-then-clear: `hiddenTimer` is tracked so
     * `undoVisit` can cancel a still-pending one rather than let it fire and
     * hide markers for a visit the undo just reopened.
     */
    async commitDart(this: Bobs27PlayContext, observation: DartObservation) {
      if (!this.engine) return;
      try {
        this.engine.record(observation);
      } catch (err: unknown) {
        this.error = (err as Error).message;
        return;
      }
      this.error = "";
      const facts = this.engine.facts();
      this.$store.game.recordFacts(facts);

      const resolvedTurn = facts.turns.at(-1);
      if (resolvedTurn?.completedAt) {
        if (this.hiddenTimer) {
          clearTimeout(this.hiddenTimer);
          this.hiddenTimer = null;
        }
        if (this.$store.game.inputModeKey === "VISUAL_BOARD") {
          const clientKey = resolvedTurn.clientKey;
          this.hiddenTimer = setTimeout(() => {
            this.hiddenTurnKey = clientKey;
          }, 1500);
        } else {
          this.hiddenTurnKey = resolvedTurn.clientKey;
        }
      }

      if (this.engine.isComplete()) {
        this.finished = true;
        this.completionStatus = "pending";
        await this.uploadAndCompleteSession();
      }
    },

    undoVisit(this: Bobs27PlayContext) {
      if (this.finished) return;
      if (!this.engine || !this.engine.undo()) return;

      if (this.hiddenTimer) {
        clearTimeout(this.hiddenTimer);
        this.hiddenTimer = null;
      }
      this.hiddenTurnKey = null;
      this.$store.game.recordFacts(this.engine.facts());
      this.error = "";
    },

    /**
     * Uploads the fact log, then marks the session COMPLETED. On this path
     * only, SESSION_ALREADY_COMPLETED counts as success. Final state is read
     * before any store mutation so `resultsSnapshot` never depends on
     * `$store.game.turns` surviving a later reset.
     */
    async uploadAndCompleteSession(this: Bobs27PlayContext): Promise<void> {
      const sessionId = this.$store.game.sessionId!;

      if (!this.$store.game.idempotencyKey) {
        this.$store.game.idempotencyKey = crypto.randomUUID();
      }
      const idempotencyKey = this.$store.game.idempotencyKey;

      this.completionStatus = "saving";
      this.completionError = "";

      const finalState = this.engine?.state() ?? null;

      try {
        const batch = buildEventsBatch(
          this.$store.game.participantRef!,
          currentFacts(this),
        );
        await appendBatch(sessionId, idempotencyKey, batch);
        await completeSession(sessionId, "COMPLETED");
      } catch (err: unknown) {
        const error = err as { code?: string; message?: string };
        const alreadyCompleted =
          error.code === "SESSION_ALREADY_COMPLETED" ||
          error.message?.includes("SESSION_ALREADY_COMPLETED");
        if (!alreadyCompleted) {
          this.completionError =
            "Could not save your game. Check your connection and retry.";
          this.completionStatus = "failed";
          return;
        }
      }

      if (finalState) {
        this.resultsSnapshot = computeStats(finalState, this.$store.game.turns);
      }
      this.completionStatus = "succeeded";
    },

    async back(this: Bobs27PlayContext) {
      this.$store.game.reset();
      globalThis.location.href = "/games";
    },

    async abandonAndExit(this: Bobs27PlayContext) {
      if (this.$store.game.loading) return;
      const sessionId = this.$store.game.sessionId;
      if (!sessionId) {
        this.$store.game.reset();
        globalThis.location.href = "/games";
        return;
      }
      this.$store.game.loading = true;
      this.error = "";
      try {
        const facts = currentFacts(this);
        if (facts.turns.length > 0) {
          if (!this.$store.game.idempotencyKey) {
            this.$store.game.idempotencyKey = crypto.randomUUID();
          }
          const batch = buildEventsBatch(
            this.$store.game.participantRef!,
            facts,
          );
          await appendBatch(sessionId, this.$store.game.idempotencyKey, batch);
        }
        await completeSession(sessionId, "ABANDONED");
        this.$store.game.reset();
        globalThis.location.href = "/games";
      } catch {
        this.error = "Could not abandon session. Try again.";
        this.$store.game.loading = false;
      }
    },

    /**
     * Replays the same configuration template the first session used, with
     * no overrides — V1 has zero editable settings, same rule Phase 3's
     * setup `start()` follows.
     */
    async playAgain(this: Bobs27PlayContext) {
      const config = this.$store.game.configSnapshot;
      const templateRef = this.$store.game.templateRef;
      if (!config || !templateRef || this.playAgainLoading) return;
      const factory = getEngineFactory(RULESET_VERSION_KEY);
      if (!factory) return;

      this.playAgainLoading = true;
      this.playAgainError = "";

      const modePair = resolveSessionModePair(
        RULESET_VERSION_KEY,
        this.$store.settings,
      );

      try {
        let session;
        try {
          session = await createSession({
            gameTypeKey: GAME_TYPE_KEY,
            rulesetVersionKey: RULESET_VERSION_KEY,
            captureModeKey: modePair.captureModeKey,
            inputModeKey: modePair.inputModeKey,
            config: { source: "template", templateRef },
          });
        } catch {
          this.playAgainError = "Could not start a new session. Try again.";
          return;
        }

        this.$store.game.sessionId = session.sessionId;
        this.$store.game.participantRef = session.participants[0].ref;
        this.$store.game.idempotencyKey = null;
        this.$store.game.setSessionModes(modePair);

        this.finished = false;
        this.completionStatus = "pending";
        this.completionError = "";
        this.resultsSnapshot = null;
        if (this.hiddenTimer) {
          clearTimeout(this.hiddenTimer);
          this.hiddenTimer = null;
        }
        this.hiddenTurnKey = null;
        this.error = "";
        this.hasActiveSession = true;

        const engine = factory.create(config);
        if (!(engine instanceof Bobs27Engine)) return;
        this.engine = engine;
        this.$store.game.recordFacts(engine.facts());
      } finally {
        this.playAgainLoading = false;
      }
    },
  };
}
