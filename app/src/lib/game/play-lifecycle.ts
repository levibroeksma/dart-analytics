import { getEngineFactory } from "@modules/game/engine.registry";
import {
  participantsFromSeats,
  reseatSnapshot,
  resolveSessionModePair,
} from "@lib/game/session-mode-resolution";
import {
  appendBatch,
  completeSession,
  createSession,
  fetchActiveSessions,
} from "@client/api/sessions";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import { markersForTurns } from "@lib/game/board-input.data";
import type { RulesetVersionKey, Seated } from "@lib/types";
import type {
  DartFact,
  DartObservation,
  EngineFacts,
  MultiSeatState,
  TurnFact,
} from "@modules/types";
import type { GameEngine, GameEngineFactory } from "@modules/interfaces";
import type {
  BoardMarker,
  BotDartThrower,
  BotQuickScoreFold,
  BotQuickScoreThrower,
  PlayAgainOverrides,
  PlayLifecycleContext,
  PlayStoreContext,
  PreviewSegment,
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

function clearTimerHandle(context: {
  hiddenTimer?: ReturnType<typeof setTimeout> | null;
}): void {
  if (context.hiddenTimer) {
    clearTimeout(context.hiddenTimer);
    context.hiddenTimer = null;
  }
}

/**
 * Arms the 1500ms reveal-then-clear timer once `turns`' last entry has
 * resolved (`completedAt` set). This is the primitive `playCommitDart` uses
 * internally, and the one a caller whose engine has different completion
 * semantics (Score Training, D234) calls directly instead of adopting the
 * whole `playCommitDart` composite. A no-op while the last turn is open, or
 * when there are no turns yet.
 */
export function armHiddenTimer(
  context: {
    hiddenTurnKey: string | null;
    hiddenTimer?: ReturnType<typeof setTimeout> | null;
  },
  turns: readonly TurnFact[],
): void {
  const resolvedTurn = turns.at(-1);
  if (!resolvedTurn?.completedAt) return;
  clearTimerHandle(context);
  const clientKey = resolvedTurn.clientKey;
  context.hiddenTimer = setTimeout(() => {
    context.hiddenTurnKey = clientKey;
  }, 1500);
}

/**
 * Cancels a pending reveal-then-clear timer and clears `hiddenTurnKey`, so
 * an undone or replayed visit's markers/preview stay visible instead of
 * disappearing on a timer that no longer applies to it.
 */
export function clearHiddenTimer(context: {
  hiddenTurnKey: string | null;
  hiddenTimer?: ReturnType<typeof setTimeout> | null;
}): void {
  clearTimerHandle(context);
  context.hiddenTurnKey = null;
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
  armHiddenTimer(context, facts.turns);

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
  clearHiddenTimer(context);
  context.$store.game.recordFacts(context.engine.facts());
  context.error = "";
}

/**
 * Pops visits until `participantRef`'s own seat is active again, or the fact
 * log is empty. Always pops at least once, even when that seat is already
 * active — a solo session's only seat never stops being active, so a loop
 * that pops only *while* it is not would pop nothing at all, and the undo
 * button would go dead in every solo session in the app. Existing single-pop
 * callers (`playUndoVisit`, every non-bot page) are unaffected: this is a new
 * export, not a change to that one.
 */
export function undoToActiveSeat<
  TConfig,
  TEngine extends GameEngine<DartObservation, MultiSeatState>,
  TResults,
>(
  context: PlayLifecycleContext<TConfig, TEngine, TResults>,
  participantRef: string,
): void {
  if (context.finished) return;
  const engine = context.engine;
  if (!engine) return;
  if (!engine.undo()) return;
  while (
    engine.facts().turns.length > 0 &&
    engine.state().activeParticipantRef !== participantRef
  ) {
    if (!engine.undo()) break;
  }
  clearHiddenTimer(context);
  context.$store.game.recordFacts(engine.facts());
  context.error = "";
}

function defaultBotWait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Drives the bot's whole visit under `VISUAL_BOARD`: one real `playCommitDart`
 * call per dart, for as long as the engine's own active seat stays the bot's.
 * The loop condition is what makes "the bot can hold consecutive turns"
 * (score-compare, one seat finished) and "the bot may have opened the leg"
 * both fall out for free — neither is special-cased here.
 *
 * Two re-entrancy guards, both required (`08-DartBot.md` §Re-entrancy):
 * `context.botThrowing` makes a second concurrent call for the same trigger
 * a no-op, and the active-seat re-check right after `wait(pacing.preThrowMs)`
 * — before recording — abandons the throw if a user action (most likely
 * `undoToActiveSeat`) moved the active seat away from the bot during the
 * delay. Guard 2 is load-bearing on its own; guard 1 only prevents two
 * *overlapping* loops from both reaching guard 2's window at once.
 */
export async function playRunBotVisualBoardVisit<
  TConfig,
  TEngine extends GameEngine<DartObservation, MultiSeatState>,
  TResults,
>(
  context: PlayLifecycleContext<TConfig, TEngine, TResults> & {
    botThrowing: boolean;
  },
  botParticipantRef: string,
  throwDart: BotDartThrower,
  wait: (ms: number) => Promise<void> = defaultBotWait,
): Promise<void> {
  if (context.botThrowing || !context.engine) return;
  if (context.engine.state().activeParticipantRef !== botParticipantRef) return;

  context.botThrowing = true;
  try {
    while (
      !context.finished &&
      context.engine.state().activeParticipantRef === botParticipantRef
    ) {
      const { observation, pacing } = throwDart();
      await wait(pacing.preThrowMs);
      if (
        context.finished ||
        context.engine.state().activeParticipantRef !== botParticipantRef
      ) {
        return;
      }
      await playCommitDart(context, observation);
      await wait(pacing.postThrowMs);
    }
  } finally {
    context.botThrowing = false;
  }
}

/**
 * Feeds `throwDart`'s darts into a throwaway instance of the same ruleset,
 * built from `facts` exactly as a page's own `resumeEngine` rehydrates one —
 * `08-DartBot.md` §The Play Loop's "a scratch engine, never arithmetic in
 * the adapter". The scratch engine is discarded when this returns; only its
 * final visit's `totalScore`/`darts.length` survive, so a QUICK_SCORE bot
 * visit's coordinates never reach any caller.
 *
 * `throwDart` reads the scratch engine's own state — the only way a
 * QUICK_SCORE strategy can re-target between darts without the adapter or
 * DartBot computing a score itself — and always returns a `DartObservation`
 * — the bot throws three real darts internally under every capture mode
 * (§Strategy Layer and Game Coverage) — so the cast below asserts only that
 * every ruleset's own input union already includes `DartObservation` as one
 * of its variants, which `isDartObservationInput` (`turn-log.module.ts`,
 * D241) exists to prove true for every registered engine.
 */
export function playFoldBotQuickScoreVisit<TConfig, TInput, TState>(
  factory: GameEngineFactory<TConfig, TInput, TState>,
  config: TConfig,
  facts: EngineFacts,
  throwDart: BotQuickScoreThrower<TState>,
  dartsPerVisit: number,
): BotQuickScoreFold {
  const scratch = factory.create(config, facts);
  for (let i = 0; i < dartsPerVisit && !scratch.isComplete(); i++) {
    scratch.record(throwDart(scratch.state()) as TInput);
    if (scratch.facts().turns.at(-1)?.completedAt) break;
  }
  const visitTurn = scratch.facts().turns.at(-1)!;
  return {
    totalScore: visitTurn.totalScore,
    dartsThrown: visitTurn.darts.length,
  };
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

const EMPTY_PREVIEW_SEGMENTS: readonly PreviewSegment[] = [
  { status: "empty" },
  { status: "empty" },
  { status: "empty" },
];

/**
 * The open visit's 3-dart preview strip: the last turn's darts classified
 * hit/miss by the caller's own rule, padded to 3 placeholders, or all 3
 * empty once there is no turn yet or its reveal-then-clear timer
 * (`playCommitDart`) has fired. `classify` only runs once a turn exists, so
 * a caller may safely read state that assumes one (e.g. `turns.length - 1`
 * as the current visit's index).
 */
export function playPreviewSegments(
  turns: readonly TurnFact[],
  hiddenTurnKey: string | null,
  classify: (dart: DartFact, index: number) => "hit" | "miss",
): PreviewSegment[] {
  const lastTurn = turns.at(-1);
  if (!lastTurn || lastTurn.clientKey === hiddenTurnKey) {
    return [...EMPTY_PREVIEW_SEGMENTS];
  }
  return [0, 1, 2].map((i) => {
    const dart = lastTurn.darts[i];
    if (!dart) return { status: "empty" };
    return { status: classify(dart, i) };
  });
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
  resolveFinalState: () => ReturnType<TEngine["state"]> | null = () =>
    (context.engine?.state() ?? null) as ReturnType<TEngine["state"]> | null,
): Promise<void> {
  const sessionId = context.$store.game.sessionId!;

  if (!context.$store.game.idempotencyKey) {
    context.$store.game.idempotencyKey = crypto.randomUUID();
  }
  const idempotencyKey = context.$store.game.idempotencyKey;

  context.completionStatus = "saving";
  context.completionError = "";

  const finalState = resolveFinalState();

  try {
    const batch = buildEventsBatch(currentFacts(context));
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
    context.resultsSnapshot = buildResultsSnapshot(finalState);
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
>(
  context: PlayLifecycleContext<TConfig, TEngine, TResults>,
  onAbandoned?: () => void,
): Promise<void> {
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
      const batch = buildEventsBatch(facts);
      await appendBatch(sessionId, context.$store.game.idempotencyKey, batch);
    }
    await completeSession(sessionId, "ABANDONED");
    onAbandoned?.();
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
  TConfig extends object,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
>(
  context: PlayLifecycleContext<TConfig, TEngine, TResults>,
  gameTypeKey: string,
  rulesetVersionKey: RulesetVersionKey,
  narrowEngine: (engine: GameEngine<unknown, unknown>) => TEngine | null,
  buildOverrides?: (
    priorConfig: Seated<TConfig>,
  ) => PlayAgainOverrides<TConfig>,
  resetLocalState?: () => void,
  afterEngineReady?: (engine: TEngine) => void,
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
        participants: participantsFromSeats(config.seats),
      });
    } catch {
      context.playAgainError = "Could not start a new session. Try again.";
      return;
    }

    const seatedSnapshot = reseatSnapshot(
      nextConfigSnapshot,
      session.participants,
    ) as Seated<TConfig>;

    context.$store.game.sessionId = session.sessionId;
    context.$store.game.idempotencyKey = null;
    context.$store.game.configSnapshot = seatedSnapshot;
    context.$store.game.setSessionModes(modePair);

    context.finished = false;
    context.completionStatus = "pending";
    context.completionError = "";
    context.resultsSnapshot = null;
    clearHiddenTimer(context);
    context.error = "";
    context.hasActiveSession = true;
    resetLocalState?.();

    const engine = narrowEngine(factory.create(seatedSnapshot));
    if (!engine) return;
    context.engine = engine;
    context.$store.game.recordFacts(engine.facts());
    afterEngineReady?.(engine);
  } finally {
    context.playAgainLoading = false;
  }
}
