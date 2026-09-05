import { getEngineFactory } from "@modules/game/engine.registry";
import { matchWinnerName } from "@lib/game/match-result-text";
import { ScoreInputBuffer } from "@modules/game/score-input.module";
import { checkoutDartOptions } from "@modules/game/checkout-darts.module";
import { checkoutPathFor } from "@modules/game/checkout-path.module";
import { SegmentTimer } from "@modules/ui/segment-timer.module";
import { fetchActiveSessions } from "@client/api/sessions";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import { boardInputData } from "@lib/game/board-input.data";
import {
  clearHiddenTimer,
  playAbandonAndExit,
  playBack,
  playCommitDart,
  playFoldBotQuickScoreVisit,
  playRunBotVisualBoardVisit,
  playUploadAndCompleteSession,
  playVisitMarkers,
  runPlayAgain,
  undoToActiveSeat,
} from "@lib/game/play-lifecycle";
import { skillProfileForLevel } from "@modules/dartbot/skill-profile.module";
import { createDartRng } from "@modules/dartbot/rng.module";
import { throwDart as botThrowDart } from "@modules/dartbot/throw-engine.module";
import { chooseTarget } from "@modules/dartbot/strategy/x01.strategy.module";
import { accuracyDisplay } from "@lib/game/play-visit-stats";
import {
  classifyDoubleAttempts,
  type CheckoutVisitDarts,
} from "@modules/game/double-attempt.module";
import { turnsBeforeVisit } from "@modules/game/turn-log.module";
import type {
  RulesetVersionKey,
  Seated,
  SeatFact,
  TuodSnapshot,
} from "@lib/types";
import type {
  CheckoutDartOptions,
  DartCount,
  DartObservation,
  EngineFacts,
  TuodAttemptInput,
  TuodSeatState,
  TuodState,
  TurnFact,
} from "@modules/types";
import type {
  BoardMarker,
  BotDartThrower,
  BotPacing,
  TuodPlayContext,
  TuodResultsSnapshot,
  TuodSeatResult,
} from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// tuodEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY. `tuodEngineFactory` is imported directly (not via the
// type-erased registry) so `playFoldBotQuickScoreVisit`'s `TState` infers as
// `TuodState` with no cast at the call site.
import {
  TuodEngine,
  foldTuodState,
  tuodEngineFactory,
} from "@modules/game/tuod.engine.module";

const GAME_TYPE_KEY = "TUOD";
const RULESET_VERSION_KEY: RulesetVersionKey = "TUOD_V1";

const BOT_PRE_THROW_MS = 900;
const BOT_POST_THROW_MS = 250;
const DARTS_PER_VISIT = 3;

type DartbotSeat = Extract<SeatFact, { participantTypeKey: "DARTBOT" }>;

function findBotSeat(seats: readonly SeatFact[]): DartbotSeat | undefined {
  return seats.find(
    (seat): seat is DartbotSeat => seat.participantTypeKey === "DARTBOT",
  );
}

function botDartIndex(turns: readonly TurnFact[], botRef: string): number {
  return turns
    .filter((turn) => turn.participantRef === botRef)
    .reduce((sum, turn) => sum + turn.darts.length, 0);
}

function throwOneDart(
  remaining: number,
  botSeat: DartbotSeat,
  dartIndex: number,
): DartObservation {
  const profile = skillProfileForLevel(botSeat.dartbot.level);
  const rng = createDartRng(botSeat.dartbot.seed, dartIndex);
  const intent = chooseTarget(
    { remaining, checkoutPath: checkoutPathFor(remaining) },
    profile.decisionQuality,
  );
  const thrown = botThrowDart(intent, profile, rng);
  return {
    hitTargetNumber: thrown.hit.targetNumber,
    hitZoneKey: thrown.hit.zoneKey,
    locationX: thrown.landing.x,
    locationY: thrown.landing.y,
  };
}

/** VISUAL_BOARD thrower: TUOD's "remaining" for a fresh attempt is the
 * seat's own `currentTarget` — an attempt always starts at the ladder
 * target, unlike 121/501's visit-to-visit carry. Reads the typed state
 * directly (never the formatted `currentTargetLabelFor` display helper). */
