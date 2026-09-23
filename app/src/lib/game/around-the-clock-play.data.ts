import { getEngineFactory } from "@modules/game/engine.registry";
import { matchWinnerName } from "@lib/game/match-result-text";
import {
  BULL_TARGET_NUMBER,
  targetAt,
} from "@modules/game/board-progression.module";
import {
  formatRemaining,
  maybeResumeCountdown,
  startCountdown,
} from "@lib/game/play-countdown";
import { toWireConfig } from "@lib/game/rulesets/config-codec";
import {
  playAbandonAndExit,
  playBack,
  playCommitDart,
  playInit,
  playPreviewSegments,
  playRetryReconciliation,
  playRunBotVisualBoardVisit,
  playToggleTimerPause,
  playUndoVisit,
  playUploadAndCompleteSession,
  playVisitMarkers,
  runPlayAgain,
  undoToActiveSeat,
} from "@lib/game/play-lifecycle";
import { boardInputData } from "@lib/game/board-input.data";
import { accuracyDisplay } from "@lib/game/play-visit-stats";
import { skillProfileForLevel } from "@modules/dartbot/skill-profile.module";
import { createDartRng } from "@modules/dartbot/rng.module";
import { throwDart as botThrowDart } from "@modules/dartbot/throw-engine.module";
import { chooseTarget } from "@modules/dartbot/strategy/dictated.strategy.module";
import type {
  AroundTheClockEngineConfig,
  AroundTheClockV2Snapshot,
  RulesetVersionKey,
  Seated,
  SeatFact,
} from "@lib/types";
import type {
  AroundTheClockRules,
  AroundTheClockSeatState,
  AroundTheClockState,
  DartFact,
  DartObservation,
  TurnFact,
} from "@modules/types";
import type {
  AroundTheClockPlayContext,
  AroundTheClockPreviewSegment,
  AroundTheClockSeatResult,
  BoardMarker,
  BotDartThrower,
  BotPacing,
} from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// aroundTheClockEngineFactory so the registry can resolve this page's own
// V1 and V2 keys.
import {
  applyAroundTheClockDart,
  AroundTheClockEngine,
  foldAroundTheClockState,
  initialAroundTheClockState,
  isClockHit,
  rulesOf,
} from "@modules/game/around-the-clock.engine.module";

const GAME_TYPE_KEY = "AROUND_THE_CLOCK";
const RESUMABLE = new Set<RulesetVersionKey>([
  "AROUND_THE_CLOCK_V1",
  "AROUND_THE_CLOCK_V2",
]);

/** The session's own key, read off the snapshot's shape (as the engine does). */
function keyOf(config: AroundTheClockEngineConfig): RulesetVersionKey {
  return "pathDirection" in config
    ? "AROUND_THE_CLOCK_V2"
    : "AROUND_THE_CLOCK_V1";
}

/** A timed V2 snapshot, or null for V1 and untimed V2. */
function timedConfig(
  config: AroundTheClockEngineConfig | null,
): (Seated<AroundTheClockV2Snapshot> & { durationValue: number }) | null {
  if (!config || !("durationType" in config)) return null;
  if (config.durationType !== "MINUTES" || config.durationValue === null) {
    return null;
  }
  return { ...config, durationValue: config.durationValue };
}

function labelOf(rules: AroundTheClockRules, index: number): string {
  const target = targetAt(rules.path, index);
  return target.kind === "BULL" ? "BULL" : String(target.number);
}

const EMPTY_SEGMENTS: readonly AroundTheClockPreviewSegment[] = [
  { status: "empty" },
  { status: "empty" },
  { status: "empty" },
];

function dartObservation(dart: DartFact): DartObservation {
  return {
    hitTargetNumber: dart.hitTargetNumber,
    hitZoneKey: dart.hitZoneKey,
    locationX: dart.locationX,
    locationY: dart.locationY,
  };
}

