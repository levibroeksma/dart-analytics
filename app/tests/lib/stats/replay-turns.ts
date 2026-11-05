import type { EngineFacts } from "@modules/types";
import type { ReplayTurnSchemaData } from "@routes/types";

/**
 * `turns` in the wire shape the replay route serves: each turn's stage id
 * comes from `stageIdOf`, `kept` defaults to `false`, and each dart's
 * `sequence` becomes its leading `dartNumber`.
 */
export function replayTurns(
  turns: EngineFacts["turns"],
  stageIdOf: (turn: EngineFacts["turns"][number]) => string,
): ReplayTurnSchemaData[] {
  return turns.map((turn) => ({
    stageId: stageIdOf(turn),
    turnSequence: turn.sequence,
    participantId: turn.participantRef,
    turnTotalScore: turn.totalScore,
    kept: turn.kept ?? false,
    darts: turn.darts.map(({ sequence, ...rest }) => ({
      dartNumber: sequence,
      ...rest,
    })),
  }));
}
