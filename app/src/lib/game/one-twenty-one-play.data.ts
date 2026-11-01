import {
  activeBotTurn,
  botDartObservationAt,
  botThrowObservation,
  x01BotIntent,
} from "@lib/game/play-bot-seat";
import { playAgainStarterData } from "@lib/game/play-again-starter";
import { ScoreInputBuffer } from "@modules/game/score-input.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import { foldOneTwentyOneState } from "@modules/game/one-twenty-one.engine.module";
import {
  checkoutPathFor,
  checkoutPathWithin,
} from "@modules/game/checkout-path.module";
import { checkoutDartOptions } from "@modules/game/checkout-darts.module";
import {
  formatRemaining,
  maybeResumeCountdown,
  restartCountdown,
} from "@lib/game/play-countdown";
import { boardInputData } from "@lib/game/board-input.data";
import {
  confirmCheckout,
  openCheckoutConfirm,
  playScreenActions,
  playScreenState,
  recordCheckoutVisit,
  resetTimerStoreFields,
  restoreCheckoutScore,
  timedPlayData,
} from "@lib/game/play-screen.data";
import {
  playCommitDart,
  playInit,
  playRunBotVisualBoardVisit,
  playUploadAndCompleteSession,
  runPlayAgain,
  isInputBlocked,
  undoBotAwareVisit,
  playBotQuickScoreVisit,
} from "@lib/game/play-lifecycle";
import {
  checkoutPercentageDisplay,
  dartsLeftForSeat,
} from "@lib/game/play-visit-stats";
import { joinSubtitle } from "@lib/game/play-subtitle";
import { classifyDoubleAttempts } from "@modules/game/double-attempt.module";
import { oneTwentyOneCheckoutVisits } from "@modules/game/checkout-visits.module";
import { matchWinnerName } from "@lib/game/match-result-text";
import type { DartbotSeat, RulesetVersionKey } from "@lib/types";
import type {
  CheckoutDartOptions,
  DartCount,
  DartObservation,
  OneTwentyOneSeatState,
  OneTwentyOneState,
  StageFact,
  TurnFact,
} from "@modules/types";
import type {
  BotDartThrower,
  BotPacing,
  CountdownConfig,
  OneTwentyOneDurationType,
  OneTwentyOnePlayContext,
  OneTwentyOneResultsSnapshot,
  OneTwentyOneSeatResult,
} from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// oneTwentyOneEngineFactory so the registry can resolve either ruleset
// version this shared play page might be resuming.
import {
  OneTwentyOneEngine,
  oneTwentyOneEngineFactory,
} from "@modules/game/one-twenty-one.engine.module";

const GAME_TYPE_KEY = "ONE_TWENTY_ONE";
const DARTS_PER_VISIT = 3;

/** Three visits make one 121 attempt, so an attempt is nine darts. */
const DARTS_PER_ATTEMPT = 3 * DARTS_PER_VISIT;

/** VISUAL_BOARD thrower: reads the real engine's own live `state()` —
 * `remainingInAttemptFor` already folds an open visit's running total. */
function throwBotDart(
  context: OneTwentyOnePlayContext,
  botSeat: DartbotSeat,
): { observation: DartObservation; pacing: BotPacing } {
  return botThrowObservation(
    botSeat,
    context.$store.game.turns,
    x01BotIntent(
      context.remainingInAttemptFor(botSeat.participantRef),
      botSeat,
    ),
  );
}

/** QUICK_SCORE thrower: `state` is the scratch engine's own live state,
 * never the real engine's — mirrors `five-oh-one-play.data.ts`. */
function throwBotQuickScoreDart(
  state: OneTwentyOneState,
  botSeat: DartbotSeat,
  dartIndex: number,
): DartObservation {
  const remaining = state.seats.find(
    (seat) => seat.participantRef === botSeat.participantRef,
  )!.remainingInAttempt;
  return botDartObservationAt(
    botSeat,
    dartIndex,
    x01BotIntent(remaining, botSeat),
  );
}

const RESUMABLE_RULESET_VERSIONS = new Set(["121_V1", "121_V2"]);

/**
 * Rebuilds the engine for the persisted session, replaying the store's fact
 * log so a reload restores the game exactly. Accepts either ruleset version
 * — both build the same `OneTwentyOneEngine` class (Pattern 18) — since
 * `/games/121/play` is shared between them.
 */
