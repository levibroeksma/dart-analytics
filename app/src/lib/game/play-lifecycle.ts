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
import { markersForTurns } from "@lib/game/board-input.data";
import type { RulesetVersionKey } from "@lib/types";
import type { DartObservation, EngineFacts } from "@modules/types";
import type { GameEngine } from "@modules/interfaces";
import type {
  BoardMarker,
  PlayAgainOverrides,
  PlayLifecycleContext,
  PlayStoreContext,
} from "./types";

function currentFacts<
  TConfig,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
>(context: PlayLifecycleContext<TConfig, TEngine, TResults>): EngineFacts {
  return (
    context.engine?.facts() ?? {
      stages: context.$store.game.stages,
      turns: context.$store.game.turns,
    }
  );
}

export async function playInit<
  TConfig,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
>(
  context: PlayLifecycleContext<TConfig, TEngine, TResults>,
  gameTypeKey: string,
  resumeEngine: (game: PlayStoreContext<TConfig>["game"]) => TEngine | null,
): Promise<void> {
  context.loadingReconciliation = true;
  try {
    const activeSessions = await fetchActiveSessions();
    const result = await reconcileActiveSession(
      gameTypeKey,
      context.$store.game.sessionId,
      activeSessions,
      context.$store.game,
    );

    if (result.action === "abandon_failed") {
      context.reconciliationFailed = true;
      context.hasActiveSession = false;
      return;
    }
    context.reconciliationFailed = false;

    if (result.action === "no_active" || !result.activeSession) {
      context.hasActiveSession = false;
      return;
    }

    context.$store.game.setSessionModes(result.activeSession);

    const config = context.$store.game.configSnapshot;
    const engine = resumeEngine(context.$store.game);
    if (!config || !engine) {
      context.hasActiveSession = false;
      return;
    }
    context.engine = engine;
    context.$store.game.recordFacts(engine.facts());
    context.hasActiveSession = true;

    if (engine.isComplete()) {
      context.finished = true;
      context.completionStatus = "pending";
      await context.uploadAndCompleteSession();
    }
  } catch {
    context.reconciliationFailed = true;
    context.hasActiveSession = false;
  } finally {
    context.loadingReconciliation = false;
  }
}

export async function playRetryReconciliation<
  TConfig,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
>(context: PlayLifecycleContext<TConfig, TEngine, TResults>): Promise<void> {
  await context.init();
}

export async function playCommitDart<
  TConfig,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
>(
  context: PlayLifecycleContext<TConfig, TEngine, TResults>,
  observation: DartObservation,
): Promise<void> {
  if (!context.engine) return;
  try {
    context.engine.record(observation);
  } catch (err: unknown) {
    context.error = (err as Error).message;
    return;
  }
  context.error = "";
  const facts = context.engine.facts();
  context.$store.game.recordFacts(facts);

  const resolvedTurn = facts.turns.at(-1);
  if (resolvedTurn?.completedAt) {
    if (context.hiddenTimer) {
      clearTimeout(context.hiddenTimer);
      context.hiddenTimer = null;
    }
    if (context.$store.game.inputModeKey === "VISUAL_BOARD") {
      const clientKey = resolvedTurn.clientKey;
      context.hiddenTimer = setTimeout(() => {
        context.hiddenTurnKey = clientKey;
      }, 1500);
    } else {
      context.hiddenTurnKey = resolvedTurn.clientKey;
    }
  }

  if (context.engine.isComplete()) {
    context.finished = true;
    context.completionStatus = "pending";
    await context.uploadAndCompleteSession();
  }
}

export function playUndoVisit<
  TConfig,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
>(context: PlayLifecycleContext<TConfig, TEngine, TResults>): void {
  if (context.finished) return;
  if (!context.engine || !context.engine.undo()) return;
  if (context.hiddenTimer) {
    clearTimeout(context.hiddenTimer);
    context.hiddenTimer = null;
  }
  context.hiddenTurnKey = null;
  context.$store.game.recordFacts(context.engine.facts());
  context.error = "";
}

/**
 * The darts a VISUAL_BOARD session's board should currently show stuck in
 * it: the last turn's located darts, or none once that turn's own
 * reveal-then-clear timer (`playCommitDart`) has fired. Extracted from Bob's
 * 27's own `visitMarkers` override so Singles/Doubles Training can reuse it
 * instead of hand-rolling the same hidden-turn check.
 */
export function playVisitMarkers<
  TConfig,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
>(context: PlayLifecycleContext<TConfig, TEngine, TResults>): BoardMarker[] {
  if (context.$store.game.turns.at(-1)?.clientKey === context.hiddenTurnKey) {
    return [];
  }
  return markersForTurns(context.$store.game.turns);
}

/**
 * Uploads the fact log, then marks the session COMPLETED. On this path
 * only, SESSION_ALREADY_COMPLETED counts as success. Final state is read
 * before any store mutation so `resultsSnapshot` never depends on
 * `$store.game.turns` surviving a later reset. `buildResultsSnapshot`
 * supplies the one piece each ruleset computes differently.
 */
export async function playUploadAndCompleteSession<
  TConfig,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
