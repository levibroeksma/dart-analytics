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
