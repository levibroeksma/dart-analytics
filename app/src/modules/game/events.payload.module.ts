import type { EventsBatchRequestInput } from "@client/api/types";
import type { EngineFacts, TurnFact } from "./types";

type WireDarts =
  EventsBatchRequestInput["stages"][number]["turns"][number]["darts"];

/**
 * Builds the engine-agnostic events batch payload for
 * `POST /api/sessions/:sessionId/events/batch`. Any engine's `EngineFacts`
 * produces one batch: stages come straight from `facts.stages`, and each
 * stage's turns are its owned subset of `facts.turns`, grouped in a single
 * pass and ordered by `sequence` so replay order is deterministic regardless
 * of the order turns were appended to the fact log.
 *
 * `turn.darts` is passed through unchanged rather than field-mapped: the
 * engine-side `DartFact` (`./types`) and the wire `DartFactInput` (server
 * contract) currently diverge (`dartNumber` vs `sequence`; nullable vs
 * required `hitZoneKey`), so this assignment is intentionally cast. No
 * engine populates non-empty `darts` yet (Task 4); the first one that does
 * must reconcile the two shapes, not silently rely on this cast.
 */
export function buildEventsBatch(
  participantRef: string,
  facts: EngineFacts,
): EventsBatchRequestInput {
  const turnsByStage = new Map<string, TurnFact[]>();
  for (const turn of facts.turns) {
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
          participantRef,
          sequence: turn.sequence,
          totalScore: turn.totalScore,
          completedAt: turn.completedAt,
          darts: turn.darts as unknown as WireDarts,
        })),
    })),
  };
}
