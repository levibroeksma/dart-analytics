import { z } from "zod";

export const ScoreTrainingConfig = z
  .object({
    duration_type: z.enum(["ROUNDS", "MINUTES"]),
    duration_value: z.number().int(),
    max_darts_per_turn: z.number().int().min(1).max(3),
  })
  .superRefine((val, ctx) => {
    const [min, max] = val.duration_type === "ROUNDS" ? [1, 50] : [1, 180];
    if (val.duration_value < min || val.duration_value > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["duration_value"],
        message: `duration_value must be between ${min} and ${max} for ${val.duration_type}`,
      });
    }
  });

export type ScoreTrainingConfigData = z.infer<typeof ScoreTrainingConfig>;