function resumeEngine(
  game: OneTwentyOnePlayContext["$store"]["game"],
): OneTwentyOneEngine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (
    !configSnapshot ||
    !rulesetVersionKey ||
    !RESUMABLE_RULESET_VERSIONS.has(rulesetVersionKey)
  )
    return null;
  const factory = getEngineFactory(rulesetVersionKey);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof OneTwentyOneEngine ? engine : null;
}

/**
 * Normalizes either ruleset version's config into `durationType`, mirroring
 * the engine's own `durationOf()` — `121_V1`'s snapshot carries no duration
 * fields at all, so it always reads `TARGET`.
 */
function durationTypeOf(
  config: OneTwentyOnePlayContext["$store"]["game"]["configSnapshot"],
): OneTwentyOneDurationType {
  if (config && "durationType" in config) return config.durationType;
  return "TARGET";
}

function durationValueOf(
  config: OneTwentyOnePlayContext["$store"]["game"]["configSnapshot"],
): number | null {
  if (config && "durationType" in config && config.durationType !== "TARGET") {
    return config.durationValue ?? null;
  }
  return null;
}

/** The config's countdown fields, in the shape `play-countdown.ts` reads. */
function countdownConfigOf(
  config: NonNullable<
    OneTwentyOnePlayContext["$store"]["game"]["configSnapshot"]
  >,
): CountdownConfig {
  return {
    durationType: durationTypeOf(config),
    durationValue: durationValueOf(config),
  };
}

/**
 * Whether `playAgain` may proceed once a config, template, and ruleset key
 * are already known to exist: the ruleset is one this shared play page can
 * resume, and no replay is already in flight. Named so the call site reads
 * as one decision rather than folding these two checks into the same
 * five-term condition as the null guards above it.
 */
function canReplay(
  rulesetVersionKey: RulesetVersionKey,
  playAgainLoading: boolean,
): boolean {
  return RESUMABLE_RULESET_VERSIONS.has(rulesetVersionKey) && !playAgainLoading;
}

type OneTwentyOneConfig = NonNullable<
  OneTwentyOnePlayContext["$store"]["game"]["configSnapshot"]
>;

function statsFor(
  seat: OneTwentyOneSeatState,
  stages: StageFact[],
  turns: readonly TurnFact[],
  config: OneTwentyOneConfig,
  inputModeKey: string | null,
): OneTwentyOneSeatResult {
  const seatTurns = turns.filter(
    (turn) => turn.participantRef === seat.participantRef,
  );
  const total = seatTurns.reduce((sum, turn) => sum + turn.totalScore, 0);
  const checkoutPercentage = (() => {
    if (inputModeKey !== "VISUAL_BOARD") return null;
    const { hits, misses } = classifyDoubleAttempts(
      oneTwentyOneCheckoutVisits(
        seatTurns,
        stages,
        turns,
        config,
        seat.participantRef,
      ),
    );
    return checkoutPercentageDisplay(hits, hits + misses);
  })();
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    target: seat.currentTarget,
    visits: seatTurns.length,
    average: seatTurns.length === 0 ? 0 : total / seatTurns.length,
    checkoutPercentage,
  };
}

function computeStats(
  state: OneTwentyOneState,
  stages: StageFact[],
  turns: readonly TurnFact[],
  config: OneTwentyOneConfig,
  inputModeKey: string | null,
): OneTwentyOneResultsSnapshot {
  return {
    target: state.seats[0].currentTarget,
    winningSideKey: state.winningSideKey,
    status: state.status === "WON" ? "WON" : "COMPLETE",
    seats: state.seats.map((seat) =>
      statsFor(seat, stages, turns, config, inputModeKey),
    ),
  };
}

/**
 * `self` exists only so `boardInputData`'s `onCommit` callback can reach this
 * page's own `recordDart` with the live, reactive `this` Alpine binds to
 * every directive-driven call — mirrors `five-oh-one-play.data.ts`'s own
 * `self` pattern.
 */
