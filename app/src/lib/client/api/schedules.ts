import { apiRequest, unwrapOrThrow } from "./client";
import {
  CreateScheduleRequest,
  UpdateScheduleRequest,
  type CreateScheduleRequestInput,
  type UpdateScheduleRequestInput,
  type ScheduleData,
  type ScheduleListData,
} from "./types";

export async function listSchedules(): Promise<ScheduleListData> {
  return unwrapOrThrow(
    await apiRequest<ScheduleListData>("/api/schedules", { method: "GET" }),
  );
}

export async function getSchedule(scheduleId: string): Promise<ScheduleData> {
  return unwrapOrThrow(
    await apiRequest<ScheduleData>(
      `/api/schedules/${encodeURIComponent(scheduleId)}`,
      { method: "GET" },
    ),
  );
}

/** The caller's active schedule, or `null` when none is active (backs the Today card). */
export async function getActiveSchedule(): Promise<ScheduleData | null> {
  return unwrapOrThrow(
    await apiRequest<ScheduleData | null>("/api/schedules/active", {
      method: "GET",
    }),
  );
}

export async function createSchedule(
  body: CreateScheduleRequestInput,
): Promise<ScheduleData> {
  const payload = CreateScheduleRequest.parse(body);
  return unwrapOrThrow(
    await apiRequest<ScheduleData>("/api/schedules", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
}

export async function updateSchedule(
  scheduleId: string,
  body: UpdateScheduleRequestInput,
): Promise<ScheduleData> {
  const payload = UpdateScheduleRequest.parse(body);
  return unwrapOrThrow(
    await apiRequest<ScheduleData>(
      `/api/schedules/${encodeURIComponent(scheduleId)}`,
      { method: "PUT", body: JSON.stringify(payload) },
    ),
  );
}

export async function activateSchedule(
  scheduleId: string,
): Promise<ScheduleData> {
  return unwrapOrThrow(
    await apiRequest<ScheduleData>(
      `/api/schedules/${encodeURIComponent(scheduleId)}/activate`,
      { method: "POST" },
    ),
  );
}

export async function deactivateSchedule(
  scheduleId: string,
): Promise<ScheduleData> {
  return unwrapOrThrow(
    await apiRequest<ScheduleData>(
      `/api/schedules/${encodeURIComponent(scheduleId)}/deactivate`,
      { method: "POST" },
    ),
  );
}

export async function deleteSchedule(scheduleId: string): Promise<void> {
  unwrapOrThrow(
    await apiRequest<null>(`/api/schedules/${encodeURIComponent(scheduleId)}`, {
      method: "DELETE",
    }),
  );
}
