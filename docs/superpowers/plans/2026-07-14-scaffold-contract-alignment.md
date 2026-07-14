# Scaffold ↔ Frozen-Contract Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The `app/` scaffold implements the frozen v1 middleware/auth contract, the prerender-default rendering config, and the D76 provision contract — and the one load-bearing doc claim (middleware runs for prerendered pages on Cloudflare) is verified, not assumed.

**Architecture:** Verification first (Task 1 decides whether the HTML gate is load-bearing), then bottom-up: envelope helpers → JWT verifier → middleware with route classes → provision endpoint → rendering config. The app has no unit-test framework; each task carries an executable verification matrix (`astro check` + `wrangler dev`/`astro dev` + `curl` with expected status/body) instead — adding a test framework is out of scope for this plan.

**Tech Stack:** Astro server endpoints on Cloudflare Workers, TypeScript, jose, Zod (new dependency), drizzle-orm/neon-http.

**Spec:** `docs/superpowers/specs/2026-07-14-scaffold-contract-alignment-design.md`

## Global Constraints

- **Prerequisite:** repo-restructure plan DONE — doc paths below are POST-restructure. (App-code paths are unaffected by the restructure.)
- Docs win over code (authority order); only `07-Frontend/01-Rendering-Strategy.md` may be amended, and only as the recorded outcome of Task 1.
- Error/success bodies use the frozen envelope: `{ ok, data, requestId }` / `{ ok: false, error: { code, message, retryable, details }, requestId }` — exact field names, no additions.
- Route surface is frozen — nothing in this plan adds or renames a route.
- **Known open question (do not silently "solve"):** browser HTML navigation carries no `Authorization` header, so a Bearer-only middleware cannot truly authenticate page requests. The HTML gate implemented here is the documented navigation redirect only; if Task 1 shows prerendered shells bypass the Worker entirely, escalate to the user with the two options from the spec (Decision 1) before changing `wrangler.jsonc`.
- After the final task: `cd app && npm run validate:app` passes (DB steps may be skipped with a note if the environment has no Neon credentials).

---

### Task 1: Verify the prerender/middleware claim on Cloudflare

**Files:**
- Modify (outcome-dependent): `docs/architecture/07-Frontend/01-Rendering-Strategy.md` (one dated line) and possibly `app/wrangler.jsonc`

**Interfaces:**
- Produces: a recorded YES/NO — "does `middleware.ts` run for a prerendered HTML route served by the Cloudflare adapter?" Tasks 4 and 6 read this to know whether the HTML redirect is load-bearing.

- [ ] **Step 1: Create a minimal probe on the current scaffold**

Add to `app/src/pages/profile/index.astro` frontmatter (temporary, reverted in Step 4): `export const prerender = true;` — and ensure `astro.config.mjs` temporarily carries `output: 'server'` for the probe (this becomes permanent in Task 6):

```javascript
export default defineConfig({
  output: 'server',
  // ...existing config unchanged
```

- [ ] **Step 2: Build and serve through the real adapter**

```bash
cd app && npm run build 2>&1 | tail -3 && npx wrangler dev --port 8788 &
sleep 8
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://127.0.0.1:8788/profile
kill %1
```

- [ ] **Step 3: Interpret**

- `302 …/login` → middleware ran for the prerendered page. **Claim verified.**
- `200` (page served) → the asset was served without the Worker; **claim false** for this setup. STOP and ask the user: (a) set `run_worker_first` in `wrangler.jsonc` so the Worker fronts assets, or (b) amend `01-Rendering-Strategy.md` to reclassify shells as public-by-design (data stays JWT-gated). Implement whichever they pick.

- [ ] **Step 4: Record the outcome and clean the probe**

Append to the "Middleware + Prerender" section of `docs/architecture/07-Frontend/01-Rendering-Strategy.md`:

```markdown
> **Verified 2026-07-14:** `wrangler dev` probe confirmed middleware [runs / does not run] for prerendered HTML on the Cloudflare adapter[; mitigation: <chosen option>]. 
```

Revert the temporary probe edits (they return permanently in Task 6).

- [ ] **Step 5: Commit**

