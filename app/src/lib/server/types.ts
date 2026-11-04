import type { z } from "zod";
import type { ServiceResult } from "@services/types";
import { ERROR_HTTP } from "./errors";

export type ErrorCode = keyof typeof ERROR_HTTP;

/** A request body schema: any input, parsed to `T`. */
export type BodySchema<T> = z.ZodType<T, z.ZodTypeDef, unknown>;

/** The services behind a player-owned collection route (`GET` list, `POST` create). */
export type CollectionRouteSpec<C> = {
  list: (playerId: string) => Promise<ServiceResult<unknown>>;
  create: (playerId: string, body: C) => Promise<ServiceResult<unknown>>;
  createSchema: BodySchema<C>;
};

/** The services behind a player-owned item route, keyed by the path param `param`. */
export type ItemRouteSpec<U> = {
  param: string;
  get: (playerId: string, id: string) => Promise<ServiceResult<unknown>>;
  replace: (
    playerId: string,
    id: string,
    body: U,
  ) => Promise<ServiceResult<unknown>>;
  remove: (playerId: string, id: string) => Promise<ServiceResult<unknown>>;
  updateSchema: BodySchema<U>;
};