/**
 * Replays every dart in fact-log order through the target-progression
 * rules, in step with the engine's own `deriveState`, and records whether
 * each one actually advanced the target. The tap input (`recordTap`)
 * always aims at whichever target is active, so every non-MISS tap is a
 * genuine hit — but a VISUAL_BOARD dart lands wherever the player touched
 * the board, so `hitZoneKey !== "MISS"` alone cannot tell a hit on the
 * active target from a hit on the wrong number.
 */
function replayHits(
  config: AroundTheClockEngineConfig,
  turns: readonly TurnFact[],
): boolean[] {
  const rules = rulesOf(config);
  let state = initialAroundTheClockState(config).seats[0];
  const hits: boolean[] = [];
  for (const turn of turns) {
    for (const dart of turn.darts) {
      if (state.status !== "IN_PROGRESS") break;
      const observation = dartObservation(dart);
      const target = targetAt(rules.path, state.targetIndex);
      hits.push(isClockHit(rules, target, observation));
      state = applyAroundTheClockDart(state, observation, rules);
    }
  }
  return hits;
}

function previewSegmentsFor(
  config: AroundTheClockEngineConfig,
  turns: readonly TurnFact[],
  hiddenTurnKey: string | null,
): AroundTheClockPreviewSegment[] {
  const priorDarts = turns
    .slice(0, -1)
    .reduce((total, turn) => total + turn.darts.length, 0);
  const hits = replayHits(config, turns);
  return playPreviewSegments(turns, hiddenTurnKey, (_dart, i) =>
    hits[priorDarts + i] ? "hit" : "miss",
  );
}

function countHits(
  config: AroundTheClockEngineConfig,
  turns: readonly TurnFact[],
): number {
  return replayHits(config, turns).filter(Boolean).length;
}

function countDarts(turns: readonly TurnFact[]): number {
  return turns.reduce((total, turn) => total + turn.darts.length, 0);
}

function statsFor(
  seat: AroundTheClockSeatState,
  turns: readonly TurnFact[],
  config: AroundTheClockEngineConfig | null,
): AroundTheClockSeatResult {
  const seatTurns = turns.filter(
    (turn) => turn.participantRef === seat.participantRef,
  );
  const timed = timedConfig(config);
  return {
    laps: timed ? seat.laps : null,
    targetAtEnd: timed ? labelOf(rulesOf(timed), seat.targetIndex) : null,
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    turns: seatTurns.length,
    accuracy: config
      ? accuracyDisplay(countHits(config, seatTurns), countDarts(seatTurns))
      : "0.00%",
    totalDarts: countDarts(seatTurns),
  };
}

function resumeEngine(
  game: AroundTheClockPlayContext["$store"]["game"],
): AroundTheClockEngine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (
    !configSnapshot ||
    !rulesetVersionKey ||
    !RESUMABLE.has(rulesetVersionKey)
  ) {
    return null;
  }
  const factory = getEngineFactory(rulesetVersionKey);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof AroundTheClockEngine ? engine : null;
}

const BOT_PRE_THROW_MS = 900;
const BOT_POST_THROW_MS = 250;

type DartbotSeat = Extract<SeatFact, { participantTypeKey: "DARTBOT" }>;

function botDartIndex(turns: readonly TurnFact[], botRef: string): number {
  return turns
    .filter((turn) => turn.participantRef === botRef)
    .reduce((sum, turn) => sum + turn.darts.length, 0);
}

/**
 * The real per-dart thrower: the shipped skill curve, seeded RNG, dictated
 * strategy and throw engine, combined the same way `shanghai-play.data.ts`
 * already does. `dartIndex` is re-derived from the fact log on every call —
 * never held on this closure — so an undone bot visit re-throws identically
 * from the same seed (`08-DartBot.md` §Determinism and Replay).
 */
