# iOS Home Screen Web App Auth Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix issue #55 (auth doesn't work in an installed iOS Home Screen web app) by proxying all Neon Auth traffic same-origin through the Astro Worker, and declare the app as a properly-scoped standalone PWA.

**Architecture:** A new catch-all route `pages/api/auth/[...path].ts` forwards every request under `/api/auth/*` verbatim to `NEON_AUTH_BASE_URL`, rewriting `Set-Cookie` so the Better Auth session cookie binds first-party to the app's own host instead of Neon Auth's cross-site domain. The browser `authClient` points at this same-origin path instead of the cross-origin `PUBLIC_NEON_AUTH_BASE_URL`. A new `api-auth-proxy` route class makes middleware skip JWT verification and envelope wrapping for this route — it is transport, not a domain endpoint. A `manifest.json` + `apple-mobile-web-app-capable` meta tags pin navigation to `scope: "/"` so an auth redirect can never break out to Safari.

**Tech Stack:** Astro (Cloudflare Workers adapter), TypeScript, Vitest, `@neon/env` (`env.auth.*`), Better Auth via `@neondatabase/auth`.

## Global Constraints

- Full generic proxy under `/api/auth/*` — no endpoint allowlist (spec B1).
- `Set-Cookie` rewrite: strip `Domain=`, force `SameSite=Lax` (append it when upstream omits it), keep `Secure` (spec B2).
- New route class `api-auth-proxy`: no JWT check, no player resolution, no `ok/data/requestId` envelope (spec B3).
- Browser `authClient` base URL becomes same-origin (spec B4). **It must be an absolute URL** — `${globalThis.location.origin}/api/auth`, never the bare path `"/api/auth"`. Verified against `better-auth@1.4.18`: `createAuthClient(url)` passes `url` straight to `getBaseURL()`, which calls `assertHasProtocol()` → `new URL(url)` and throws `BetterAuthError: Invalid base URL` on a relative path (`better-auth/dist/utils/url.mjs:12-20`, `dist/client/config.mjs:11`).
- **Neon Auth must trust the app's deployed origin.** `originCheckMiddleware` (`better-auth/dist/api/middlewares/origin-check.mjs:26`) validates the `Origin` header against `trustedOrigins` on every non-GET request. The proxy forwards the browser's `Origin: https://<app-host>` unchanged (rewriting it would defeat CSRF protection), so the app origin must be registered in Neon Auth or `POST /api/auth/sign-in/email` returns `403 FORBIDDEN`. See Task 0.
- No new UX for the one-time re-login on first standalone launch — out of scope (spec B5).
- `manifest.json`: `scope`/`start_url: "/"`, `display: "standalone"` (spec B6).
- Ledger entries: **D172** (auth proxy), **D173** (manifest/meta) — these are the next free IDs (highest existing is D171).
- Tests live under `app/tests/`, mirroring `app/src/`, Vitest mocks only, no real network (`app/CLAUDE.md`).
- No `//` or `/* */` comments inside function/method bodies in `app/src/**/*.ts` — JSDoc above the declaration only (`app/CLAUDE.md`).
- `npm run validate:app` must pass before the work is done (`app/CLAUDE.md`).
- Minimal diffs on all doc edits — extend existing tables/sections, never regenerate (root `CLAUDE.md`).

---

### Task 0: Register the app origin as a Neon Auth trusted origin

**Files:**

- Modify: `docs/architecture/05-Database/11-Neon-Integration.md`

**Interfaces:** None — external configuration + documentation.

> **Why this is Task 0, not a footnote:** without it the proxy returns `403 FORBIDDEN` on the login POST and the whole change appears broken. Before this change the browser called Neon Auth directly from the app's own origin, so the app origin was already the request `Origin` and no separate registration was needed for production. Once traffic is proxied, the `Origin` header still says `https://<app-host>` — but it now arrives at Neon Auth as a request Better Auth origin-checks against its `trustedOrigins` list, which only has the dev entry.

- [ ] **Step 1: Determine the deployed app origin**

Run: `cd app && npx wrangler deployments list`
Read the Worker URL from the output (shape: `https://<worker-name>.<subdomain>.workers.dev`). This is the origin to register. If a custom domain has since been configured, use that instead.

- [ ] **Step 2: Add the origin to Neon Auth's trusted origins**

In the Neon console → the project's **Auth** section → trusted origins/domains, add the origin from Step 1 for the **`main`** branch (production). Confirm `http://localhost:4321` is still present on the **`dev`** branch — the existing local-development entry (`11-Neon-Integration.md`, "Dev auth user (out of band)", step 2).

This is a console/config action, not a code change — there is no committed file that holds this list.

- [ ] **Step 3: Document the requirement so it is not lost on the next environment**

In `docs/architecture/05-Database/11-Neon-Integration.md`, change:

```markdown
### Dev auth user (out of band)

Sign-up UI is out of scope for v1. Provision the dev branch user once per environment:

| Step | Action |
| ---- | ------ |
| 1 | Enable email/password on the dev Neon Auth branch; disable email verification for local dev |
| 2 | Add trusted origin `http://localhost:4321` |
| 3 | Run `npm run env:dev` (checkout `dev` + mirror `PUBLIC_NEON_AUTH_BASE_URL`) |
| 4 | Run `npm run seed:dev-auth` from `app/` |
```

to:

```markdown
### Trusted origins (required per branch)

