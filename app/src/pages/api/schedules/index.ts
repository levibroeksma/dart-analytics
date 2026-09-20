import type { APIRoute } from "astro";
import { CreateScheduleRequest } from "./types";
import { createSchedule, listSchedules } from "@services/schedule.service";
import { ok, fail } from "@server/envelope";
import { parseAndValidateBody } from "@server/parse-json-body";

export const GET: APIRoute = async ({ locals }) => {
  const auth = locals.auth!;
  const result = await listSchedules(auth.playerId!);
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId);
};

export const POST: APIRoute = async ({ locals, request }) => {
  const auth = locals.auth!;
  const parsed = await parseAndValidateBody(
    CreateScheduleRequest,
    request,
    locals.requestId,
  );
  if (!parsed.ok) return parsed.response;

  const result = await createSchedule(auth.playerId!, parsed.data);
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId, 201);
};