function throwBotDart(
  context: AroundTheClockPlayContext,
  botSeat: DartbotSeat,
): { observation: DartObservation; pacing: BotPacing } {
  const state = context.state();
  const seatState = state?.seats.find(
    (seat) => seat.participantRef === botSeat.participantRef,
  );
  if (!state || !seatState) {
    throw new Error("DartBot has no seat in this session's engine state");
  }
  const profile = skillProfileForLevel(botSeat.dartbot.level);
  const dartIndex = botDartIndex(
    context.$store.game.turns,
    botSeat.participantRef,
  );
  const rng = createDartRng(botSeat.dartbot.seed, dartIndex);
  const config = context.$store.game.configSnapshot!;
  const target = targetAt(rulesOf(config).path, seatState.targetIndex);
  const intent = chooseTarget({ target });
  const thrown = botThrowDart(intent, profile, rng);
  return {
    observation: {
      hitTargetNumber: thrown.hit.targetNumber,
      hitZoneKey: thrown.hit.zoneKey,
      locationX: thrown.landing.x,
      locationY: thrown.landing.y,
    },
    pacing: { preThrowMs: BOT_PRE_THROW_MS, postThrowMs: BOT_POST_THROW_MS },
  };
}

function findBotSeat(seats: readonly SeatFact[]): DartbotSeat | undefined {
  return seats.find(
    (seat): seat is DartbotSeat => seat.participantTypeKey === "DARTBOT",
  );
}

