import { botThrowObservation } from "@lib/game/play-bot-seat";
import { playAgainStarterData } from "@lib/game/play-again-starter";
import { getEngineFactory } from "@modules/game/engine.registry";
import { matchWinnerName } from "@lib/game/match-result-text";
import { doublesPath, targetAt } from "@modules/game/board-progression.module";
import {
  doublesPathObservation,
  doublesPathPreviewSegments,
  doublesPathTargetLabel,
} from "@lib/game/doubles-path-play";
import { accuracyDisplay } from "@lib/game/play-visit-stats";
import {
  boardPlayActions,
  botVisualBoardData,
  playScreenActions,
  playScreenState,
} from "@lib/game/play-screen.data";
import {
  playUploadAndCompleteSession,
  runPlayAgain,
  variantsPlayAgain,
} from "@lib/game/play-lifecycle";
import { chooseTarget } from "@modules/dartbot/strategy/dictated.strategy.module";
import type {
  Bobs27Snapshot,
  DartbotSeat,
  RulesetVersionKey,
} from "@lib/types";
import type {
  Bobs27SeatState,
  Bobs27State,
  DartObservation,
  TurnFact,
} from "@modules/types";
import type { BotPacing } from "./types";
import type {
  Bobs27PlayContext,
  Bobs27PreviewSegment,
  Bobs27ResultsSnapshot,
  Bobs27SeatResult,
} from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// both Bob's 27 engine factories so the registry can resolve this page's
// own keys.
import {
  Bobs27Engine,
  foldBobs27State,
} from "@modules/game/bobs27.engine.module";

const GAME_TYPE_KEY = "BOBS27";
const RESUMABLE = new Set<RulesetVersionKey>(["BOBS27_V1", "BOBS27_V2"]);

function statsFor(
  seat: Bobs27SeatState,
  turns: readonly TurnFact[],
): Bobs27SeatResult {
  const seatTurns = turns.filter(
    (turn) => turn.participantRef === seat.participantRef,
  );
  const darts = seatTurns.reduce((sum, turn) => sum + turn.darts.length, 0);
  const hits = seatTurns.reduce(
    (sum, turn) =>
      sum +
      turn.darts.filter(
        (dart) =>
          dart.hitTargetNumber === dart.intendedTargetNumber &&
          dart.hitZoneKey === dart.intendedZoneKey,
      ).length,
    0,
  );
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    score: seat.score,
    darts,
    doubleHitRate: accuracyDisplay(hits, darts),
    highestNumberReached: doublesPathTargetLabel(
      targetAt(doublesPath(), seat.targetIndex),
    ),
  };
}

function computeStats(
  state: Bobs27State,
  turns: readonly TurnFact[],
): Bobs27ResultsSnapshot {
  return {
    status: state.status as Bobs27ResultsSnapshot["status"],
    winningSideKey: state.winningSideKey,
    seats: state.seats.map((seat) => statsFor(seat, turns)),
  };
}

/**
 * Rebuilds the engine for the persisted session, replaying the store's fact
 * log so a reload restores the game exactly. Mirrors
 * `five-oh-one-play.data.ts`'s `resumeEngine`.
 */
function resumeEngine(
  game: Bobs27PlayContext["$store"]["game"],
): Bobs27Engine | null {
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
  return engine instanceof Bobs27Engine ? engine : null;
}

/**
 * The real per-dart thrower: phases 1–3's shipped pipeline (skill curve,
 * seeded RNG, dictated strategy, throw engine), combined the same way
 * `play-dictated-session.ts`'s test harness already does for a solo bot.
 * `dartIndex` is re-derived from the fact log on every call — never held on
 * this closure — so an undone bot visit re-throws identically from the same
 * seed (`08-DartBot.md` §Determinism and Replay).
 */
function throwBotDart(
  context: Bobs27PlayContext,
  botSeat: DartbotSeat,
): { observation: DartObservation; pacing: BotPacing } {
  const state = context.state();
  const seatState = state?.seats.find(
    (seat) => seat.participantRef === botSeat.participantRef,
  );
  if (!state || !seatState) {
    throw new Error("DartBot has no seat in this session's engine state");
  }
  const target = targetAt(doublesPath(), seatState.targetIndex);
  return botThrowObservation(
    botSeat,
    context.$store.game.turns,
    chooseTarget({ target }),
  );
}

