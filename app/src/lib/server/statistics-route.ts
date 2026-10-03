import type { APIRoute } from "astro";
import type { z } from "zod";
import type { ServiceResult } from "@services/types";
import { ok, fail } from "./envelope";
import type { ErrorCode } from "./types";

type RouteParams = Record<string, string | undefined>;

type StatisticsRouteContext = {
  playerId: string;
  params: RouteParams;
  requestId: string;
};

type GuardFailure = { code: ErrorCode; details?: Record<string, unknown> };

type StatisticsRouteOptions<Q> = {
  schema: z.ZodType<Q, z.ZodTypeDef, unknown>;
  guard?: (params: RouteParams) => GuardFailure | null;
  pick?: (url: URL) => unknown;
  run: (
    context: StatisticsRouteContext,
    query: Q,
  ) => Promise<ServiceResult<unknown>>;
};

function noStore(response: Response): Response {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

/**
 * The first value of each of `keys` off the query string, `undefined` when
 * absent — a `pick` for routes whose schema is not `.strict()`.
 */
export function pickQuery(
  url: URL,
  keys: readonly string[],
): Record<string, string | undefined> {
  return Object.fromEntries(
    keys.map((key) => [key, url.searchParams.get(key) ?? undefined]),
  );
}

function allParams(url: URL): unknown {
  return Object.fromEntries(url.searchParams);
}

/**
 * A `/api/statistics/*` GET route: `guard` on the path params, `schema` on the
 * query (read by `pick`, every param by default), then `run`. Every response,
 * page or error, is `private, no-store`.
 */
export function statisticsRoute<Q>(
  options: StatisticsRouteOptions<Q>,
): APIRoute {
  const { schema, guard, pick = allParams, run } = options;
  return async ({ locals, params, url }) => {
    const requestId = locals.requestId;
    const blocked = guard?.(params);
    if (blocked) {
      return noStore(fail(blocked.code, requestId, blocked.details));
    }

    const parsed = schema.safeParse(pick(url));
    if (!parsed.success) {
      return noStore(
        fail("VALIDATION_FAILED", requestId, {
          reason: parsed.error.issues[0]?.message ?? "invalid query",
        }),
      );
    }

    const result = await run(
      { playerId: locals.auth!.playerId!, params, requestId },
      parsed.data,
    );
    if (!result.ok) {
      return noStore(fail(result.code, requestId, result.details));
    }
    return noStore(ok(result.data, requestId));
  };
}
