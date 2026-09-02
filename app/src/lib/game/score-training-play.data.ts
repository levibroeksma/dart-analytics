import { ScoreInputBuffer } from "@modules/game/score-input.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { SegmentTimer } from "@modules/ui/segment-timer.module";
import {
  appendBatch,
  completeSession,
  createSession,
  fetchActiveSessions,
} from "@client/api/sessions";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import {
  participantsFromSeats,
  resolveSessionModePair,
  reseatSnapshot,
} from "@lib/game/session-mode-resolution";
import { boardInputData } from "@lib/game/board-input.data";
import { matchWinnerName } from "@lib/game/match-result-text";
import {
  armHiddenTimer,
  clearHiddenTimer,
  playVisitMarkers,
} from "@lib/game/play-lifecycle";
import {
  completedVisitsTotal,
  dartsThrownCount,
  firstNineAverageDisplay,
  highestVisitScore,
  perVisitAverageDisplay,
  previousScoreDisplay,
  visitScoreBandCounts,
} from "@lib/game/play-visit-stats";
import type { RulesetVersionKey } from "@lib/types";
import type {
  DartObservation,
  EngineFacts,
  ScoreTrainingSeatState,
  ScoreTrainingState,
  TurnFact,
} from "@modules/types";
import type {
  BoardMarker,
  ScoreTrainingPlayContext,
  ScoreTrainingResultsSnapshot,
  ScoreTrainingSeatResult,
} from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// scoreTrainingEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import {
  ScoreTrainingEngine,
  foldScoreTrainingState,
} from "@modules/game/score-training.engine.module";

const GAME_TYPE_KEY = "SCORE_TRAINING";
const RULESET_VERSION_KEY: RulesetVersionKey = "SCORE_TRAINING_V1";

