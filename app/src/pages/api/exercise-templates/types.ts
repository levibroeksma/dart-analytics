import { z } from "zod";

export const ExerciseTemplateCatalogEntry = z.object({
  exerciseTemplateId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  exerciseTypeKey: z.string(),
  gameTypeKey: z.string().nullable(),
  gameRulesetVersionKey: z.string().nullable(),
  exerciseTypeName: z.string(),
  gameTypeName: z.string().nullable(),
  difficultyLevel: z.number().int().min(1).max(4).nullable(),
});
export type ExerciseTemplateCatalogEntryData = z.infer<
  typeof ExerciseTemplateCatalogEntry
>;
