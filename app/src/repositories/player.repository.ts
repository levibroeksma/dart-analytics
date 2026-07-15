import { sql } from "drizzle-orm";
import { players } from "../db/schema";
import type { getDb } from "../db/client";

type Db = ReturnType<typeof getDb>;

export interface ProvisionedPlayer {
  playerId: string;
  authUserId: string;
  created: boolean;
}

/**
 * Creates or returns the player row for the given auth user id.
 * `created` is true when a new row was inserted, false when it already existed.
 * Detection uses the system column `xmax`: a freshly inserted row has xmax = 0,
 * while an ON CONFLICT DO UPDATE touch sets it non-zero.
 */
export async function upsertPlayerByAuthUserId(
  db: Db,
  authUserId: string,
  id: string,
  displayName: string,
): Promise<ProvisionedPlayer> {
  const now = new Date().toISOString();
  const [row] = await db
    .insert(players)
    .values({
      id,
      authUserId,
      displayName,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: players.authUserId,
      set: { updatedAt: now }, // existing display_name is preserved — provision is idempotent
    })
    .returning({
      playerId: players.id,
      authUserId: players.authUserId,
      xmax: sql<string>`xmax::text`,
    });

  return {
    playerId: row.playerId,
    authUserId: row.authUserId,
    created: row.xmax === "0",
  };
}