export function aroundTheClockPlay() {
  let self: AroundTheClockPlayContext;

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
    resultsSnapshot: null as AroundTheClockPlayContext["resultsSnapshot"],
    hiddenTurnKey: null as string | null,
    hiddenTimer: null as ReturnType<typeof setTimeout> | null,
    botThrowing: false,
    timer: null as AroundTheClockPlayContext["timer"],
    engine: null as AroundTheClockEngine | null,
    ...boardInputData(
      (observation) => self.recordDart(observation),
      () => self.$store.game.turns,
    ),

    state(this: AroundTheClockPlayContext): AroundTheClockState | null {
      const config = this.$store.game.configSnapshot;
      if (!config) return null;
      return foldAroundTheClockState(
        { stages: this.$store.game.stages, turns: this.$store.game.turns },
        config,
        this.$store.game.timerExpired ?? false,
      );
    },

    activeSeatState(
      this: AroundTheClockPlayContext,
    ): AroundTheClockSeatState | null {
      const state = this.state();
      if (!state) return null;
      return (
        state.seats.find(
          (seat) => seat.participantRef === state.activeParticipantRef,
        ) ?? null
      );
    },

    currentTargetLabelFor(
      this: AroundTheClockPlayContext,
      seatRef: string,
    ): string {
      const seat = this.state()?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      if (!seat) return "";
      return labelOf(
        rulesOf(this.$store.game.configSnapshot!),
        seat.targetIndex,
      );
    },

    currentTargetLabel(this: AroundTheClockPlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.currentTargetLabelFor(state.activeParticipantRef);
    },

    turnsSoFarFor(this: AroundTheClockPlayContext, seatRef: string): string {
      return String(
        this.$store.game.turns.filter((turn) => turn.participantRef === seatRef)
          .length,
      );
    },

    turnsSoFar(this: AroundTheClockPlayContext): string {
      const state = this.state();
      if (!state) return "0";
      return this.turnsSoFarFor(state.activeParticipantRef);
    },

    accuracyFor(this: AroundTheClockPlayContext, seatRef: string): string {
      const config = this.$store.game.configSnapshot!;
      const turns = this.$store.game.turns.filter(
        (turn) => turn.participantRef === seatRef,
      );
      return accuracyDisplay(countHits(config, turns), countDarts(turns));
    },

    accuracy(this: AroundTheClockPlayContext): string {
      const state = this.state();
      if (!state) return "0.00%";
      return this.accuracyFor(state.activeParticipantRef);
    },

    isBullVisit(this: AroundTheClockPlayContext): boolean {
      const seat = this.activeSeatState();
      if (!seat) return false;
      const config = this.$store.game.configSnapshot!;
      return targetAt(rulesOf(config).path, seat.targetIndex).kind === "BULL";
    },

    isTimed(this: AroundTheClockPlayContext): boolean {
      return timedConfig(this.$store.game.configSnapshot) !== null;
    },

    laps(this: AroundTheClockPlayContext): number {
      return this.activeSeatState()?.laps ?? 0;
    },

    remainingLabel(this: AroundTheClockPlayContext): string {
      return formatRemaining(this.$store.game.timerRemainingMs);
    },

    /** "hits / needed" in the open visit; empty on Easy (mid-visit advance). */
    hitsNeededLabel(this: AroundTheClockPlayContext): string {
      const config = this.$store.game.configSnapshot;
      const seat = this.activeSeatState();
      if (!config || !seat) return "";
      const { hitsRequired } = rulesOf(config);
      if (hitsRequired === 0) return "";
      return `${seat.hitsThisVisit} / ${hitsRequired} hits`;
    },

    previewSegments(
      this: AroundTheClockPlayContext,
    ): AroundTheClockPreviewSegment[] {
      const config = this.$store.game.configSnapshot;
      if (!this.engine || !config) return [...EMPTY_SEGMENTS];
      const turns = this.$store.game.turns;
      const lastParticipantRef = turns.at(-1)?.participantRef;
      const seatTurns = turns.filter(
        (turn) => turn.participantRef === lastParticipantRef,
      );
      return previewSegmentsFor(config, seatTurns, this.hiddenTurnKey);
    },

    /**
     * A timed run resumes its countdown after `playInit`. Expiry lands in the
     * store flag the `$watch` reads: a run whose open visit is already closed
     * finishes there; one mid-visit finishes on that visit's last dart, via
     * `playCommitDart`'s own `isComplete()` check.
     */
    async init(this: AroundTheClockPlayContext) {
      self = this;
      await playInit(this, GAME_TYPE_KEY, resumeEngine);
      const timed = timedConfig(this.$store.game.configSnapshot);
      if (timed && this.engine && !this.finished) {
        this.timer = maybeResumeCountdown(this.$store.game, timed, this.engine);
        this.$watch("$store.game.timerExpired", () => this.finishIfExpired());
        await this.finishIfExpired();
      }
      await this.maybeRunBotVisit();
    },

    async finishIfExpired(this: AroundTheClockPlayContext) {
      if (this.finished || !this.engine?.isComplete()) return;
      this.finished = true;
      this.completionStatus = "pending";
      await this.uploadAndCompleteSession();
    },

    togglePause(this: AroundTheClockPlayContext) {
      playToggleTimerPause(this);
    },

    destroy(this: AroundTheClockPlayContext) {
      this.timer?.stop();
    },

    retryReconciliation(this: AroundTheClockPlayContext) {
      return playRetryReconciliation(this);
    },

    async recordTap(
      this: AroundTheClockPlayContext,
      ring: "SINGLE" | "DOUBLE" | "TREBLE" | "MISS",
    ) {
      if (!this.engine || this.finished) return;
      const seat = this.activeSeatState();
      if (!seat) return;
      const config = this.$store.game.configSnapshot!;
      const target = targetAt(rulesOf(config).path, seat.targetIndex);
      if (target.kind === "BULL" && ring === "TREBLE") return;
      const observation: DartObservation =
        ring === "MISS"
          ? {
              hitTargetNumber: null,
              hitZoneKey: "MISS",
              locationX: null,
              locationY: null,
            }
          : target.kind === "BULL"
            ? {
                hitTargetNumber: BULL_TARGET_NUMBER,
                hitZoneKey: ring === "SINGLE" ? "OUTER_BULL" : "INNER_BULL",
                locationX: null,
                locationY: null,
              }
            : {
                hitTargetNumber: target.number,
                hitZoneKey: ring,
                locationX: null,
                locationY: null,
              };
      await this.commitDart(observation);
    },

    async commitDart(
      this: AroundTheClockPlayContext,
      observation: DartObservation,
    ) {
      await playCommitDart(this, observation);
      await this.maybeRunBotVisit();
    },

    async maybeRunBotVisit(this: AroundTheClockPlayContext) {
      const botSeat = findBotSeat(this.$store.game.seats);
      if (!botSeat) return;
      const thrower: BotDartThrower = () => throwBotDart(this, botSeat);
      await playRunBotVisualBoardVisit(this, botSeat.participantRef, thrower);
    },

    async recordDart(
      this: AroundTheClockPlayContext,
      observation: DartObservation,
    ) {
      if (!this.engine || this.finished) return;
      await this.commitDart(observation);
    },

    /**
     * Overrides `boardInputData`'s own `visitMarkers` — object-literal key
     * order means this later definition wins, so the shared module needs no
     * change. Delegates to `play-lifecycle.ts`'s shared implementation.
     */
    visitMarkers(this: AroundTheClockPlayContext): BoardMarker[] {
      return playVisitMarkers(this);
    },

    async undoVisit(this: AroundTheClockPlayContext) {
      const botSeat = findBotSeat(this.$store.game.seats);
      if (botSeat) {
        const humanSeat = this.$store.game.seats.find(
          (seat) => seat.participantTypeKey === "PLAYER",
        )!;
        undoToActiveSeat(this, humanSeat.participantRef);
      } else {
        playUndoVisit(this);
      }
      await this.maybeRunBotVisit();
    },

    uploadAndCompleteSession(this: AroundTheClockPlayContext): Promise<void> {
      const config = this.$store.game.configSnapshot;
      return playUploadAndCompleteSession(this, (finalState) => ({
        winningSideKey: finalState.winningSideKey,
        status: (finalState.status ?? "COMPLETE") as "COMPLETE" | "TIE",
        seats: finalState.seats.map((seat) =>
          statsFor(seat, this.$store.game.turns, config),
        ),
      }));
    },

    resultsTitle(this: AroundTheClockPlayContext): string {
      const timedSeat = this.resultsSnapshot?.seats[0];
      if (timedSeat?.laps != null && this.resultsSnapshot?.seats.length === 1) {
        return `Time — ${timedSeat.laps} laps, on ${timedSeat.targetAtEnd}`;
      }
      if (this.resultsSnapshot?.status === "TIE") return "Tie — same darts!";
      const winner = matchWinnerName(
        this.$store.game.seats,
        this.resultsSnapshot?.winningSideKey ?? null,
      );
      return winner ? `${winner} wins — fewest darts!` : "Session complete";
    },

    back(this: AroundTheClockPlayContext) {
      return playBack(this);
    },

    abandonAndExit(this: AroundTheClockPlayContext) {
      return playAbandonAndExit(this, () => this.timer?.stop());
    },

    /**
     * Replays under the session's own key. V2 resends every variant as
     * overrides (V1 has none) and restarts a timed run's countdown.
     */
    playAgain(this: AroundTheClockPlayContext) {
      const config = this.$store.game.configSnapshot;
      if (!config) return Promise.resolve();
      const key = keyOf(config);
      return runPlayAgain(
        this,
        GAME_TYPE_KEY,
        key,
        (engine) => (engine instanceof AroundTheClockEngine ? engine : null),
        key === "AROUND_THE_CLOCK_V2"
          ? (prior) => {
              const { seats: _seats, ...variants } =
                prior as Seated<AroundTheClockV2Snapshot>;
              return {
                snapshot: variants,
                wire: toWireConfig("AROUND_THE_CLOCK_V2", variants),
              };
            }
          : undefined,
        () => {
          this.timer?.stop();
          this.timer = null;
          this.$store.game.timerRemainingMs = null;
          this.$store.game.timerStartedAt = null;
          this.$store.game.timerExpired = false;
          this.$store.game.timerPaused = false;
        },
        (engine) => {
          const timed = timedConfig(this.$store.game.configSnapshot);
          if (timed) {
            this.timer = startCountdown(
              this.$store.game,
              timed.durationValue,
              engine,
            );
          }
        },
      );
    },
  };
}
