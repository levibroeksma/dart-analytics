import { getDb } from "@db/client";
import { generateId } from "@lib/id";
import { upsertPlayerByAuthUserId } from "@repositories/player.repository";
import type { ProvisionedPlayer } from "@repositories/interfaces";

/**
 * Provisions an application player profile for the authenticated user.
 * displayName resolution (D76): caller passes request-or-claim value; 'Player' is the final fallback.
 */
export async function provisionPlayer(
  authUserId: string,
  displayName?: string,
): Promise<ProvisionedPlayer> {
  const db = getDb();
  return upsertPlayerByAuthUserId(
    db,
    authUserId,
    generateId(),
    displayName ?? "Player",
  );
}
