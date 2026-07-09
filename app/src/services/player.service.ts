import { getDb } from "../db/client";
import { generateId } from "../lib/id";
import { upsertPlayerByAuthUserId } from "../repositories/player.repository";

/**
 * Provisions an application player profile for the authenticated user.
 */
export async function provisionPlayer(authUserId: string) {
  const db = getDb();
  return upsertPlayerByAuthUserId(db, authUserId, generateId());
}
