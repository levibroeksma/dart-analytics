import { playAgainStarterData } from "@lib/game/play-again-starter";
import { ScoreInputBuffer } from "@modules/game/score-input.module";
import { boardInputData } from "@lib/game/board-input.data";
import {
  playScreenActions,
  playScreenState,
  resetTimerStoreFields,
  timedPlayData,
} from "@lib/game/play-screen.data";
import { matchWinnerName } from "@lib/game/match-result-text";
import {
  armHiddenTimer,
  playAnimateBotDarts,
  playFoldBotQuickScoreVisit,
  playInit,
  playRunBotVisualBoardVisit,
  playUploadAndCompleteSession,
  resumeGameEngine,
  runPlayAgain,
  isInputBlocked,
  undoBotAwareVisit,
} from "@lib/game/play-lifecycle";
import { chooseTarget } from "@modules/dartbot/strategy/scoring.strategy.module";
import {
  completedVisitsTotal,
  dartsThrownCount,
  firstNineAverageDisplay,
  highestVisitScore,
  perVisitAverageDisplay,
  previousScoreDisplay,
  visitScoreBandCounts,
} from "@lib/game/play-visit-stats";
import {
  botDartObservationAt,
  botQuickScoreDartIndex,
  botThrowObservation,
  findBotSeat,
} from "@lib/game/play-bot-seat";
import {
  formatRemaining,
  maybeResumeCountdown,
  restartCountdown,
} from "@lib/game/play-countdown";
import type {
  DartbotSeat,
  RulesetVersionKey,
  ScoreTrainingSnapshot,
} from "@lib/types";
import type {
  DartObservation,
  ScoreTrainingSeatState,
  ScoreTrainingState,
  TurnFact,
} from "@modules/types";
import type {
  BotDartThrower,
  BotPacing,
  ScoreTrainingPlayContext,
  ScoreTrainingResultsSnapshot,
  ScoreTrainingSeatResult,
} from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// scoreTrainingEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY. `scoreTrainingEngineFactory` is imported directly
// (not via the type-erased registry) so `playFoldBotQuickScoreVisit`'s
// `TState` infers as `ScoreTrainingState` with no cast at the call site.
import {
  ScoreTrainingEngine,
  foldScoreTrainingState,
  scoreTrainingEngineFactory,
} from "@modules/game/score-training.engine.module";

const GAME_TYPE_KEY = "SCORE_TRAINING";
const RULESET_VERSION_KEY: RulesetVersionKey = "SCORE_TRAINING_V1";

const DARTS_PER_VISIT = 3;

