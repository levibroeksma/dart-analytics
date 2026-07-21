import { apiRequest } from "./client";
import {
  ProvisionPlayerRequest,
  type ProvisionPlayerRequestInput,
  type ProvisionPlayerResponseData,
} from "./types";

export class ProvisionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ProvisionError";
  }
}

export async function provision(
  body?: ProvisionPlayerRequestInput,
): Promise<ProvisionPlayerResponseData> {
  const payload = body ? ProvisionPlayerRequest.parse(body) : {};
  const result = await apiRequest<ProvisionPlayerResponseData>(
    "/api/players/provision",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

  if (!result.ok) {
    throw new ProvisionError(result.error.code, result.error.message);
  }

  return result.data;
}
