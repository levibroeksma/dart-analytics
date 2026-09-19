import { apiRequest } from "./client";
import { SessionApiError } from "./sessions";
import {
  CreateRoutineRequest,
  UpdateRoutineRequest,
  type CreateRoutineRequestInput,
  type UpdateRoutineRequestInput,
  type RoutineExecutionData,
  type RoutineListData,
  type ExerciseTemplateCatalogEntryData,
} from "./types";
import type { ApiResult } from "./types";

function unwrap<T>(result: ApiResult<T>): T {
  if (!result.ok) {
    throw new SessionApiError(
      result.error.code,
      result.error.message,
      result.requestId,
      result.error.details,
    );
  }
  return result.data;
}

export async function listRoutines(): Promise<RoutineListData> {
  return unwrap(
    await apiRequest<RoutineListData>("/api/routines", { method: "GET" }),
  );
}

export async function getRoutine(
  routineId: string,
): Promise<RoutineExecutionData> {
  return unwrap(
    await apiRequest<RoutineExecutionData>(
      `/api/routines/${encodeURIComponent(routineId)}`,
      { method: "GET" },
    ),
  );
}

export async function createRoutine(
  body: CreateRoutineRequestInput,
): Promise<RoutineExecutionData> {
  const payload = CreateRoutineRequest.parse(body);
  return unwrap(
    await apiRequest<RoutineExecutionData>("/api/routines", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
}

export async function updateRoutine(
  routineId: string,
  body: UpdateRoutineRequestInput,
): Promise<RoutineExecutionData> {
  const payload = UpdateRoutineRequest.parse(body);
  return unwrap(
    await apiRequest<RoutineExecutionData>(
      `/api/routines/${encodeURIComponent(routineId)}`,
      { method: "PUT", body: JSON.stringify(payload) },
    ),
  );
}

export async function deleteRoutine(routineId: string): Promise<void> {
  unwrap(
    await apiRequest<null>(`/api/routines/${encodeURIComponent(routineId)}`, {
      method: "DELETE",
    }),
  );
}

export async function listExerciseTemplates(): Promise<
  ExerciseTemplateCatalogEntryData[]
> {
  return unwrap(
    await apiRequest<ExerciseTemplateCatalogEntryData[]>(
      "/api/exercise-templates",
      { method: "GET" },
    ),
  );
}
