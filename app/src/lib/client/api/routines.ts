import { apiRequest } from "./client";
import { unwrapOrThrow } from "./unwrap";
import {
  CreateRoutineRequest,
  UpdateRoutineRequest,
  type CreateRoutineRequestInput,
  type UpdateRoutineRequestInput,
  type RoutineExecutionData,
  type RoutineListData,
  type ExerciseTemplateCatalogEntryData,
} from "./types";

export async function listRoutines(): Promise<RoutineListData> {
  return unwrapOrThrow(
    await apiRequest<RoutineListData>("/api/routines", { method: "GET" }),
  );
}

export async function getRoutine(
  routineId: string,
): Promise<RoutineExecutionData> {
  return unwrapOrThrow(
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
  return unwrapOrThrow(
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
  return unwrapOrThrow(
    await apiRequest<RoutineExecutionData>(
      `/api/routines/${encodeURIComponent(routineId)}`,
      { method: "PUT", body: JSON.stringify(payload) },
    ),
  );
}

export async function deleteRoutine(routineId: string): Promise<void> {
  unwrapOrThrow(
    await apiRequest<null>(`/api/routines/${encodeURIComponent(routineId)}`, {
      method: "DELETE",
    }),
  );
}

export async function listExerciseTemplates(): Promise<
  ExerciseTemplateCatalogEntryData[]
> {
  return unwrapOrThrow(
    await apiRequest<ExerciseTemplateCatalogEntryData[]>(
      "/api/exercise-templates",
      { method: "GET" },
    ),
  );
}
