import type { PersistFactory } from "@alpinejs/persist";
import type { RulesetVersionKey } from "@lib/game/rulesets/types";
import type { EngineFacts, StageFact, TurnFact } from "@modules/game/types";
import type { ConfigSnapshot } from "./types";

/** D91: bumped to 2 — the fact-log shape replaced `RecordedTurn`, so v1 state is discarded. */
const STORE_VERSION = 2;

/**
 * Game-agnostic session state: which ruleset is being played, the snapshot of
 * its configuration, and the engine's fact log. The engine owns that log; this
 * store only mirrors it, so `recordFacts` replaces it wholesale rather than
 * appending — the two can never drift.
 *
 * @param persist - Must return a fresh Alpine `$persist` instance per call
 *   (D120). Reusing one `persist()` across fields collapses every `.as()` key
 *   onto the last alias (Alpine shares `alias` in the persist closure) — e.g.
 *   `turns` hydrates as `null` from `game.idempotencyKey`.
 */
export function gameStore(persist: PersistFactory) {
  return {
    _v: persist()(STORE_VERSION).as("game._v"),
    gameTypeKey: persist()<string | null>(null).as("game.gameTypeKey"),
    rulesetVersionKey: persist()<RulesetVersionKey | null>(null).as(
      "game.rulesetVersionKey",
    ),
    sessionId: persist()<string | null>(null).as("game.sessionId"),
    participantRef: persist()<string | null>(null).as("game.participantRef"),
    configSnapshot: persist()<ConfigSnapshot | null>(null).as(
      "game.configSnapshot",
    ),
    templateRef: persist()<string | null>(null).as("game.templateRef"),
    stages: persist()<StageFact[]>([]).as("game.stages"),
    turns: persist()<TurnFact[]>([]).as("game.turns"),
    timerRemainingMs: persist()<number | null>(null).as(
      "game.timerRemainingMs",
    ),
    timerStartedAt: persist()<string | null>(null).as("game.timerStartedAt"),
    timerExpired: persist()<boolean>(false).as("game.timerExpired"),
    idempotencyKey: persist()<string | null>(null).as("game.idempotencyKey"),

    startSession(input: {
      gameTypeKey: string;
      rulesetVersionKey: RulesetVersionKey;
      sessionId: string;
      participantRef: string;
      templateRef: string | null;
      configSnapshot: ConfigSnapshot;
    }) {
      this.gameTypeKey = input.gameTypeKey;
      this.rulesetVersionKey = input.rulesetVersionKey;
      this.sessionId = input.sessionId;
      this.participantRef = input.participantRef;
      this.configSnapshot = input.configSnapshot;
      this.templateRef = input.templateRef;
      this.stages = [];
      this.turns = [];
      this.timerRemainingMs = null;
      this.timerStartedAt = null;
      this.timerExpired = false;
      this.idempotencyKey = null;
    },

    /** Mirrors the engine's whole fact log; never appends to the previous one. */
    recordFacts(facts: EngineFacts) {
      this.stages = [...facts.stages];
      this.turns = [...facts.turns];
    },

    reset() {
      this.gameTypeKey = null;
      this.rulesetVersionKey = null;
      this.sessionId = null;
      this.participantRef = null;
      this.configSnapshot = null;
      this.templateRef = null;
      this.stages = [];
      this.turns = [];
      this.timerRemainingMs = null;
      this.timerStartedAt = null;
      this.timerExpired = false;
      this.idempotencyKey = null;
    },
  };
}
