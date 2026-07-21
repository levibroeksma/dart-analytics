import { z } from "zod";

export const ConfigurationPreset = z.object({
  configurationTemplateId: z.string(),
  gameTypeKey: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  configuration: z.record(z.unknown()),
  isSystemTemplate: z.boolean(),
});
export type ConfigurationPresetData = z.infer<typeof ConfigurationPreset>;
