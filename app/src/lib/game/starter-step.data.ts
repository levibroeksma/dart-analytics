import {
  BULL_OFF_CROP_MM,
  botBullThrow,
  bullDistanceMm,
  bullOffResult,
  clampToCrop,
  coinRotation,
  coinWinner,
  tossCoin,
} from "@modules/game/starter.module";
import type { BoardPointMm, CoinFace } from "@modules/types";
import type {
  BotFlight,
  BullOffPhase,
  CoinPhase,
  StarterMethod,
  StarterStepOptions,
} from "@lib/types";

const METHOD_KEY = "starter-method";
const BOT_SEQUENCE: [BullOffPhase, number][] = [
  ["wait", 500],
  ["aim", 750],
  ["fly", 240],
  ["hit", 70],
  ["land", 600],
  ["measure", 1000],
];
const MEASURE_MS = 1000;
const COIN_RISE_MS = 750;
const COIN_SETTLE_MS = 830;
const FLIGHT_PHASES: readonly BullOffPhase[] = ["aim", "fly", "hit", "land"];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cropPercent(point: BoardPointMm) {
  return {
    leftPercent: 50 + (point.x / BULL_OFF_CROP_MM) * 50,
    topPercent: 50 + (point.y / BULL_OFF_CROP_MM) * 50,
  };
}

/**
 * Alpine factory for the who-throws-first step (bull-off or coin toss).
 * The method defaults to bull-off and is remembered in `storage`. Bull-off:
 * side 0 taps where their dart landed (clamped to the crop) and confirms;
 * Dartbot then throws on a timed sequence, or a guest taps and confirms in
 * turn; the closer dart wins and a tie within 1mm is thrown again. Coin
 * toss: side 0 calls, the coin flips, a correct call wins. `start()` hands
 * the winner's index to `onResolve`; nothing here is ever persisted beyond
 * the method choice. Every timed sequence carries a run token so a reset
 * mid-sequence stops it.
 */
export function starterStep(options: StarterStepOptions) {
  const storage = options.storage ?? globalThis.localStorage;
  const random = options.random ?? Math.random;
  const stored = storage?.getItem(METHOD_KEY);

  return {
    method: (stored === "coin" ? "coin" : "bull") as StarterMethod,
    phase: "enter" as BullOffPhase,
    enterSide: 0 as 0 | 1,
    pending: null as BoardPointMm | null,
    points: [null, null] as [BoardPointMm | null, BoardPointMm | null],
    coinPhase: "pick" as CoinPhase,
    called: null as CoinFace | null,
    outcome: null as CoinFace | null,
    rotation: 0,
    coinUp: false,
    run: 0,
    wait: options.wait ?? sleep,

    sides(): [string, string] {
      return options.sides();
    },

    opponentIsBot(): boolean {
      return options.opponentIsBot();
    },

    setMethod(method: StarterMethod) {
      storage?.setItem(METHOD_KEY, method);
      this.method = method;
      this.reset();
    },

    reset() {
      this.run += 1;
      this.phase = "enter";
      this.enterSide = 0;
      this.pending = null;
      this.points = [null, null];
      this.coinPhase = "pick";
      this.called = null;
      this.outcome = null;
      this.coinUp = false;
    },

    again() {
      this.reset();
    },

    tap(event: MouseEvent) {
      if (this.phase !== "enter") return;
      const box = (event.currentTarget as Element).getBoundingClientRect();
      const x =
        ((event.clientX - box.left) / box.width - 0.5) * 2 * BULL_OFF_CROP_MM;
      const y =
        ((event.clientY - box.top) / box.height - 0.5) * 2 * BULL_OFF_CROP_MM;
      this.pending = clampToCrop({ x, y });
    },

    async confirm() {
      if (this.phase !== "enter" || !this.pending) return;
      this.points[this.enterSide] = this.pending;
      this.pending = null;
      const run = this.run;
      if (this.enterSide === 0 && !this.opponentIsBot()) {
        this.enterSide = 1;
        return;
      }
      if (this.enterSide === 0) {
        this.points[1] = botBullThrow(random);
        for (const [phase, ms] of BOT_SEQUENCE) {
          this.phase = phase;
          await this.wait(ms);
          if (run !== this.run) return;
        }
      } else {
        this.phase = "measure";
        await this.wait(MEASURE_MS);
        if (run !== this.run) return;
      }
      this.phase = "result";
    },

    async call(face: CoinFace) {
      if (this.coinPhase !== "pick") return;
      const run = this.run;
      this.called = face;
      this.outcome = tossCoin(random);
      this.rotation = coinRotation(this.rotation, this.outcome);
      this.coinPhase = "flip";
      this.coinUp = true;
      await this.wait(COIN_RISE_MS);
      if (run !== this.run) return;
      this.coinUp = false;
      await this.wait(COIN_SETTLE_MS);
      if (run !== this.run) return;
      this.coinPhase = "result";
    },

    bullResult() {
      const [first, second] = this.points;
      if (this.phase !== "result" || !first || !second) return null;
      return bullOffResult(first, second);
    },

    winner(): 0 | 1 | null {
      if (this.method === "coin") {
        return this.coinPhase === "result" && this.called && this.outcome
          ? coinWinner(this.called, this.outcome)
          : null;
      }
      const result = this.bullResult();
      return result === null || result === "tie" ? null : result;
    },

    tie(): boolean {
      return this.method === "bull" && this.bullResult() === "tie";
    },

    cta(): string {
      const winner = this.winner();
      return winner === null ? "" : `${this.sides()[winner]} throws first`;
    },

    start() {
      const winner = this.winner();
      if (winner !== null) options.onResolve(winner);
    },

    cancel() {
      this.reset();
      options.onCancel();
    },

    distanceMm(side: 0 | 1): number | null {
      const point = this.points[side];
      return point ? bullDistanceMm(point) : null;
    },

    ringPercent(side: 0 | 1): number {
      const distance = this.distanceMm(side);
      return distance === null ? 0 : (distance / BULL_OFF_CROP_MM) * 100;
    },

    pointStyle(point: BoardPointMm | null): string {
      if (!point) return "";
      const { leftPercent, topPercent } = cropPercent(point);
      return `left: ${leftPercent}%; top: ${topPercent}%`;
    },

    get botFlight(): BotFlight | null {
      const point = this.points[1];
      if (
        !this.opponentIsBot() ||
        !point ||
        !FLIGHT_PHASES.includes(this.phase)
      ) {
        return null;
      }
      return {
        dartIndex: 1,
        phase: this.phase as BotFlight["phase"],
        ...cropPercent(point),
        landed: [],
      };
    },
  };
}
