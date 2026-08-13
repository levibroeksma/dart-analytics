import { getEngineFactory } from "@modules/game/engine.registry";
import { resolveSessionModePair } from "@lib/game/session-mode-resolution";
import {
  appendBatch,
  completeSession,
  createSession,
  fetchActiveSessions,
} from "@client/api/sessions";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import {
  BULL_TARGET_NUMBER,
  numbersPath,
  targetAt,
} from "@modules/game/board-progression.module";
import type { RulesetVersionKey, SinglesSnapshot } from "@lib/types";
import type {
  BoardTarget,
  DartFact,
  DartObservation,
  DartZoneKey,
  EngineFacts,
  TurnFact,
} from "@modules/types";
import type {
  SinglesPreviewSegment,
  SinglesTrainingPlayContext,
} from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// singlesTrainingEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import { SinglesTrainingEngine } from "@modules/game/singles-training.engine.module";

const GAME_TYPE_KEY = "SINGLES_TRAINING";
const RULESET_VERSION_KEY: RulesetVersionKey = "SINGLES_V1";

const EMPTY_SEGMENTS: readonly SinglesPreviewSegment[] = [
  { status: "empty" },
  { status: "empty" },
  { status: "empty" },
];

/** Mirrors the engine's own (unexported) ring classification — the module
 * boundary between this play data module and the engine module means it
 * cannot be imported directly; see the design spec's flagged duplication. */
const SINGLE_ZONE_KEYS: ReadonlySet<DartZoneKey> = new Set([
  "SINGLE",
  "INNER_SINGLE",
  "OUTER_SINGLE",
]);

const MISS_COUNT_ZONE_KEYS: ReadonlySet<DartZoneKey> = new Set(["MISS"]);
const SINGLE_COUNT_ZONE_KEYS: ReadonlySet<DartZoneKey> = new Set([
  "SINGLE",
  "INNER_SINGLE",
  "OUTER_SINGLE",
  "OUTER_BULL",
]);
const DOUBLE_COUNT_ZONE_KEYS: ReadonlySet<DartZoneKey> = new Set([
  "DOUBLE",
  "INNER_BULL",
]);
const TREBLE_COUNT_ZONE_KEYS: ReadonlySet<DartZoneKey> = new Set(["TREBLE"]);

function countZoneKey(
  turns: readonly TurnFact[],
  zoneKeys: ReadonlySet<DartZoneKey>,
): number {
  let count = 0;
  for (const turn of turns) {
    for (const dart of turn.darts) {
      if (zoneKeys.has(dart.hitZoneKey)) count += 1;
    }
  }
  return count;
}

function trainingPointsFor(
  target: BoardTarget,
  config: SinglesSnapshot,
  dart: DartFact,
): number {
  if (target.kind === "BULL") {
    if (dart.hitTargetNumber !== BULL_TARGET_NUMBER) return 0;
    if (dart.hitZoneKey === "OUTER_BULL") return config.pointsSingle;
    if (dart.hitZoneKey === "INNER_BULL") return config.pointsDouble;
    return 0;
  }
  if (dart.hitTargetNumber !== target.number) return 0;
  if (SINGLE_ZONE_KEYS.has(dart.hitZoneKey)) return config.pointsSingle;
  if (dart.hitZoneKey === "DOUBLE") return config.pointsDouble;
  if (dart.hitZoneKey === "TREBLE") return config.pointsTreble;
  return 0;
}

/**
 * Every turn maps 1:1 to the target at its own array index (the engine only
 * ever opens a new turn once the previous one holds 3 darts), so the last
 * turn's target is always `targetAt(numbersPath(), turns.length - 1)` — no
 * separate per-dart target bookkeeping is needed.
 */
function previewSegmentsFor(
  turns: readonly TurnFact[],
  config: SinglesSnapshot | null,
  hiddenTurnKey: string | null,
): SinglesPreviewSegment[] {
  const lastTurn = turns.at(-1);
  if (!lastTurn || lastTurn.clientKey === hiddenTurnKey || !config) {
    return [...EMPTY_SEGMENTS];
  }
  const target = targetAt(numbersPath(), turns.length - 1);
  return [0, 1, 2].map((i) => {
    const dart = lastTurn.darts[i];
    if (!dart) return { status: "empty" };
    return {
      status: trainingPointsFor(target, config, dart) > 0 ? "hit" : "miss",
    };
  });
}

function resumeEngine(
  game: SinglesTrainingPlayContext["$store"]["game"],
): SinglesTrainingEngine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (!configSnapshot || rulesetVersionKey !== RULESET_VERSION_KEY) return null;
  const factory = getEngineFactory(RULESET_VERSION_KEY);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof SinglesTrainingEngine ? engine : null;
}

function currentFacts(context: SinglesTrainingPlayContext): EngineFacts {
  return (
    context.engine?.facts() ?? {
      stages: context.$store.game.stages,
      turns: context.$store.game.turns,
    }
  );
}

