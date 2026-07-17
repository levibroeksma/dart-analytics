import type { Persist } from "@alpinejs/persist";
import type { GameConfigSnapshot, RecordedTurn } from "./types";

const STORE_VERSION = 1;

export function gameStore(persist: Persist) {
  return {
    _v: persist(STORE_VERSION).as("game._v"),
    gameTypeKey: persist<string | null>(null).as("game.gameTypeKey"),
    sessionId: persist<string | null>(null).as("game.sessionId"),
    participantRef: persist<string | null>(null).as("game.participantRef"),
    configSnapshot: persist<GameConfigSnapshot | null>(null).as("game.configSnapshot"),
    turns: persist<RecordedTurn[]>([]).as("game.turns"),
    timerRemainingMs: persist<number | null>(null).as("game.timerRemainingMs"),
    timerStartedAt: persist<string | null>(null).as("game.timerStartedAt"),
    timerExpired: persist<boolean>(false).as("game.timerExpired"),
    idempotencyKey: persist<string | null>(null).as("game.idempotencyKey"),

    startSession(input: {
      gameTypeKey: string;
      sessionId: string;
      participantRef: string;
      configSnapshot: GameConfigSnapshot;
    }) {
      this.gameTypeKey = input.gameTypeKey;
      this.sessionId = input.sessionId;
      this.participantRef = input.participantRef;
      this.configSnapshot = input.configSnapshot;
      this.turns = [];
      this.timerRemainingMs = null;
      this.timerStartedAt = null;
      this.timerExpired = false;
      this.idempotencyKey = null;
    },

    recordTurn(turn: RecordedTurn) {
      this.turns = [...this.turns, turn];
    },

    reset() {
      this.gameTypeKey = null;
      this.sessionId = null;
      this.participantRef = null;
      this.configSnapshot = null;
      this.turns = [];
      this.timerRemainingMs = null;
      this.timerStartedAt = null;
      this.timerExpired = false;
      this.idempotencyKey = null;
    },
  };
}
