import { QuickSubtractGame } from "@modules/trivia/quick-subtract.module";
import { SegmentTimer } from "@modules/ui/segment-timer.module";
import { ScoreInputBuffer } from "@modules/game/score-input.module";
import type { AnswerResult, Calculation } from "@modules/interfaces";
import type { GameStatus } from "@modules/types";

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function quickSubtractPlay() {
  return {
    status: "idle" as GameStatus,
    current: null as Calculation | null,
    scoreInput: new ScoreInputBuffer({ maxLength: 3 }),
    correctAnswers: 0,
    attempts: 0,
    incorrectAnswers: 0,
    elapsedTime: 0,
    remainingTime: 0,
    lastAnswer: null as AnswerResult | null,
    game: null as QuickSubtractGame | null,

    formattedElapsed(): string {
      return formatSeconds(this.elapsedTime);
    },

    formattedRemaining(): string {
      return formatSeconds(this.remainingTime);
    },

    /** Runs after every game mutation, including a timer's onComplete firing
     * outside submit() — otherwise status/elapsedTime/remainingTime go stale
     * the moment a running-mode timer finishes on its own. */
    syncFromGame(): void {
      if (!this.game) return;
      this.status = this.game.getStatus();
      this.current = this.game.getCurrent();
      this.correctAnswers = this.game.getCorrectAnswers();
      this.attempts = this.game.getAttempts();
      this.incorrectAnswers = this.game.getIncorrectAnswers();
      this.elapsedTime = this.game.getElapsedTime();
      this.remainingTime = this.game.getRemainingTime();
    },

    startCount(count: number) {
      let game: QuickSubtractGame;
      const timer = new SegmentTimer({
        totalMinutes: 180,
        intervalMinutes: 0,
        direction: "countup",
        onTick: () => this.syncFromGame(),
        onComplete: () => {
          game.finish();
          this.syncFromGame();
        },
      });
      game = new QuickSubtractGame({ mode: "count", count, timer });
      this.game = game;
      game.start();
      this.syncFromGame();
    },

    startTimer(minutes: number) {
      let game: QuickSubtractGame;
      const timer = new SegmentTimer({
        totalMinutes: minutes,
        intervalMinutes: minutes,
        onTick: () => this.syncFromGame(),
        onComplete: () => {
          game.finish();
          this.syncFromGame();
        },
      });
      game = new QuickSubtractGame({ mode: "timer", timer });
      this.game = game;
      game.start();
      this.syncFromGame();
    },

    submit() {
      if (!this.game || !this.scoreInput.value) return;
      const result = this.game.answer(this.scoreInput.value);
      this.lastAnswer = result;
      this.scoreInput.clear();
      this.syncFromGame();
    },

    reset() {
      this.game?.destroy();
      this.game = null;
      this.status = "idle";
      this.current = null;
      this.scoreInput.clear();
      this.correctAnswers = 0;
      this.attempts = 0;
      this.incorrectAnswers = 0;
      this.elapsedTime = 0;
      this.remainingTime = 0;
      this.lastAnswer = null;
    },

    destroy() {
      this.game?.destroy();
    },
  };
}
