import { getDb } from "@db/client";
import { capableRulesets } from "@lib/game/rulesets/capabilities";
import {
  findSettings,
  upsertSettings,
} from "@repositories/settings.repository";
import type { PlayerSettings, ServiceResult } from "./types";

const DEFAULT_SETTINGS: PlayerSettings = {
  defaultCaptureModeKey: "RECREATIONAL",
  defaultInputModeKey: "QUICK_SCORE",
};

/**
 * The player's mode preference, falling back to quick score when they have no
 * settings row or either stored key is unset — every player provisioned before
 * settings shipped is in that state, and no backfill runs.
 */
export async function readSettings(playerId: string): Promise<PlayerSettings> {
  const db = getDb();
  const stored = await findSettings(db, playerId);
  if (
    !stored ||
    stored.defaultCaptureModeKey === null ||
    stored.defaultInputModeKey === null
  ) {
    return { ...DEFAULT_SETTINGS };
  }

  return {
    defaultCaptureModeKey: stored.defaultCaptureModeKey,
    defaultInputModeKey: stored.defaultInputModeKey,
  };
}

/**
 * Stores the player's mode preference, refusing a pair no ruleset version
 * supports — that would leave the player in an app mode in which no game can
 * be played.
 */
export async function writeSettings(
  playerId: string,
  next: PlayerSettings,
): Promise<ServiceResult<PlayerSettings>> {
  if (
    capableRulesets(next.defaultCaptureModeKey, next.defaultInputModeKey)
      .length === 0
  ) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: {
        reason: `no ruleset supports captureModeKey ${next.defaultCaptureModeKey} + inputModeKey ${next.defaultInputModeKey}`,
      },
    };
  }

  await upsertSettings(playerId, next);
  return { ok: true, data: next };
}
