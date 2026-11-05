import type { APIRoute } from "astro";
import type { ServiceResult } from "@services/types";
import { ok, fail } from "./envelope";
import { parseAndValidateBody } from "./parse-json-body";
import type { CollectionRouteSpec, ItemRouteSpec } from "./types";

function respond(
  result: ServiceResult<unknown>,
  requestId: string,
  status = 200,
): Response {
  if (!result.ok) return fail(result.code, requestId, result.details);
  return ok(result.data, requestId, status);
}

/** `GET` lists the player's resources; `POST` validates the body and creates one (`201`). */
export function collectionRoutes<C>(spec: CollectionRouteSpec<C>): {
  GET: APIRoute;
  POST: APIRoute;
} {
  const GET: APIRoute = async ({ locals }) => {
    const result = await spec.list(locals.auth!.playerId!);
    return respond(result, locals.requestId);
  };

  const POST: APIRoute = async ({ locals, request }) => {
    const parsed = await parseAndValidateBody(
      spec.createSchema,
      request,
      locals.requestId,
    );
    if (!parsed.ok) return parsed.response;

    const result = await spec.create(locals.auth!.playerId!, parsed.data);
    return respond(result, locals.requestId, 201);
  };

  return { GET, POST };
}

/**
 * `GET`, `PUT` (validated body) and `DELETE` on the resource named by
 * `params[spec.param]`. `DELETE`'s `204` carries no envelope: there is no body
 * to put a `requestId` in; the header still carries it.
 */
export function itemRoutes<U>(spec: ItemRouteSpec<U>): {
  GET: APIRoute;
  PUT: APIRoute;
  DELETE: APIRoute;
} {
  const GET: APIRoute = async ({ locals, params }) => {
    const result = await spec.get(locals.auth!.playerId!, params[spec.param]!);
    return respond(result, locals.requestId);
  };

  const PUT: APIRoute = async ({ locals, params, request }) => {
    const parsed = await parseAndValidateBody(
      spec.updateSchema,
      request,
      locals.requestId,
    );
    if (!parsed.ok) return parsed.response;

    const result = await spec.replace(
      locals.auth!.playerId!,
      params[spec.param]!,
      parsed.data,
    );
    return respond(result, locals.requestId);
  };

  const DELETE: APIRoute = async ({ locals, params }) => {
    const result = await spec.remove(
      locals.auth!.playerId!,
      params[spec.param]!,
    );
    if (!result.ok) return fail(result.code, locals.requestId, result.details);
    return new Response(null, {
      status: 204,
      headers: { "X-Request-Id": locals.requestId },
    });
  };

  return { GET, PUT, DELETE };
}