```bash
bash scripts/check-context-map.sh
git add docs/architecture/07-Frontend/01-Rendering-Strategy.md app/wrangler.jsonc 2>/dev/null; git add docs/architecture/07-Frontend/01-Rendering-Strategy.md
git commit -m "docs(frontend): record verified prerender/middleware interaction on Cloudflare"
```

---

### Task 2: Envelope + error-mapping helpers

**Files:**
- Create: `app/src/lib/server/envelope.ts`
- Create: `app/src/lib/server/errors.ts`

**Interfaces:**
- Produces: `ok(data, requestId, status?)`, `fail(code, requestId, details?)` returning `Response`; `ERROR_HTTP: Record<ErrorCode, { status: number; message: string; retryable: boolean }>`. Consumed by Tasks 4–5 and every future endpoint.

- [ ] **Step 1: `app/src/lib/server/errors.ts`**

```typescript
/** Domain error registry — frozen v1 (docs/architecture/06-API/03-Shared-Conventions.md). */
export const ERROR_HTTP = {
  UNAUTHORIZED: { status: 401, message: "Authentication required", retryable: false },
  PLAYER_NOT_PROVISIONED: { status: 403, message: "Player profile not provisioned", retryable: false },
  SESSION_OWNERSHIP_MISMATCH: { status: 403, message: "Session does not belong to the authenticated player", retryable: false },
  SESSION_ALREADY_COMPLETED: { status: 409, message: "Session is already completed", retryable: false },
  IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD: { status: 409, message: "Idempotency key reused with a different payload", retryable: false },
  BATCH_INCONSISTENT_ORDERING: { status: 422, message: "Batch event ordering is inconsistent", retryable: false },
  BATCH_REFERENCE_MISSING: { status: 422, message: "Batch payload references a missing element", retryable: false },
  NOT_FOUND: { status: 404, message: "Resource not found", retryable: false },
  VALIDATION_FAILED: { status: 400, message: "Request validation failed", retryable: false },
  INVALID_STATUS_TRANSITION: { status: 409, message: "Invalid session status transition", retryable: false },
  SERVICE_UNAVAILABLE: { status: 503, message: "Service temporarily unavailable", retryable: true },
  INTERNAL_ERROR: { status: 500, message: "Internal error", retryable: false },
} as const;

export type ErrorCode = keyof typeof ERROR_HTTP;
```

- [ ] **Step 2: `app/src/lib/server/envelope.ts`**

```typescript
import { ERROR_HTTP, type ErrorCode } from "./errors";

const JSON_HEADERS = { "Content-Type": "application/json" };

/** Frozen success envelope (docs/architecture/06-API/00-Overview.md). */
export function ok(data: unknown, requestId: string, status = 200): Response {
  return new Response(JSON.stringify({ ok: true, data, requestId }), {
    status,
    headers: JSON_HEADERS,
  });
}

/** Frozen error envelope; status/message/retryable come from the registry. */
export function fail(
  code: ErrorCode,
  requestId: string,
  details: Record<string, unknown> = {},
): Response {
  const { status, message, retryable } = ERROR_HTTP[code];
  return new Response(
    JSON.stringify({ ok: false, error: { code, message, retryable, details }, requestId }),
    { status, headers: JSON_HEADERS },
  );
}
```

- [ ] **Step 3: Type-check + commit**

```bash
cd app && npx astro check 2>&1 | tail -2 && cd ..
git add app/src/lib/server
git commit -m "feat(api): frozen envelope + error registry helpers (06-API/02, /03)"
```

---

### Task 3: JWT verifier — never throws, surfaces the `name` claim

**Files:**
- Modify: `app/src/lib/auth/verify-jwt.ts`
- Modify: `app/src/env.d.ts`

**Interfaces:**
- Produces: `verifyBearerToken(header: string | null): Promise<{ authUserId: string; name?: string } | null>` — `null` for every failure mode (missing/malformed/bad-signature/expired/missing-claims); never throws. Consumed by Task 4.

- [ ] **Step 1: Rewrite `verify-jwt.ts`**

