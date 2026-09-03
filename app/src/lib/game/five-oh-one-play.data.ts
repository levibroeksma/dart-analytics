import { ScoreInputBuffer } from "@modules/game/score-input.module";
import { checkoutDartOptions } from "@modules/game/checkout-darts.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import { foldFiveOhOneState } from "@modules/game/five-oh-one.engine.module";
import { checkoutPathFor } from "@modules/game/checkout-path.module";
import {
  participantsFromSeats,
  resolveSessionModePair,
  reseatSnapshot,
} from "@lib/game/session-mode-resolution";
import {
  appendBatch,
  completeSession,
  createSession,
  fetchActiveSessions,
} from "@client/api/sessions";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import { boardInputData } from "@lib/game/board-input.data";
import {
  clearHiddenTimer,
  currentFacts,
  playAbandonAndExit,
  playBack,
  playCommitDart,
  playFoldBotQuickScoreVisit,
  playRunBotVisualBoardVisit,
  playVisitMarkers,
  undoToActiveSeat,
} from "@lib/game/play-lifecycle";
import { skillProfileForLevel } from "@modules/dartbot/skill-profile.module";
import { createDartRng } from "@modules/dartbot/rng.module";
import { throwDart as botThrowDart } from "@modules/dartbot/throw-engine.module";
import { chooseTarget } from "@modules/dartbot/strategy/x01.strategy.module";
import {
  accuracyDisplay,
  dartsThrownCount,
  previousScoreDisplay,
  threeDartAverageDisplay,
  visitScoreBandCounts,
} from "@lib/game/play-visit-stats";
import { checkoutAttemptCount } from "@modules/game/checkout-bust.module";
import { matchWinnerName } from "@lib/game/match-result-text";
import type { RulesetVersionKey, SeatFact } from "@lib/types";
import type {
  CheckoutDartOptions,
  DartCount,
  DartObservation,
  FiveOhOneState,
  TurnFact,
} from "@modules/types";
import type {
  BoardMarker,
  BotDartThrower,
  BotPacing,
  FiveOhOnePlayContext,
  FiveOhOneSeatResult,
  FiveOhOneResultsSnapshot,
} from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// fiveOhOneEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY. `fiveOhOneEngineFactory` is imported directly (not via
// the type-erased registry) so `playFoldBotQuickScoreVisit`'s `TState` infers
// as `FiveOhOneState` with no cast at the call site.
import {
  FiveOhOneEngine,
  fiveOhOneEngineFactory,
} from "@modules/game/five-oh-one.engine.module";

const GAME_TYPE_KEY = "501";
const RULESET_VERSION_KEY: RulesetVersionKey = "501_V1";

/**
 * Rebuilds the engine for the persisted session, replaying the store's fact
 * log so a reload restores the game exactly. Only this page's own ruleset is
 * ever resolved — mirrors `score-training-play.data.ts`'s `resumeEngine`.
 */
function resumeEngine(
  game: FiveOhOnePlayContext["$store"]["game"],
): FiveOhOneEngine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (!configSnapshot || rulesetVersionKey !== RULESET_VERSION_KEY) return null;
  const factory = getEngineFactory(RULESET_VERSION_KEY);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof FiveOhOneEngine ? engine : null;
}

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

/** VISUAL_BOARD thrower: reads the real engine's own live `state()`, exactly
 * as `bobs27-play.data.ts`'s `throwBotDart` does — `foldFiveOhOneState`
 * already folds an open visit's running total, so `remainingScoreFor` is
 * live per dart, not just per visit. */
function throwBotDart(
  context: FiveOhOnePlayContext,
  botSeat: DartbotSeat,
): { observation: DartObservation; pacing: BotPacing } {
  const remaining = context.remainingScoreFor(botSeat.participantRef);
  const dartIndex = botDartIndex(
    context.$store.game.turns,
    botSeat.participantRef,
  );
  return {
    observation: throwOneDart(remaining, botSeat, dartIndex),
    pacing: { preThrowMs: BOT_PRE_THROW_MS, postThrowMs: BOT_POST_THROW_MS },
  };
}

/**
 * QUICK_SCORE thrower: `state` is the scratch engine's own live state
 * (Task 4's widened `playFoldBotQuickScoreVisit`), never the real engine's —
 * the real engine is never told about darts mid-visit under QUICK_SCORE.
 */
