import { z } from "zod";

/** Frozen contract: docs/architecture/06-API/04-Endpoint-Contracts.md §Player Provisioning. */
export const ProvisionPlayerRequest = z.object({
  displayName: z.string().min(1).optional(),
});

export const ProvisionPlayerResponse = z.object({
  playerId: z.string(),
  authUserId: z.string(),
  created: z.boolean(),
});

/** Frozen contract: docs/architecture/06-API/04-Endpoint-Contracts.md §Player Settings. */
export const UpdatePlayerSettingsRequest = z.object({
  defaultCaptureModeKey: z.string(),
  defaultInputModeKey: z.string(),
});

export const PlayerSettingsResponse = z.object({
  defaultCaptureModeKey: z.string(),
  defaultInputModeKey: z.string(),
});

export type UpdatePlayerSettingsInput = z.infer<
  typeof UpdatePlayerSettingsRequest
>;
export type PlayerSettingsResponseData = z.infer<typeof PlayerSettingsResponse>;

export type ProvisionPlayerRequestInput = z.infer<
  typeof ProvisionPlayerRequest
>;
export type ProvisionPlayerResponseData = z.infer<
  typeof ProvisionPlayerResponse
>;

/** Frozen contract: docs/architecture/06-API/04-Endpoint-Contracts.md §Player Profile. */
export const UpdatePlayerProfileRequest = z.object({
  displayName: z.string().min(1),
  dartsDescription: z.string().min(1).nullable(),
  dartsWeightGrams: z.number().int().min(1).max(100).nullable(),
});

export const PlayerProfileResponse = z.object({
  displayName: z.string(),
  dartsDescription: z.string().nullable(),
  dartsWeightGrams: z.number().nullable(),
});

export type UpdatePlayerProfileInput = z.infer<
  typeof UpdatePlayerProfileRequest
>;
export type PlayerProfileResponseData = z.infer<typeof PlayerProfileResponse>;