```typescript
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "../env";

const jwks = createRemoteJWKSet(new URL(env.auth.jwksUrl));

export type VerifiedAuth = {
  authUserId: string;
  /** Optional display-name claim, used only by provisioning (D76). */
  name?: string;
};

/**
 * Verifies a Neon Auth bearer JWT. Returns null on ANY failure —
 * the 401 mapping is middleware's job (06-API/02 failure table); this
 * function must never throw an invalid token into a 500.
 */
export async function verifyBearerToken(
  authorizationHeader: string | null,
): Promise<VerifiedAuth | null> {
  if (!authorizationHeader?.startsWith("Bearer ")) return null;
  const token = authorizationHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, jwks, {
      algorithms: ["EdDSA", "RS256", "ES256"],
    });
    const sub = payload.sub;
    if (typeof sub !== "string" || !sub) return null;
    if (typeof payload.exp !== "number") return null; // jose enforced expiry; claim must exist
    return {
      authUserId: sub,
      ...(typeof payload.name === "string" && payload.name ? { name: payload.name } : {}),
    };
  } catch {
    return null; // invalid signature, expired, malformed — all map to 401 upstream
  }
}
```

- [ ] **Step 2: Extend `env.d.ts` locals typing**

```typescript
/// <reference path="../.astro/types.d.ts" />

interface AppLocalsAuth {
  authUserId: string;
  playerId?: string;
  /** JWT name claim — present only on the provision route (D76). */
  name?: string;
}

declare namespace App {
  interface Locals {
    requestId: string;
    auth?: AppLocalsAuth;
  }
}
```

- [ ] **Step 3: Type-check + commit**

```bash
cd app && npx astro check 2>&1 | tail -2 && cd ..
git add app/src/lib/auth/verify-jwt.ts app/src/env.d.ts
git commit -m "fix(auth): jwt verifier never throws; surfaces name claim for provisioning"
```

---

### Task 4: Middleware with the documented route classes

**Files:**
- Modify: `app/src/middleware.ts` (full rewrite below)

**Interfaces:**
- Consumes: `verifyBearerToken` (Task 3), `fail` (Task 2).
- Produces: `locals.auth` per the `06-API/02` contract — full on protected API routes, `{ authUserId, name? }` on the provision route, absent when unauthenticated.

- [ ] **Step 1: Rewrite `middleware.ts`**

```typescript
import type { MiddlewareHandler } from "astro";
import { eq } from "drizzle-orm";
import { getDb } from "./db/client";
import { players } from "./db/schema";
import { verifyBearerToken } from "./lib/auth/verify-jwt";
import { fail } from "./lib/server/envelope";

/** Route classes — docs/architecture/06-API/02 + 07-Frontend/01 (D80). */
const PUBLIC_PAGES = new Set(["/login"]);
const PROVISION_ROUTE = "/api/players/provision";

type RouteClass = "public-page" | "asset" | "api-provision" | "api-protected" | "protected-page";

function classify(path: string): RouteClass {
  if (path === PROVISION_ROUTE) return "api-provision";
  if (path.startsWith("/api/")) return "api-protected";
  if (PUBLIC_PAGES.has(path)) return "public-page";
  if (path.includes(".")) return "asset"; // favicon, _astro/* bundles — no auth work
  return "protected-page"; // D80: everything else is protected in v1
}

export const onRequest: MiddlewareHandler = async (ctx, next) => {
  ctx.locals.requestId = crypto.randomUUID();
  const cls = classify(ctx.url.pathname);

  if (cls === "public-page" || cls === "asset") return next();

  const verified = await verifyBearerToken(ctx.request.headers.get("authorization"));

  if (cls === "api-provision" || cls === "api-protected") {
    if (!verified) return fail("UNAUTHORIZED", ctx.locals.requestId);

    if (cls === "api-provision") {
      // authenticated-unprovisioned: JWT verified, player resolution skipped (D62)
      ctx.locals.auth = { authUserId: verified.authUserId, ...(verified.name ? { name: verified.name } : {}) };
      return next();
    }

    const db = getDb();
    const [player] = await db
      .select({ id: players.id })
      .from(players)
      .where(eq(players.authUserId, verified.authUserId))
      .limit(1);
    if (!player) return fail("PLAYER_NOT_PROVISIONED", ctx.locals.requestId);

    ctx.locals.auth = { authUserId: verified.authUserId, playerId: player.id };
    return next();
  }

  // protected-page: navigation gate only — HTML requests carry no Bearer header,
  // so this redirect is the documented nav gate, not authentication (see plan
  // Global Constraints / Task 1 outcome). Data is fetched client-side with JWT.
  if (!verified) return ctx.redirect("/login");
  ctx.locals.auth = { authUserId: verified.authUserId };
  return next();
};
```

