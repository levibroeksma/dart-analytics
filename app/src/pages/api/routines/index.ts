import type { APIRoute } from "astro";
import { CreateRoutineRequest } from "./types";
import { createRoutine, listRoutines } from "@services/routine.service";
import { ok, fail } from "@server/envelope";
import { parseAndValidateBody } from "@server/parse-json-body";

export const GET: APIRoute = async ({ locals }) => {
  const auth = locals.auth!;
  const result = await listRoutines(auth.playerId!);
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId);
};

export const POST: APIRoute = async ({ locals, request }) => {
  const auth = locals.auth!;
  const parsed = await parseAndValidateBody(
    CreateRoutineRequest,
    request,
    locals.requestId,
  );
  if (!parsed.ok) return parsed.response;

  const result = await createRoutine(auth.playerId!, parsed.data);
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId, 201);
};
