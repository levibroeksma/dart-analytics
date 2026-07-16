import type { EventsBatchRequestInput } from "@routes/types";
import type { RecordedVisit } from "./score-training.engine.module";

export function buildEventsBatch(participantRef: string, turns: RecordedVisit[]): EventsBatchRequestInput {
  return {
    stages: [
      {
        clientKey: "stage-1",
        stageTypeKey: "EXERCISE_BLOCK",
        parentClientKey: null,
        sequence: 1,
        turns: turns.map((turn) => ({
          clientKey: turn.clientKey,
          participantRef,
          sequence: turn.sequence,
          totalScore: turn.totalScore,
          completedAt: turn.completedAt,
          darts: [],
        })),
      },
    ],
  };
}