function formatRemaining(ms: number | null | undefined): string {
  const totalSeconds = Math.max(0, Math.floor((ms ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * One seat's own results stats, replayed from its own completed visits in
 * `turns` — `total` is read off the already-folded engine state (never
 * recomputed), the rest are derived from that seat's own filtered turns via
 * the shared `play-visit-stats.ts` helpers.
 */
function statsFor(
  seat: ScoreTrainingSeatState,
  turns: readonly TurnFact[],
): ScoreTrainingSeatResult {
  const seatTurns = turns.filter(
    (turn) => turn.participantRef === seat.participantRef,
  );
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    total: completedVisitsTotal(seatTurns),
    threeDartAverage: perVisitAverageDisplay(seatTurns),
    firstNineAverage: firstNineAverageDisplay(seatTurns),
    highestScore: highestVisitScore(seatTurns),
    ...visitScoreBandCounts(seatTurns),
  };
}

/**
 * Rebuilds the engine for the persisted session, replaying the store's fact
 * log so a reload restores the game exactly.
 *
 * Only this page's own ruleset is ever resolved: a store still holding another
 * game's `rulesetVersionKey` must not build that game's engine here, however
 * the shared registry would happily hand one over once every game registers.
 *
 * @returns null when the store holds no config to resume from, when its
 *   ruleset belongs to a different game, when no engine is registered, or when
 *   the registered factory builds something other than a Score Training engine.
 */
function resumeEngine(
  game: ScoreTrainingPlayContext["$store"]["game"],
): ScoreTrainingEngine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (!configSnapshot || rulesetVersionKey !== RULESET_VERSION_KEY) return null;
  const factory = getEngineFactory(RULESET_VERSION_KEY);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof ScoreTrainingEngine ? engine : null;
}

/**
 * Starts the MINUTES countdown, resuming from the persisted remaining time
 * when a prior session left one and starting a fresh segment otherwise.
 * `timerRemainingMs` is set synchronously so the label never renders 00:00
 * while waiting for the timer's first onTick (which fires 1s after start()).
 * Expiry is written to both authorities it governs: the persisted store flag
 * that survives a reload, and the engine, which owns session completion.
 */
function startCountdown(
  game: ScoreTrainingPlayContext["$store"]["game"],
  durationValue: number,
  engine: ScoreTrainingEngine,
): SegmentTimer {
  const resumedRemainingMs = game.timerRemainingMs;
  const durationMinutes =
    resumedRemainingMs != null ? resumedRemainingMs / 60000 : durationValue;

  game.timerRemainingMs = durationMinutes * 60000;
  if (resumedRemainingMs == null) {
    game.timerStartedAt = new Date().toISOString();
  }

  const timer = new SegmentTimer({
    totalMinutes: durationMinutes,
    intervalMinutes: durationMinutes,
    onTick: (secondsRemaining) => {
      game.timerRemainingMs = secondsRemaining * 1000;
    },
    onComplete: () => {
      game.timerExpired = true;
      engine.expireTimer();
    },
  });
  timer.start();
  return timer;
}

/**
 * The engine owns the fact log while a session is live; the store mirrors it.
 * Upload paths that can run without a live engine (a completion retry driven
 * straight from the results modal) fall back to the persisted mirror.
 */
function currentFacts(context: ScoreTrainingPlayContext): EngineFacts {
  return (
    context.engine?.facts() ?? {
      stages: context.$store.game.stages,
      turns: context.$store.game.turns,
    }
  );
}

/**
 * The engine's own state while live; mirrors `currentFacts()`'s own fallback
 * otherwise — a completion retry driven straight from the results modal (no
 * live engine) folds the persisted mirror through the same pure reducer
 * instead of going without a snapshot. Mirrors `tuod-play.data.ts`'s own
 * `finalTuodState`.
 */
function finalScoreTrainingState(
  context: ScoreTrainingPlayContext,
): ScoreTrainingState | null {
  const live = context.state();
  if (live) return live;
  const config = context.$store.game.configSnapshot;
  if (!config) return null;
  return foldScoreTrainingState(
    currentFacts(context),
    config,
    context.$store.game.timerExpired ?? false,
  );
}

/**
 * `self` exists only so `boardInputData`'s `onCommit` callback can reach this
 * page's own `recordDart` with the live, reactive `this` Alpine binds to every
 * directive-driven call (`@click="…"`, `init()`). `onCommit` is built once,
 * synchronously, while this factory's returned object literal is still being
 * constructed — at that point Alpine has not yet wrapped it in `reactive()`,
 * so a callback written as `(observation) => this.recordDart(…)` right here
 * would close over the wrong `this` (this factory's own call-time receiver,
 * never the component) and silently stop updating the DOM for every local
 * field `recordDart` touches (`showFinishConfirm`, `pendingDartObservation`,
 * `error`) — the store mirror would still update, masking the bug in anything
 * that only inspects `$store.game`. `init()` runs through Alpine's own
 * evaluator after the wrap, so assigning `self = this` there captures the real
 * reactive instance in time for the first possible board press, which cannot
 * happen before `hasActiveSession` flips true. Mirrors
 * `five-oh-one-play.data.ts`.
 */
export function scoreTrainingPlay() {
  let self: ScoreTrainingPlayContext;

  return {
    scoreInput: new ScoreInputBuffer({ maxLength: 3 }),
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
    resultsSnapshot: null as ScoreTrainingResultsSnapshot | null,
    pendingFinishScore: null as number | null,
    pendingDartObservation: null as DartObservation | null,
    showFinishConfirm: false,
    engine: null as ScoreTrainingEngine | null,
    timer: null as SegmentTimer | null,
    hiddenTurnKey: null as string | null,
    hiddenTimer: null as ReturnType<typeof setTimeout> | null,
    ...boardInputData((observation) => self.recordDart(observation)),

    /** Overrides `boardInputData`'s own default — object-literal key order
     * means this later definition wins. Delegates to `play-lifecycle.ts`'s
     * shared implementation, mirrors `bobs27-play.data.ts`. */
    visitMarkers(this: ScoreTrainingPlayContext): BoardMarker[] {
      return playVisitMarkers(this);
    },

    state(this: ScoreTrainingPlayContext): ScoreTrainingState | null {
      const config = this.$store.game.configSnapshot;
      if (!config) return null;
      return foldScoreTrainingState(
        { stages: this.$store.game.stages, turns: this.$store.game.turns },
        config,
        this.$store.game.timerExpired ?? false,
      );
    },

    totalScoreFor(this: ScoreTrainingPlayContext, seatRef: string): number {
      const seat = this.state()?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      return seat?.totalScore ?? 0;
    },

    threeDartAverageFor(
      this: ScoreTrainingPlayContext,
      seatRef: string,
    ): string {
      return perVisitAverageDisplay(
        this.$store.game.turns.filter(
          (turn) => turn.participantRef === seatRef,
        ),
      );
    },

    dartsThrownThisLegFor(
      this: ScoreTrainingPlayContext,
      seatRef: string,
    ): number {
      const maxDartsPerTurn =
        this.$store.game.configSnapshot?.maxDartsPerTurn ?? 3;
      return dartsThrownCount(
        this.$store.game.turns.filter(
          (turn) => turn.participantRef === seatRef,
        ),
        maxDartsPerTurn,
      );
    },

    previousScoreThisLegFor(
      this: ScoreTrainingPlayContext,
      seatRef: string,
    ): string {
      return previousScoreDisplay(
        this.$store.game.turns.filter(
          (turn) => turn.participantRef === seatRef,
        ),
      );
    },

    remainingLabel(this: ScoreTrainingPlayContext): string {
      return formatRemaining(this.$store.game.timerRemainingMs);
    },

    threeDartAverage(this: ScoreTrainingPlayContext): string {
      return perVisitAverageDisplay(this.$store.game.turns);
    },

    dartsThrownThisLeg(this: ScoreTrainingPlayContext): number {
      const maxDartsPerTurn =
        this.$store.game.configSnapshot?.maxDartsPerTurn ?? 3;
      return dartsThrownCount(this.$store.game.turns, maxDartsPerTurn);
    },

    previousScoreThisLeg(this: ScoreTrainingPlayContext): string {
      return previousScoreDisplay(this.$store.game.turns);
    },

    /**
     * D88 auto-cleanup via shared reconcileActiveSession helper.
     *
     * On "match", resume silently (no Continue/Abandon modal — that is
     * setup-only): the engine is rebuilt from the persisted facts and the
     * store is written back from `engine.facts()` immediately, so the two
     * agree before any input. On "abandon_failed", stay on the loading/error
     * view rather than flipping to "no active session" as if it were cleaned.
     */
    async init(this: ScoreTrainingPlayContext) {
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

        if (config.durationType === "MINUTES") {
          if (this.$store.game.timerExpired) {
            engine.expireTimer();
          } else {
            this.timer = startCountdown(
              this.$store.game,
              config.durationValue,
              engine,
            );
          }
        }

        this.hasActiveSession = true;
      } catch {
        this.reconciliationFailed = true;
        this.hasActiveSession = false;
      } finally {
        this.loadingReconciliation = false;
      }
    },

    async retryReconciliation(this: ScoreTrainingPlayContext) {
      await this.init();
    },

    destroy(this: ScoreTrainingPlayContext) {
      this.timer?.stop();
    },

    /**
     * The engine is the sole authority on both the score range and completion,
     * including MINUTES-mode timer expiry, which reaches it through
     * `expireTimer()` when the countdown fires rather than through a write to
     * a returned state object. `wouldComplete` gates the finish confirm without
     * mutating the fact log, so a finishing visit is recorded exactly once — by
     * `confirmFinish`, after the player agrees. A score the engine would reject
     * never reports as completing, so it falls through to `record` and surfaces
     * its error.
     */
    async submitVisit(this: ScoreTrainingPlayContext) {
      if (!this.engine || this.finished || this.showFinishConfirm) return;
      this.loading = true;

      const score = Number(this.scoreInput.value);

      if (this.engine.wouldComplete(score)) {
        this.error = "";
        this.pendingFinishScore = score;
        this.scoreInput.clear();
        this.showFinishConfirm = true;
        this.loading = false;
        return;
      }

      try {
        this.engine.record(score);
      } catch (err: unknown) {
        this.error = (err as Error).message;
        this.loading = false;
        return;
      }

      this.error = "";
      this.scoreInput.clear();
      this.$store.game.recordFacts(this.engine.facts());
      this.loading = false;
    },

    /**
     * The board's per-dart counterpart to `submitVisit`: every dart the player
     * throws, including an unseen one, arrives here from `boardInputData`'s
     * `onCommit`.
     *
     * A dart that would close the session's last visit is deferred to the same
     * finish confirm a keypad total is, for the same reason: `confirmFinish`
     * uploads the fact log and PATCHes the session COMPLETED, which is
     * irreversible. Every other dart records immediately — Score Training has
     * no double-out and no bust, so a dart's zone is never ambiguous the way
     * 501's typed checkout total is, and there is nothing else to ask about.
     *
     * Completion is deliberately never inferred after recording, the way
     * 501's `commitDart` infers it from `isComplete()`. A Score Training
     * engine can already be complete before any input at all — MINUTES mode,
     * once the countdown has fired — so a post-record `isComplete()` check
     * would upload and finish on the first dart of a fresh visit, mid-visit.
     * Only `wouldComplete`, which requires an open visit already holding two
     * darts, may end the session, matching what `submitVisit` already does for
     * the keypad.
     */
    recordDart(this: ScoreTrainingPlayContext, observation: DartObservation) {
      if (!this.engine || this.finished || this.showFinishConfirm) return;

      if (this.engine.wouldComplete(observation)) {
        this.pendingDartObservation = observation;
        this.showFinishConfirm = true;
        return;
      }

      this.engine.record(observation);
      this.error = "";
      this.$store.game.recordFacts(this.engine.facts());
      armHiddenTimer(this, this.$store.game.turns);
    },

    /**
     * Records whichever input the player was deferred on — the board's dart
     * (`recordDart`'s gate) or the keypad's total (`submitVisit`'s) — then
     * finishes and uploads, so the record → mirror → complete sequence exists
     * once for both input modes. `??` picks the dart first and still reads a
     * `pendingFinishScore` of 0 correctly, since only null falls through.
     */
    async confirmFinish(this: ScoreTrainingPlayContext) {
      if (!this.engine || this.finished || !this.showFinishConfirm) return;

      const input = this.pendingDartObservation ?? this.pendingFinishScore;
      if (input === null) return;

      this.pendingDartObservation = null;
      this.pendingFinishScore = null;
      this.showFinishConfirm = false;

      this.engine.record(input);
      this.$store.game.recordFacts(this.engine.facts());

      this.finished = true;
      this.completionStatus = "pending";
      await this.uploadAndCompleteSession();
    },

    /**
     * Cancel on the finish confirm. A deferred keypad total returns to the
     * keypad so a mistyped entry is not lost; a deferred dart has no buffer to
     * return to — the player simply throws again — so it is discarded.
     */
    cancelFinish(this: ScoreTrainingPlayContext) {
      if (!this.showFinishConfirm) return;

      if (this.pendingDartObservation !== null) {
        this.pendingDartObservation = null;
        this.showFinishConfirm = false;
        return;
      }

      if (this.pendingFinishScore == null) return;
      this.scoreInput.setValue(String(this.pendingFinishScore));
      this.pendingFinishScore = null;
      this.showFinishConfirm = false;
    },

    undoVisit(this: ScoreTrainingPlayContext) {
      if (this.finished || this.showFinishConfirm) return;
      if (!this.engine || !this.engine.undo()) return;

      clearHiddenTimer(this);
      this.$store.game.recordFacts(this.engine.facts());
      this.scoreInput.clear();
      this.error = "";
    },

    /**
     * Uploads the fact log, then marks the session COMPLETED. On this path
     * only, SESSION_ALREADY_COMPLETED counts as success — it covers "PATCH
     * reached the server, the client never saw the response". Stats are copied
     * into `resultsSnapshot` before any store mutation, so the results modal
     * never depends on `$store.game.turns` surviving a later reset.
     */
    async uploadAndCompleteSession(
      this: ScoreTrainingPlayContext,
    ): Promise<void> {
      const sessionId = this.$store.game.sessionId!;

      if (!this.$store.game.idempotencyKey) {
        this.$store.game.idempotencyKey = crypto.randomUUID();
      }
      const idempotencyKey = this.$store.game.idempotencyKey;

      this.completionStatus = "saving";
      this.completionError = "";

      try {
        const batch = buildEventsBatch(currentFacts(this));

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

      const finalState = finalScoreTrainingState(this);
      if (finalState) {
        this.resultsSnapshot = {
          status: finalState.status === "TIE" ? "TIE" : "COMPLETE",
          winningSideKey: finalState.winningSideKey,
          seats: finalState.seats.map((seat) =>
            statsFor(seat, this.$store.game.turns),
          ),
        };
      }
      this.completionStatus = "succeeded";
    },

    resultsTitle(this: ScoreTrainingPlayContext): string {
      if (this.resultsSnapshot?.status === "TIE") return "Tie — same total!";
      const winner = matchWinnerName(
        this.$store.game.seats,
        this.resultsSnapshot?.winningSideKey ?? null,
      );
      return winner ? `${winner} wins — highest total!` : "Game Summary";
    },

    async back(this: ScoreTrainingPlayContext) {
      this.$store.game.reset();
      globalThis.location.href = "/games";
    },

    async abandonAndExit(this: ScoreTrainingPlayContext) {
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
          const batch = buildEventsBatch(facts);
          await appendBatch(sessionId, this.$store.game.idempotencyKey, batch);
        }
        await completeSession(sessionId, "ABANDONED");
        this.timer?.stop();
        this.$store.game.reset();
        globalThis.location.href = "/games";
      } catch {
        this.error = "Could not abandon session. Try again.";
        this.$store.game.loading = false;
      }
    },

    /**
     * Replays the same configuration template the first session used, so the
     * new session's provenance on the server matches rather than drifting to
     * an inline copy. Store and UI are mutated only once the new session
     * exists: on failure the modal stays open with the results visible and the
     * buttons enabled, since the prior session is already COMPLETED.
     */
    async playAgain(this: ScoreTrainingPlayContext) {
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
            config: {
              source: "template",
              templateRef,
              overrides: { duration_value: config.durationValue },
            },
            participants: participantsFromSeats(config.seats),
          });
        } catch {
          this.playAgainError = "Could not start a new session. Try again.";
          return;
        }

        const seatedSnapshot = reseatSnapshot(config, session.participants);

        this.$store.game.sessionId = session.sessionId;
        this.$store.game.configSnapshot = seatedSnapshot;
        this.$store.game.idempotencyKey = null;
        this.$store.game.setSessionModes(modePair);
        this.$store.game.timerRemainingMs = null;
        this.$store.game.timerStartedAt = null;
        this.$store.game.timerExpired = false;

        this.finished = false;
        this.completionStatus = "pending";
        this.completionError = "";
        this.resultsSnapshot = null;
        this.pendingFinishScore = null;
        this.pendingDartObservation = null;
        this.showFinishConfirm = false;
        clearHiddenTimer(this);
        this.scoreInput.clear();
        this.error = "";
        this.hasActiveSession = true;

        const engine = factory.create(seatedSnapshot);
        if (!(engine instanceof ScoreTrainingEngine)) return;
        this.engine = engine;
        this.$store.game.recordFacts(engine.facts());

        if (config.durationType === "MINUTES") {
          this.timer?.stop();
          this.timer = startCountdown(
            this.$store.game,
            config.durationValue,
            engine,
          );
        }
      } finally {
        this.playAgainLoading = false;
      }
    },
  };
}