>(
  context: PlayLifecycleContext<TConfig, TEngine, TResults>,
  buildResultsSnapshot: (finalState: ReturnType<TEngine["state"]>) => TResults,
): Promise<void> {
  const sessionId = context.$store.game.sessionId!;

  if (!context.$store.game.idempotencyKey) {
    context.$store.game.idempotencyKey = crypto.randomUUID();
  }
  const idempotencyKey = context.$store.game.idempotencyKey;

  context.completionStatus = "saving";
  context.completionError = "";

  const finalState = context.engine?.state() ?? null;

  try {
    const batch = buildEventsBatch(
      context.$store.game.participantRef!,
      currentFacts(context),
    );
    await appendBatch(sessionId, idempotencyKey, batch);
    await completeSession(sessionId, "COMPLETED");
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    const alreadyCompleted =
      error.code === "SESSION_ALREADY_COMPLETED" ||
      error.message?.includes("SESSION_ALREADY_COMPLETED");
    if (!alreadyCompleted) {
      context.completionError =
        "Could not save your game. Check your connection and retry.";
      context.completionStatus = "failed";
      return;
    }
  }

  if (finalState) {
    context.resultsSnapshot = buildResultsSnapshot(
      finalState as ReturnType<TEngine["state"]>,
    );
  }
  context.completionStatus = "succeeded";
}

export async function playBack<
  TConfig,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
>(context: PlayLifecycleContext<TConfig, TEngine, TResults>): Promise<void> {
  context.$store.game.reset();
  globalThis.location.href = "/games";
}

export async function playAbandonAndExit<
  TConfig,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
>(context: PlayLifecycleContext<TConfig, TEngine, TResults>): Promise<void> {
  if (context.$store.game.loading) return;
  const sessionId = context.$store.game.sessionId;
  if (!sessionId) {
    context.$store.game.reset();
    globalThis.location.href = "/games";
    return;
  }
  context.$store.game.loading = true;
  context.error = "";
  try {
    const facts = currentFacts(context);
    if (facts.turns.length > 0) {
      if (!context.$store.game.idempotencyKey) {
        context.$store.game.idempotencyKey = crypto.randomUUID();
      }
      const batch = buildEventsBatch(
        context.$store.game.participantRef!,
        facts,
      );
      await appendBatch(sessionId, context.$store.game.idempotencyKey, batch);
    }
    await completeSession(sessionId, "ABANDONED");
    context.$store.game.reset();
    globalThis.location.href = "/games";
  } catch {
    context.error = "Could not abandon session. Try again.";
    context.$store.game.loading = false;
  }
}

/**
 * Replays the same configuration template the first session used, with no
 * overrides — every current adopter of this module has zero editable
 * settings. `narrowEngine` supplies the `instanceof` check each ruleset's
 * own engine class needs, since the registry hands back a type-erased
 * `GameEngine<unknown, unknown>`.
 */
export async function runPlayAgain<
  TConfig,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
>(
  context: PlayLifecycleContext<TConfig, TEngine, TResults>,
  gameTypeKey: string,
  rulesetVersionKey: RulesetVersionKey,
  narrowEngine: (engine: GameEngine<unknown, unknown>) => TEngine | null,
  buildOverrides?: (priorConfig: TConfig) => PlayAgainOverrides<TConfig>,
): Promise<void> {
  const config = context.$store.game.configSnapshot;
  const templateRef = context.$store.game.templateRef;
  if (!config || !templateRef || context.playAgainLoading) return;
  const factory = getEngineFactory(rulesetVersionKey);
  if (!factory) return;

  context.playAgainLoading = true;
  context.playAgainError = "";

  const modePair = resolveSessionModePair(
    rulesetVersionKey,
    context.$store.settings,
  );
  const overrides = buildOverrides ? buildOverrides(config) : null;
  const nextConfigSnapshot = overrides ? overrides.snapshot : config;

  try {
    let session;
    try {
      session = await createSession({
        gameTypeKey,
        rulesetVersionKey,
        captureModeKey: modePair.captureModeKey,
        inputModeKey: modePair.inputModeKey,
        config: overrides
          ? { source: "template", templateRef, overrides: overrides.wire }
          : { source: "template", templateRef },
      });
    } catch {
      context.playAgainError = "Could not start a new session. Try again.";
      return;
    }

    context.$store.game.sessionId = session.sessionId;
    context.$store.game.participantRef = session.participants[0].ref;
    context.$store.game.idempotencyKey = null;
    context.$store.game.configSnapshot = nextConfigSnapshot;
    context.$store.game.setSessionModes(modePair);

    context.finished = false;
    context.completionStatus = "pending";
    context.completionError = "";
    context.resultsSnapshot = null;
    if (context.hiddenTimer) {
      clearTimeout(context.hiddenTimer);
      context.hiddenTimer = null;
    }
    context.hiddenTurnKey = null;
    context.error = "";
    context.hasActiveSession = true;

    const engine = narrowEngine(factory.create(nextConfigSnapshot));
    if (!engine) return;
    context.engine = engine;
    context.$store.game.recordFacts(engine.facts());
  } finally {
    context.playAgainLoading = false;
  }
}