Browser auth traffic is proxied same-origin through `/api/auth/*` (D172), so every request Neon Auth receives carries the **app's** origin in its `Origin` header. Better Auth origin-checks that value against the branch's trusted-origins list on every non-GET request, so each deployed origin must be registered or sign-in returns `403 FORBIDDEN`:

| Branch | Origin to register |
| ------ | ------------------ |
| `dev` | `http://localhost:4321` |
| `main` | The deployed Worker URL (`https://<worker-name>.<subdomain>.workers.dev`, or the custom domain once configured) |

Registered in the Neon console under the project's Auth section — there is no committed file for this list.

### Dev auth user (out of band)

Sign-up UI is out of scope for v1. Provision the dev branch user once per environment:

| Step | Action |
| ---- | ------ |
| 1 | Enable email/password on the dev Neon Auth branch; disable email verification for local dev |
| 2 | Add trusted origin `http://localhost:4321` (see Trusted origins above) |
| 3 | Run `npm run env:dev` (checkout `dev` + mirror `PUBLIC_NEON_AUTH_BASE_URL`) |
| 4 | Run `npm run seed:dev-auth` from `app/` |
```

- [ ] **Step 4: Bump the doc header and version**

In the same file, change:

```markdown
<!--
status: canonical
scope: database/platform
read-when: Neon environment and tooling work
updated: 2026-07-24
-->

# Neon Integration Guide

> **Version:** 1.0.1
```

to:

```markdown
<!--
status: canonical
scope: database/platform
read-when: Neon environment and tooling work
updated: 2026-07-29
-->

# Neon Integration Guide

> **Version:** 1.1.0 (per-branch trusted origins required by the same-origin auth proxy, D172, 2026-07-29)
```

- [ ] **Step 5: Commit**

```bash
git add docs/architecture/05-Database/11-Neon-Integration.md
git commit -m "docs: require per-branch Neon Auth trusted origins for the same-origin proxy"
```

---

### Task 1: Route classification — add `api-auth-proxy`

**Files:**

- Modify: `app/src/lib/utils/types.ts`
- Modify: `app/src/lib/utils/route-class.ts`
- Modify: `app/tests/utils/route-class.test.ts`

**Interfaces:**

- Produces: `RouteClass` union gains `"api-auth-proxy"`; `classifyRoute(path: string): RouteClass` returns `"api-auth-proxy"` for any path starting with `/api/auth/`.

- [ ] **Step 1: Write the failing test**

Add to `app/tests/utils/route-class.test.ts` (append inside the existing `describe` block, after the `"classifies provision endpoint"` test):

```typescript
it("classifies auth proxy paths", () => {
  expect(classifyRoute("/api/auth/sign-in/email")).toBe("api-auth-proxy");
  expect(classifyRoute("/api/auth/get-session")).toBe("api-auth-proxy");
  expect(classifyRoute("/api/auth")).toBe("api-auth-proxy");
});

