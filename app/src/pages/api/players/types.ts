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

export type ProvisionPlayerRequestInput = z.infer<
  typeof ProvisionPlayerRequest
>;
export type ProvisionPlayerResponseData = z.infer<
  typeof ProvisionPlayerResponse
>;
