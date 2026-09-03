import { getEngineFactory } from "@modules/game/engine.registry";
import { matchWinnerName } from "@lib/game/match-result-text";
import { numbersPath, targetAt } from "@modules/game/board-progression.module";
import {
  playAbandonAndExit,
  playBack,
  playCommitDart,
  playInit,
  playPreviewSegments,
  playRetryReconciliation,
  playRunBotVisualBoardVisit,
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
import type { RulesetVersionKey, SeatFact } from "@lib/types";
import type {
  DartObservation,
  ShanghaiSeatState,
  ShanghaiState,
  TurnFact,
} from "@modules/types";
import type {
  BoardMarker,
  BotDartThrower,
  BotPacing,
  ShanghaiPlayContext,
  ShanghaiPreviewSegment,
  ShanghaiSeatResult,
} from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// shanghaiEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import {
  ShanghaiEngine,
  foldShanghaiState,
  zoneBucketOf,
} from "@modules/game/shanghai.engine.module";

const GAME_TYPE_KEY = "SHANGHAI";
const RESUMABLE_RULESET_VERSIONS = new Set<RulesetVersionKey>([
  "SHANGHAI_V1",
  "SHANGHAI_V2",
]);

/**
 * Rounds 1..20 never reach `numbersPath()`'s 21st (BULL) entry — mirrors the
 * same guard the engine itself carries, since this module also needs the
 * plain round number for the tap row and the preview.
 */
function targetNumberAt(targetIndex: number): number {
  const target = targetAt(numbersPath(), targetIndex);
  if (target.kind === "BULL") {
    throw new Error("Shanghai never reaches the BULL target");
  }
  return target.number;
}

/**
 * The last resolved turn maps 1:1 to the round at its own array index within
 * that turn's own seat's history — never `turns.length - 1`, which counts
 * every seat's turns together and is wrong the moment a 1v1 session's turns
 * interleave (issue #166). `seatRoundIndex` is computed once from a count of
 * `turns` filtered to the last turn's own `participantRef`, so a solo
 * session (where every turn already belongs to the one seat) computes the
 * exact same value `turns.length - 1` always gave it — no behavior change
 * there.
 */
function previewSegmentsFor(
  turns: readonly TurnFact[],
  hiddenTurnKey: string | null,
): ShanghaiPreviewSegment[] {
  const lastTurn = turns.at(-1);
  const seatRoundIndex = lastTurn
    ? turns.filter((turn) => turn.participantRef === lastTurn.participantRef)
        .length - 1
    : 0;
  return playPreviewSegments(turns, hiddenTurnKey, (dart) => {
    const targetNumber = targetNumberAt(seatRoundIndex);
    return dart.hitTargetNumber === targetNumber ? "hit" : "miss";
  });
}

/**
 * One seat's own results stats, replayed from its own darts in `turns` — a
 * seat's `targetIndex`/`totalScore` (from `finalState`) name where it ended
 * and its final score, but not its per-dart accuracy or zone breakdown,
 * which need each dart's own round at the time it was thrown. Every one of
 * a seat's own turns holds exactly 3 darts by the time a session is fully
 * complete (Shanghai has no early-visit-end rule), so grouping the seat's
 * flattened darts into 3s in throw order reproduces its round-by-round
 * history exactly.
 */
function statsFor(
  seat: ShanghaiSeatState,
  turns: readonly TurnFact[],
): ShanghaiSeatResult {
  const seatDarts = turns
    .filter((turn) => turn.participantRef === seat.participantRef)
    .flatMap((turn) => turn.darts);

  let hits = 0;
  let trebles = 0;
  let doubles = 0;
  let singles = 0;
  seatDarts.forEach((dart, index) => {
    const targetNumber = targetNumberAt(Math.floor(index / 3));
    if (dart.hitTargetNumber === targetNumber) hits += 1;
    const bucket = zoneBucketOf(dart.hitZoneKey);
    if (bucket === "TREBLE") trebles += 1;
    if (bucket === "DOUBLE") doubles += 1;
    if (bucket === "SINGLE") singles += 1;
  });

  const accuracy = accuracyDisplay(hits, seatDarts.length);

  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    score: seat.totalScore,
    round: seat.targetIndex + 1,
    accuracy,
    trebles,
    doubles,
    singles,
  };
}

/**
 * Rebuilds the engine for the persisted session, replaying the store's fact
 * log so a reload restores the game exactly. Accepts either ruleset version
 * — both build the same `ShanghaiEngine` class (Pattern 18) — since
 * `/games/shanghai/play` is shared between them.
 */
function resumeEngine(
  game: ShanghaiPlayContext["$store"]["game"],
): ShanghaiEngine | null {
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
  return engine instanceof ShanghaiEngine ? engine : null;
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
 * The real per-dart thrower: phases 1–3's shipped pipeline (skill curve,
 * seeded RNG, dictated strategy, throw engine), combined the same way
 * `bobs27-play.data.ts` already does. `dartIndex` is re-derived from the
 * fact log on every call — never held on this closure — so an undone bot
 * visit re-throws identically from the same seed (`08-DartBot.md`
 * §Determinism and Replay).
 */