it("still classifies other /api/ paths as api-protected", () => {
  expect(classifyRoute("/api/sessions")).toBe("api-protected");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/utils/route-class.test.ts`
Expected: FAIL — `classifyRoute("/api/auth/sign-in/email")` returns `"api-protected"`, not `"api-auth-proxy"`.

- [ ] **Step 3: Add the new class to the `RouteClass` union**

Replace the full contents of `app/src/lib/utils/types.ts`:

```typescript
export type RouteClass =
  | "public-page"
  | "asset"
  | "api-auth-proxy"
  | "api-provision"
  | "api-protected"
  | "protected-page";
```

- [ ] **Step 4: Classify `/api/auth/*` before the generic `/api/` fallthrough**

Replace the full contents of `app/src/lib/utils/route-class.ts`:

```typescript
import { isPublicPage, normalizePath } from "./auth-routes";
import type { RouteClass } from "./types";

const PROVISION_ROUTE = "/api/players/provision";
const AUTH_PROXY_ROOT = "/api/auth";

export function classifyRoute(path: string): RouteClass {
  if (path === AUTH_PROXY_ROOT || path.startsWith(`${AUTH_PROXY_ROOT}/`))
    return "api-auth-proxy";
  if (path === PROVISION_ROUTE) return "api-provision";
  if (path.startsWith("/api/")) return "api-protected";
  if (isPublicPage(normalizePath(path))) return "public-page";
  if (path.includes(".")) return "asset";
  return "protected-page";
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/utils/route-class.test.ts`
Expected: PASS (6 tests, 7 assertions in the new auth-proxy case)

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/utils/types.ts app/src/lib/utils/route-class.ts app/tests/utils/route-class.test.ts
git commit -m "feat: classify /api/auth/* as a new api-auth-proxy route class"
```

---

### Task 2: Middleware bypass for `api-auth-proxy`

**Files:**

- Modify: `app/src/middleware.ts`
- Modify: `app/tests/middleware.test.ts`

**Interfaces:**

- Consumes: `classifyRoute` (Task 1), returns `RouteClass` including `"api-auth-proxy"`.
- Produces: `onRequest` calls `next()` immediately for `api-auth-proxy` — never calls `verifyBearerToken` or the error-boundary `fail()`/`classifyThrownError()` path for this class.

- [ ] **Step 1: Write the failing test**

Add to `app/tests/middleware.test.ts`, as a new top-level `describe` block after the existing one:

```typescript
describe("middleware auth proxy bypass", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skips JWT verification for /api/auth/* and returns next() directly", async () => {
    const next = vi.fn(() => new Response("proxied", { status: 200 }));
    const res = await onRequest(
      ctxFor("/api/auth/sign-in/email") as never,
      next as never,
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(verifyBearerToken).not.toHaveBeenCalled();
    expect((res as Response).status).toBe(200);
    expect(await (res as Response).text()).toBe("proxied");
  });

  it("does not envelope a thrown error on the auth proxy route", async () => {
    const next = vi.fn(() => {
      throw new Error("proxy boom");
    });
    await expect(
      onRequest(ctxFor("/api/auth/get-session") as never, next as never),
    ).rejects.toThrow("proxy boom");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/middleware.test.ts`
Expected: FAIL — `/api/auth/sign-in/email` currently classifies as `api-protected`, so `verifyBearerToken` is called and the mocked `Bearer t` token from `ctxFor` resolves successfully instead of hitting the plain `next()` path; the second test fails because the error gets enveloped as a 500 instead of propagating.

- [ ] **Step 3: Route `api-auth-proxy` through the early-return path**

In `app/src/middleware.ts`, change:

```typescript
if (cls === "public-page" || cls === "asset") return next();
```

to:

```typescript
if (cls === "public-page" || cls === "asset" || cls === "api-auth-proxy")
  return next();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/middleware.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/middleware.ts app/tests/middleware.test.ts
git commit -m "feat: bypass JWT check and error envelope for the auth proxy route"
```

---

### Task 3: Same-origin auth proxy route handler

**Files:**

- Create: `app/src/pages/api/auth/[...path].ts`
- Test: `app/tests/pages/api/auth/[...path].test.ts`

**Interfaces:**

- Consumes: `env.auth.baseUrl` from `@lib/env` (same accessor pattern as `env.auth.jwksUrl` in `app/src/lib/auth/verify-jwt.ts`), which resolves `NEON_AUTH_BASE_URL`.
- Produces: `export const ALL: APIRoute` — handles every HTTP method under `/api/auth/*`.

- [ ] **Step 1: Write the failing tests**

Create `app/tests/pages/api/auth/[...path].test.ts`:

```typescript
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
  });

  it("returns 500 when NEON_AUTH_BASE_URL is not configured", async () => {
    authBaseUrlBox.value = undefined;

    const response = await ALL(requestFor("get-session") as never);

    expect(response.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/pages/api/auth/\[...path\].test.ts`
Expected: FAIL — `app/src/pages/api/auth/[...path].ts` does not exist yet (module not found).

- [ ] **Step 3: Write the proxy handler**

Create `app/src/pages/api/auth/[...path].ts`:

```typescript
import type { APIRoute } from "astro";
import { env } from "@lib/env";

const STRIPPED_REQUEST_HEADERS = ["connection", "keep-alive", "host"];

/**
 * Copies the browser's headers for the upstream call. `host` is dropped rather
 * than rewritten — it is a forbidden header name that `fetch` sets from the
 * target URL regardless. `origin` is deliberately forwarded unchanged: Better
 * Auth origin-checks it against its trustedOrigins list (Task 0), and
 * rewriting it here would defeat that CSRF protection.
 */
function buildForwardHeaders(request: Request): Headers {
  const headers = new Headers(request.headers);
  for (const name of STRIPPED_REQUEST_HEADERS) headers.delete(name);
  return headers;
}

/**
 * Rebinds one upstream cookie to the app's own host: drops `Domain` so it
 * binds to whatever host served the request, and forces `SameSite=Lax`,
 * appending the attribute when upstream omitted it entirely.
 */
function rebindCookie(cookie: string): string {
  const withoutDomain = cookie.replace(/;\s*Domain=[^;]+/i, "");
  return /SameSite=/i.test(withoutDomain)
    ? withoutDomain.replace(/SameSite=[^;]+/i, "SameSite=Lax")
    : `${withoutDomain}; SameSite=Lax`;
}

function rewriteSetCookieHeaders(upstreamHeaders: Headers): Headers {
  const rewritten = new Headers(upstreamHeaders);
  const setCookies = upstreamHeaders.getSetCookie();
  if (setCookies.length === 0) return rewritten;
  rewritten.delete("set-cookie");
  for (const cookie of setCookies)
    rewritten.append("set-cookie", rebindCookie(cookie));
  return rewritten;
}

/**
 * Same-origin transport for Neon Auth (Better Auth) traffic (D172). Forwards
 * every `/api/auth/*` request verbatim to `NEON_AUTH_BASE_URL` and rewrites
 * `Set-Cookie` so the session cookie binds first-party to whatever host
 * served the request, instead of cross-site to Neon Auth's own domain —
 * the fix for iOS standalone web app login. Not a domain endpoint: the
 * upstream response passes through untouched, never wrapped in the
 * `ok/data/requestId` envelope.
 */
export const ALL: APIRoute = async ({ request, params }) => {
  let authBaseUrl: string;
  try {
    authBaseUrl = env.auth.baseUrl;
  } catch {
    return new Response("NEON_AUTH_BASE_URL is not configured", {
      status: 500,
    });
  }

  const forwardPath = params.path ?? "";
  const requestUrl = new URL(request.url);
  const target = new URL(`${authBaseUrl}/${forwardPath}${requestUrl.search}`);
  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(target, {
      method: request.method,
      headers: buildForwardHeaders(request),
      body: hasBody ? await request.blob() : undefined,
      redirect: "manual",
    });
  } catch {
    return new Response("Neon Auth unreachable", { status: 502 });
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: rewriteSetCookieHeaders(upstreamResponse.headers),
  });
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/pages/api/auth/\[...path\].test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Type-check the new property access**

Run: `cd app && npx astro check`
Expected: no errors. If `env.auth.baseUrl` reports a missing-property TypeScript error, inspect `app/node_modules/@neon/env/dist/*.d.ts` for the generated `auth` shape and use the correct property name in both the handler and the test mock (the sibling `env.auth.jwksUrl` accessor in `app/src/lib/auth/verify-jwt.ts` is the precedent this mirrors).

- [ ] **Step 6: Commit**

```bash
git add app/src/pages/api/auth/\[...path\].ts app/tests/pages/api/auth/\[...path\].test.ts
git commit -m "feat: proxy Neon Auth traffic same-origin through /api/auth"
```

---

### Task 4: Point the browser auth client at the same-origin proxy

**Files:**

- Modify: `app/src/lib/client/auth/client.ts`

**Interfaces:**

- Produces: `authClient` (unchanged shape — still `createAuthClient(...)`'s return value) now talks to the app's own origin at `/api/auth` instead of the cross-origin `PUBLIC_NEON_AUTH_BASE_URL`. `getAccessToken()` signature unchanged.

- [ ] **Step 1: Replace the cross-origin base URL with an absolute same-origin URL**

Replace the full contents of `app/src/lib/client/auth/client.ts`:

```typescript
import { createAuthClient } from "@neondatabase/neon-js/auth";

const AUTH_PROXY_PATH = "/api/auth";

export const authClient = createAuthClient(
  `${globalThis.location.origin}${AUTH_PROXY_PATH}`,
);

export async function getAccessToken(): Promise<string | null> {
  const result = await authClient.getSession();
  return result.data?.session?.token ?? null;
}
```

**The absolute URL is load-bearing — do not "simplify" this to the bare path `"/api/auth"`.** `createAuthClient(url)` forwards `url` to Better Auth's `getBaseURL()`, which calls `assertHasProtocol()` → `new URL(url)`; a relative path throws `BetterAuthError: Invalid base URL` at module load and the app never boots (`better-auth@1.4.18`, `dist/utils/url.mjs:12-20`, `dist/client/config.mjs:11`). Building it from `globalThis.location.origin` keeps it same-origin on `*.workers.dev`, on any future custom domain, and on `localhost:4321` with no per-environment configuration.

This removes the `PUBLIC_NEON_AUTH_BASE_URL` presence check and its thrown error — the base URL now derives from the page's own origin, not env, so there is nothing left to validate at module load. This module is browser-only (reached solely through the Alpine client entrypoint: `auth.store.ts`, `login.data.ts`, `@client/api/client.ts`), so `globalThis.location` is always defined where it runs.

- [ ] **Step 2: Run the full test suite to confirm nothing depended on the removed guard**

Run: `cd app && npx vitest run`
Expected: PASS — no existing test file covers `client.ts` (confirmed: `app/tests/lib/client/auth/` does not exist), so this is a refactor with no test to update.

- [ ] **Step 3: Type-check and confirm the build does not evaluate this module server-side**

Run: `cd app && npx astro check && npx astro build`
Expected: both succeed. A build-time `TypeError: Cannot read properties of undefined (reading 'origin')` would mean something imports this module during prerendering — if that happens, wrap the base URL in a lazy getter rather than reverting to a relative path (which cannot work, per Step 1).

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/client/auth/client.ts
git commit -m "feat: point browser auth client at the same-origin /api/auth proxy"
```

---

### Task 5: PWA manifest and standalone meta tags

**Files:**

- Create: `app/public/manifest.json`
- Modify: `app/src/layouts/BaseLayout.astro`

**Interfaces:** None — presentational/static only, no runtime contract for other tasks to consume.

- [ ] **Step 1: Create the manifest**

Create `app/public/manifest.json`:

```json
{
  "name": "Dart Analytics",
  "short_name": "Dart Analytics",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "/favicon.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any"
    },
    {
      "src": "/favicon.ico",
      "sizes": "48x48",
      "type": "image/x-icon"
    }
  ]
}
```

`background_color`/`theme_color` match the app's `--surface` design token (`oklch(0% 0 0)` — pure black, `app/src/styles/global.css:15`).

**Known limitation (not addressed by this task):** iOS Safari's Home Screen icon uses `<link rel="apple-touch-icon">`, which requires a PNG asset — this repo only has `favicon.ico`/`favicon.svg`. No `apple-touch-icon` tag is added here; iOS will fall back to a screenshot-based icon for the installed app until a PNG icon asset is added in a follow-up. This does not affect the auth fix.

- [ ] **Step 2: Add standalone meta tags and the manifest link to `BaseLayout.astro`**

In `app/src/layouts/BaseLayout.astro`, change:

```astro
    <link
      rel="icon"
      href="/favicon.ico"
    />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
    />
