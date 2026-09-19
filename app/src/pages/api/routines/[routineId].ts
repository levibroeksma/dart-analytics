import type { APIRoute } from "astro";
import { UpdateRoutineRequest } from "./types";
import {
  deleteRoutine,
  getRoutine,
  replaceRoutine,
} from "@services/routine.service";
import { ok, fail } from "@server/envelope";
import { parseAndValidateBody } from "@server/parse-json-body";

export const GET: APIRoute = async ({ locals, params }) => {
  const auth = locals.auth!;
  const result = await getRoutine(auth.playerId!, params.routineId!);
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId);
};

export const PUT: APIRoute = async ({ locals, params, request }) => {
  const auth = locals.auth!;
  const parsed = await parseAndValidateBody(
    UpdateRoutineRequest,
    request,
    locals.requestId,
  );
  if (!parsed.ok) return parsed.response;

  const result = await replaceRoutine(
    auth.playerId!,
    params.routineId!,
    parsed.data,
  );
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId);
};

/** `204` carries no envelope: there is no body to put a `requestId` in; the header still carries it. */
export const DELETE: APIRoute = async ({ locals, params }) => {
  const auth = locals.auth!;
  const result = await deleteRoutine(auth.playerId!, params.routineId!);
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return new Response(null, {
    status: 204,
    headers: { "X-Request-Id": locals.requestId },
  });
};
