import type { PersistFactory } from "@alpinejs/persist";
import type { RulesetVersionKey } from "@lib/types";
import type { EngineFacts, StageFact, TurnFact } from "@modules/types";
import type { ConfigSnapshot } from "./types";

/** D91: bumped to 2 — the fact-log shape replaced `RecordedTurn`, so v1 state is discarded. */
const STORE_VERSION = 2;

/**
 * Game-agnostic session state: which ruleset is being played, the snapshot of
 * its configuration, and the engine's fact log. The engine owns that log; this
 * store only mirrors it, so `recordFacts` replaces it wholesale rather than
 * appending — the two can never drift.
 *
 * D91: `_v` is compared against `STORE_VERSION` in `init()`, discarding state
 * left by an incompatible version through `reset()` before any caller can
 * read it — a v1 fact log survives into a v2 session otherwise, and its turns
 * carry no `stageClientKey`, which makes the session permanently
 * un-uploadable.
 *
 * The check lives in `init()`, not in this factory's own body. Alpine's
 * `$persist` fields are `Alpine.interceptor` placeholders until `Alpine.store()`
 * resolves them (`initInterceptors`, called before `init()` — see
 * `alpinejs/src/store.js`); reading `this._v` any earlier compares that
 * placeholder object to `STORE_VERSION` and is never equal, so the discard
 * would fire on every load regardless of the real persisted value. Alpine
 * calls a registered store's `init()` automatically once those placeholders
 * are resolved, which is what makes the comparison here meaningful.
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

    /** Called by Alpine once this store's `$persist` fields have resolved. */
    init() {
      if (this._v !== STORE_VERSION) {
        this.reset();
        this._v = STORE_VERSION;
      }
    },

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
