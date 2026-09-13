import { apiRequest } from "./client";
import {
  StartTrainingRequest,
  type StartTrainingRequestInput,
  type StartTrainingResponseData,
  type StartTrainingStepResponseData,
  type CompleteTrainingResponseData,
  type AbandonTrainingResponseData,
} from "./types";
import { SessionApiError } from "./sessions";

export async function startTraining(
  body: StartTrainingRequestInput,
): Promise<StartTrainingResponseData> {
  const payload = StartTrainingRequest.parse(body);
  const result = await apiRequest<StartTrainingResponseData>(
    "/api/training-sessions",
    { method: "POST", body: JSON.stringify(payload) },
  );
  if (!result.ok)
    throw new SessionApiError(result.error.code, result.error.message);
  return result.data;
}

export async function startTrainingStep(
  activityId: string,
  sequenceNumber: number,
): Promise<StartTrainingStepResponseData> {
  const result = await apiRequest<StartTrainingStepResponseData>(
    `/api/training-sessions/${activityId}/steps/${sequenceNumber}`,
    { method: "POST", body: "{}" },
  );
  if (!result.ok)
    throw new SessionApiError(result.error.code, result.error.message);
  return result.data;
}

export async function completeTraining(
  activityId: string,
): Promise<CompleteTrainingResponseData> {
  const result = await apiRequest<CompleteTrainingResponseData>(
    `/api/training-sessions/${activityId}/complete`,
    { method: "PATCH" },
  );
  if (!result.ok)
    throw new SessionApiError(result.error.code, result.error.message);
  return result.data;
}

export async function abandonTraining(
  activityId: string,
): Promise<AbandonTrainingResponseData> {
  const result = await apiRequest<AbandonTrainingResponseData>(
    `/api/training-sessions/${activityId}/abandon`,
    { method: "PATCH" },
  );
  if (!result.ok)
    throw new SessionApiError(result.error.code, result.error.message);
  return result.data;
}
