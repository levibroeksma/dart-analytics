import { botSeatState, botThrowObservation } from "@lib/game/play-bot-seat";
import { playAgainStarterData } from "@lib/game/play-again-starter";
import { getEngineFactory } from "@modules/game/engine.registry";
import { matchWinnerName } from "@lib/game/match-result-text";
import { joinSubtitle } from "@lib/game/play-subtitle";
import {
  BULL_TARGET_NUMBER,
  boardTargetLabel,
  targetAt,
} from "@modules/game/board-progression.module";
import {
  formatRemaining,
  maybeResumeCountdown,
  startCountdown,
} from "@lib/game/play-countdown";
import {
  playPreviewSegments,
  playUploadAndCompleteSession,
  runPlayAgain,
  variantsPlayAgain,
} from "@lib/game/play-lifecycle";
import {
  boardPlayActions,
  botVisualBoardData,
  playScreenActions,
  playScreenState,
  resetTimerForPlayAgain,
  timedPlayData,
  forActiveSeat,
} from "@lib/game/play-screen.data";
import { accuracyDisplay } from "@lib/game/play-visit-stats";
import { chooseTarget } from "@modules/dartbot/strategy/dictated.strategy.module";
import type {
  AroundTheClockEngineConfig,
  AroundTheClockV2Snapshot,
  RulesetVersionKey,
  Seated,
  DartbotSeat,
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
  AroundTheClockResultsSnapshot,
  AroundTheClockSeatResult,
  BotPacing,
} from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// aroundTheClockEngineFactory so the registry can resolve this page's own
// V1, V2 and V3 keys.
import {
  applyAroundTheClockDart,
  AroundTheClockEngine,
  foldAroundTheClockState,
  initialAroundTheClockState,
  isClockHit,
  rulesOf,
  rulesetKeyOf,
} from "@modules/game/around-the-clock.engine.module";

const GAME_TYPE_KEY = "AROUND_THE_CLOCK";
const RESUMABLE = new Set<RulesetVersionKey>([
  "AROUND_THE_CLOCK_V1",
  "AROUND_THE_CLOCK_V2",
  "AROUND_THE_CLOCK_V3",
]);

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
  return boardTargetLabel(targetAt(rules.path, index));
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

