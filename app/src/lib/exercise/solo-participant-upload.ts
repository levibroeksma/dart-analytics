import { SOLO_PARTICIPANT_REF } from "@modules/exercise/solo-participant.module";
import type { EngineFacts } from "@modules/types";

/**
 * Exercise engines stamp every turn with the fixed SOLO_PARTICIPANT_REF
 * constant — there is no seat to mint a real id from. The server validates
 * a batch's turn.participantRef against the session's real DB participant
 * id, so this swap must happen before upload.
 */
export function resolveSoloParticipantRef(
  facts: EngineFacts,
  realParticipantRef: string,
): EngineFacts {
  return {
    stages: facts.stages,
    turns: facts.turns.map((turn) =>
      turn.participantRef === SOLO_PARTICIPANT_REF
        ? { ...turn, participantRef: realParticipantRef }
        : turn,
    ),
  };
}