function throwBotDart(
  context: ShanghaiPlayContext,
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
  const target = targetAt(numbersPath(), seatState.targetIndex);
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

export function shanghaiPlay() {
  let self: ShanghaiPlayContext;

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
    resultsSnapshot: null as ShanghaiPlayContext["resultsSnapshot"],
    hiddenTurnKey: null as string | null,
    hiddenTimer: null as ReturnType<typeof setTimeout> | null,
    botThrowing: false,
    engine: null as ShanghaiEngine | null,
    ...boardInputData((observation) => self.recordDart(observation)),

    state(this: ShanghaiPlayContext): ShanghaiState | null {
      const config = this.$store.game.configSnapshot;
      if (!config) return null;
      return foldShanghaiState(
        { stages: this.$store.game.stages, turns: this.$store.game.turns },
        config,
      );
    },

    currentTargetLabelFor(this: ShanghaiPlayContext, seatRef: string): string {
      const seat = this.state()?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      return seat ? String(targetNumberAt(seat.targetIndex)) : "";
    },

    currentTargetLabel(this: ShanghaiPlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.currentTargetLabelFor(state.activeParticipantRef);
    },

    roundLabelFor(this: ShanghaiPlayContext, seatRef: string): string {
      const seat = this.state()?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      return seat ? `${seat.targetIndex + 1}/20` : "";
    },

    roundLabel(this: ShanghaiPlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.roundLabelFor(state.activeParticipantRef);
    },

    currentScoreFor(this: ShanghaiPlayContext, seatRef: string): string {
      const seat = this.state()?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      return seat ? String(seat.totalScore) : "";
    },

    currentScore(this: ShanghaiPlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.currentScoreFor(state.activeParticipantRef);
    },

    isBullVisit(this: ShanghaiPlayContext): boolean {
      return false;
    },

    previewSegments(this: ShanghaiPlayContext): ShanghaiPreviewSegment[] {
      return previewSegmentsFor(this.$store.game.turns, this.hiddenTurnKey);
    },

    async init(this: ShanghaiPlayContext) {
      self = this;
      await playInit(this, GAME_TYPE_KEY, resumeEngine);
      await this.maybeRunBotVisit();
    },

    retryReconciliation(this: ShanghaiPlayContext) {
      return playRetryReconciliation(this);
    },

    async recordTap(
      this: ShanghaiPlayContext,
      ring: "SINGLE" | "DOUBLE" | "TREBLE" | "MISS",
    ) {
      if (!this.engine) return;
      const state = this.state();
      const activeSeat = state?.seats.find(
        (seat) => seat.participantRef === state.activeParticipantRef,
      );
      if (!activeSeat) return;
      const observation: DartObservation =
        ring === "MISS"
          ? {
              hitTargetNumber: null,
              hitZoneKey: "MISS",
              locationX: null,
              locationY: null,
            }
          : {
              hitTargetNumber: targetNumberAt(activeSeat.targetIndex),
              hitZoneKey: ring,
              locationX: null,
              locationY: null,
            };
      await this.commitDart(observation);
    },

    async commitDart(this: ShanghaiPlayContext, observation: DartObservation) {
      await playCommitDart(this, observation);
      await this.maybeRunBotVisit();
    },

    async maybeRunBotVisit(this: ShanghaiPlayContext) {
      const botSeat = findBotSeat(this.$store.game.seats);
      if (!botSeat) return;
      const thrower: BotDartThrower = () => throwBotDart(this, botSeat);
      await playRunBotVisualBoardVisit(this, botSeat.participantRef, thrower);
    },

    async recordDart(this: ShanghaiPlayContext, observation: DartObservation) {
      if (!this.engine || this.finished) return;
      await this.commitDart(observation);
    },

    /**
     * Overrides `boardInputData`'s own `visitMarkers` — object-literal key
     * order means this later definition wins, so the shared module needs no
     * change. Delegates to `play-lifecycle.ts`'s shared implementation.
     */
    visitMarkers(this: ShanghaiPlayContext): BoardMarker[] {
      return playVisitMarkers(this);
    },

    async undoVisit(this: ShanghaiPlayContext) {
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

    uploadAndCompleteSession(this: ShanghaiPlayContext): Promise<void> {
      const turns = this.$store.game.turns;
      return playUploadAndCompleteSession(this, (finalState) => ({
        status: finalState.status as "SHANGHAI" | "COMPLETE" | "TIE",
        winningSideKey: finalState.winningSideKey,
        seats: finalState.seats.map((seat) => statsFor(seat, turns)),
      }));
    },

    resultsTitle(this: ShanghaiPlayContext): string {
      if (!(this.completionStatus === "succeeded" && this.resultsSnapshot)) {
        return "Session complete";
      }
      if (this.resultsSnapshot.status === "TIE") return "Tie — same score!";
      const winner = matchWinnerName(
        this.$store.game.seats,
        this.resultsSnapshot.winningSideKey,
      );
      const isShanghai = this.resultsSnapshot.status === "SHANGHAI";
      if (!winner) return isShanghai ? "Shanghai!" : "Session complete";
      return isShanghai ? `${winner} hits a Shanghai!` : `${winner} wins!`;
    },

    back(this: ShanghaiPlayContext) {
      return playBack(this);
    },

    abandonAndExit(this: ShanghaiPlayContext) {
      return playAbandonAndExit(this);
    },

    playAgain(this: ShanghaiPlayContext) {
      const rulesetVersionKey = this.$store.game.rulesetVersionKey;
      if (
        !rulesetVersionKey ||
        !RESUMABLE_RULESET_VERSIONS.has(rulesetVersionKey)
      )
        return;
      return runPlayAgain(this, GAME_TYPE_KEY, rulesetVersionKey, (engine) =>
        engine instanceof ShanghaiEngine ? engine : null,
      );
    },
  };
}