/** The title a solo run earns: out of lives, or a timed run's laps; null otherwise. */
function soloTitle(
  snapshot: AroundTheClockResultsSnapshot | null,
): string | null {
  const seat = snapshot?.seats[0];
  if (snapshot?.seats.length !== 1 || !seat) return null;
  if (seat.out) return `Out on ${seat.targetAtEnd}`;
  if (seat.laps != null) {
    return `Time — ${seat.laps} laps, on ${seat.targetAtEnd}`;
  }
  return null;
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
  const reached = timed ?? (seat.lives === undefined ? null : config);
  return {
    ...(seat.lives === undefined
      ? {}
      : { lives: seat.lives, out: seat.status === "OUT" }),
    laps: timed ? seat.laps : null,
    targetAtEnd: reached ? labelOf(rulesOf(reached), seat.targetIndex) : null,
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
  const seatState = botSeatState(context.state(), botSeat);
  const config = context.$store.game.configSnapshot!;
  const target = targetAt(rulesOf(config).path, seatState.targetIndex);
  return botThrowObservation(
    botSeat,
    context.$store.game.turns,
    chooseTarget({ target }),
  );
}

/**
 * A timed run resumes its countdown after `playInit`. Expiry lands in the
 * store flag the `$watch` reads: a run whose open visit is already closed
 * finishes there; one mid-visit finishes on that visit's last dart, via
 * `playCommitDart`'s own `isComplete()` check.
 */
async function resumeCountdown(
  context: AroundTheClockPlayContext,
): Promise<void> {
  const timed = timedConfig(context.$store.game.configSnapshot);
  if (timed && context.engine && !context.finished) {
    context.timer = maybeResumeCountdown(
      context.$store.game,
      timed,
      context.engine,
    );
    context.$watch("$store.game.timerExpired", () => context.finishIfExpired());
    await context.finishIfExpired();
  }
}

export function aroundTheClockPlay() {
  return {
    ...playScreenState<
      AroundTheClockEngine,
      AroundTheClockPlayContext["resultsSnapshot"]
    >(),
    ...playAgainStarterData(),
    ...boardPlayActions({
      gameTypeKey: GAME_TYPE_KEY,
      resume: resumeEngine,
      afterInit: resumeCountdown,
    }),
    ...botVisualBoardData(throwBotDart),
    ...playScreenActions(),
    ...timedPlayData(),

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
      return forActiveSeat(this, (ref) => this.currentTargetLabelFor(ref), "");
    },

    turnsSoFarFor(this: AroundTheClockPlayContext, seatRef: string): string {
      return String(
        this.$store.game.turns.filter((turn) => turn.participantRef === seatRef)
          .length,
      );
    },

    turnsSoFar(this: AroundTheClockPlayContext): string {
      return forActiveSeat(this, (ref) => this.turnsSoFarFor(ref), "0");
    },

    accuracyFor(this: AroundTheClockPlayContext, seatRef: string): string {
      const config = this.$store.game.configSnapshot!;
      const turns = this.$store.game.turns.filter(
        (turn) => turn.participantRef === seatRef,
      );
      return accuracyDisplay(countHits(config, turns), countDarts(turns));
    },

    accuracy(this: AroundTheClockPlayContext): string {
      return forActiveSeat(this, (ref) => this.accuracyFor(ref), "0.00%");
    },

    isBullVisit(this: AroundTheClockPlayContext): boolean {
      const seat = this.activeSeatState();
      if (!seat) return false;
      const config = this.$store.game.configSnapshot!;
      return targetAt(rulesOf(config).path, seat.targetIndex).kind === "BULL";
    },

    hasLives(this: AroundTheClockPlayContext): boolean {
      const config = this.$store.game.configSnapshot;
      return config !== null && "lives" in config;
    },

    isTimed(this: AroundTheClockPlayContext): boolean {
      return timedConfig(this.$store.game.configSnapshot) !== null;
    },

    laps(this: AroundTheClockPlayContext): number {
      return this.activeSeatState()?.laps ?? 0;
    },

    livesLeft(this: AroundTheClockPlayContext): string {
      const lives = this.activeSeatState()?.lives;
      return lives === undefined ? "" : String(lives);
    },

    remainingLabel(this: AroundTheClockPlayContext): string {
      return formatRemaining(this.$store.game.timerRemainingMs);
    },

    /**
     * Play-header subtitle: lap and path ends (`LAP 2 · 1 → 20`). The path
     * ends in BULL; its last number is the one before it. Blank before
     * config loads.
     */
    subtitle(this: AroundTheClockPlayContext): string {
      const config = this.$store.game.configSnapshot;
      if (!config) return "";
      const numbers = rulesOf(config).path.flatMap((target) =>
        target.kind === "BULL" ? [] : [target.number],
      );
      return joinSubtitle([
        `LAP ${this.laps() + 1}`,
        `${numbers[0]} → ${numbers.at(-1)}`,
      ]);
    },

    /** Hits the seat still needs in its open visit (`2 to hit`); blank on Easy, where any hit advances. */
    hitsToGoFor(this: AroundTheClockPlayContext, seatRef: string): string {
      const config = this.$store.game.configSnapshot;
      const seat = this.state()?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      if (!config || !seat) return "";
      const { hitsRequired } = rulesOf(config);
      if (hitsRequired === 0) return "";
      return `${Math.max(hitsRequired - seat.hitsThisVisit, 0)} to hit`;
    },

    hitsToGo(this: AroundTheClockPlayContext): string {
      return forActiveSeat(this, (ref) => this.hitsToGoFor(ref), "");
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

    async finishIfExpired(this: AroundTheClockPlayContext) {
      if (this.finished || !this.engine?.isComplete()) return;
      this.finished = true;
      this.completionStatus = "pending";
      await this.uploadAndCompleteSession();
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
      const solo = soloTitle(this.resultsSnapshot);
      if (solo) return solo;
      if (this.resultsSnapshot?.status === "TIE") return "Tie — same darts!";
      const winner = matchWinnerName(
        this.$store.game.seats,
        this.resultsSnapshot?.winningSideKey ?? null,
      );
      if (!winner) return "Session complete";
      return this.hasLives()
        ? `${winner} wins!`
        : `${winner} wins — fewest darts!`;
    },

    /**
     * Replays under the session's own key. V2 resends every variant as
     * overrides (V1 has none) and restarts a timed run's countdown.
     */
    playAgain(this: AroundTheClockPlayContext) {
      const config = this.$store.game.configSnapshot;
      if (!config) return Promise.resolve();
      const key = rulesetKeyOf(config);
      return runPlayAgain(
        this,
        GAME_TYPE_KEY,
        key,
        (engine) => (engine instanceof AroundTheClockEngine ? engine : null),
        key === "AROUND_THE_CLOCK_V1" ? undefined : variantsPlayAgain(key),
        () => resetTimerForPlayAgain(this),
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