- [ ] **Step 2: Type-check**

```bash
cd app && npx astro check 2>&1 | tail -2 && cd ..
```

Expected: 0 errors.

- [ ] **Step 3: Behaviour matrix with the dev server**

```bash
cd app && npx astro dev --port 4321 & sleep 6
curl -s -o /dev/null -w "provision no-token: %{http_code}\n" -X POST http://127.0.0.1:4321/api/players/provision   # expect 401
curl -s -X POST http://127.0.0.1:4321/api/players/provision | python3 -m json.tool                                 # expect frozen error envelope with requestId
curl -s -o /dev/null -w "garbage token: %{http_code}\n" -H "Authorization: Bearer not.a.jwt" -X POST http://127.0.0.1:4321/api/players/provision   # expect 401, NOT 500
curl -s -o /dev/null -w "login page: %{http_code}\n" http://127.0.0.1:4321/login                                    # expect 200, no auth work
kill %1; cd ..
```

- [ ] **Step 4: Commit**

```bash
git add app/src/middleware.ts
git commit -m "fix(api): middleware owns 401/403 with documented route classes; no more auth fall-through"
```

---

### Task 5: Provision endpoint completes D76

**Files:**
- Modify: `app/src/pages/api/players/provision.ts`
- Modify: `app/src/services/player.service.ts`
- Modify: `app/src/repositories/player.repository.ts`
- Modify: `app/package.json` (add `zod`)

**Interfaces:**
- Consumes: `ok`/`fail` (Task 2), `locals.auth.name` (Tasks 3–4).
- Produces: `provisionPlayer(authUserId: string, displayName?: string): Promise<ProvisionedPlayer>`; `upsertPlayerByAuthUserId(db, authUserId, id, displayName): Promise<ProvisionedPlayer>`.

- [ ] **Step 1: Add Zod**

```bash
cd app && npm install zod@^3 && cd ..
```

- [ ] **Step 2: Rewrite the handler**

```typescript
import type { APIRoute } from "astro";
import { z } from "zod";
import { provisionPlayer } from "../../../services/player.service";
import { ok, fail } from "../../../lib/server/envelope";

/** Frozen contract: docs/architecture/06-API/04-Endpoint-Contracts.md §Player Provisioning. */
const ProvisionPlayerRequest = z.object({
  displayName: z.string().min(1).optional(),
});

export const POST: APIRoute = async ({ locals, request }) => {
  // Middleware guarantees authUserId on this route (authenticated-unprovisioned class).
  const auth = locals.auth!;

  let body: unknown = {};
  const raw = await request.text();
  if (raw.trim().length > 0) {
    try {
      body = JSON.parse(raw);
    } catch {
      return fail("VALIDATION_FAILED", locals.requestId, { reason: "body is not valid JSON" });
    }
  }
  const parsed = ProvisionPlayerRequest.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_FAILED", locals.requestId, { issues: parsed.error.issues });
  }

  // D76 resolution: request displayName → JWT name claim → 'Player' (service default)
  const displayName = parsed.data.displayName ?? auth.name;
  const provisioned = await provisionPlayer(auth.authUserId, displayName);
  return ok(provisioned, locals.requestId);
};
```

- [ ] **Step 3: Thread `displayName` through service and repository**

`app/src/services/player.service.ts`:

```typescript
import { getDb } from "../db/client";
import { generateId } from "../lib/id";
import {
  upsertPlayerByAuthUserId,
  type ProvisionedPlayer,
} from "../repositories/player.repository";

/**
 * Provisions an application player profile for the authenticated user.
 * displayName resolution (D76): caller passes request-or-claim value; 'Player' is the final fallback.
 */
export async function provisionPlayer(
  authUserId: string,
  displayName?: string,
): Promise<ProvisionedPlayer> {
  const db = getDb();
  return upsertPlayerByAuthUserId(db, authUserId, generateId(), displayName ?? "Player");
}
```

