import { players } from "../db/schema";
import type { getDb } from "../db/client";

type Db = ReturnType<typeof getDb>;

/**
 * Creates or returns the player row for the given auth user id.
 */
export async function upsertPlayerByAuthUserId(
  db: Db,
  authUserId: string,
  id: string,
) {
  const now = new Date().toISOString();
  const [player] = await db
    .insert(players)
    .values({
      id,
      authUserId,
      displayName: "Player",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: players.authUserId,
      set: { updatedAt: now },
    })
    .returning();

  return player;
}
