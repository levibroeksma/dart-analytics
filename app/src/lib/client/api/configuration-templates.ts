import { apiRequest } from './client';
import { SessionApiError } from './sessions';
import { type ConfigurationPresetData } from './types';

export type { ConfigurationPresetData };

export async function fetchConfigurationPresets(gameTypeKey: string): Promise<ConfigurationPresetData[]> {
  const result = await apiRequest<ConfigurationPresetData[]>(
    `/api/configuration-templates?gameType=${encodeURIComponent(gameTypeKey)}`,
    undefined,
  );
  if (!result.ok) throw new SessionApiError(result.error.code, result.error.message);
  return result.data;
}
