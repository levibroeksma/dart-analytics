import { z } from 'zod';

export const ProvisionPlayerRequest = z.object({
  displayName: z.string().min(1).optional(),
});

export const ProvisionPlayerResponse = z.object({
  playerId: z.string(),
  authUserId: z.string(),
  created: z.boolean(),
});

export type ProvisionPlayerRequestInput = z.infer<typeof ProvisionPlayerRequest>;
export type ProvisionPlayerResponseData = z.infer<typeof ProvisionPlayerResponse>;
