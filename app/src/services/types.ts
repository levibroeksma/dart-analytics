import type { ErrorCode } from "@server/types";

export * from "./rulesets/types";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; details?: Record<string, unknown> };

export type CreateSessionResult = {
  sessionId: string;
  participants: {
    ref: string;
    participantTypeKey: string;
    displayName: string;
  }[];
};

/** A player's default capture and input modes, as implementation keys. */
export type PlayerSettings = {
  defaultCaptureModeKey: string;
  defaultInputModeKey: string;
};

/** A player's display name and darts equipment. */
export type PlayerProfile = {
  displayName: string;
  dartsDescription: string | null;
  dartsWeightGrams: number | null;
};

export type AppendBatchResult = {
  created: { stages: number; turns: number; darts: number };
};

/**
 * One seat as it will be persisted: the participant row to insert plus the
 * side it plays for. Built before the write so participants and the
 * configuration snapshot are composed from the same ids in one transaction.
 */
export type SeatPlan = {
  participantId: string;
  participantTypeId: number;
  playerId: string | null;
  displayName: string;
  sideKey: string;
};
