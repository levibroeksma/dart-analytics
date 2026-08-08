import { apiRequest } from "./client";
import {
  UpdatePlayerSettingsRequest,
  type UpdatePlayerSettingsInput,
  type PlayerSettingsResponseData,
} from "./types";

export class SettingsApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SettingsApiError";
  }
}

export async function fetchSettings(): Promise<PlayerSettingsResponseData> {
  const result = await apiRequest<PlayerSettingsResponseData>(
    "/api/players/me/settings",
  );
  if (!result.ok)
    throw new SettingsApiError(result.error.code, result.error.message);
  return result.data;
}

export async function saveSettings(
  next: UpdatePlayerSettingsInput,
): Promise<PlayerSettingsResponseData> {
  const payload = UpdatePlayerSettingsRequest.parse(next);
  const result = await apiRequest<PlayerSettingsResponseData>(
    "/api/players/me/settings",
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
  if (!result.ok)
    throw new SettingsApiError(result.error.code, result.error.message);
  return result.data;
}
