import { z } from "zod";

export const ConfigInput = z.discriminatedUnion("source", [
  z.object({ source: z.literal("template"), templateRef: z.string(), overrides: z.record(z.unknown()).optional() }),
  z.object({ source: z.literal("inline"), config: z.record(z.unknown()) }),
]);

export const CreateSessionRequest = z.object({
  gameTypeKey: z.string(),
  rulesetVersionKey: z.string(),
  captureModeKey: z.string(),
  inputModeKey: z.string(),
  config: ConfigInput,
});
export type CreateSessionRequestInput = z.infer<typeof CreateSessionRequest>;

export const ParticipantRef = z.object({
  ref: z.string(),
  participantTypeKey: z.string(),
  displayName: z.string(),
});

export const CreateSessionResponse = z.object({
  sessionId: z.string(),
  participants: z.array(ParticipantRef),
});
export type CreateSessionResponseData = z.infer<typeof CreateSessionResponse>;

export const DartFact = z.object({
  sequence: z.number().int(),
  intendedTargetNumber: z.number().int().nullable(),
  intendedZoneKey: z.string().nullable(),
  hitTargetNumber: z.number().int().nullable(),
  hitZoneKey: z.string(),
  score: z.number().int(),
});

export const TurnFact = z.object({
  clientKey: z.string(),
  participantRef: z.string(),
  sequence: z.number().int(),
  totalScore: z.number().int(),
  completedAt: z.string().datetime().nullable(),
  darts: z.array(DartFact),
});

export const StageFact = z.object({
  clientKey: z.string(),
  stageTypeKey: z.string(),
  parentClientKey: z.string().nullable(),
  sequence: z.number().int(),
  turns: z.array(TurnFact),
});

export const EventsBatchRequest = z.object({ stages: z.array(StageFact) });
export type EventsBatchRequestInput = z.infer<typeof EventsBatchRequest>;
export type StageFactInput = z.infer<typeof StageFact>;
export type TurnFactInput = z.infer<typeof TurnFact>;
export type DartFactInput = z.infer<typeof DartFact>;

export const BatchWriteResponse = z.object({
  created: z.object({ stages: z.number().int(), turns: z.number().int(), darts: z.number().int() }),
});
export type BatchWriteResponseData = z.infer<typeof BatchWriteResponse>;

export const UpdateSessionRequest = z.object({
  status: z.string(),
  completedAt: z.string().datetime().optional(),
});
export type UpdateSessionRequestInput = z.infer<typeof UpdateSessionRequest>;

export const SessionActive = z.object({
  sessionId: z.string(),
  gameTypeKey: z.string(),
  gameTypeName: z.string(),
  captureModeKey: z.string(),
  inputModeKey: z.string(),
  rulesetVersionKey: z.string(),
  startedAt: z.string().datetime(),
});
export type SessionActiveData = z.infer<typeof SessionActive>;
