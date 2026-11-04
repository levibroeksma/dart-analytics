import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { collectionRoutes, itemRoutes } from "@server/resource-routes";

const locals = {
  requestId: "req-1",
  auth: { authUserId: "auth-1", playerId: "player-1" },
};
const schema = z.object({ name: z.string() }).strict();

function jsonRequest(body: string): Request {
  return new Request("http://localhost/x", { method: "POST", body });
}

function call(
  route: (context: never) => Response | Promise<Response>,
  init: { params?: Record<string, string>; request?: Request } = {},
) {
  return route({
    locals,
    params: init.params ?? {},
    request: init.request ?? new Request("http://localhost/x"),
  } as never);
}

function collection(
  overrides: Partial<Parameters<typeof collectionRoutes>[0]> = {},
) {
  return collectionRoutes({
    list: vi.fn().mockResolvedValue({ ok: true, data: [{ a: 1 }] }),
    create: vi.fn().mockResolvedValue({ ok: true, data: { id: "n" } }),
    createSchema: schema,
    ...overrides,
  });
}

function item(overrides: Partial<Parameters<typeof itemRoutes>[0]> = {}) {
  return itemRoutes({
    param: "thingId",
    get: vi.fn().mockResolvedValue({ ok: true, data: { id: "t" } }),
    replace: vi.fn().mockResolvedValue({ ok: true, data: { id: "t" } }),
    remove: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
    updateSchema: schema,
    ...overrides,
  });
}

describe("collectionRoutes", () => {
  it("GET lists for the player in a 200 envelope", async () => {
    const list = vi.fn().mockResolvedValue({ ok: true, data: [{ a: 1 }] });
    const response = await call(collection({ list }).GET);

    expect(list).toHaveBeenCalledWith("player-1");
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Request-Id")).toBe("req-1");
    expect(await response.json()).toEqual({
      ok: true,
      data: [{ a: 1 }],
      requestId: "req-1",
    });
  });

  it("GET maps a service failure to the fail envelope", async () => {
    const list = vi
      .fn()
      .mockResolvedValue({ ok: false, code: "NOT_FOUND", details: { w: 1 } });
    const response = await call(collection({ list }).GET);

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.details).toEqual({ w: 1 });
    expect(body.requestId).toBe("req-1");
  });

  it("POST rejects an invalid body without calling create", async () => {
    const create = vi.fn();
    const response = await call(collection({ create }).POST, {
      request: jsonRequest(JSON.stringify({ name: 1 })),
    });

    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("VALIDATION_FAILED");
    expect(create).not.toHaveBeenCalled();
  });

  it("POST rejects malformed JSON", async () => {
    const response = await call(collection().POST, {
      request: jsonRequest("{"),
    });

    expect(response.status).toBe(422);
    expect((await response.json()).error.details).toEqual({
      reason: "body is not valid JSON",
    });
  });

  it("POST creates with the parsed body and answers 201", async () => {
    const create = vi.fn().mockResolvedValue({ ok: true, data: { id: "n" } });
    const response = await call(collection({ create }).POST, {
      request: jsonRequest(JSON.stringify({ name: "x" })),
    });

    expect(create).toHaveBeenCalledWith("player-1", { name: "x" });
    expect(response.status).toBe(201);
    expect((await response.json()).data).toEqual({ id: "n" });
  });

  it("POST maps a create failure to the fail envelope", async () => {
    const create = vi.fn().mockResolvedValue({ ok: false, code: "NOT_FOUND" });
    const response = await call(collection({ create }).POST, {
      request: jsonRequest(JSON.stringify({ name: "x" })),
    });

    expect(response.status).toBe(404);
    expect((await response.json()).error.details).toEqual({});
  });
});

describe("itemRoutes", () => {
  it("GET reads the id from params[param]", async () => {
    const get = vi.fn().mockResolvedValue({ ok: true, data: { id: "t" } });
    const response = await call(item({ get }).GET, {
      params: { thingId: "t-1" },
    });

    expect(get).toHaveBeenCalledWith("player-1", "t-1");
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ id: "t" });
  });

  it("GET maps a service failure to the fail envelope", async () => {
    const get = vi.fn().mockResolvedValue({ ok: false, code: "NOT_FOUND" });
    const response = await call(item({ get }).GET, {
      params: { thingId: "t-1" },
    });

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("NOT_FOUND");
  });

  it("PUT rejects an invalid body without calling replace", async () => {
    const replace = vi.fn();
    const response = await call(item({ replace }).PUT, {
      params: { thingId: "t-1" },
      request: jsonRequest(JSON.stringify({})),
    });

    expect(response.status).toBe(422);
    expect(replace).not.toHaveBeenCalled();
  });

  it("PUT replaces with id and parsed body and answers 200", async () => {
    const replace = vi.fn().mockResolvedValue({ ok: true, data: { id: "t" } });
    const response = await call(item({ replace }).PUT, {
      params: { thingId: "t-1" },
      request: jsonRequest(JSON.stringify({ name: "y" })),
    });

    expect(replace).toHaveBeenCalledWith("player-1", "t-1", { name: "y" });
    expect(response.status).toBe(200);
  });

  it("DELETE answers 204 with no body and the X-Request-Id header", async () => {
    const remove = vi.fn().mockResolvedValue({ ok: true, data: undefined });
    const response = await call(item({ remove }).DELETE, {
      params: { thingId: "t-1" },
    });

    expect(remove).toHaveBeenCalledWith("player-1", "t-1");
    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
    expect(response.headers.get("X-Request-Id")).toBe("req-1");
  });

  it("DELETE maps a service failure to the fail envelope", async () => {
    const remove = vi.fn().mockResolvedValue({ ok: false, code: "NOT_FOUND" });
    const response = await call(item({ remove }).DELETE, {
      params: { thingId: "t-1" },
    });

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("NOT_FOUND");
  });
});