export function oneTwentyOnePlay() {
  let self: OneTwentyOnePlayContext;

  return {
    ...playScreenState<OneTwentyOneEngine, OneTwentyOneResultsSnapshot>(),
    ...playAgainStarterData(),
    ...boardInputData(
      (observation) => self.recordDart(observation),
      () => self.$store.game.turns,
    ),
    ...playScreenActions(),
    ...timedPlayData(),

    scoreInput: new ScoreInputBuffer({ maxLength: 3 }),
    pendingCheckoutScore: null as number | null,
    dartsAtDouble: null as DartCount | null,
    dartsToFinish: null as DartCount | null,
    pendingDartObservation: null as DartObservation | null,
    showDoubleConfirm: false,
    showSessionFinishConfirm: false,
    botThrowing: false,
    botFlight: null,

    state(this: OneTwentyOnePlayContext): OneTwentyOneState | null {
      const config = this.$store.game.configSnapshot;
      if (!config) return null;
      return foldOneTwentyOneState(
        { stages: this.$store.game.stages, turns: this.$store.game.turns },
        config,
        this.$store.game.timerExpired ?? false,
      );
    },

    remainingInAttemptFor(
      this: OneTwentyOnePlayContext,
      seatRef: string,
    ): number {
      const state = this.state();
      const seat = state?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      return seat?.remainingInAttempt ?? 0;
    },

    remainingInAttempt(this: OneTwentyOnePlayContext): number {
      const state = this.state();
      if (!state) return 0;
      return this.remainingInAttemptFor(state.activeParticipantRef);
    },

    currentTargetLabelFor(
      this: OneTwentyOnePlayContext,
      seatRef: string,
    ): string {
      const state = this.state();
      const seat = state?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      return seat ? String(seat.currentTarget) : "";
    },

    currentTargetLabel(this: OneTwentyOnePlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.currentTargetLabelFor(state.activeParticipantRef);
    },

    visitsThisAttemptFor(
      this: OneTwentyOnePlayContext,
      seatRef: string,
    ): number {
      const state = this.state();
      const seat = state?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      return seat?.visitsThisAttempt ?? 0;
    },

    visitsThisAttempt(this: OneTwentyOnePlayContext): number {
      const state = this.state();
      if (!state) return 0;
      return this.visitsThisAttemptFor(state.activeParticipantRef);
    },

    /**
     * The finish route for what is left in the seat's open attempt, blank
     * when no route fits the darts its visit has left (#291). A seat that
     * is not throwing reads its full visit.
     */
    checkoutHintFor(this: OneTwentyOnePlayContext, seatRef: string): string {
      if (this.$store.checkoutHints?.enabled === false) return "";
      const remaining = this.remainingInAttemptFor(seatRef);
      const dartsLeft = dartsLeftForSeat(
        this.$store.game.turns,
        seatRef,
        DARTS_PER_VISIT,
      );
      return checkoutPathWithin(remaining, dartsLeft)?.join(" ") ?? "";
    },

    checkoutHint(this: OneTwentyOnePlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.checkoutHintFor(state.activeParticipantRef);
    },

    /** Darts the seat has thrown in its open attempt: three per closed visit plus the open visit's own. */
    dartsThisAttemptFor(
      this: OneTwentyOnePlayContext,
      seatRef: string,
    ): number {
      const openDarts =
        DARTS_PER_VISIT -
        dartsLeftForSeat(this.$store.game.turns, seatRef, DARTS_PER_VISIT);
      return this.visitsThisAttemptFor(seatRef) * DARTS_PER_VISIT + openDarts;
    },

    dartsThisAttempt(this: OneTwentyOnePlayContext): number {
      const state = this.state();
      if (!state) return 0;
      return this.dartsThisAttemptFor(state.activeParticipantRef);
    },

    /**
     * Play-header subtitle: the throwing seat's attempt (`ATTEMPT 3 · 9 DARTS`),
     * `ATTEMPT 3 OF 10 · 9 DARTS` against a ROUNDS budget, held at the last
     * attempt once it is spent; blank before config loads.
     */
    subtitle(this: OneTwentyOnePlayContext): string {
      const state = this.state();
      const seat = state?.seats.find(
        (candidate) => candidate.participantRef === state.activeParticipantRef,
      );
      if (!seat) return "";
      const config = this.$store.game.configSnapshot;
      const attempt = seat.attemptsCompleted + 1;
      const rounds =
        durationTypeOf(config) === "ROUNDS" ? durationValueOf(config) : null;
      return joinSubtitle([
        rounds == null
          ? `ATTEMPT ${attempt}`
          : `ATTEMPT ${Math.min(attempt, rounds)} OF ${rounds}`,
        `${DARTS_PER_ATTEMPT} DARTS`,
      ]);
    },

    remainingLabel(this: OneTwentyOnePlayContext): string {
      return formatRemaining(this.$store.game.timerRemainingMs);
    },

    async init(this: OneTwentyOnePlayContext) {
      self = this;
      await playInit(this, GAME_TYPE_KEY, resumeEngine, {
        onResumed: (engine, config) => {
          this.timer = maybeResumeCountdown(
            this.$store.game,
            countdownConfigOf(config),
            engine,
          );
        },
        uploadIfComplete: false,
      });
      if (this.hasActiveSession) await this.maybeRunBotVisit();
    },

    /**
     * Which dart counts the checkout confirm may offer. The remaining score
     * the visit finished is exactly `pendingCheckoutScore` — `submitVisit`
     * only defers a visit that takes the attempt to zero — so the options are
     * read off the deferred score rather than off `remainingInAttempt()`,
     * which the dialog is open precisely to avoid moving yet.
     */
    checkoutDartOptions(this: OneTwentyOnePlayContext): CheckoutDartOptions {
      return checkoutDartOptions(this.pendingCheckoutScore ?? 0, 3);
    },

    /**
     * Folds one visit into the engine's fact log, then checks for a session
     * win. Shared by the plain-reduction path (`submitVisit`) and both
     * checkout confirm (`confirmDouble`) so the
     * record → mirror → complete sequence exists exactly once.
     */
    async recordVisit(
      this: OneTwentyOnePlayContext,
      score: number,
      finishedOnDouble: boolean,
    ) {
      if (!this.engine || this.$store.game.timerPaused) return;
      await recordCheckoutVisit(this, score, finishedOnDouble);
    },

    async maybeRunBotVisit(this: OneTwentyOnePlayContext) {
      if (this.$store.game.timerPaused) return;
      const turn = activeBotTurn(this);
      if (!turn) return;
      const { botSeat } = turn;

      if (this.$store.game.inputModeKey === "QUICK_SCORE") {
        const remainingBefore = this.remainingInAttemptFor(
          botSeat.participantRef,
        );
        const total = await playBotQuickScoreVisit(
          this,
          botSeat,
          oneTwentyOneEngineFactory,
          (scratchState, dartIndex) =>
            throwBotQuickScoreDart(scratchState, botSeat, dartIndex),
          DARTS_PER_VISIT,
        );
        if (total === null) return;
        await this.recordVisit(total, total === remainingBefore);
        return;
      }

      const thrower: BotDartThrower = () => throwBotDart(this, botSeat);
      await playRunBotVisualBoardVisit(this, botSeat.participantRef, thrower);
    },

    /**
     * The board's per-dart counterpart to `recordVisit`: every dart the
     * player throws arrives here from `boardInputData`'s `onCommit`. A dart
     * that would complete the whole session is gated behind
     * `showSessionFinishConfirm`, because recording it uploads and completes
     * the session immediately and that step is irreversible; a
     * ladder-climbing checkout or a bust commits straight away — mirrors
     * `five-oh-one-play.data.ts`'s `recordDart`.
     */
    async recordDart(
      this: OneTwentyOnePlayContext,
      observation: DartObservation,
    ) {
      this.timer?.unlockAudio();
      if (
        !this.engine ||
        this.finished ||
        this.showDoubleConfirm ||
        this.showSessionFinishConfirm ||
        this.$store.game.timerPaused
      )
        return;

      if (this.engine.wouldComplete(observation)) {
        this.pendingDartObservation = observation;
        this.showSessionFinishConfirm = true;
        return;
      }

      await this.commitDart(observation);
    },

    async commitDart(
      this: OneTwentyOnePlayContext,
      observation: DartObservation,
    ) {
      await playCommitDart(this, observation);
      await this.maybeRunBotVisit();
    },

    /**
     * 121 is double-out but this app's keypad only captures a visit's total,
     * not individual darts — so when the entered score would bring the
     * attempt's remaining total to exactly 0, the app cannot know from the
     * number alone whether the last dart was a double (a checkout) or not (a
     * bust). `isCheckoutAttempt` gates a "Finished on a double?" confirm
     * before anything is recorded; every other visit records immediately.
     * `checkoutPathFor` narrows that gate to remainders a double-out finish
     * can actually reach, mirroring `five-oh-one-play.data.ts`'s
     * `submitVisit`.
     */
    async submitVisit(this: OneTwentyOnePlayContext) {
      this.timer?.unlockAudio();
      if (
        !this.engine ||
        this.finished ||
        this.showDoubleConfirm ||
        this.showSessionFinishConfirm ||
        this.$store.game.timerPaused
      )
        return;
      this.loading = true;

      const score = Number(this.scoreInput.value);
      const remaining = this.remainingInAttempt();
      const isCheckoutAttempt =
        remaining - score === 0 &&
        score <= 180 &&
        checkoutPathFor(remaining) !== null;

      if (isCheckoutAttempt) {
        openCheckoutConfirm(this, score);
        this.loading = false;
        return;
      }

      await this.recordVisit(score, false);
    },

    /**
     * "Yes" on the double-out confirm. A checkout that only climbs the
     * ladder records immediately. A checkout at the cap target (170) wins
     * the whole session and is irreversible once uploaded, so this asks
     * `engine.wouldComplete` and opens a second confirm instead of
     * recording right away, mirroring `five-oh-one-play.data.ts`'s
     * `confirmDouble`.
     */
    confirmDouble(this: OneTwentyOnePlayContext) {
      return confirmCheckout(this, () => {
        this.showSessionFinishConfirm = true;
      });
    },

    cancelCheckout(this: OneTwentyOnePlayContext) {
      if (!this.showDoubleConfirm) return;
      if (restoreCheckoutScore(this)) this.showDoubleConfirm = false;
    },

    /**
     * Confirm on the second, session-ending dialog: records whichever the
     * player was deferred on — the board's dart (`recordDart`'s gate) or the
     * keypad's checkout (`confirmDouble`'s deferral) — mirrors
     * `five-oh-one-play.data.ts`'s `confirmMatchFinish`.
     */
    async confirmSessionFinish(this: OneTwentyOnePlayContext) {
      if (!this.engine || this.finished || !this.showSessionFinishConfirm)
        return;

      if (this.pendingDartObservation) {
        const observation = this.pendingDartObservation;
        this.pendingDartObservation = null;
        this.showSessionFinishConfirm = false;
        await this.commitDart(observation);
        return;
      }

      if (this.pendingCheckoutScore == null) return;
      const score = this.pendingCheckoutScore;
      this.pendingCheckoutScore = null;
      this.showSessionFinishConfirm = false;
      await this.recordVisit(score, true);
    },

    /**
     * Cancel on the second, session-ending dialog. Nothing is recorded; a
     * deferred keypad score returns to the keypad, a deferred dart is simply
     * discarded (the player throws again) — mirrors
     * `five-oh-one-play.data.ts`'s `cancelMatchFinish`.
     */
    cancelSessionFinish(this: OneTwentyOnePlayContext) {
      if (!this.showSessionFinishConfirm) return;

      if (this.pendingDartObservation) {
        this.pendingDartObservation = null;
        this.showSessionFinishConfirm = false;
        return;
      }

      if (restoreCheckoutScore(this)) this.showSessionFinishConfirm = false;
    },

    undoVisit(this: OneTwentyOnePlayContext) {
      if (
        isInputBlocked(
          this,
          this.showDoubleConfirm,
          this.showSessionFinishConfirm,
        )
      )
        return;
      undoBotAwareVisit(this);
    },

    async uploadAndCompleteSession(
      this: OneTwentyOnePlayContext,
    ): Promise<void> {
      return playUploadAndCompleteSession(
        this,
        (finalState) =>
          computeStats(
            finalState,
            this.$store.game.stages,
            this.$store.game.turns,
            this.$store.game.configSnapshot!,
            this.$store.game.inputModeKey,
          ),
        () => this.state(),
      );
    },

    resultsTitle(this: OneTwentyOnePlayContext): string {
      if (this.resultsSnapshot?.status !== "WON") return "Session complete";
      const winner = matchWinnerName(
        this.$store.game.seats,
        this.resultsSnapshot?.winningSideKey ?? null,
      );
      return winner ? `${winner} checks out 170!` : "170 checked out!";
    },

    /**
     * Replays the same configuration template the first session used,
     * against whichever ruleset version that session actually used —
     * `121_V1` stays on `121_V1`, `121_V2` stays on `121_V2` and its own
     * `duration_type`/`duration_value`. Delegates to `play-lifecycle.ts`'s
     * shared `runPlayAgain`.
     */
    async playAgain(this: OneTwentyOnePlayContext) {
      const rulesetVersionKey = this.$store.game.rulesetVersionKey;
      if (
        !rulesetVersionKey ||
        !canReplay(rulesetVersionKey, this.playAgainLoading)
      ) {
        return;
      }
      await runPlayAgain(
        this,
        GAME_TYPE_KEY,
        rulesetVersionKey,
        (engine) => (engine instanceof OneTwentyOneEngine ? engine : null),
        undefined,
        () => {
          resetTimerStoreFields(this);
          this.pendingCheckoutScore = null;
          this.pendingDartObservation = null;
          this.showDoubleConfirm = false;
          this.showSessionFinishConfirm = false;
          this.scoreInput.clear();
        },
        (engine) =>
          restartCountdown(
            this,
            this.$store.game.configSnapshot &&
              countdownConfigOf(this.$store.game.configSnapshot),
            engine,
          ),
      );
    },
  };
}
