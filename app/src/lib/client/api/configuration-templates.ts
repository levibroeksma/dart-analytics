import { apiRequest } from './client';
import { SessionApiError } from './sessions';

export type ConfigurationPresetData = {
  configurationTemplateId: string;
  gameTypeKey: string;
  name: string;
  description: string | null;
  configuration: Record<string, unknown>;
  isSystemTemplate: boolean;
};

export async function fetchConfigurationPresets(gameTypeKey: string): Promise<ConfigurationPresetData[]> {
  const result = await apiRequest<ConfigurationPresetData[]>(
    `/api/configuration-templates?gameType=${encodeURIComponent(gameTypeKey)}`,
    undefined,
  );
  if (!result.ok) throw new SessionApiError(result.error.code, result.error.message);
  return result.data;
}
