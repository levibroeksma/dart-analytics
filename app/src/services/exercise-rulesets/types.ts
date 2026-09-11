export type ExerciseConfigValidationResult =
  | { ok: true; config: Record<string, unknown> }
  | { ok: false; issues: string[] };