function throwBotDart(
  context: TuodPlayContext,
  botSeat: DartbotSeat,
): { observation: DartObservation; pacing: BotPacing } {
  const seat = context
    .state()
    ?.seats.find(
      (candidate) => candidate.participantRef === botSeat.participantRef,
    );
  const dartIndex = botDartIndex(
    context.$store.game.turns,
    botSeat.participantRef,
  );
  return {
    observation: throwOneDart(seat?.currentTarget ?? 0, botSeat, dartIndex),
    pacing: { preThrowMs: BOT_PRE_THROW_MS, postThrowMs: BOT_POST_THROW_MS },
  };
}

/** QUICK_SCORE thrower: `state` is the scratch engine's own live state,
 * never the real engine's — mirrors `five-oh-one-play.data.ts`. */
function throwBotQuickScoreDart(
  state: TuodState,
  botSeat: DartbotSeat,
  dartIndex: number,
): DartObservation {
  const remaining = state.seats.find(
    (seat) => seat.participantRef === botSeat.participantRef,
  )!.currentTarget;
  return throwOneDart(remaining, botSeat, dartIndex);
}

function formatRemaining(ms: number | null | undefined): string {
  const totalSeconds = Math.max(0, Math.floor((ms ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Rebuilds the engine for the persisted session, replaying the store's fact
 * log so a reload restores the ladder exactly. Mirrors
 * `score-training-play.data.ts`'s `resumeEngine`.
 */
function resumeEngine(
  game: TuodPlayContext["$store"]["game"],
): TuodEngine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (!configSnapshot || rulesetVersionKey !== RULESET_VERSION_KEY) return null;
  const factory = getEngineFactory(RULESET_VERSION_KEY);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof TuodEngine ? engine : null;
}

/**
 * One seat's checkout visits, each carrying the target it opened against --
 * folded via `foldTuodState` over every turn strictly before it, mirroring
 * `TuodEngine`'s own (private) `targetBeforeVisit`. `timerExpired` is always
 * `false` here: every visit folded this way is already closed, and a closed
 * visit's own `currentTarget` never depends on the live timer flag.
 */
function tuodCheckoutVisits(
  seatTurns: readonly TurnFact[],
  facts: EngineFacts,
  config: Seated<TuodSnapshot>,
  participantRef: string,
): CheckoutVisitDarts[] {
  return seatTurns.map((visit) => ({
    startingRemaining: foldTuodState(
      { stages: facts.stages, turns: turnsBeforeVisit(facts.turns, visit) },
      config,
      false,
    ).seats.find((seat) => seat.participantRef === participantRef)!
      .currentTarget,
    darts: visit.darts,
  }));
}

function statsFor(
  seat: TuodSeatState,
  facts: EngineFacts,
  config: Seated<TuodSnapshot>,
  inputModeKey: string | null,
): TuodSeatResult {
  const seatTurns = facts.turns.filter(
    (turn) => turn.participantRef === seat.participantRef,
  );
  const doubleAccuracy = (() => {
    if (inputModeKey !== "VISUAL_BOARD") return null;
    const { hits, misses } = classifyDoubleAttempts(
      tuodCheckoutVisits(seatTurns, facts, config, seat.participantRef),
    );
    return accuracyDisplay(hits, hits + misses);
  })();
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    target: seat.currentTarget,
    doubleAccuracy,
  };
}

/**
 * `status` collapses the engine's own three-way `status` to the two
 * outcomes a finished session can report, so a genuine TIE (both seats
 * reach the same target) stays distinguishable from a solo session even
 * though both leave `winningSideKey` `null`: solo sessions never see `TIE`
 * from the engine (score-compare only runs seats.length >= 2), so this
 * collapse is safe.
 */
function computeStats(
  state: TuodState,
  facts: EngineFacts,
  config: Seated<TuodSnapshot>,
  inputModeKey: string | null,
): TuodResultsSnapshot {
  return {
    winningSideKey: state.winningSideKey,
    status: state.status === "TIE" ? "TIE" : "COMPLETE",
    seats: state.seats.map((seat) =>
      statsFor(seat, facts, config, inputModeKey),
    ),
  };
}

/**
 * Starts the MINUTES countdown, resuming from the persisted remaining time
 * when a prior session left one and starting a fresh segment otherwise.
 * Mirrors `score-training-play.data.ts`'s `startCountdown`.
 */
function startCountdown(
  game: TuodPlayContext["$store"]["game"],
  durationValue: number,
  engine: TuodEngine,
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
 * `self` exists only so `boardInputData`'s `onCommit` callback can reach this
 * page's own `recordDart` with the live, reactive `this` Alpine binds to every
 * directive-driven call — mirrors `one-twenty-one-play.data.ts`'s own `self`
 * pattern.
 */
export function tuodPlay() {
  let self: TuodPlayContext;

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
    resultsSnapshot: null as TuodResultsSnapshot | null,
    scoreInput: new ScoreInputBuffer({ maxLength: 3 }),
    pendingAttempt: null as TuodAttemptInput | null,
    pendingCheckoutScore: null as number | null,
    pendingDartObservation: null as DartObservation | null,
    dartsAtDouble: null as DartCount | null,
    dartsToFinish: null as DartCount | null,
    showDoubleConfirm: false,
    showFinishConfirm: false,
    botThrowing: false,
    engine: null as TuodEngine | null,
    timer: null as SegmentTimer | null,
    hiddenTurnKey: null as string | null,
    hiddenTimer: null as ReturnType<typeof setTimeout> | null,
    ...boardInputData((observation) => self.recordDart(observation)),

    /** Overrides `boardInputData`'s own default — object-literal key order
     * means this later definition wins. Delegates to `play-lifecycle.ts`'s
     * shared implementation, mirrors `bobs27-play.data.ts`. */
    visitMarkers(this: TuodPlayContext): BoardMarker[] {
      return playVisitMarkers(this);
    },

    /**
     * Folds the store's own fact log — never `engine.state()` — so every
     * Alpine display expression that calls this re-renders when
     * `recordFacts` writes a new turn. The engine is a plain class instance;
     * its internal mutations carry no Alpine reactivity (see
     * `07-Frontend/03-Alpine-Patterns.md`'s reactive-store convention).
     */
    state(this: TuodPlayContext): TuodState | null {
      const config = this.$store.game.configSnapshot;
      if (!config) return null;
      return foldTuodState(
        { stages: this.$store.game.stages, turns: this.$store.game.turns },
        config,
        this.$store.game.timerExpired ?? false,
      );
    },

    currentTargetLabelFor(this: TuodPlayContext, seatRef: string): string {
      const seat = this.state()?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      return seat ? String(seat.currentTarget) : "";
    },

    currentTargetLabel(this: TuodPlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.currentTargetLabelFor(state.activeParticipantRef);
    },

    checkoutHintFor(this: TuodPlayContext, seatRef: string): string {
      if (this.$store.checkoutHints?.enabled === false) return "";
      const seat = this.state()?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      const path = seat ? checkoutPathFor(seat.currentTarget) : null;
      return path ? path.join(" ") : "";
    },

    checkoutHint(this: TuodPlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.checkoutHintFor(state.activeParticipantRef);
    },

    remainingLabel(this: TuodPlayContext): string {
      return formatRemaining(this.$store.game.timerRemainingMs);
    },

    /**
     * Which dart counts the checkout confirm may offer. The score being
     * finished is the target the attempt was thrown at, held in
     * `pendingCheckoutScore` while the dialog is open — the ladder has not
     * moved yet, so reading it back off the engine would give the same
     * number, but only until the attempt is recorded.
     */
    checkoutDartOptions(this: TuodPlayContext): CheckoutDartOptions {
      const maxDartsPerTurn =
        this.$store.game.configSnapshot?.maxDartsPerTurn ?? 3;
      return checkoutDartOptions(
        this.pendingCheckoutScore ?? 0,
        maxDartsPerTurn,
      );
    },

    /**
     * D88 auto-cleanup via shared reconcileActiveSession helper. On "match",
     * resume silently: the engine is rebuilt from the persisted facts and the
     * store is written back from `engine.facts()` immediately.
     */
    async init(this: TuodPlayContext) {
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
        await this.maybeRunBotVisit();
      } catch {
        this.reconciliationFailed = true;
        this.hasActiveSession = false;
      } finally {
        this.loadingReconciliation = false;
      }
    },

    async retryReconciliation(this: TuodPlayContext) {
      await this.init();
    },

    destroy(this: TuodPlayContext) {
      this.timer?.stop();
    },

    /**
     * Submits the typed visit total. TUOD's only meaningful total is the
     * target itself — that is what a checkout scores — so an entry that
     * matches the target opens the checkout confirm and every other entry is
     * a failed attempt, recorded straight away. A target the checkout chart
     * has no route for can never be checked out, so it skips the dialog the
     * same way 501 skips it for a bogey number.
     */
    async submitVisit(this: TuodPlayContext): Promise<void> {
      if (
        !this.engine ||
        this.finished ||
        this.showDoubleConfirm ||
        this.showFinishConfirm
      )
        return;

      const score = Number(this.scoreInput.value);
      const activeState = this.state();
      const target =
        activeState?.seats.find(
          (seat) => seat.participantRef === activeState.activeParticipantRef,
        )?.currentTarget ?? 0;

      if (score === target && checkoutPathFor(target) !== null) {
        this.error = "";
        this.pendingCheckoutScore = score;
        this.scoreInput.clear();
        const options = this.checkoutDartOptions();
        this.dartsAtDouble = options.atDouble[0];
        this.dartsToFinish = options.toFinish[0];
        this.showDoubleConfirm = true;
        return;
      }

      await this.recordAttempt({ checkedOut: false });
    },

    /** "Confirm" on the checkout dialog: a checkout finished on a double. */
    async confirmDouble(this: TuodPlayContext): Promise<void> {
      if (!this.showDoubleConfirm || this.pendingCheckoutScore == null) return;
      this.pendingCheckoutScore = null;
      this.showDoubleConfirm = false;
      await this.recordAttempt({
        checkedOut: true,
        finishedOnDouble: true,
        dartsUsed: this.dartsToFinish ?? undefined,
        dartsAtDouble: this.dartsAtDouble ?? undefined,
      });
    },

    /**
     * Cancel on the checkout dialog: nothing is recorded and the typed total
     * goes back into the keypad, so a mistyped entry is not lost.
     */
    cancelCheckout(this: TuodPlayContext) {
      if (!this.showDoubleConfirm || this.pendingCheckoutScore == null) return;
      this.scoreInput.setValue(String(this.pendingCheckoutScore));
      this.pendingCheckoutScore = null;
      this.dartsAtDouble = null;
      this.dartsToFinish = null;
      this.showDoubleConfirm = false;
    },

    /**
     * Folds one resolved attempt into the engine's fact log. Shared by the
     * plain-failure path (`submitVisit`) and the checkout confirm
     * (`confirmDouble`) so the record → mirror sequence exists
     * exactly once. `wouldComplete` defers a session-ending attempt to the
     * finish confirm exactly as every other quick-score game does.
     */
    async recordAttempt(
      this: TuodPlayContext,
      input: TuodAttemptInput,
    ): Promise<void> {
      if (!this.engine || this.finished || this.showFinishConfirm) return;

      if (this.engine.wouldComplete(input)) {
        this.error = "";
        this.pendingAttempt = input;
        this.showFinishConfirm = true;
        return;
      }

      try {
        this.engine.record(input);
      } catch (err: unknown) {
        this.error = (err as Error).message;
        return;
      }

      this.error = "";
      this.scoreInput.clear();
      this.dartsAtDouble = null;
      this.dartsToFinish = null;
      this.$store.game.recordFacts(this.engine.facts());
      await this.maybeRunBotVisit();
    },

    async maybeRunBotVisit(this: TuodPlayContext) {
      const botSeat = findBotSeat(this.$store.game.seats);
      if (!botSeat || !this.engine || this.finished) return;
      const state = this.state();
      if (!state || state.activeParticipantRef !== botSeat.participantRef)
        return;

      if (this.$store.game.inputModeKey === "QUICK_SCORE") {
        const target = state.seats.find(
          (seat) => seat.participantRef === botSeat.participantRef,
        )!.currentTarget;
        let dartIndex = botDartIndex(
          this.$store.game.turns,
          botSeat.participantRef,
        );
        const fold = playFoldBotQuickScoreVisit(
          tuodEngineFactory,
          this.$store.game.configSnapshot!,
          this.engine.facts(),
          (scratchState) =>
            throwBotQuickScoreDart(scratchState, botSeat, dartIndex++),
          DARTS_PER_VISIT,
        );
        await this.recordAttempt({
          checkedOut: fold.totalScore === target,
          finishedOnDouble: fold.totalScore === target,
        });
        return;
      }

      const thrower: BotDartThrower = () => throwBotDart(this, botSeat);
      await playRunBotVisualBoardVisit(this, botSeat.participantRef, thrower);
    },

    /**
     * The board's per-dart counterpart to `recordAttempt`: every dart the
     * player throws arrives here from `boardInputData`'s `onCommit`. A dart
     * that would end the session is gated behind `showFinishConfirm` — the
     * same dialog the keypad path defers to — because recording it uploads
     * and completes the session immediately and that step is irreversible;
     * any other dart commits straight away. Mirrors
     * `one-twenty-one-play.data.ts`'s `recordDart`.
     */
    async recordDart(
      this: TuodPlayContext,
      observation: DartObservation,
    ): Promise<void> {
      if (!this.engine || this.finished || this.showFinishConfirm) return;

      if (this.engine.wouldComplete(observation)) {
        this.error = "";
        this.pendingDartObservation = observation;
        this.showFinishConfirm = true;
        return;
      }

      await this.commitDart(observation);
    },

    async commitDart(
      this: TuodPlayContext,
      observation: DartObservation,
    ): Promise<void> {
      await playCommitDart(this, observation);
      await this.maybeRunBotVisit();
    },

    async confirmFinish(this: TuodPlayContext): Promise<void> {
      if (!this.engine || this.finished || !this.showFinishConfirm) return;

      if (this.pendingDartObservation) {
        const observation = this.pendingDartObservation;
        this.pendingDartObservation = null;
        this.showFinishConfirm = false;
        await this.commitDart(observation);
        return;
      }

      if (this.pendingAttempt === null) return;
      const input = this.pendingAttempt;
      this.pendingAttempt = null;
      this.showFinishConfirm = false;

      this.engine.record(input);
      this.scoreInput.clear();
      this.dartsAtDouble = null;
      this.dartsToFinish = null;
      this.$store.game.recordFacts(this.engine.facts());

      this.finished = true;
      this.completionStatus = "pending";
      await this.uploadAndCompleteSession();
    },

    cancelFinish(this: TuodPlayContext) {
      if (!this.showFinishConfirm) return;
      this.pendingAttempt = null;
      this.pendingDartObservation = null;
      this.showFinishConfirm = false;
    },

    undoVisit(this: TuodPlayContext) {
      if (this.finished || this.showDoubleConfirm || this.showFinishConfirm)
        return;
      if (!this.engine) return;
      const botSeat = findBotSeat(this.$store.game.seats);
      if (botSeat) {
        const humanSeat = this.$store.game.seats.find(
          (seat) => seat.participantTypeKey === "PLAYER",
        )!;
        undoToActiveSeat(this, humanSeat.participantRef);
      } else {
        if (!this.engine.undo()) return;
        clearHiddenTimer(this);
        this.$store.game.recordFacts(this.engine.facts());
      }
      this.scoreInput.clear();
      this.error = "";
      void this.maybeRunBotVisit();
    },

    async uploadAndCompleteSession(this: TuodPlayContext): Promise<void> {
      return playUploadAndCompleteSession(
        this,
        (finalState) =>
          computeStats(
            finalState,
            { stages: this.$store.game.stages, turns: this.$store.game.turns },
            this.$store.game.configSnapshot!,
            this.$store.game.inputModeKey,
          ),
        () => this.state(),
      );
    },

    resultsTitle(this: TuodPlayContext): string {
      if (this.resultsSnapshot?.status === "TIE") return "Tie — same target!";
      const winner = matchWinnerName(
        this.$store.game.seats,
        this.resultsSnapshot?.winningSideKey ?? null,
      );
      return winner ? `${winner} wins — highest target!` : "Game Summary";
    },

    async back(this: TuodPlayContext) {
      return playBack(this);
    },

    async abandonAndExit(this: TuodPlayContext) {
      return playAbandonAndExit(this, () => this.timer?.stop());
    },

    /**
     * Replays with the session's own duration as an override — the same
     * carry-over `score-training-play.data.ts`'s `playAgain()` does.
     * Delegates to `play-lifecycle.ts`'s shared `runPlayAgain`. Unlike
     * 501/121/Score Training's own `playAgain`, this reset callback does not
     * call `scoreInput.clear()` — preserved exactly as this file's own
     * pre-existing asymmetry, not added or removed by this refactor.
     */
    async playAgain(this: TuodPlayContext) {
      await runPlayAgain(
        this,
        GAME_TYPE_KEY,
        RULESET_VERSION_KEY,
        (engine) => (engine instanceof TuodEngine ? engine : null),
        (config) => ({
          snapshot: config,
          wire: { duration_value: config.durationValue },
        }),
        () => {
          this.$store.game.timerRemainingMs = null;
          this.$store.game.timerStartedAt = null;
          this.$store.game.timerExpired = false;
          this.pendingAttempt = null;
          this.pendingDartObservation = null;
          this.showFinishConfirm = false;
        },
        (engine) => {
          const config = this.$store.game.configSnapshot;
          if (config?.durationType === "MINUTES") {
            this.timer?.stop();
            this.timer = startCountdown(
              this.$store.game,
              config.durationValue,
              engine,
            );
          }
        },
      );
    },
  };
}
