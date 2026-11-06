import { apiRequest } from "./client";
import { type ConfigurationPresetData } from "./types";
import { unwrapOrThrow } from "./unwrap";

export type { ConfigurationPresetData };

export async function fetchConfigurationPresets(
  gameTypeKey: string,
): Promise<ConfigurationPresetData[]> {
  return unwrapOrThrow(
    await apiRequest<ConfigurationPresetData[]>(
      `/api/configuration-templates?gameType=${encodeURIComponent(gameTypeKey)}`,
      undefined,
    ),
  );
}
