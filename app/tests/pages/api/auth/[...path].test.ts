import { describe, it, expect, vi, beforeEach } from "vitest";

const { authBaseUrlBox } = vi.hoisted(() => ({
  authBaseUrlBox: {
    value: "https://auth.example.com/neondb/auth" as string | undefined,
  },
}));

vi.mock("@lib/env", () => ({
  get env() {
    return {
      auth: {
        get baseUrl() {
          if (authBaseUrlBox.value === undefined) {
            throw new Error("NEON_AUTH_BASE_URL missing");
          }
          return authBaseUrlBox.value;
        },
      },
    };
  },
}));

import { ALL } from "../../../../src/pages/api/auth/[...path]";

function requestFor(path: string, init: RequestInit = {}) {
  return {
    request: new Request(`https://app.example.com/api/auth/${path}`, init),
    params: { path },
  };
}

describe("ALL /api/auth/[...path]", () => {
  beforeEach(() => {
    authBaseUrlBox.value = "https://auth.example.com/neondb/auth";
    vi.restoreAllMocks();
  });

  it("forwards method, target path, and body to NEON_AUTH_BASE_URL", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    await ALL(
      requestFor("sign-in/email", {
        method: "POST",
        body: JSON.stringify({ email: "a@b.com" }),
      }) as never,
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [target, init] = fetchSpy.mock.calls[0] as [
      string | URL,
      RequestInit,
    ];
    expect(String(target)).toBe(
      "https://auth.example.com/neondb/auth/sign-in/email",
    );
    expect(init.method).toBe("POST");
    expect(await (init.body as Blob).text()).toBe(
      JSON.stringify({ email: "a@b.com" }),
    );
  });

  it("forwards no body for a GET request", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    await ALL(requestFor("get-session", { method: "GET" }) as never);

    const [, init] = fetchSpy.mock.calls[0] as [string | URL, RequestInit];
    expect(init.body).toBeUndefined();
  });

  it("strips Domain and forces SameSite=Lax on Set-Cookie, keeping Secure", async () => {
    const upstream = new Response("{}", {
      status: 200,
      headers: {
        "set-cookie":
          "better-auth.session_token=abc; Domain=auth.example.com; Path=/; SameSite=None; Secure",
      },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(upstream);

    const response = await ALL(requestFor("get-session") as never);

    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Secure");
    expect(setCookie).not.toContain("Domain=");
  });

  it("rewrites SameSite=Strict to SameSite=Lax", async () => {
    const upstream = new Response("{}", {
      status: 200,
      headers: {
        "set-cookie":
          "better-auth.session_token=abc; Path=/; SameSite=Strict; Secure",
      },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(upstream);

    const response = await ALL(requestFor("get-session") as never);

    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).not.toContain("SameSite=Strict");
  });

  it("appends SameSite=Lax when upstream omits the attribute", async () => {
    const upstream = new Response("{}", {
      status: 200,
      headers: {
        "set-cookie": "better-auth.session_token=abc; Path=/; HttpOnly",
      },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(upstream);

    const response = await ALL(requestFor("get-session") as never);

    expect(response.headers.get("set-cookie")).toContain("SameSite=Lax");
  });

  it("forwards the browser Origin header unchanged for the upstream CSRF check", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    await ALL(
      requestFor("sign-in/email", {
        method: "POST",
        headers: { origin: "https://app.example.com" },
        body: "{}",
      }) as never,
    );

    const [, init] = fetchSpy.mock.calls[0] as [string | URL, RequestInit];
    expect(new Headers(init.headers).get("origin")).toBe(
      "https://app.example.com",
    );
  });

  it("passes non-2xx status and body through untouched", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid" }), { status: 401 }),
    );

    const response = await ALL(requestFor("sign-in/email") as never);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "invalid" });
  });

  it("returns 502 when Neon Auth is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    const response = await ALL(requestFor("get-session") as never);

    expect(response.status).toBe(502);
    const body = await response.text();
    expect(body).not.toContain('"ok"');
    let parsed: unknown;
    let didParse = true;
    try {
      parsed = JSON.parse(body);
    } catch {
      didParse = false;
    }
    if (didParse) expect(parsed).not.toHaveProperty("ok");
  });

  it("returns 500 when NEON_AUTH_BASE_URL is not configured", async () => {
    authBaseUrlBox.value = undefined;

    const response = await ALL(requestFor("get-session") as never);

    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).not.toContain('"ok"');
    let parsed: unknown;
    let didParse = true;
    try {
      parsed = JSON.parse(body);
    } catch {
      didParse = false;
    }
    if (didParse) expect(parsed).not.toHaveProperty("ok");
  });

  it("builds a well-formed target URL for the bare /api/auth path", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    await ALL({
      request: new Request("https://app.example.com/api/auth", {
        method: "GET",
      }),
      params: { path: undefined },
    } as never);

    const [target] = fetchSpy.mock.calls[0] as [string | URL, RequestInit];
    const targetString = String(target);
    expect(targetString.replace(/^https:\/\//, "")).not.toContain("//");
    expect(targetString).not.toContain("undefined");
  });

  it("strips a trailing slash on NEON_AUTH_BASE_URL before joining the path", async () => {
    authBaseUrlBox.value = "https://auth.example.com/neondb/auth/";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    await ALL(requestFor("sign-in/email") as never);

    const [target] = fetchSpy.mock.calls[0] as [string | URL, RequestInit];
    expect(String(target)).toBe(
      "https://auth.example.com/neondb/auth/sign-in/email",
    );
  });
});