```

to:

```astro
    <link
      rel="icon"
      href="/favicon.ico"
    />
    <link
      rel="manifest"
      href="/manifest.json"
    />
    <meta
      name="apple-mobile-web-app-capable"
      content="yes"
    />
    <meta
      name="apple-mobile-web-app-title"
      content="Dart Analytics"
    />
    <meta
      name="apple-mobile-web-app-status-bar-style"
      content="black-translucent"
    />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
    />
```

- [ ] **Step 3: Verify the build picks up the new static file and markup**

Run: `cd app && npx astro build`
Expected: build succeeds; `dist/manifest.json` exists; `dist/client/index.html` (or equivalent prerendered shell) contains `rel="manifest"` and `apple-mobile-web-app-capable`.

```bash
test -f dist/manifest.json && echo "manifest present"
grep -l "apple-mobile-web-app-capable" dist/client/*.html 2>/dev/null || grep -rl "apple-mobile-web-app-capable" dist/ 2>/dev/null
```

- [ ] **Step 4: Format check**

Run: `cd app && npm run format:check`
Expected: clean (the `.astro` edit follows existing `singleAttributePerLine` formatting already used by neighboring tags in the file).

- [ ] **Step 5: Commit**

```bash
git add app/public/manifest.json app/src/layouts/BaseLayout.astro
git commit -m "feat: add PWA manifest and standalone web app meta tags"
```

---

### Task 6: API docs — register the auth proxy route surface

**Files:**

- Modify: `docs/architecture/06-API/00-Overview.md`
- Modify: `docs/architecture/06-API/02-Middleware-And-Layering.md`

**Interfaces:** None — documentation only.

- [ ] **Step 1: Add an "Auth Proxy" subsection to the Route Surface**

In `docs/architecture/06-API/00-Overview.md`, change:

```markdown
### Players

- `POST /api/players/provision` <!-- 2026-07-10 -->

Idempotent; creates the `players` row for a JWT-valid user. Full contract in `04-Endpoint-Contracts.md`.

---

## Authentication And Identity Flow
```

to:

```markdown
### Players

- `POST /api/players/provision` <!-- 2026-07-10 -->

Idempotent; creates the `players` row for a JWT-valid user. Full contract in `04-Endpoint-Contracts.md`.

### Auth Proxy

- `ALL /api/auth/*` <!-- 2026-07-29 -->

Same-origin transport for Neon Auth (Better Auth) traffic — forwards verbatim to `NEON_AUTH_BASE_URL` and rewrites `Set-Cookie` so the session cookie is first-party (D172). Intentionally **outside** this document's `ok/data/requestId` envelope contract: it is transport, not a domain endpoint, and its response shape is Better Auth's own. Not JWT-verified — this route is how a JWT is obtained in the first place.

---

## Authentication And Identity Flow
```

- [ ] **Step 2: Note the proxy in the Authentication And Identity Flow section**

In the same file, change:

```markdown
- Handlers never parse JWT directly.
- Token issuance/refresh is external to this API (Neon Auth).
```

to:

```markdown
- Handlers never parse JWT directly.
- Token issuance/refresh is external to this API (Neon Auth).
- Neon Auth traffic itself (login, session check, sign-out) is proxied same-origin through `/api/auth/*` so the underlying Better Auth session cookie is first-party, not cross-site (D172, see Auth Proxy above) — this is what feeds `getJWTToken()`, not a change to the Bearer-JWT contract above.
```

- [ ] **Step 3: Bump the doc header and version**

In `docs/architecture/06-API/00-Overview.md`, change:

```markdown
<!--
status: canonical
scope: api/contract-baseline
read-when: any API work (frozen v1 baseline)
updated: 2026-07-22
-->

# API Overview

> **Version:** 1.4.0 (frozen v1 API baseline; `SESSION_ALREADY_ACTIVE` + S1 implementation status, 2026-07-22)
```

to:

```markdown
<!--
status: canonical
scope: api/contract-baseline
read-when: any API work (frozen v1 baseline)
updated: 2026-07-29
-->

# API Overview

> **Version:** 1.5.0 (same-origin `/api/auth/*` proxy for Neon Auth traffic, D172, 2026-07-29)
```

- [ ] **Step 4: Add `api-auth-proxy` to the Route classes table**

In `docs/architecture/06-API/02-Middleware-And-Layering.md`, change:

```markdown
| Class | JWT verified | Player resolved | Members |
| ----- | ------------ | --------------- | ------- |
| Public | No | No | unauthenticated routes (if any) |
| Protected | Yes | Yes — missing player → `403 PLAYER_NOT_PROVISIONED` | all domain routes (sessions, routines) |
| Authenticated-unprovisioned | Yes | Skipped | `POST /api/players/provision` only (historically "provision-exempt", D62) |
```

to:

```markdown
| Class | JWT verified | Player resolved | Members |
| ----- | ------------ | --------------- | ------- |
| Public | No | No | unauthenticated routes (if any) |
| Auth proxy | No | No | `/api/auth/*` only — same-origin transport to Neon Auth, not a domain route (D172) |
| Protected | Yes | Yes — missing player → `403 PLAYER_NOT_PROVISIONED` | all domain routes (sessions, routines) |
| Authenticated-unprovisioned | Yes | Skipped | `POST /api/players/provision` only (historically "provision-exempt", D62) |
```

- [ ] **Step 5: Bump the doc header and version**

In `docs/architecture/06-API/02-Middleware-And-Layering.md`, change:

```markdown
<!--
status: canonical
scope: api/middleware-layering
read-when: middleware or folder-layering changes
updated: 2026-07-22
-->

# API Middleware And Layering

> **Version:** 1.3.0 (API error boundary for `api-*` routes, 2026-07-22)
```

to:

```markdown
<!--
status: canonical
scope: api/middleware-layering
read-when: middleware or folder-layering changes
updated: 2026-07-29
-->

# API Middleware And Layering

> **Version:** 1.4.0 (`api-auth-proxy` route class, D172, 2026-07-29)
```

- [ ] **Step 6: Commit**

```bash
git add docs/architecture/06-API/00-Overview.md docs/architecture/06-API/02-Middleware-And-Layering.md
git commit -m "docs: register /api/auth/* as a same-origin transport-only proxy surface"
```

---

### Task 7: Frontend doc + DECISIONS ledger

**Files:**

- Modify: `docs/architecture/07-Frontend/01-Rendering-Strategy.md`
- Modify: `DECISIONS.md`

**Interfaces:** None — documentation only.

- [ ] **Step 1: Note the same-origin auth client in the Client auth gate section**

In `docs/architecture/07-Frontend/01-Rendering-Strategy.md`, change:

```markdown
- `PUBLIC_PAGES` is a single source in `@utils/auth-routes.ts` (shared with `middleware.ts` / `classifyRoute`).

This gate is **navigation UX only** — the JWT-gated API remains the sole real authorization boundary (D97).
```

to:

```markdown
- `PUBLIC_PAGES` is a single source in `@utils/auth-routes.ts` (shared with `middleware.ts` / `classifyRoute`).
- `auth.store.ts`'s `authClient` calls the same-origin `/api/auth` proxy (`pages/api/auth/[...path].ts`), not the cross-origin Neon Auth URL directly — the underlying Better Auth session cookie is first-party as a result (D172), fixing login inside an installed iOS Home Screen web app.

This gate is **navigation UX only** — the JWT-gated API remains the sole real authorization boundary (D97).
```

- [ ] **Step 2: Add D172 to the Related Documents decision list**

In the same file, change:

```markdown
| `../../DECISIONS.md` | D79, D80, D88, D97, D98 |
```

to:

```markdown
| `../../DECISIONS.md` | D79, D80, D88, D97, D98, D172 |
```

- [ ] **Step 3: Bump the doc header and version**

In `docs/architecture/07-Frontend/01-Rendering-Strategy.md`, change:

```markdown
<!--
status: canonical
scope: frontend/rendering
read-when: new routes, prerender vs SSR decisions
updated: 2026-07-15
-->

# Frontend Rendering Strategy

> **Version:** 0.1.0
```

to:

```markdown
<!--
status: canonical
scope: frontend/rendering
read-when: new routes, prerender vs SSR decisions
updated: 2026-07-29
-->

# Frontend Rendering Strategy

> **Version:** 0.2.0 (same-origin auth client via `/api/auth` proxy, D172, 2026-07-29)
```

- [ ] **Step 4: Add D172 and D173 to `DECISIONS.md`**

Find the decisions table's last row (currently D171) and add two new rows immediately after it, matching the existing `| # | Source | Decision | Rationale |` column format:

```markdown
| D172 | 2026-07-29 | Neon Auth traffic proxied same-origin through `/api/auth/[...path]` (new `api-auth-proxy` route class, bypasses JWT/player checks and the `ok/data/requestId` envelope) so the Better Auth session cookie binds first-party instead of cross-site to `NEON_AUTH_BASE_URL`'s own domain; the app's `Authorization: Bearer` API contract is unchanged, only what feeds `getJWTToken()` changes | iOS gives an installed Home Screen web app its own storage container split from Safari, and WebKit blocks the cross-site session cookie Better Auth's default client relies on, so login never established inside the installed PWA (issue #55) |
| D173 | 2026-07-29 | `apple-mobile-web-app-capable` meta tags + `app/public/manifest.json` (`scope`/`start_url: "/"`, `display: "standalone"`) declare the app as an installable PWA | No manifest or meta tags existed; "Add to Home Screen" produced an unconfigured Safari Web Clip that could break navigation out to Safari on an auth redirect |
```

- [ ] **Step 5: Commit**

```bash
git add docs/architecture/07-Frontend/01-Rendering-Strategy.md DECISIONS.md
git commit -m "docs: record D172/D173 and note the same-origin auth client"
```

---

### Task 8: Context map registration and final validation

**Files:**

- Modify: `docs/architecture/00-Context-Map.md`

**Interfaces:** None — documentation + validation gates only.

- [ ] **Step 1: Update the File Inventory rows touched by this change**

In `docs/architecture/00-Context-Map.md`, change:

```markdown
| `06-API/00-Overview.md` | Frozen v1 API baseline: runtime, routes, auth, envelopes (2026-07-22) | canonical | ~2.6k |
```

to:

```markdown
| `06-API/00-Overview.md` | Frozen v1 API baseline: runtime, routes, auth, envelopes; `/api/auth/*` same-origin proxy (D172, 2026-07-29) | canonical | ~2.7k |
```

Change:

```markdown
| `06-API/02-Middleware-And-Layering.md` | Middleware, `locals.auth`, folder layering, API error boundary (2026-07-22) | canonical | ~2.9k |
```

to:

```markdown
| `06-API/02-Middleware-And-Layering.md` | Middleware, `locals.auth`, folder layering, API error boundary; `api-auth-proxy` route class (D172, 2026-07-29) | canonical | ~3.0k |
```

Change:

```markdown
| `07-Frontend/01-Rendering-Strategy.md` | Prerender-default, middleware, client auth gate (D98), route classes | canonical | ~2.1k |
```

to:

```markdown
| `07-Frontend/01-Rendering-Strategy.md` | Prerender-default, middleware, client auth gate (D98), route classes; same-origin auth client (D172, 2026-07-29) | canonical | ~2.2k |
```

- [ ] **Step 1b: Register this task's spec and plan in the Context & history table**

In the same file's "Context & history (repo root, `docs/`)" table, add two rows after the existing `docs/superpowers/plans/2026-07-25-game-engine-contract-hardening.md` row:

```markdown
| `docs/superpowers/specs/2026-07-29-ios-web-app-auth-design.md` | iOS Home Screen web app auth: same-origin `/api/auth/*` proxy design, cookie-rebinding rules, PWA manifest scope (D172, D173) (2026-07-29) | historical |
| `docs/superpowers/plans/2026-07-29-ios-web-app-auth.md` | The 9-task plan implementing that spec, incl. the Neon Auth trusted-origin prerequisite (2026-07-29) | historical |
```

Also update the `11-Neon-Integration.md` row in the Database handbook table, changing:

```markdown
| `11-Neon-Integration.md` | Neon topology, branches, dbmate/drizzle workflow; `env:dev`/`env:prod` PUBLIC_ mirror (2026-07-24) | canonical | ~1.5k |
```

to:

```markdown
| `11-Neon-Integration.md` | Neon topology, branches, dbmate/drizzle workflow; `env:dev`/`env:prod` PUBLIC_ mirror; per-branch trusted origins (D172, 2026-07-29) | canonical | ~1.6k |
```

- [ ] **Step 2: Update the Current Implementation State table**

In the same file, change the `API docs` row's end (append a clause before the closing `|`):

```markdown
| API docs | v1 frozen; contracts `00`–`04`; error boundary (D131) + `SESSION_ALREADY_ACTIVE` single-active guard (D132); `03`→1.7.0 type-vs-value barrel rule (D156, 2026-07-26); `00`→1.4.0, `02`→1.3.0, `03`→1.6.0, `04`→1.2.0 (2026-07-22); prior: `01` frozen at 1.0.0, `02`→1.2.0, `03`→1.5.0 (2026-07-16/17); hardening `00`→1.3.0, `04`→1.1.0 (2026-07-13) |
```

to:

```markdown
| API docs | v1 frozen; contracts `00`–`04`; error boundary (D131) + `SESSION_ALREADY_ACTIVE` single-active guard (D132); `03`→1.7.0 type-vs-value barrel rule (D156, 2026-07-26); `00`→1.4.0, `02`→1.3.0, `03`→1.6.0, `04`→1.2.0 (2026-07-22); prior: `01` frozen at 1.0.0, `02`→1.2.0, `03`→1.5.0 (2026-07-16/17); hardening `00`→1.3.0, `04`→1.1.0 (2026-07-13); auth proxy `00`→1.5.0, `02`→1.4.0 (D172, 2026-07-29) |
```

Change the `Application code` row's end:

```markdown
| Application code | Auth middleware with route-class 401/403 handling + API error boundary (D131); frozen envelope/error helpers; player provisioning (D76); `POST /api/sessions` server-guards single-active (D132); logout flow (`signOut`, `LogoutButton`) complete; Score Training first-deploy write/read subset live (S1) |
```

to:

```markdown
| Application code | Auth middleware with route-class 401/403 handling + API error boundary (D131); frozen envelope/error helpers; player provisioning (D76); `POST /api/sessions` server-guards single-active (D132); logout flow (`signOut`, `LogoutButton`) complete; Score Training first-deploy write/read subset live (S1); same-origin Neon Auth proxy (`/api/auth/*`) fixes iOS standalone-PWA login (D172, 2026-07-29) |
```

- [ ] **Step 3: Bump the Context Map's own version header**

Change:

```markdown
<!--
status: canonical
scope: repository-wide context routing
read-when: start of every task (via root CLAUDE.md protocol)
updated: 2026-07-26
-->

# Context Map

> **Version:** 1.7.2 (2026-07-26 — D156: type-raising governs type imports, value imports exempt; `06-API/03-Shared-Conventions.md` → 1.7.0 and the type-barrel gate row restated; prior 1.7.1 game engine review fixes D149–D152; 1.7.0 game engine contract D138–D144; 1.6.11 context-integrity guards D133)
```

to:

```markdown
<!--
status: canonical
scope: repository-wide context routing
read-when: start of every task (via root CLAUDE.md protocol)
updated: 2026-07-29
-->

# Context Map

> **Version:** 1.7.3 (2026-07-29 — D172/D173: same-origin `/api/auth/*` proxy and `api-auth-proxy` route class fix iOS standalone web app auth; PWA manifest/meta tags; prior 1.7.2 D156)
```

- [ ] **Step 4: Run the context-integrity gates**

Run: `bash scripts/check-context-map.sh`
Expected: PASS. If it fails on a broken path reference, fix the offending line — every path this task references (`app/src/pages/api/auth/[...path].ts`, `app/public/manifest.json`) now exists on disk from Tasks 3 and 5.

Run: `bash scripts/check-doc-links.sh`
Expected: PASS.

Run: `bash scripts/check-context-budget.sh`
Expected: PASS. If it reports drift on the `~Nk` estimates edited in Step 1, adjust those three numbers to match the script's reported actual size and re-run.

- [ ] **Step 5: Run the full app validation suite**

Run: `cd app && npm run validate:app`
Expected: PASS (db status/migrate/introspect, `fallow`, full Vitest suite, `astro check`, graph refresh).

Run: `cd app && npm run format:check`
Expected: clean.

Run: `bash scripts/check-game-engines.sh && bash scripts/check-refinement-coverage.sh && bash scripts/check-type-barrels.sh && bash scripts/check-alias-sync.sh && bash scripts/check-constraint-mirror.sh && bash scripts/check-no-inline-comments.sh && bash scripts/check-style-tokens.sh && bash scripts/check-file-locations.sh && bash scripts/check-agent-mirrors.sh && bash scripts/check-astro-class-composition.sh && bash scripts/check-astro-conventions.sh`
Expected: all PASS (none of this change touches game engines, style tokens, or file-location rules, but the pre-commit hook runs all of them and CI will too).

- [ ] **Step 6: Commit**

```bash
git add docs/architecture/00-Context-Map.md
git commit -m "docs: register D172/D173 in the context map and bump touched doc versions"
```

- [ ] **Step 7: Record the manual iOS verification checklist**

This step has no code change — it is the reminder called out in the spec's Testing section: no automated test can exercise real iOS storage-container isolation or WebKit cookie behavior. Before closing issue #55, manually verify on a real iOS device (Safari, not Simulator, since ITP/storage-container behavior does not fully reproduce in Simulator):

0. **Desktop first — this catches the trusted-origin failure before touching a phone.** Sign in on the deployed URL in a desktop browser. A `403 FORBIDDEN` on `POST /api/auth/sign-in/email` means Task 0's trusted-origin registration is missing or has the wrong origin; fix that before continuing. Also confirm in DevTools → Application → Cookies that the session cookie is listed under the **app's own** host, not Neon Auth's.
1. Sign in via iOS Safari in a normal tab; confirm session persists across reloads.
2. "Add to Home Screen"; launch the installed icon. Expect `/login` (separate storage container — this is expected, not a bug, per spec B5).
3. Sign in inside the installed app. Expect the session to establish and survive closing/reopening the installed app.
4. Confirm the installed app's icon/splash reflects `manifest.json`'s `name`.

---

## Self-Review Notes

- **Spec coverage:** B1 (Task 3, full proxy) · B2 (Task 3, cookie rewrite) · B3 (Tasks 1–2, route class + middleware bypass) · B4 (Task 4, same-origin client) · B5 (Task 8 Step 7, no new UX, manual check only) · B6 (Task 5, manifest) · D172/D173 (Task 7) · doc updates table (Tasks 6–8) · verification plan (Task 5 Step 3 for build, Task 8 Steps 4–5 for gates, Task 8 Step 7 for the manual checklist).
- **Placeholder scan:** no TBD/TODO; the one open item (`apple-touch-icon` PNG) is called out explicitly as a deliberate, documented scope boundary with a stated reason, not an unresolved requirement.
- **Type consistency:** `env.auth.baseUrl` used identically in Task 3's handler and its test mock; `ALL` export name matches between Task 3's handler and its test's import; `RouteClass` value `"api-auth-proxy"` is identical across Task 1 (type + classifier), Task 2 (middleware), and both doc edits (Tasks 6, 8); `AUTH_PROXY_PATH` (Task 4) and `AUTH_PROXY_ROOT` (Task 1) both resolve to the string `/api/auth`.

## Verification Notes (checked against installed dependency sources, 2026-07-29)

Findings that changed the plan after it was first drafted — recorded so a reviewer can see they were tested, not assumed:

| Finding                                                                                                                                            | Evidence                                                                                                          | Where handled                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| A relative `baseURL` throws — `createAuthClient("/api/auth")` cannot work                                                                          | `better-auth@1.4.18` `dist/utils/url.mjs:12-20` (`assertHasProtocol` → `new URL`), `dist/client/config.mjs:11`    | Task 4 uses `${globalThis.location.origin}/api/auth`; Global Constraints call it out |
| Better Auth origin-checks every non-GET against `trustedOrigins`; the proxy forwards the app's `Origin`, which was never registered for production | `dist/api/middlewares/origin-check.mjs:26` (`originCheckMiddleware`), `:36` (`isTrustedOrigin` → `403 FORBIDDEN`) | New Task 0 + `11-Neon-Integration.md` trusted-origins table                          |
| `Headers.getSetCookie()` is available in the test runner                                                                                           | Vitest `environment: "node"` (`app/vitest.config.ts`), Node v22 — verified returning `['a=1']`                    | Task 3 test relies on it directly                                                    |
| API routes are on-demand by default under `output: "server"`; no `prerender` export needed on the proxy route                                      | `app/astro.config.mjs`, and no `prerender` export exists anywhere under `app/src/pages/api/`                      | Task 3 handler adds none                                                             |
| `check-file-locations.sh` permits `.ts` under `pages/api/**`, so the new route passes                                                              | `scripts/check-file-locations.sh:8` excludes `^app/src/pages/api/`                                                | Task 8 Step 5 gate run                                                               |
| Context/doc gates all pass on the pre-change tree, so any failure in Task 8 is caused by this change                                               | `check-context-map.sh`, `check-doc-links.sh`, `check-context-budget.sh` each ran clean                            | Task 8 Step 4                                                                        |

**Still unverified (`app/node_modules` is absent in the authoring environment):** the exact `@neon/env` property name for `NEON_AUTH_BASE_URL`. Task 3 assumes `env.auth.baseUrl`, mirroring the confirmed sibling `env.auth.jwksUrl` (`app/src/lib/auth/verify-jwt.ts:14`). Task 3 Step 5 verifies this with `astro check` and states the fallback.
