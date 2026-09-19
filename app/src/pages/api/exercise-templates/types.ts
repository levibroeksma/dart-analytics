import { z } from "zod";

export const ExerciseTemplateCatalogEntry = z.object({
  exerciseTemplateId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  exerciseTypeKey: z.string(),
  gameTypeKey: z.string().nullable(),
});
export type ExerciseTemplateCatalogEntryData = z.infer<
  typeof ExerciseTemplateCatalogEntry
>;
