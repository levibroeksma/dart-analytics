import { getDb } from "../db/client";
import { generateId } from "../lib/id";
import {
  upsertPlayerByAuthUserId,
  type ProvisionedPlayer,
} from "../repositories/player.repository";

/**
 * Provisions an application player profile for the authenticated user.
 */
export async function provisionPlayer(
  authUserId: string,
): Promise<ProvisionedPlayer> {
  const db = getDb();
  return upsertPlayerByAuthUserId(db, authUserId, generateId());
}
