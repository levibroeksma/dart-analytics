import { z } from "zod";

export const ConfigInput = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("template"),
    templateRef: z.string(),
    overrides: z.record(z.unknown()).optional(),
  }),
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

/**
 * A board target number, or null when the dart carries none. Mirrors
 * `chk_intended_target` / `chk_hit_target` (migration `0006`): the board has
 * segments 1..20 plus 25 for the bull, so anything outside 1..25 is a row the
 * database refuses. Bounding it here — beside the column type the field
 * already mirrors — keeps the rejection a `VALIDATION_FAILED` response naming
 * the offending dart instead of a CHECK violation inside the write
 * transaction, which aborts the whole batch and loses the session upload.
 */
const TargetNumber = z.number().int().min(1).max(25).nullable();

/**
 * One `darts` row. The bounds mirror that table's CHECK constraints exactly —
 * `chk_dart_number_positive` and `chk_dart_score_positive` (migration `0007`)
 * alongside the target-number range — and the refinement mirrors
 * `chk_dart_target_consistency`, which admits both intention columns NULL or
 * the zone NOT NULL, never a target number on its own.
 */
export const DartFact = z
  .object({
    sequence: z.number().int().positive(),
    intendedTargetNumber: TargetNumber,
    intendedZoneKey: z.string().nullable(),
    hitTargetNumber: TargetNumber,
    hitZoneKey: z.string(),
    score: z.number().int().nonnegative(),
  })
  .refine(
    (dart) =>
      dart.intendedZoneKey !== null || dart.intendedTargetNumber === null,
    {
      message:
        "intendedZoneKey is required whenever intendedTargetNumber is set",
      path: ["intendedZoneKey"],
    },
  );

/**
 * One `turns` row. `sequence` is bounded by `chk_turn_sequence_positive`
 * (migration `0007`); `totalScore` carries no CHECK, so none is asserted here.
 */
export const TurnFact = z.object({
  clientKey: z.string(),
  participantRef: z.string(),
  sequence: z.number().int().positive(),
  totalScore: z.number().int(),
  completedAt: z.string().datetime().nullable(),
  darts: z.array(DartFact),
});

/**
 * One `exercise_stages` row, bounded by `chk_stage_sequence_positive` and
 * `chk_stage_not_self_parent` (migration `0007`) — a stage whose
 * `parentClientKey` is its own `clientKey` resolves to `parent_stage_id = id`
 * on insert.
 */
export const StageFact = z
  .object({
    clientKey: z.string(),
    stageTypeKey: z.string(),
    parentClientKey: z.string().nullable(),
    sequence: z.number().int().positive(),
    turns: z.array(TurnFact),
  })
  .refine((stage) => stage.parentClientKey !== stage.clientKey, {
    message: "a stage cannot be its own parent",
    path: ["parentClientKey"],
  });

export const EventsBatchRequest = z.object({ stages: z.array(StageFact) });
export type EventsBatchRequestInput = z.infer<typeof EventsBatchRequest>;
export type StageFactInput = z.infer<typeof StageFact>;
export type TurnFactInput = z.infer<typeof TurnFact>;
export type DartFactInput = z.infer<typeof DartFact>;

export const BatchWriteResponse = z.object({
  created: z.object({
    stages: z.number().int(),
    turns: z.number().int(),
    darts: z.number().int(),
  }),
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