function throwBotDart(
  context: ScoreTrainingPlayContext,
  botSeat: DartbotSeat,
): { observation: DartObservation; pacing: BotPacing } {
  return botThrowObservation(
    botSeat,
    context.$store.game.turns,
    chooseTarget(),
  );
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
 * The bot seat when it is the bot's turn to throw — a bot is seated, the
 * engine is up, the session is neither finished nor paused, and the active
 * seat is the bot's — otherwise null.
 */
function botSeatToThrow(context: ScoreTrainingPlayContext): DartbotSeat | null {
  const botSeat = findBotSeat(context.$store.game.seats);
  if (!botSeat || !context.engine || context.finished) return null;
  if (context.$store.game.timerPaused) return null;
  const active = context.state()?.activeParticipantRef;
  return active === botSeat.participantRef ? botSeat : null;
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
    ...playScreenState<ScoreTrainingEngine, ScoreTrainingResultsSnapshot>(),
    ...playAgainStarterData(),
    ...boardInputData(
      (observation) => self.recordDart(observation),
      () => self.$store.game.turns,
    ),
    ...playScreenActions(),
    ...timedPlayData(),

    scoreInput: new ScoreInputBuffer({ maxLength: 3 }),
    pendingFinishScore: null as number | null,
    pendingDartObservation: null as DartObservation | null,
    showFinishConfirm: false,
    botThrowing: false,
    botFlight: null,

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

    /** Play-header subtitle: `ROUND 3 OF 10`, or `ROUND 3` under MINUTES; blank before config loads. */
    subtitle(this: ScoreTrainingPlayContext): string {
      const config = this.$store.game.configSnapshot;
      const state = this.state();
      const seat = state?.seats.find(
        (candidate) => candidate.participantRef === state.activeParticipantRef,
      );
      if (!config || !seat) return "";
      const round = seat.turnCount + 1;
      if (config.durationType === "MINUTES") return `ROUND ${round}`;
      return `ROUND ${Math.min(round, config.durationValue)} OF ${config.durationValue}`;
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
     * Reconciles via the shared reconcileActiveSession helper.
     *
     * On "match", resume silently (no Continue/Abandon modal — that is
     * setup-only): the engine is rebuilt from the persisted facts and the
     * store is written back from `engine.facts()` immediately, so the two
     * agree before any input. Any other outcome shows no session; nothing is
     * abandoned here (D460).
     */
    async init(this: ScoreTrainingPlayContext) {
      self = this;
      await playInit(
        this,
        GAME_TYPE_KEY,
        (game) =>
          resumeGameEngine<ScoreTrainingSnapshot, ScoreTrainingEngine>(
            game,
            RULESET_VERSION_KEY,
            (candidate): candidate is ScoreTrainingEngine =>
              candidate instanceof ScoreTrainingEngine,
          ),
        {
          onResumed: (engine, config) => {
            this.timer = maybeResumeCountdown(this.$store.game, config, engine);
          },
          uploadIfComplete: false,
        },
      );
      if (this.hasActiveSession) await this.maybeRunBotVisit();
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
      this.timer?.unlockAudio();
      if (
        !this.engine ||
        this.finished ||
        this.showFinishConfirm ||
        this.$store.game.timerPaused
      )
        return;
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
      await this.maybeRunBotVisit();
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
    async recordDart(
      this: ScoreTrainingPlayContext,
      observation: DartObservation,
    ) {
      this.timer?.unlockAudio();
      if (
        !this.engine ||
        this.finished ||
        this.showFinishConfirm ||
        this.$store.game.timerPaused
      )
        return;

      if (this.engine.wouldComplete(observation)) {
        this.pendingDartObservation = observation;
        this.showFinishConfirm = true;
        return;
      }

      this.engine.record(observation);
      this.error = "";
      this.$store.game.recordFacts(this.engine.facts());
      armHiddenTimer(this, this.$store.game.turns);
      await this.maybeRunBotVisit();
    },

    async maybeRunBotVisit(this: ScoreTrainingPlayContext) {
      const botSeat = botSeatToThrow(this);
      if (!botSeat || !this.engine) return;

      if (this.$store.game.inputModeKey === "QUICK_SCORE") {
        let dartIndex = botQuickScoreDartIndex(
          this.$store.game.turns,
          botSeat.participantRef,
          DARTS_PER_VISIT,
        );
        const fold = playFoldBotQuickScoreVisit(
          scoreTrainingEngineFactory,
          this.$store.game.configSnapshot!,
          this.engine.facts(),
          () => botDartObservationAt(botSeat, dartIndex++, chooseTarget()),
          DARTS_PER_VISIT,
        );
        if (
          !(await playAnimateBotDarts(this, botSeat.participantRef, fold.darts))
        )
          return;
        const completes = this.engine.wouldComplete(fold.totalScore);
        this.engine.record(fold.totalScore);
        this.$store.game.recordFacts(this.engine.facts());
        if (!completes) return;
        this.finished = true;
        this.completionStatus = "pending";
        await this.uploadAndCompleteSession();
        return;
      }

      const thrower: BotDartThrower = () => throwBotDart(this, botSeat);
      await playRunBotVisualBoardVisit(
        this,
        botSeat.participantRef,
        thrower,
        undefined,
        (observation) => this.engine!.wouldComplete(observation),
      );
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
      if (isInputBlocked(this, this.showFinishConfirm)) return;
      undoBotAwareVisit(this);
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
      return playUploadAndCompleteSession(
        this,
        (finalState) => ({
          status: finalState.status === "TIE" ? "TIE" : "COMPLETE",
          winningSideKey: finalState.winningSideKey,
          seats: finalState.seats.map((seat) =>
            statsFor(seat, this.$store.game.turns),
          ),
        }),
        () => this.state(),
      );
    },

    resultsTitle(this: ScoreTrainingPlayContext): string {
      if (this.resultsSnapshot?.status === "TIE") return "Tie — same total!";
      const winner = matchWinnerName(
        this.$store.game.seats,
        this.resultsSnapshot?.winningSideKey ?? null,
      );
      return winner ? `${winner} wins — highest total!` : "Game Summary";
    },

    /**
     * Replays the same configuration template the first session used, with
     * the current duration value as an override. Delegates to
     * `play-lifecycle.ts`'s shared `runPlayAgain`.
     */
    async playAgain(this: ScoreTrainingPlayContext) {
      await runPlayAgain(
        this,
        GAME_TYPE_KEY,
        RULESET_VERSION_KEY,
        (engine) => (engine instanceof ScoreTrainingEngine ? engine : null),
        (config) => ({
          snapshot: config,
          wire: { duration_value: config.durationValue },
        }),
        () => {
          resetTimerStoreFields(this);
          this.pendingFinishScore = null;
          this.pendingDartObservation = null;
          this.showFinishConfirm = false;
          this.scoreInput.clear();
        },
        (engine) =>
          restartCountdown(this, this.$store.game.configSnapshot, engine),
      );
    },
  };
}