`app/src/repositories/player.repository.ts` — change the signature and the insert values (idempotency unchanged: an existing row is returned as-is, its stored `display_name` is NOT overwritten):

```typescript
export async function upsertPlayerByAuthUserId(
  db: Db,
  authUserId: string,
  id: string,
  displayName: string,
): Promise<ProvisionedPlayer> {
  const now = new Date().toISOString();
  const [row] = await db
    .insert(players)
    .values({
      id,
      authUserId,
      displayName,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: players.authUserId,
      set: { updatedAt: now }, // existing display_name is preserved — provision is idempotent
    })
    .returning({
      playerId: players.id,
      authUserId: players.authUserId,
      xmax: sql<string>`xmax::text`,
    });

  return {
    playerId: row.playerId,
    authUserId: row.authUserId,
    created: row.xmax === "0",
  };
}
```

(imports and the `ProvisionedPlayer` interface stay as they are.)

- [ ] **Step 4: Verify**

```bash
cd app && npx astro check 2>&1 | tail -2
npx astro dev --port 4321 & sleep 6
curl -s -X POST -H "Content-Type: application/json" -d '{"displayName": 42}' http://127.0.0.1:4321/api/players/provision -H "Authorization: Bearer <A_VALID_DEV_TOKEN>" | python3 -m json.tool
kill %1; cd ..
```

Expected with a valid dev token: `VALIDATION_FAILED` envelope for the numeric displayName. Without obtainable dev tokens in this environment, the 401 path (no token) plus `astro check` cover the wiring; note the untested happy path in the completion report.

- [ ] **Step 5: Commit**

```bash
git add app/src/pages/api/players/provision.ts app/src/services/player.service.ts app/src/repositories/player.repository.ts app/package.json app/package-lock.json
git commit -m "feat(api): provision honours D76 — Zod request, displayName from request/claim/'Player'"
```

---

### Task 6: Rendering config aligned with 01-Rendering-Strategy

**Files:**
- Modify: `app/astro.config.mjs`
- Modify: `app/src/pages/index.astro`, `app/src/pages/login.astro`, `app/src/pages/games/index.astro`, `app/src/pages/statistics/index.astro`, `app/src/pages/profile/index.astro`

- [ ] **Step 1: `output: 'server'`**

In `app/astro.config.mjs` add as the first `defineConfig` property:

```javascript
export default defineConfig({
  output: 'server',
  vite: {
```

Do NOT add the `alpinejs` entrypoint yet — `lib/client/alpine/app.factory.ts` does not exist; wiring an absent entrypoint breaks the build. That lands with the first Alpine store work (handbook task, out of scope here).

- [ ] **Step 2: Prerender-default on every page**

Add as the first frontmatter line of each of the five `.astro` pages:

```astro
---
export const prerender = true;
```

(API routes get nothing — under `output: 'server'` they are on-demand by default, per the rendering doc.)

- [ ] **Step 3: Build proves it**

```bash
cd app && npm run build 2>&1 | grep -Ei "prerender|static|error" | head -8; cd ..
```

Expected: the five pages listed as prerendered; zero errors.

- [ ] **Step 4: Commit**

```bash
git add app/astro.config.mjs app/src/pages
git commit -m "feat(app): output:'server' + prerender-default pages per 07-Frontend/01 (D79)"
```

---

### Task 7: Full-gate close-out

- [ ] **Step 1: Run the whole validation gate**

```bash
cd app && npm run validate:app; cd ..
```

Expected: passes end-to-end (DB steps need Neon credentials — if unavailable, run `npx fallow && npx astro check` individually and record the skipped DB steps).

- [ ] **Step 2: Context maintenance**

```bash
bash scripts/check-context-map.sh
```

No docs changed in Tasks 2–6 except the Task 1 verification line — confirm the checker passes and the graph refresh ran via `validate:app` (stage `graphify-out/graph.json` if changed).

- [ ] **Step 3: Final commit (if the graph changed) and push**

```bash
git add graphify-out/graph.json 2>/dev/null
git commit -m "chore(graphify): refresh graph after scaffold alignment" 2>/dev/null || echo "graph unchanged"
git push -u origin <task-branch>
```
