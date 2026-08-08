import { eq } from "drizzle-orm";
import {
  captureModes,
  inputModes,
  playerSettings,
  vPlayerSettings,
} from "@db/schema";
import { getDb, withTransaction } from "@db/client";
import type { PlayerSettingsInput, PlayerSettingsRow } from "./interfaces";

type Db = ReturnType<typeof getDb>;

/**
 * Reads the player's stored mode preference through `v_player_settings`,
 * or null when the player has no settings row.
 */
export async function findSettings(
  db: Db,
  playerId: string,
): Promise<PlayerSettingsRow | null> {
  const [row] = await db
    .select({
      defaultCaptureModeKey: vPlayerSettings.defaultCaptureModeKey,
      defaultInputModeKey: vPlayerSettings.defaultInputModeKey,
    })
    .from(vPlayerSettings)
    .where(eq(vPlayerSettings.playerId, playerId))
    .limit(1);

  return row ?? null;
}

/**
 * Creates or replaces the player's settings row, resolving mode keys to lookup
 * ids inside the transaction. The row's primary key is the player id, so no id
 * is generated. Throws when a key resolves to no lookup row — the service only
 * passes pairs a ruleset declares, so that means seed drift, not user input.
 */
export async function upsertSettings(
  playerId: string,
  next: PlayerSettingsInput,
): Promise<void> {
  await withTransaction(async (tx) => {
    const [captureMode] = await tx
      .select({ id: captureModes.id })
      .from(captureModes)
      .where(eq(captureModes.implementationKey, next.defaultCaptureModeKey))
      .limit(1);
    if (!captureMode) {
      throw new Error(
        `unknown captureModeKey ${next.defaultCaptureModeKey} in capture_modes`,
      );
    }

    const [inputMode] = await tx
      .select({ id: inputModes.id })
      .from(inputModes)
      .where(eq(inputModes.implementationKey, next.defaultInputModeKey))
      .limit(1);
    if (!inputMode) {
      throw new Error(
        `unknown inputModeKey ${next.defaultInputModeKey} in input_modes`,
      );
    }

    const now = new Date().toISOString();
    await tx
      .insert(playerSettings)
      .values({
        playerId,
        defaultCaptureModeId: captureMode.id,
        defaultInputModeId: inputMode.id,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: playerSettings.playerId,
        set: {
          defaultCaptureModeId: captureMode.id,
          defaultInputModeId: inputMode.id,
          updatedAt: now,
        },
      });
  });
}