function throwBotQuickScoreDart(
  state: FiveOhOneState,
  botSeat: DartbotSeat,
  dartIndex: number,
): DartObservation {
  const remaining = state.seats.find(
    (seat) => seat.participantRef === botSeat.participantRef,
  )!.remainingScore;
  return throwOneDart(remaining, botSeat, dartIndex);
}

/**
 * One seat's own results stats, replayed from its own completed visits in
 * `turns`. `legsWon` is read off `state().sides` by the caller — never
 * counted from `turns` directly (a stage exists per leg *played*, not per
 * leg *won*). `checkoutPercentage` is `null` outside VISUAL_BOARD capture.
 */
function statsFor(
  seat: SeatFact,
  turns: readonly TurnFact[],
  legsWon: number,
  maxDartsPerTurn: number,
  inputModeKey: string | null,
): FiveOhOneSeatResult {
  const seatTurns = turns.filter(
    (turn) => turn.participantRef === seat.participantRef,
  );
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    legsWon,
    threeDartAverage: threeDartAverageDisplay(seatTurns, maxDartsPerTurn),
    checkoutPercentage:
      inputModeKey === "VISUAL_BOARD"
        ? accuracyDisplay(legsWon, legsWon + checkoutAttemptCount(seatTurns))
        : null,
    ...visitScoreBandCounts(seatTurns),
  };
}

/**
 * The match-summary modal's whole snapshot: every seat's own `statsFor`,
 * plus the winning side — `null` for a solo session (one seat can't have a
 * side to compare against, so there is nothing to declare a winner over)
 * even though the engine's own fold always names a `sideKey` once that
 * seat's side reaches `legsToWin`.
 */
function buildResultsSnapshot(
  context: FiveOhOnePlayContext,
): FiveOhOneResultsSnapshot {
  const seats = context.$store.game.seats;
  const maxDartsPerTurn =
    context.$store.game.configSnapshot?.maxDartsPerTurn ?? 3;
  const inputModeKey = context.$store.game.inputModeKey;
  return {
    winningSideKey:
      seats.length >= 2 ? (context.state()?.winningSideKey ?? null) : null,
    seats: seats.map((seat) =>
      statsFor(
        seat,
        context.$store.game.turns,
        context.legsWonFor(seat.participantRef),
        maxDartsPerTurn,
        inputModeKey,
      ),
    ),
  };
}

/**
 * `self` exists only so `boardInputData`'s `onCommit` callback can reach this
 * page's own `recordDart` with the live, reactive `this` Alpine binds to
 * every directive-driven call (`@click="…"`, `init()`). `onCommit` is built
 * once, synchronously, while this factory's returned object literal is still
 * being constructed — at that point Alpine has not yet wrapped it in
 * `reactive()`, so a callback written as `(observation) => this.recordDart(…)`
 * right here would close over the wrong `this` (this factory's own call-time
 * receiver, never the component) and silently stop updating the DOM for
 * every local field `recordDart` touches (`finished`, `showMatchFinishConfirm`,
 * `pendingDartObservation`, `error`) — the store mirror would still update,
 * masking the bug in anything that only inspects `$store.game`. `init()` runs
 * through Alpine's own evaluator after the wrap, so assigning `self = this`
 * there captures the real reactive instance in time for the first possible
 * board press, which cannot happen before `hasActiveSession` flips true.
 */
