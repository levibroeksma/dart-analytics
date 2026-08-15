import { getDb } from "@db/client";
import { generateId } from "@lib/id";
import {
  findPlayerProfile,
  updatePlayerProfile,
  upsertPlayerByAuthUserId,
} from "@repositories/player.repository";
import type { ProvisionedPlayer } from "@repositories/interfaces";
import type { PlayerProfile, ServiceResult } from "./types";

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

/** The caller's display name and darts equipment. */
export async function readProfile(playerId: string): Promise<PlayerProfile> {
  const db = getDb();
  return findPlayerProfile(db, playerId);
}

/**
 * Replaces the caller's display name and darts equipment in one write.
 * Always succeeds — request-shape validation (non-empty name, weight bounds)
 * already happened against the Zod schema before this is called.
 */
export async function writeProfile(
  playerId: string,
  next: PlayerProfile,
): Promise<ServiceResult<PlayerProfile>> {
  const db = getDb();
  const stored = await updatePlayerProfile(db, playerId, next);
  return { ok: true, data: stored };
}