export function bobs27Play() {
  return {
    ...playScreenState<Bobs27Engine, Bobs27ResultsSnapshot>(),
    ...playAgainStarterData(),
    ...boardPlayActions({ gameTypeKey: GAME_TYPE_KEY, resume: resumeEngine }),
    ...botVisualBoardData(throwBotDart),
    ...playScreenActions(),

    state(this: Bobs27PlayContext): Bobs27State | null {
      const config = this.$store.game.configSnapshot;
      if (!config) return null;
      return foldBobs27State(
        { stages: this.$store.game.stages, turns: this.$store.game.turns },
        config,
      );
    },

    /** Play-header subtitle: `ROUND 4 OF 21` along the doubles path; blank before config loads. */
    subtitle(this: Bobs27PlayContext): string {
      const state = this.state();
      const seat = state?.seats.find(
        (candidate) => candidate.participantRef === state.activeParticipantRef,
      );
      if (!seat) return "";
      const rounds = doublesPath().length;
      return `ROUND ${Math.min(seat.targetIndex + 1, rounds)} OF ${rounds}`;
    },

    currentTargetLabelFor(this: Bobs27PlayContext, seatRef: string): string {
      const state = this.state();
      const seat = state?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      if (!seat) return "";
      return doublesPathTargetLabel(targetAt(doublesPath(), seat.targetIndex));
    },

    currentTargetLabel(this: Bobs27PlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.currentTargetLabelFor(state.activeParticipantRef);
    },

    currentScoreFor(this: Bobs27PlayContext, seatRef: string): string {
      const state = this.state();
      const seat = state?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      return seat ? String(seat.score) : "";
    },

    currentScore(this: Bobs27PlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.currentScoreFor(state.activeParticipantRef);
    },

    previewSegments(this: Bobs27PlayContext): Bobs27PreviewSegment[] {
      return doublesPathPreviewSegments(
        this.$store.game.turns,
        this.hiddenTurnKey,
      );
    },

    /** The recreational tap row's entry point: synthesizes the observation
     * for a hit or miss on the current target and funnels it through
     * `commitDart`, exactly as the board's per-dart `recordDart` does. */
    async recordTap(this: Bobs27PlayContext, hit: boolean) {
      if (!this.engine || this.finished) return;
      const state = this.state();
      const activeSeat = state?.seats.find(
        (seat) => seat.participantRef === state.activeParticipantRef,
      );
      if (!activeSeat) return;
      const target = targetAt(doublesPath(), activeSeat.targetIndex);
      await this.commitDart(doublesPathObservation(target, hit));
    },

    uploadAndCompleteSession(this: Bobs27PlayContext): Promise<void> {
      return playUploadAndCompleteSession(this, (finalState) =>
        computeStats(finalState, this.$store.game.turns),
      );
    },

    resultsTitle(this: Bobs27PlayContext): string {
      const winner = matchWinnerName(
        this.$store.game.seats,
        this.resultsSnapshot?.winningSideKey ?? null,
      );
      if (winner) return `${winner} wins!`;
      const status = this.resultsSnapshot?.status;
      if (status === "TIE") return "It's a tie!";
      if (status === "LOST") return "Game over!";
      return this.$store.game.configSnapshot?.mode === "EASY"
        ? "Run complete!"
        : "Winner!";
    },

    /**
     * Replays under the session's own key; Easy resends its mode as an
     * override.
     */
    playAgain(this: Bobs27PlayContext) {
      const key = this.$store.game.rulesetVersionKey;
      if (!key) return Promise.resolve();
      return runPlayAgain(
        this,
        GAME_TYPE_KEY,
        key,
        (engine) => (engine instanceof Bobs27Engine ? engine : null),
        key === "BOBS27_V2"
          ? variantsPlayAgain<Bobs27Snapshot>(key)
          : undefined,
      );
    },
  };
}
