import { eq, sql } from "drizzle-orm";
import { players, vPlayerProfile } from "@db/schema";
import type { getDb } from "@db/client";
import type {
  PlayerProfileInput,
  PlayerProfileRow,
  ProvisionedPlayer,
} from "./interfaces";

type Db = ReturnType<typeof getDb>;

/**
 * Creates or returns the player row for the given auth user id.
 * `created` is true when a new row was inserted, false when it already existed.
 * Detection uses the system column `xmax`: a freshly inserted row has xmax = 0,
 * while an ON CONFLICT DO UPDATE touch sets it non-zero. On conflict, existing
 * `display_name` is preserved — provision is idempotent.
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
      set: { updatedAt: now },
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

/**
 * Reads the player's display name and darts equipment through
 * `v_player_profile`. Every valid player id has exactly one row (a plain
 * projection over `players`, not a LEFT JOIN) — a missing row means the
 * caller passed an id that does not resolve to a provisioned player.
 * `displayName` is cast to `string`: view columns carry no NOT NULL
 * metadata in Drizzle, but the underlying `players.display_name` is
 * `chk_players_display_name_not_empty`-guaranteed non-null.
 */
export async function findPlayerProfile(
  db: Db,
  playerId: string,
): Promise<PlayerProfileRow> {
  const [row] = await db
    .select({
      displayName: vPlayerProfile.displayName,
      dartsDescription: vPlayerProfile.dartsDescription,
      dartsWeightGrams: vPlayerProfile.dartsWeightGrams,
    })
    .from(vPlayerProfile)
    .where(eq(vPlayerProfile.playerId, playerId))
    .limit(1);

  if (!row) {
    throw new Error(`no v_player_profile row for player ${playerId}`);
  }

  return row as PlayerProfileRow;
}

/**
 * Replaces the player's display name and darts equipment in one UPDATE.
 * Darts fields are nullable, so passing null clears them.
 */
export async function updatePlayerProfile(
  db: Db,
  playerId: string,
  next: PlayerProfileInput,
): Promise<PlayerProfileRow> {
  const now = new Date().toISOString();
  const [row] = await db
    .update(players)
    .set({
      displayName: next.displayName,
      dartsDescription: next.dartsDescription,
      dartsWeightGrams: next.dartsWeightGrams,
      updatedAt: now,
    })
    .where(eq(players.id, playerId))
    .returning({
      displayName: players.displayName,
      dartsDescription: players.dartsDescription,
      dartsWeightGrams: players.dartsWeightGrams,
    });

  return row;
}
