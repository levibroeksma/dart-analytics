import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { pickQuery, statisticsRoute } from "@server/statistics-route";

const locals = {
  requestId: "req-1",
  auth: { authUserId: "auth-1", playerId: "player-1" },
};
const schema = z.object({ n: z.coerce.number() }).strict();

function call(
  route: ReturnType<typeof statisticsRoute>,
  query: string,
  params: Record<string, string> = {},
) {
  return route({
    locals,
    params,
    url: new URL(`http://localhost/x?${query}`),
  } as never);
}

describe("statisticsRoute", () => {
  it("422s with the first issue and skips run when the query is invalid", async () => {
    const run = vi.fn();
    const response = await call(statisticsRoute({ schema, run }), "n=a");

    expect(response.status).toBe(422);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.details.reason).toEqual(expect.any(String));
    expect(run).not.toHaveBeenCalled();
  });

  it("rejects unexpected keys through a strict schema", async () => {
    const run = vi.fn();
    const response = await call(statisticsRoute({ schema, run }), "n=1&x=2");

    expect(response.status).toBe(422);
    expect(run).not.toHaveBeenCalled();
  });

  it("passes player, params, parsed query and request id to run", async () => {
    const run = vi.fn().mockResolvedValue({ ok: true, data: { a: 1 } });
    const response = await call(statisticsRoute({ schema, run }), "n=2", {
      k: "v",
    });

    expect(run).toHaveBeenCalledWith(
      { playerId: "player-1", params: { k: "v" }, requestId: "req-1" },
      { n: 2 },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect((await response.json()).data).toEqual({ a: 1 });
  });

  it("maps a service failure to its envelope with no-store", async () => {
    const run = vi.fn().mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      details: { why: "x" },
    });
    const response = await call(statisticsRoute({ schema, run }), "n=1");

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect((await response.json()).error.details).toEqual({ why: "x" });
  });

  it("answers a guard failure before parsing the query or running", async () => {
    const run = vi.fn();
    const guard = vi.fn().mockReturnValue({ code: "NOT_FOUND" });
    const response = await call(
      statisticsRoute({ schema, guard, run }),
      "n=bad",
      { k: "v" },
    );

    expect(guard).toHaveBeenCalledWith({ k: "v" });
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(run).not.toHaveBeenCalled();
  });

  it("reads the query through a custom picker when given one", async () => {
    const run = vi.fn().mockResolvedValue({ ok: true, data: null });
    const pick = (url: URL) => ({ n: url.searchParams.get("n") ?? undefined });
    const response = await call(
      statisticsRoute({ schema, pick, run }),
      "n=3&extra=1",
    );

    expect(response.status).toBe(200);
    expect(run).toHaveBeenCalledWith(expect.anything(), { n: 3 });
  });
});

describe("pickQuery", () => {
  it("keeps the first value of each key and drops the rest", () => {
    const url = new URL("http://localhost/x?a=1&a=2&b=3&c=4");
    expect(pickQuery(url, ["a", "b", "z"])).toEqual({
      a: "1",
      b: "3",
      z: undefined,
    });
  });
});
