import { apiRequest } from "./client";
import {
  StartTrainingRequest,
  type StartTrainingRequestInput,
  type StartTrainingResponseData,
  type ResumeTrainingResponseData,
  type StartTrainingStepResponseData,
  type CompleteTrainingResponseData,
  type AbandonTrainingResponseData,
  type TrainingCompletionListData,
} from "./types";
import { unwrapOrThrow } from "./unwrap";

export async function startTraining(
  body: StartTrainingRequestInput,
): Promise<StartTrainingResponseData> {
  const payload = StartTrainingRequest.parse(body);
  const result = await apiRequest<StartTrainingResponseData>(
    "/api/training-sessions",
    { method: "POST", body: JSON.stringify(payload) },
  );
  return unwrapOrThrow(result);
}

/**
 * Reopens the player's open routine at its first unfinished step. A
 * `completedStepCount` equal to the step count means every step had already
 * finished and the server has closed the routine.
 */
export async function resumeTraining(
  activityId: string,
): Promise<ResumeTrainingResponseData> {
  const result = await apiRequest<ResumeTrainingResponseData>(
    `/api/training-sessions/${activityId}/resume`,
    { method: "POST", body: "{}" },
  );
  return unwrapOrThrow(result);
}

export async function startTrainingStep(
  activityId: string,
  sequenceNumber: number,
): Promise<StartTrainingStepResponseData> {
  const result = await apiRequest<StartTrainingStepResponseData>(
    `/api/training-sessions/${activityId}/steps/${sequenceNumber}`,
    { method: "POST", body: "{}" },
  );
  return unwrapOrThrow(result);
}

export async function completeTraining(
  activityId: string,
): Promise<CompleteTrainingResponseData> {
  const result = await apiRequest<CompleteTrainingResponseData>(
    `/api/training-sessions/${activityId}/complete`,
    { method: "PATCH" },
  );
  return unwrapOrThrow(result);
}

export async function abandonTraining(
  activityId: string,
): Promise<AbandonTrainingResponseData> {
  const result = await apiRequest<AbandonTrainingResponseData>(
    `/api/training-sessions/${activityId}/abandon`,
    { method: "PATCH" },
  );
  return unwrapOrThrow(result);
}

/** The caller's completed trainings at or after `since` (an ISO instant). */
export async function listTrainingCompletions(
  since: string,
): Promise<TrainingCompletionListData> {
  return unwrapOrThrow(
    await apiRequest<TrainingCompletionListData>(
      `/api/training-sessions/completed?since=${encodeURIComponent(since)}`,
      { method: "GET" },
    ),
  );
}
