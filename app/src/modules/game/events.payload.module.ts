import type { EventsBatchRequestInput } from "@client/api/types";
import type { EngineFacts, TurnFact } from "./types";

/**
 * Builds the engine-agnostic events batch payload for
 * `POST /api/sessions/:sessionId/events/batch`. Any engine's `EngineFacts`
 * produces one batch: stages come straight from `facts.stages`, and each
 * stage's turns are its owned subset of `facts.turns`, grouped in a single
 * pass and ordered by `sequence` so replay order is deterministic regardless
 * of the order turns were appended to the fact log.
 *
 * Each turn carries its own `participantRef`, minted by the engine, so refs
 * vary within one batch when several seats played the session. This used to
 * take one ref and stamp it onto every turn, which is why a session's whole
 * log necessarily belonged to one identity.
 *
 * Every turn must belong to a stage present in `facts.stages` — an orphan
 * turn is silent gameplay-data loss on upload, so it throws rather than
 * being dropped.
 */
export function buildEventsBatch(facts: EngineFacts): EventsBatchRequestInput {
  const stageKeys = new Set(facts.stages.map((stage) => stage.clientKey));
  const turnsByStage = new Map<string, TurnFact[]>();
  for (const turn of facts.turns) {
    if (!stageKeys.has(turn.stageClientKey)) {
      throw new Error(
        `No stage matching stageClientKey ${turn.stageClientKey} for turn ${turn.clientKey}`,
      );
    }
    const stageTurns = turnsByStage.get(turn.stageClientKey);
    if (stageTurns) {
      stageTurns.push(turn);
    } else {
      turnsByStage.set(turn.stageClientKey, [turn]);
    }
  }

  return {
    stages: facts.stages.map((stage) => ({
      clientKey: stage.clientKey,
      stageTypeKey: stage.stageTypeKey,
      parentClientKey: stage.parentClientKey,
      sequence: stage.sequence,
      turns: (turnsByStage.get(stage.clientKey) ?? [])
        .slice()
        .sort((a, b) => a.sequence - b.sequence)
        .map((turn) => ({
          clientKey: turn.clientKey,
          participantRef: turn.participantRef,
          sequence: turn.sequence,
          totalScore: turn.totalScore,
          completedAt: turn.completedAt,
          darts: turn.darts,
        })),
    })),
  };
}