export function singlesTrainingPlay() {
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
    resultsSnapshot: null as { points: number } | null,
    hiddenTurnKey: null as string | null,
    engine: null as SinglesTrainingEngine | null,

    currentTargetLabel(this: SinglesTrainingPlayContext): string {
      if (!this.engine) return "";
      const target = targetAt(numbersPath(), this.engine.state().targetIndex);
      return target.kind === "BULL" ? "BULL" : String(target.number);
    },

    currentPoints(this: SinglesTrainingPlayContext): string {
      if (!this.engine) return "";
      return String(this.engine.state().totalPoints);
    },

    isBullVisit(this: SinglesTrainingPlayContext): boolean {
      if (!this.engine) return false;
      return (
        targetAt(numbersPath(), this.engine.state().targetIndex).kind === "BULL"
      );
    },

    previewSegments(this: SinglesTrainingPlayContext): SinglesPreviewSegment[] {
      if (!this.engine) return [...EMPTY_SEGMENTS];
      return previewSegmentsFor(
        this.$store.game.turns,
        this.$store.game.configSnapshot,
        this.hiddenTurnKey,
      );
    },

    missCount(this: SinglesTrainingPlayContext): string {
      return String(countZoneKey(this.$store.game.turns, MISS_COUNT_ZONE_KEYS));
    },

    singleCount(this: SinglesTrainingPlayContext): string {
      return String(
        countZoneKey(this.$store.game.turns, SINGLE_COUNT_ZONE_KEYS),
      );
    },

    doubleCount(this: SinglesTrainingPlayContext): string {
      return String(
        countZoneKey(this.$store.game.turns, DOUBLE_COUNT_ZONE_KEYS),
      );
    },

    trebleCount(this: SinglesTrainingPlayContext): string {
      return String(
        countZoneKey(this.$store.game.turns, TREBLE_COUNT_ZONE_KEYS),
      );
    },

    async init(this: SinglesTrainingPlayContext) {
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

        if (engine.isComplete()) {
          this.finished = true;
          this.completionStatus = "pending";
          await this.uploadAndCompleteSession();
        }
      } catch {
        this.reconciliationFailed = true;
        this.hasActiveSession = false;
      } finally {
        this.loadingReconciliation = false;
      }
    },

    async retryReconciliation(this: SinglesTrainingPlayContext) {
      await this.init();
    },

    async recordTap(
      this: SinglesTrainingPlayContext,
      ring: "SINGLE" | "DOUBLE" | "TREBLE" | "MISS",
    ) {
      if (!this.engine || this.finished) return;
      const target = targetAt(numbersPath(), this.engine.state().targetIndex);
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
      this: SinglesTrainingPlayContext,
      observation: DartObservation,
    ) {
      if (!this.engine) return;
      try {
        this.engine.record(observation);
      } catch (err: unknown) {
        this.error = (err as Error).message;
        return;
      }
      this.error = "";
      const facts = this.engine.facts();
      this.$store.game.recordFacts(facts);

      const resolvedTurn = facts.turns.at(-1);
      if (resolvedTurn?.completedAt) {
        this.hiddenTurnKey = resolvedTurn.clientKey;
      }

      if (this.engine.isComplete()) {
        this.finished = true;
        this.completionStatus = "pending";
        await this.uploadAndCompleteSession();
      }
    },

    undoVisit(this: SinglesTrainingPlayContext) {
      if (this.finished) return;
      if (!this.engine || !this.engine.undo()) return;
      this.hiddenTurnKey = null;
      this.$store.game.recordFacts(this.engine.facts());
      this.error = "";
    },

    async uploadAndCompleteSession(
      this: SinglesTrainingPlayContext,
    ): Promise<void> {
      const sessionId = this.$store.game.sessionId!;

      if (!this.$store.game.idempotencyKey) {
        this.$store.game.idempotencyKey = crypto.randomUUID();
      }
      const idempotencyKey = this.$store.game.idempotencyKey;

      this.completionStatus = "saving";
      this.completionError = "";

      const finalState = this.engine?.state() ?? null;

      try {
        const batch = buildEventsBatch(
          this.$store.game.participantRef!,
          currentFacts(this),
        );
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

      if (finalState) {
        this.resultsSnapshot = { points: finalState.totalPoints };
      }
      this.completionStatus = "succeeded";
    },

    async back(this: SinglesTrainingPlayContext) {
      this.$store.game.reset();
      globalThis.location.href = "/games";
    },

    async abandonAndExit(this: SinglesTrainingPlayContext) {
      if (this.$store.game.loading) return;
      const sessionId = this.$store.game.sessionId;
      if (!sessionId) {
        this.$store.game.reset();
        globalThis.location.href = "/games";
        return;
      }
      this.$store.game.loading = true;
      this.error = "";
      try {
        const facts = currentFacts(this);
        if (facts.turns.length > 0) {
          if (!this.$store.game.idempotencyKey) {
            this.$store.game.idempotencyKey = crypto.randomUUID();
          }
          const batch = buildEventsBatch(
            this.$store.game.participantRef!,
            facts,
          );
          await appendBatch(sessionId, this.$store.game.idempotencyKey, batch);
        }
        await completeSession(sessionId, "ABANDONED");
        this.$store.game.reset();
        globalThis.location.href = "/games";
      } catch {
        this.error = "Could not abandon session. Try again.";
        this.$store.game.loading = false;
      }
    },

    async playAgain(this: SinglesTrainingPlayContext) {
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
            config: { source: "template", templateRef },
          });
        } catch {
          this.playAgainError = "Could not start a new session. Try again.";
          return;
        }

        this.$store.game.sessionId = session.sessionId;
        this.$store.game.participantRef = session.participants[0].ref;
        this.$store.game.idempotencyKey = null;
        this.$store.game.setSessionModes(modePair);

        this.finished = false;
        this.completionStatus = "pending";
        this.completionError = "";
        this.resultsSnapshot = null;
        this.hiddenTurnKey = null;
        this.error = "";
        this.hasActiveSession = true;

        const engine = factory.create(config);
        if (!(engine instanceof SinglesTrainingEngine)) return;
        this.engine = engine;
        this.$store.game.recordFacts(engine.facts());
      } finally {
        this.playAgainLoading = false;
      }
    },
  };
}
