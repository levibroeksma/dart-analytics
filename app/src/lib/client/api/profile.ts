import { apiRequest } from "./client";
import {
  UpdatePlayerProfileRequest,
  type UpdatePlayerProfileInput,
  type PlayerProfileResponseData,
} from "./types";

export class ProfileApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ProfileApiError";
  }
}

export async function fetchProfile(): Promise<PlayerProfileResponseData> {
  const result = await apiRequest<PlayerProfileResponseData>("/api/players/me");
  if (!result.ok)
    throw new ProfileApiError(result.error.code, result.error.message);
  return result.data;
}

export async function saveProfile(
  next: UpdatePlayerProfileInput,
): Promise<PlayerProfileResponseData> {
  const payload = UpdatePlayerProfileRequest.parse(next);
  const result = await apiRequest<PlayerProfileResponseData>(
    "/api/players/me",
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
  if (!result.ok)
    throw new ProfileApiError(result.error.code, result.error.message);
  return result.data;
}