export function fiveOhOnePlay() {
  let self: FiveOhOnePlayContext;

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
    resultsSnapshot: null as FiveOhOneResultsSnapshot | null,
    pendingCheckoutScore: null as number | null,
    dartsAtDouble: null as DartCount | null,
    dartsToFinish: null as DartCount | null,
    pendingDartObservation: null as DartObservation | null,
    showDoubleConfirm: false,
    showMatchFinishConfirm: false,
    botThrowing: false,
    engine: null as FiveOhOneEngine | null,
    hiddenTurnKey: null as string | null,
    hiddenTimer: null as ReturnType<typeof setTimeout> | null,
    ...boardInputData((observation) => self.recordDart(observation)),

    /** Overrides `boardInputData`'s own default — object-literal key order
     * means this later definition wins. Delegates to `play-lifecycle.ts`'s
     * shared implementation, mirrors `bobs27-play.data.ts`. */
    visitMarkers(this: FiveOhOnePlayContext): BoardMarker[] {
      return playVisitMarkers(this);
    },

    turnsInCurrentLeg(this: FiveOhOnePlayContext): TurnFact[] {
      const openLeg = this.$store.game.stages.at(-1);
      if (!openLeg) return [];
      return this.$store.game.turns.filter(
        (turn) => turn.stageClientKey === openLeg.clientKey,
      );
    },

    /**
     * Folds the store's own fact log — never `engine.state()` — so every
     * Alpine display expression that calls this re-renders when
     * `recordFacts` writes a new turn. The engine is a plain class instance;
     * its internal mutations carry no Alpine reactivity (see
     * `07-Frontend/03-Alpine-Patterns.md`'s reactive-store convention).
     */
    state(this: FiveOhOnePlayContext): FiveOhOneState | null {
      const config = this.$store.game.configSnapshot;
      if (!config) return null;
      return foldFiveOhOneState(
        { stages: this.$store.game.stages, turns: this.$store.game.turns },
        config,
      );
    },

    /**
     * The play-page header's title. Falls back to the plain "501" before a
     * session's config has loaded; once loaded, names the match format the
     * session was actually configured with. A future task adding sets
     * extends this one function rather than the header template.
     */
    matchTitle(this: FiveOhOnePlayContext): string {
      const legsToWin = this.$store.game.configSnapshot?.legsToWin;
      return legsToWin ? `First to ${legsToWin} legs` : "501";
    },

    remainingScoreFor(this: FiveOhOnePlayContext, seatRef: string): number {
      const state = this.state();
      if (!state) return 0;
      const seat = state.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      return seat?.remainingScore ?? 0;
    },

    remainingScore(this: FiveOhOnePlayContext): number {
      const state = this.state();
      if (!state) return 0;
      return this.remainingScoreFor(state.activeParticipantRef);
    },

    checkoutHintFor(this: FiveOhOnePlayContext, seatRef: string): string {
      if (this.$store.checkoutHints?.enabled === false) return "";
      const path = checkoutPathFor(this.remainingScoreFor(seatRef));
      return path ? path.join(" ") : "";
    },

    checkoutHint(this: FiveOhOnePlayContext): string {
      if (this.$store.checkoutHints?.enabled === false) return "";
      const path = checkoutPathFor(this.remainingScore());
      return path ? path.join(" ") : "";
    },

    dartsThrownThisLegFor(this: FiveOhOnePlayContext, seatRef: string): number {
      const maxDartsPerTurn =
        this.$store.game.configSnapshot?.maxDartsPerTurn ?? 3;
      const seatTurns = this.turnsInCurrentLeg().filter(
        (turn) => turn.participantRef === seatRef,
      );
      return dartsThrownCount(seatTurns, maxDartsPerTurn);
    },

    dartsThrownThisLeg(this: FiveOhOnePlayContext): number {
      const maxDartsPerTurn =
        this.$store.game.configSnapshot?.maxDartsPerTurn ?? 3;
      return dartsThrownCount(this.turnsInCurrentLeg(), maxDartsPerTurn);
    },

    /**
     * Match-wide, not leg-scoped: unlike darts thrown, the average and the
     * previous visit's score are a running read on the player across the
     * whole match, so they must survive a leg boundary rather than reset to
     * zero the instant a new leg's stage opens.
     */
    averageFor(this: FiveOhOnePlayContext, seatRef: string): string {
      const maxDartsPerTurn =
        this.$store.game.configSnapshot?.maxDartsPerTurn ?? 3;
      const seatTurns = this.$store.game.turns.filter(
        (turn) => turn.participantRef === seatRef,
      );
      return threeDartAverageDisplay(seatTurns, maxDartsPerTurn);
    },

    average(this: FiveOhOnePlayContext): string {
      const state = this.state();
      if (!state) return "0.0";
      return this.averageFor(state.activeParticipantRef);
    },

    previousScoreFor(this: FiveOhOnePlayContext, seatRef: string): string {
      const seatTurns = this.$store.game.turns.filter(
        (turn) => turn.participantRef === seatRef,
      );
      return previousScoreDisplay(seatTurns);
    },

    previousScore(this: FiveOhOnePlayContext): string {
      const state = this.state();
      if (!state) return "—";
      return this.previousScoreFor(state.activeParticipantRef);
    },

    legsWonFor(this: FiveOhOnePlayContext, seatRef: string): number {
      const state = this.state();
      if (!state) return 0;
      const seat = state.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      const side = state.sides.find(
        (candidate) => candidate.sideKey === seat?.sideKey,
      );
      return side?.legsWon ?? 0;
    },

    /**
     * Which dart counts the checkout confirm may offer. The remaining score
     * the visit finished is exactly `pendingCheckoutScore` — `submitVisit`
     * only defers a visit that takes the leg to zero — so the options are read
     * off the deferred score rather than off `remainingScore()`, which the
     * dialog is open precisely to avoid moving yet.
     */
    checkoutDartOptions(this: FiveOhOnePlayContext): CheckoutDartOptions {
      const maxDartsPerTurn =
        this.$store.game.configSnapshot?.maxDartsPerTurn ?? 3;
      return checkoutDartOptions(
        this.pendingCheckoutScore ?? 0,
        maxDartsPerTurn,
      );
    },

    async init(this: FiveOhOnePlayContext) {
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
        await this.maybeRunBotVisit();
      } catch {
        this.reconciliationFailed = true;
        this.hasActiveSession = false;
      } finally {
        this.loadingReconciliation = false;
      }
    },

    async retryReconciliation(this: FiveOhOnePlayContext) {
      await this.init();
    },

    /**
     * Folds one visit into the engine's fact log, then checks for a match
     * win. Shared by the plain-reduction path (`submitVisit`) and both
     * checkout confirm (`confirmDouble`) so the
     * record → mirror → complete sequence exists exactly once.
     */
    async recordVisit(
      this: FiveOhOnePlayContext,
      score: number,
      finishedOnDouble: boolean,
    ) {
      if (!this.engine) return;
      const darts = finishedOnDouble
        ? {
            dartsUsed: this.dartsToFinish ?? undefined,
            dartsAtDouble: this.dartsAtDouble ?? undefined,
          }
        : {};
      try {
        this.engine.record({
          scoreAttempted: score,
          finishedOnDouble,
          ...darts,
        });
      } catch (err: unknown) {
        this.error = (err as Error).message;
        this.loading = false;
        return;
      }
      this.error = "";
      this.scoreInput.clear();
      this.dartsAtDouble = null;
      this.dartsToFinish = null;
      this.$store.game.recordFacts(this.engine.facts());
      this.loading = false;

      if (this.engine.isComplete()) {
        this.finished = true;
        this.completionStatus = "pending";
        await this.uploadAndCompleteSession();
        return;
      }
      await this.maybeRunBotVisit();
    },

    /**
     * The board's per-dart counterpart to `recordVisit`: every dart the
     * player throws, including an unseen one, arrives here from
     * `boardInputData`'s `onCommit`. Unlike a quick-score visit, the board
     * observation already carries the zone a dart actually landed in, so
     * there is never a checkout that is ambiguous between a double and a
     * bust the way `submitVisit`'s typed total is — `showDoubleConfirm`
     * never opens for a dart. A dart that would complete the whole match is
     * still gated behind `showMatchFinishConfirm`, because recording it
     * uploads and completes the session immediately and that step is
     * irreversible; a leg-only checkout or a bust commits straight away.
     */
    async recordDart(this: FiveOhOnePlayContext, observation: DartObservation) {
      if (
        !this.engine ||
        this.finished ||
        this.showDoubleConfirm ||
        this.showMatchFinishConfirm
      )
        return;

      if (this.engine.wouldComplete(observation)) {
        this.pendingDartObservation = observation;
        this.showMatchFinishConfirm = true;
        return;
      }

      await this.commitDart(observation);
    },

    async commitDart(
      this: FiveOhOnePlayContext,
      observation: DartObservation,
    ): Promise<void> {
      await playCommitDart(this, observation);
      await this.maybeRunBotVisit();
    },

    /**
     * 501 is double-out but this app only captures a visit's total, not
     * individual darts — so when the entered score would bring the leg's
     * remaining total to exactly 0, the app cannot know from the number
     * alone whether the last dart was a double (a win) or not (a bust).
     * `isCheckoutAttempt` gates a "Finished on a double?" confirm before
     * anything is recorded; every other visit records immediately.
     *
     * `checkoutPathFor` narrows that gate to remainders a double-out finish
     * can actually reach: the seven bogey numbers and 171-180 have no legal
     * finish route, so a "Yes" answer there could never be true. Those visits
     * skip the dialog and fall straight through to `recordVisit` as a bust,
     * which the engine's own bust rule already produces for a zeroing visit
     * with `finishedOnDouble: false`.
     */
    async submitVisit(this: FiveOhOnePlayContext) {
      if (
        !this.engine ||
        this.finished ||
        this.showDoubleConfirm ||
        this.showMatchFinishConfirm
      )
        return;
      this.loading = true;

      const score = Number(this.scoreInput.value);
      const config = this.$store.game.configSnapshot;
      const remaining = this.remainingScore();
      const isCheckoutAttempt =
        !!config &&
        remaining - score === 0 &&
        score <= config.maxVisitScore &&
        checkoutPathFor(remaining) !== null;

      if (isCheckoutAttempt) {
        this.error = "";
        this.pendingCheckoutScore = score;
        this.scoreInput.clear();
        const options = this.checkoutDartOptions();
        this.dartsAtDouble = options.atDouble[0];
        this.dartsToFinish = options.toFinish[0];
        this.showDoubleConfirm = true;
        this.loading = false;
        return;
      }

      await this.recordVisit(score, false);
    },

    /**
     * "Yes" on the double-out confirm. A checkout that only wins a leg
     * records immediately, same as before this dialog existed. A checkout
     * that wins the whole match is irreversible once uploaded — `recordVisit`
     * marks the session `finished` and `PATCH COMPLETED`s it — so this asks
     * `engine.wouldComplete` (a pure predicate, matches D181: match-win, not
     * leg-win) and opens a second confirm instead of recording right away.
     * `pendingCheckoutScore` is deliberately left set for that second dialog
     * to record or restore.
     */
    async confirmDouble(this: FiveOhOnePlayContext) {
      if (!this.engine || this.finished || !this.showDoubleConfirm) return;
      if (this.pendingCheckoutScore == null) return;
      const score = this.pendingCheckoutScore;

      if (
        this.engine.wouldComplete({
          scoreAttempted: score,
          finishedOnDouble: true,
          dartsUsed: this.dartsToFinish ?? undefined,
          dartsAtDouble: this.dartsAtDouble ?? undefined,
        })
      ) {
        this.showDoubleConfirm = false;
        this.showMatchFinishConfirm = true;
        return;
      }

      this.pendingCheckoutScore = null;
      this.showDoubleConfirm = false;
      await this.recordVisit(score, true);
    },

    /**
     * Cancel on the double-out confirm. Mirrors Score Training's
     * `cancelFinish`: nothing is recorded, and the pending score is restored
     * into the keypad so a mistyped entry is not lost.
     */
    cancelCheckout(this: FiveOhOnePlayContext) {
      if (!this.showDoubleConfirm || this.pendingCheckoutScore == null) return;
      this.scoreInput.setValue(String(this.pendingCheckoutScore));
      this.pendingCheckoutScore = null;
      this.dartsAtDouble = null;
      this.dartsToFinish = null;
      this.showDoubleConfirm = false;
    },

    /**
     * Confirm on the second, match-ending dialog: records whichever the
     * player was deferred on — the board's dart (`recordDart`'s gate) or the
     * keypad's checkout (`confirmDouble`'s deferral) — which drives
     * `commitDart`'s or `recordVisit`'s own completion check and upload.
     */
    async confirmMatchFinish(this: FiveOhOnePlayContext) {
      if (!this.engine || this.finished || !this.showMatchFinishConfirm) return;

      if (this.pendingDartObservation) {
        const observation = this.pendingDartObservation;
        this.pendingDartObservation = null;
        this.showMatchFinishConfirm = false;
        await this.commitDart(observation);
        return;
      }

      if (this.pendingCheckoutScore == null) return;
      const score = this.pendingCheckoutScore;
      this.pendingCheckoutScore = null;
      this.showMatchFinishConfirm = false;
      await this.recordVisit(score, true);
    },

    /**
     * Cancel on the second, match-ending dialog. Same contract as
     * `cancelCheckout` for the keypad's deferred score: nothing is recorded,
     * and the score returns to the keypad rather than being lost. A deferred
     * dart has no keypad buffer to return to — the player simply throws
     * again — so it is just discarded.
     */
    cancelMatchFinish(this: FiveOhOnePlayContext) {
      if (!this.showMatchFinishConfirm) return;

      if (this.pendingDartObservation) {
        this.pendingDartObservation = null;
        this.showMatchFinishConfirm = false;
        return;
      }

      if (this.pendingCheckoutScore == null) return;
      this.scoreInput.setValue(String(this.pendingCheckoutScore));
      this.pendingCheckoutScore = null;
      this.dartsAtDouble = null;
      this.dartsToFinish = null;
      this.showMatchFinishConfirm = false;
    },

    async maybeRunBotVisit(this: FiveOhOnePlayContext) {
      const botSeat = findBotSeat(this.$store.game.seats);
      if (!botSeat || !this.engine || this.finished) return;
      const state = this.state();
      if (!state || state.activeParticipantRef !== botSeat.participantRef)
        return;

      if (this.$store.game.inputModeKey === "QUICK_SCORE") {
        const remainingBefore = this.remainingScoreFor(botSeat.participantRef);
        let dartIndex = botDartIndex(
          this.$store.game.turns,
          botSeat.participantRef,
        );
        const fold = playFoldBotQuickScoreVisit(
          fiveOhOneEngineFactory,
          this.$store.game.configSnapshot!,
          this.engine.facts(),
          (scratchState) =>
            throwBotQuickScoreDart(scratchState, botSeat, dartIndex++),
          DARTS_PER_VISIT,
        );
        await this.recordVisit(
          fold.totalScore,
          fold.totalScore === remainingBefore,
        );
        return;
      }

      const thrower: BotDartThrower = () => throwBotDart(this, botSeat);
      await playRunBotVisualBoardVisit(this, botSeat.participantRef, thrower);
    },

    undoVisit(this: FiveOhOnePlayContext) {
      if (
        this.finished ||
        this.showDoubleConfirm ||
        this.showMatchFinishConfirm
      )
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

    /**
     * Uploads the fact log, then marks the session COMPLETED. On this path
     * only, SESSION_ALREADY_COMPLETED counts as success. Stats are copied into
     * `resultsSnapshot` before any store mutation so the results modal never
     * depends on `$store.game.turns` surviving a later reset.
     */
    async uploadAndCompleteSession(this: FiveOhOnePlayContext): Promise<void> {
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

      this.resultsSnapshot = buildResultsSnapshot(this);
      this.completionStatus = "succeeded";
    },

    resultsTitle(this: FiveOhOnePlayContext): string {
      const winner = matchWinnerName(
        this.$store.game.seats,
        this.resultsSnapshot?.winningSideKey ?? null,
      );
      return winner ? `${winner} wins the match!` : "Match Summary";
    },

    async back(this: FiveOhOnePlayContext) {
      return playBack(this);
    },

    async abandonAndExit(this: FiveOhOnePlayContext) {
      return playAbandonAndExit(this);
    },

    /**
     * Replays the same configuration template the first session used. Store
     * and UI are mutated only once the new session exists: on failure the
     * modal stays open with the results visible and the buttons enabled,
     * since the prior session is already COMPLETED.
     */
    async playAgain(this: FiveOhOnePlayContext) {
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
              overrides: { legs_to_win: config.legsToWin },
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

        this.finished = false;
        this.completionStatus = "pending";
        this.completionError = "";
        this.resultsSnapshot = null;
        this.pendingCheckoutScore = null;
        this.showDoubleConfirm = false;
        this.showMatchFinishConfirm = false;
        clearHiddenTimer(this);
        this.scoreInput.clear();
        this.error = "";
        this.hasActiveSession = true;

        const engine = factory.create(seatedSnapshot);
        if (!(engine instanceof FiveOhOneEngine)) return;
        this.engine = engine;
        this.$store.game.recordFacts(engine.facts());
      } finally {
        this.playAgainLoading = false;
      }
    },
  };
}
