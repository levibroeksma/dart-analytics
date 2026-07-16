# Frontend Conventions Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the five hardenings from `docs/superpowers/specs/2026-07-16-frontend-conventions-hardening-design.md` on the existing branch `refactor/organize-auth-data-files`: universal type/interface barrel-raising (with API contract types relocated out of `types/` into the domain folders that own them), a frontend test-strategy doc plus shared-mocks convention, a mechanically-enforced zero-`.ts`-outside-`lib/` rule, centralized client-side error-message mapping, and a self-learning gate on the Context Maintenance protocol.

**Architecture:** Each of the spec's five items becomes 1–4 small, independently-verifiable tasks. Section 1 (types/interfaces) goes first because later sections depend on artifacts it creates (`@client/api/types`'s `ErrorCode` export feeds Section 4; the new aliases feed every later Worker-side edit). Sections 2–5 are otherwise independent of each other and are ordered to match the spec's own numbering. Every task ends with `npm test` (exact pass counts stated per task) plus `npx astro check`, and a commit.

**Tech Stack:** Astro, TypeScript, Alpine.js, Vitest, Zod, Drizzle, existing `tsconfig.json`/`vitest.config.ts` path-alias system.

## Global Constraints

- No behavior change to any runtime code path — this is a structural/convention hardening. Every relocated/renamed file's exports are unchanged; only their location and import paths move.
- `type` aliases raise through `types.ts` barrels; TS `interface` declarations raise through their own, separate `interfaces.ts` barrels — never mixed into the same file.
- `.astro` component interfaces (`interface Props`) and `env.d.ts` are excluded from all raising rules — never touched by this plan.
- Browser code never imports directly from `@routes/*` (a Worker route folder) except `lib/client/api/types.ts`, which is the one deliberate re-raising bridge point.
- No `.ts` file lives directly under `app/src/components/` or `app/src/pages/` except `app/src/pages/api/**` — zero exceptions, mechanically enforced.
- Root `CLAUDE.md` and `AGENT.md` are exact mirrors — every edit to one is applied identically to the other in the same task.
- Do not commit unless executing this plan under an approved execution mode; every task below ends with a commit step per this repo's own plan convention (see `docs/superpowers/plans/2026-07-15-test-and-variant-conventions.md`).
- Baseline before this plan: `npm test` → `Test Files 10 passed (10)`, `Tests 32 passed (32)`; `npx astro check` → `62 files`, `0 errors, 0 warnings, 0 hints`.

---

## File Structure

- **Create:** `app/src/pages/api/players/types.ts`, `app/src/pages/api/types.ts`, `app/src/repositories/interfaces.ts`, `app/src/lib/client/errors.ts`, `app/tests/mocks/auth-client.mock.ts`, `app/tests/setup.ts`, `scripts/check-file-locations.sh`, `docs/architecture/07-Frontend/06-Test-Strategy.md`, `app/tests/lib/client/errors.test.ts`
- **Rename:** `app/src/lib/client/api/index.ts` → `app/src/lib/client/api/types.ts`, `app/src/lib/client/index.ts` → `app/src/lib/client/types.ts`, `app/tests/types/api/players.test.ts` → `app/tests/pages/api/players/types.test.ts`
- **Delete:** `app/src/types/api/players.ts`, `app/src/types/api/index.ts` (and the now-empty `app/src/types/` tree)
- **Modify:** `app/tsconfig.json`, `app/vitest.config.ts`, `app/src/lib/client/api/client.ts`, `app/src/lib/client/api/players.ts`, `app/src/repositories/player.repository.ts`, `app/src/services/player.service.ts`, `app/src/db/client.ts`, `app/src/lib/auth/verify-jwt.ts`, `app/src/pages/api/players/provision.ts`, `app/src/lib/auth/login.data.ts`, `app/tests/lib/auth/login.data.test.ts`, `app/tests/stores/auth.store.test.ts`, `docs/architecture/06-API/03-Shared-Conventions.md`, `docs/architecture/06-API/02-Middleware-And-Layering.md`, `docs/architecture/07-Frontend/04-Modules-And-OOP.md`, `docs/architecture/07-Frontend/02-Folder-Structure.md`, `docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md`, `docs/architecture/07-Frontend/00-Overview.md`, `app/CLAUDE.md`, `AGENT.md`, `.github/workflows/checks.yml`, `docs/architecture/00-Context-Map.md`, `DECISIONS.md`

---

### Task 1: Add Worker-area path aliases

**Files:**
- Modify: `app/tsconfig.json`
- Modify: `app/vitest.config.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: four new resolvable aliases — `@services/*` → `src/services/*`, `@repositories/*` → `src/repositories/*`, `@db/*` → `src/db/*`, `@routes/*` → `src/pages/api/*` — available to every later task. `@types/*` is left in place for now (removed in Task 2 once nothing references it).

- [ ] **Step 1: Add the four aliases to `tsconfig.json`**

Replace `app/tsconfig.json` in full:

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*", "./worker-configuration.d.ts"],
  "exclude": ["dist"],
  "compilerOptions": {
    "types": ["node"],
    "paths": {
      "@icons/*": ["./src/icons/*"],
      "@components/*": ["./src/components/*"],
      "@layouts/*": ["./src/layouts/*"],
      "@pages/*": ["./src/pages/*"],
      "@lib/*": ["./src/lib/*"],
      "@client/*": ["./src/lib/client/*"],
      "@auth/*": ["./src/lib/auth/*"],
      "@server/*": ["./src/lib/server/*"],
      "@stores/*": ["./src/stores/*"],
      "@forms/*": ["./src/forms/*"],
      "@types/*": ["./src/types/*"],
      "@modules/*": ["./src/modules/*"],
      "@utils/*": ["./src/lib/utils/*"],
      "@styles/*": ["./src/styles/*"],
      "@services/*": ["./src/services/*"],
      "@repositories/*": ["./src/repositories/*"],
      "@db/*": ["./src/db/*"],
      "@routes/*": ["./src/pages/api/*"]
    }
  }
}
```

- [ ] **Step 2: Add the same four aliases to `vitest.config.ts`**

Replace `app/vitest.config.ts` in full:

```ts
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@auth': path.resolve(__dirname, './src/lib/auth'),
      '@client': path.resolve(__dirname, './src/lib/client'),
      '@components': path.resolve(__dirname, './src/components'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@forms': path.resolve(__dirname, './src/forms'),
      '@types': path.resolve(__dirname, './src/types'),
      '@modules': path.resolve(__dirname, './src/modules'),
      '@utils': path.resolve(__dirname, './src/lib/utils'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@services': path.resolve(__dirname, './src/services'),
      '@repositories': path.resolve(__dirname, './src/repositories'),
      '@db': path.resolve(__dirname, './src/db'),
      '@routes': path.resolve(__dirname, './src/pages/api'),
    },
  },
});
```

- [ ] **Step 3: Verify nothing broke**

Run: `cd app && npx astro check`
Expected: `Result (62 files): - 0 errors - 0 warnings - 0 hints` (unchanged — purely additive config).

Run: `npm test`
Expected: `Test Files 10 passed (10)`, `Tests 32 passed (32)` (unchanged).

- [ ] **Step 4: Commit**

```bash
git add app/tsconfig.json app/vitest.config.ts
git commit -m "chore(app): add @services, @repositories, @db, @routes path aliases"
```

---

### Task 2: Relocate API contract types; standardize `types.ts` barrels; two-barrel client re-export

**Files:**
- Create: `app/src/pages/api/players/types.ts`
- Create: `app/src/pages/api/types.ts`
- Rename: `app/src/lib/client/api/index.ts` → `app/src/lib/client/api/types.ts`
- Rename: `app/src/lib/client/index.ts` → `app/src/lib/client/types.ts`
- Modify: `app/src/lib/client/api/client.ts`
- Modify: `app/src/lib/client/api/players.ts`
- Delete: `app/src/types/api/players.ts`, `app/src/types/api/index.ts`
- Rename: `app/tests/types/api/players.test.ts` → `app/tests/pages/api/players/types.test.ts`

**Interfaces:**
- Consumes: `@routes/*` alias (Task 1), `@server/errors` (existing, unchanged `ErrorCode` type from `lib/server/errors.ts`).
- Produces: `@routes/types` — Worker-side barrel exporting `ProvisionPlayerRequest` (Zod schema, value), `ProvisionPlayerResponse` (Zod schema, value), `ProvisionPlayerRequestInput` (type), `ProvisionPlayerResponseData` (type), `ErrorCode` (type, re-raised from `@server/errors`). `@client/api/types` — browser-side barrel exporting `ApiErrorBody`, `ApiSuccess<T>`, `ApiFailure`, `ApiResult<T>` (unchanged from today) plus re-exported `ProvisionPlayerRequest`, `ProvisionPlayerRequestInput`, `ProvisionPlayerResponseData`, `ErrorCode`. `@client/types` — re-exports everything from `@client/api/types`.

- [ ] **Step 1: Create the Worker-owned domain contract file**

Create `app/src/pages/api/players/types.ts`:

```ts
import { z } from 'zod';

/** Frozen contract: docs/architecture/06-API/04-Endpoint-Contracts.md §Player Provisioning. */
export const ProvisionPlayerRequest = z.object({
  displayName: z.string().min(1).optional(),
});

export const ProvisionPlayerResponse = z.object({
  playerId: z.string(),
  authUserId: z.string(),
  created: z.boolean(),
});

export type ProvisionPlayerRequestInput = z.infer<typeof ProvisionPlayerRequest>;
export type ProvisionPlayerResponseData = z.infer<typeof ProvisionPlayerResponse>;
```

- [ ] **Step 2: Create the routes-area root barrel**

Create `app/src/pages/api/types.ts`:

```ts
export * from './players/types';
export type { ErrorCode } from '@server/errors';
```

- [ ] **Step 3: Delete the old top-level `types/api/` tree**

```bash
rm app/src/types/api/players.ts app/src/types/api/index.ts
rmdir app/src/types/api app/src/types
```

- [ ] **Step 4: Rename `lib/client/api/index.ts` to `types.ts` and add the client-owned re-raise**

```bash
git mv app/src/lib/client/api/index.ts app/src/lib/client/api/types.ts
```

Replace `app/src/lib/client/api/types.ts` in full:

```ts
export type ApiErrorBody = {
  code: string;
  message: string;
  retryable: boolean;
};

export type ApiSuccess<T> = {
  ok: true;
  data: T;
  requestId: string;
};

export type ApiFailure = {
  ok: false;
  error: ApiErrorBody;
  requestId: string;
};

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export {
  ProvisionPlayerRequest,
  type ProvisionPlayerRequestInput,
  type ProvisionPlayerResponseData,
  type ErrorCode,
} from '@routes/types';
```

- [ ] **Step 5: Rename `lib/client/index.ts` to `types.ts`**

```bash
git mv app/src/lib/client/index.ts app/src/lib/client/types.ts
```

Replace `app/src/lib/client/types.ts` in full:

```ts
export * from './api/types';
```

- [ ] **Step 6: Fix `client.ts`'s same-folder barrel import**

In `app/src/lib/client/api/client.ts`, change line 2:

```diff
- import type { ApiFailure, ApiResult } from '.';
+ import type { ApiFailure, ApiResult } from './types';
```

Full resulting file:

```ts
import { getAccessToken } from '@client/auth/client';
import type { ApiFailure, ApiResult } from './types';

const UNAUTHORIZED: ApiFailure = {
  ok: false,
  requestId: '',
  error: {
    code: 'UNAUTHORIZED',
    message: 'Authentication required',
    retryable: false,
  },
};

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  const token = await getAccessToken();
  if (!token) return UNAUTHORIZED;

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, { ...init, headers });
  const body = (await response.json()) as ApiResult<T>;
  return body;
}
```

- [ ] **Step 7: Fix `players.ts`'s deep relative import**

Replace `app/src/lib/client/api/players.ts` in full:

```ts
import { apiRequest } from './client';
import {
  ProvisionPlayerRequest,
  type ProvisionPlayerRequestInput,
  type ProvisionPlayerResponseData,
} from './types';

export class ProvisionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ProvisionError';
  }
}

export async function provision(
  body?: ProvisionPlayerRequestInput,
): Promise<ProvisionPlayerResponseData> {
  const payload = body ? ProvisionPlayerRequest.parse(body) : {};
  const result = await apiRequest<ProvisionPlayerResponseData>(
    '/api/players/provision',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );

  if (!result.ok) {
    throw new ProvisionError(result.error.code, result.error.message);
  }

  return result.data;
}
```

- [ ] **Step 8: Move and fix the relocated test**

```bash
mkdir -p app/tests/pages/api/players
git mv app/tests/types/api/players.test.ts app/tests/pages/api/players/types.test.ts
rmdir app/tests/types/api app/tests/types 2>/dev/null || true
```

Replace `app/tests/pages/api/players/types.test.ts` in full:

```ts
import { describe, it, expect } from 'vitest';
import { ProvisionPlayerRequest, ProvisionPlayerResponse } from '@routes/types';

describe('ProvisionPlayerRequest', () => {
  it('accepts empty object', () => {
    expect(ProvisionPlayerRequest.safeParse({}).success).toBe(true);
  });

  it('accepts displayName', () => {
    expect(
      ProvisionPlayerRequest.safeParse({ displayName: 'Levi' }).success,
    ).toBe(true);
  });

  it('rejects empty displayName', () => {
    expect(ProvisionPlayerRequest.safeParse({ displayName: '' }).success).toBe(
      false,
    );
  });
});

describe('ProvisionPlayerResponse', () => {
  it('parses valid response', () => {
    const result = ProvisionPlayerResponse.safeParse({
      playerId: '018f1234-5678-7000-8000-000000000001',
      authUserId: 'auth-1',
      created: true,
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 9: Remove the now-unused `@types` alias**

In `app/tsconfig.json`, remove the `"@types/*": ["./src/types/*"],` line. In `app/vitest.config.ts`, remove the `'@types': path.resolve(__dirname, './src/types'),` line.

- [ ] **Step 10: Verify**

Run: `cd app && npx astro check`
Expected: `0 errors, 0 warnings, 0 hints`.

Run: `npm test`
Expected: `Test Files 10 passed (10)`, `Tests 32 passed (32)` (pure relocation — `players.test.ts` moved, same 4 tests, same total).

- [ ] **Step 11: Commit**

```bash
git add app/src/pages/api/players/types.ts app/src/pages/api/types.ts \
  app/src/lib/client/api/types.ts app/src/lib/client/types.ts \
  app/src/lib/client/api/client.ts app/src/lib/client/api/players.ts \
  app/tests/pages/api/players/types.test.ts app/tsconfig.json app/vitest.config.ts
git add -u app/src/types app/tests/types
git commit -m "refactor(app): relocate API contract types into pages/api/, standardize types.ts barrels"
```

---

### Task 3: Fix remaining deep-relative imports; raise `ProvisionedPlayer` into `repositories/interfaces.ts`

**Files:**
- Create: `app/src/repositories/interfaces.ts`
- Modify: `app/src/repositories/player.repository.ts`
- Modify: `app/src/services/player.service.ts`
- Modify: `app/src/db/client.ts`
- Modify: `app/src/lib/auth/verify-jwt.ts`
- Modify: `app/src/pages/api/players/provision.ts`

**Interfaces:**
- Consumes: `@services/*`, `@repositories/*`, `@db/*` (Task 1), `@routes/types`'s `ProvisionPlayerRequest` and `pages/api/players/types.ts` (Task 2).
- Produces: `@repositories/interfaces` — exports `ProvisionedPlayer` (interface: `{ playerId: string; authUserId: string; created: boolean }`).

- [ ] **Step 1: Create the repositories-area interface barrel**

Create `app/src/repositories/interfaces.ts`:

```ts
export interface ProvisionedPlayer {
  playerId: string;
  authUserId: string;
  created: boolean;
}
```

- [ ] **Step 2: Remove the inline interface from the repository and fix its deep imports**

Replace `app/src/repositories/player.repository.ts` in full:

```ts
import { sql } from "drizzle-orm";
import { players } from "@db/schema";
import type { getDb } from "@db/client";
import type { ProvisionedPlayer } from "./interfaces";

type Db = ReturnType<typeof getDb>;

/**
 * Creates or returns the player row for the given auth user id.
 * `created` is true when a new row was inserted, false when it already existed.
 * Detection uses the system column `xmax`: a freshly inserted row has xmax = 0,
 * while an ON CONFLICT DO UPDATE touch sets it non-zero.
 */
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

- [ ] **Step 3: Fix `player.service.ts`'s deep imports and split its mixed runtime/type import**

Replace `app/src/services/player.service.ts` in full:

```ts
import { getDb } from "@db/client";
import { generateId } from "@lib/id";
import { upsertPlayerByAuthUserId } from "@repositories/player.repository";
import type { ProvisionedPlayer } from "@repositories/interfaces";

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

- [ ] **Step 4: Fix `db/client.ts`'s deep import**

Replace `app/src/db/client.ts` in full:

```ts
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "@lib/env";
import * as schema from "./schema";

export function getDb() {
  // Contract: DATABASE_URL_UNPOOLED = direct (runtime); DATABASE_URL is tooling-only (pooled).
  // Sole owner: docs/architecture/05-Database/11-Neon-Integration.md
  const url = env.postgres.databaseUrlUnpooled;
  neonConfig.fetchConnectionCache = true;
  const client = neon(url);
  return drizzle(client, { schema });
}
```

- [ ] **Step 5: Fix `verify-jwt.ts`'s deep import**

Replace `app/src/lib/auth/verify-jwt.ts` in full:

```ts
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "@lib/env";

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

- [ ] **Step 6: Drop the local Zod redeclaration in `provision.ts` and fix its deep imports**

Replace `app/src/pages/api/players/provision.ts` in full:

```ts
import type { APIRoute } from "astro";
import { ProvisionPlayerRequest } from "./types";
import { provisionPlayer } from "@services/player.service";
import { ok, fail } from "@server/envelope";

/**
 * Parses a raw request body into an `unknown` JSON value.
 * An empty (whitespace-only) body resolves to `{}`. Malformed JSON is
 * reported via `ok: false` rather than throwing.
 */
function parseJsonBody(raw: string): { ok: true; value: unknown } | { ok: false } {
  if (raw.trim().length === 0) {
    return { ok: true, value: {} };
  }
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

export const POST: APIRoute = async ({ locals, request }) => {
  // Middleware guarantees authUserId on this route (authenticated-unprovisioned class).
  const auth = locals.auth!;

  const parsedBody = parseJsonBody(await request.text());
  if (!parsedBody.ok) {
    return fail("VALIDATION_FAILED", locals.requestId, { reason: "body is not valid JSON" });
  }

  const parsed = ProvisionPlayerRequest.safeParse(parsedBody.value);
  if (!parsed.success) {
    return fail("VALIDATION_FAILED", locals.requestId, { issues: parsed.error.issues });
  }

  // D76 resolution: request displayName → JWT name claim → 'Player' (service default)
  const displayName = parsed.data.displayName ?? auth.name;
  const provisioned = await provisionPlayer(auth.authUserId, displayName);
  return ok(provisioned, locals.requestId);
};
```

- [ ] **Step 7: Verify**

Run: `cd app && npx astro check`
Expected: `0 errors, 0 warnings, 0 hints`.

Run: `npm test`
Expected: `Test Files 10 passed (10)`, `Tests 32 passed (32)` (pure refactor — no test exercises these Worker files directly today).

- [ ] **Step 8: Commit**

```bash
git add app/src/repositories/interfaces.ts app/src/repositories/player.repository.ts \
  app/src/services/player.service.ts app/src/db/client.ts app/src/lib/auth/verify-jwt.ts \
  app/src/pages/api/players/provision.ts
git commit -m "refactor(app): fix deep-relative imports; raise ProvisionedPlayer into repositories/interfaces.ts"
```

---

### Task 4: Update Section-1 canonical docs

**Files:**
- Modify: `docs/architecture/06-API/03-Shared-Conventions.md`
- Modify: `docs/architecture/06-API/02-Middleware-And-Layering.md`
- Modify: `docs/architecture/07-Frontend/04-Modules-And-OOP.md`
- Modify: `docs/architecture/07-Frontend/02-Folder-Structure.md`

**Interfaces:**
- Consumes: nothing (documentation only, describing Tasks 1–3's realized code).
- Produces: nothing consumed by later tasks — Task 8 further edits `02-Folder-Structure.md` and `10-Frontend-Agent-Guide.md` for the unrelated file-location rule.

- [ ] **Step 1: Add the two-barrel and `interfaces.ts` rules to `03-Shared-Conventions.md`**

In `docs/architecture/06-API/03-Shared-Conventions.md`, insert a new subsection immediately after the closing `A type never travels through a deeper import path than \`@<area>/types\`, and no barrel reaches past its direct children.` paragraph and before `### Path aliases`:

```diff
 A type never travels through a deeper import path than `@<area>/types`, and no
 barrel reaches past its direct children.
 
+### Two barrels at the Worker/browser boundary
+
+A type defined in a Worker-owned folder (`pages/api/`, `services/`, `repositories/`) that a
+browser consumer also needs is **not** imported directly from its Worker barrel by browser
+code. Instead, exactly one client-owned file re-raises it:
+
+```
+src/pages/api/players/types.ts   # Worker: defines ProvisionPlayerRequest, etc.
+src/pages/api/types.ts           # Worker: routes-area barrel (@routes/types)
+src/lib/client/api/types.ts      # Browser: re-exports what it needs (@client/api/types)
+```
+
+`lib/client/api/types.ts` is the **only** browser file with a legitimate `@routes/types`
+import. Every other browser consumer (`modules/`, `forms/`, future `.data.ts` files) imports
+from `@client/api/types` instead — the successor to the retired `@types/api` alias.
+
+### `interfaces.ts` barrels — a parallel, separate chain
+
+TS `interface` declarations are raised through their **own** `interfaces.ts` barrel file,
+following the identical mechanics as `types.ts` above (same folder-by-folder chain, same
+"raised only once consumed outside its defining file" scope), but never mixed into `types.ts`
+— a folder with both gets two barrels side by side. Reference example: `repositories/interfaces.ts`.
+
+Two standing exceptions, unaffected by this rule:
+- `.astro` component interfaces (e.g. `interface Props`) stay inline in the component's own
+  frontmatter (`../07-Frontend/05-Astro-Components.md`, D92).
+- `env.d.ts` is a TypeScript ambient global-augmentation file at an Astro/TS-required
+  well-known path, not a regular module — excluded entirely.
+
 ### Path aliases
```

Also update the `### Path aliases` paragraph's trailing comment, since the alias set is now realized (not just a documented target):

```diff
 All imports go through `tsconfig.json` path aliases, `@`-prefixed by area
 (e.g. `@services/*`, `@repositories/*`, `@routes/*`, `@lib/*`, `@db/*`). Deep
 relative import chains (`../../../`) are forbidden. (Barrel type imports use
-the `@<area>/types` form above.) <!-- alias set is documented target; see
-02-Middleware-And-Layering.md for tsconfig realization status --> <!-- 2026-07-13 -->
+the `@<area>/types` form above.) <!-- alias set realized in app/tsconfig.json, 2026-07-16 -->
```

Bump the doc's version header:

```diff
-> **Version:** 1.3.0 (frozen v1; barrel-raising chain defined 2026-07-13)
+> **Version:** 1.4.0 (two-barrel + interfaces.ts raising chain, 2026-07-16)
```

And its front-matter `updated:` date:

```diff
-updated: 2026-07-13
+updated: 2026-07-16
```

- [ ] **Step 2: Mark the alias set realized in `02-Middleware-And-Layering.md`**

In `docs/architecture/06-API/02-Middleware-And-Layering.md`, replace the "## Path aliases & type barrels" section:

```diff
 ## Path aliases & type barrels
 
 Import conventions are owned by `03-Shared-Conventions.md`: `@`-prefixed
-aliases and `@<area>/types` type-raising barrels. The target alias set is
-`@services`, `@repositories`, `@routes`, `@lib`, `@db`. This alias set and the
-per-area `types.ts` barrels are the documented target for the frontend/API
-implementation phase; `app/tsconfig.json` currently defines only a subset
-(`@lib`, `@components`, …) and is extended when the endpoints are built.
-<!-- 2026-07-13 -->
+aliases and `@<area>/types` type-raising barrels. The alias set `@services`,
+`@repositories`, `@routes`, `@lib`, `@db` is realized in `app/tsconfig.json`
+(added 2026-07-16 alongside the player-provisioning endpoint). Per-area
+`types.ts`/`interfaces.ts` barrels are populated as each area grows;
+`pages/api/players/types.ts` and `repositories/interfaces.ts` are the first
+real examples. <!-- 2026-07-16 -->
```

Bump the doc's version header and date:

```diff
-> **Version:** 1.1.0 (layout reconciliation 2026-07-13)
+> **Version:** 1.2.0 (alias set realized, 2026-07-16)
```

```diff
-updated: 2026-07-13
+updated: 2026-07-16
```

- [ ] **Step 3: Update `04-Modules-And-OOP.md`'s `@types/api` reference**

In `docs/architecture/07-Frontend/04-Modules-And-OOP.md`:

```diff
-Payload modules import types from `@types/api` only. They never call `@client/api`.
+Payload modules import types from `@client/api/types` only. They never call `@client/api`.
```

Bump the version header and date:

```diff
-> **Version:** 0.1.0
+> **Version:** 0.1.1 (@types/api successor, 2026-07-16)
```

```diff
-updated: 2026-07-14
+updated: 2026-07-16
```

- [ ] **Step 4: Update `02-Folder-Structure.md`'s tree, alias table, and barrel example**

In `docs/architecture/07-Frontend/02-Folder-Structure.md`, remove the `types/` block from the Authoritative Tree:

```diff
 │   ├── server/                      # envelope, errors — Worker only
 │   ├── auth/                        # @auth — authentication data factories, middleware helpers
 │   │   ├── login.data.ts
 │   │   └── logout.data.ts
 │   └── utils/                       # @utils (note: alias maps here, not to top-level utils/)
-├── types/
-│   └── api/                         # shared Zod schemas + z.infer<> barrels
 ├── utils/                           # @utils — widely reused pure helpers
```

Remove the `@types/*` row from the Path Aliases table:

```diff
 | `@modules/*` | `src/modules/*` |
-| `@types/*` | `src/types/*` |
 | `@utils/*` | `src/utils/*` |
```

Replace the "Barrel type imports" example block:

```diff
 ### Barrel type imports
 
-Types are imported via `@<area>/types` only — same raising chain as `../06-API/03-Shared-Conventions.md`. Never deep-import from a defining module when a barrel exists.
+Types are imported via `@<area>/types` only — same raising chain as `../06-API/03-Shared-Conventions.md`. Browser code imports API contract types via `@client/api/types` (re-raised from the Worker's `@routes/types` — see `../06-API/03-Shared-Conventions.md` §Two barrels), never `@routes/types` directly. Never deep-import from a defining module when a barrel exists.
 
 ```typescript
 // good
-import type { EventsBatchRequest } from "@types/api";
+import type { EventsBatchRequest } from "@client/api/types";
 
 // bad
-import type { EventsBatchRequest } from "@types/api/sessions/batch/types";
+import type { EventsBatchRequest } from "@routes/sessions/batch/types";
 ```
```

Update the Import Direction diagram:

```diff
 pages/*.astro / *.data.ts / forms  →  stores / @client/api
 stores                             →  modules / @client/api (recovery bootstrap only)
-modules/*                          →  @types/api, @utils — never @client/api, never Alpine
+modules/*                          →  @client/api/types, @utils — never @client/api, never Alpine
 @client/api                        →  never imports stores, forms, modules, pages
```

Bump the version header and date:

```diff
-> **Version:** 0.1.0
+> **Version:** 0.2.0 (types/ relocated into pages/api/, two-barrel rule, 2026-07-16)
```

```diff
-updated: 2026-07-14
+updated: 2026-07-16
```

- [ ] **Step 5: Verify**

Run: `bash scripts/check-context-map.sh`
Expected: `OK: context map, references, migration ranges, and front-matter are consistent.`

- [ ] **Step 6: Commit**

```bash
git add docs/architecture/06-API/03-Shared-Conventions.md docs/architecture/06-API/02-Middleware-And-Layering.md \
  docs/architecture/07-Frontend/04-Modules-And-OOP.md docs/architecture/07-Frontend/02-Folder-Structure.md
git commit -m "docs: document two-barrel + interfaces.ts raising chain, realized alias set"
```

---

### Task 5: Add the frontend Test Strategy doc

**Files:**
- Create: `docs/architecture/07-Frontend/06-Test-Strategy.md`
- Modify: `docs/architecture/00-Context-Map.md`

**Interfaces:**
- Consumes: nothing.
- Produces: `06-Test-Strategy.md`, referenced by Task 6 (shared mocks it documents) and Task 7 (cross-referenced from `app/CLAUDE.md`/`10-Frontend-Agent-Guide.md`).

- [ ] **Step 1: Create the doc**

Create `docs/architecture/07-Frontend/06-Test-Strategy.md`:

```markdown
<!--
status: canonical
scope: frontend/test-strategy
read-when: writing or reviewing app/ tests, adding a shared mock
updated: 2026-07-16
-->

# Frontend Test Strategy

> **Version:** 0.1.0
>
> Ground rules for `app/` tests, beyond the command procedure in `app/CLAUDE.md` (the sole definition of *how* to run TDD). This doc covers *why* and the edge cases command lists don't.

---

# Purpose

`app/CLAUDE.md`'s Test-Driven Development section is the sole definition of the red→green→refactor command sequence (D99). This document adds the rules that sequence alone doesn't cover: when to share a mock instead of duplicating it, and what "done" means for a full test run.

---

# TDD Is Mandatory

Every `app/` behavior change follows red → green → refactor — see `app/CLAUDE.md` for the exact commands. This doc does not redefine that procedure; it exists so the *rationale* has a home instead of being re-explained inline in every task.

---

# Shared Mocks

A module mocked identically by 2+ test files is promoted into `app/tests/mocks/<name>.mock.ts` as an exported factory function, wired once via `app/tests/setup.ts` (registered in `vitest.config.ts`'s `setupFiles`). Individual tests still override return values per-case with `vi.mocked(x).mockResolvedValue(...)` / `.mockRejectedValue(...)` in their own `beforeEach` — identical to today's per-test pattern, just without re-declaring the mock's *shape* in every file that needs it.

**Promotion threshold:** 2+ test files mocking the same module (mirrors the `.data.ts` colocation-promotion threshold in `02-Folder-Structure.md`). A single-use mock (e.g. one test file mocking `@client/api/client`) stays local to that file — promoting it would be premature abstraction for a consumer count of one.

**Example:** `authClient` (`@client/auth/client`) was mocked twice with two different, inconsistent shapes across `auth.store.test.ts` and `login.data.test.ts` before this rule existed. It is the first mock promoted into `app/tests/mocks/auth-client.mock.ts`.

---

# Full-Suite-Always-Runs Policy

`npm test` runs the complete suite — never `--bail`, never scoped to only the files touched by the current task — before any task is claimed done. This is enforced by convention, not tooling: `vitest.config.ts` has no `bail` setting and none should be added.

Pre-existing or out-of-scope failures are never silently dropped from a completion report. Name them explicitly ("N pre-existing failures, unrelated to this change: `<list>`"). They do not block completion **unless** the current change caused them — but discovering and reporting them is mandatory, not optional.

---

# Related Documents

| Document | Purpose |
| -------- | ------- |
| `app/CLAUDE.md` | TDD command procedure (sole definition) |
| `10-Frontend-Agent-Guide.md` | Condensed agent rules, §11 cross-references this doc |
| `02-Folder-Structure.md` | Colocation/promotion threshold this doc's mock rule mirrors |
```

- [ ] **Step 2: Register the doc in the context map**

In `docs/architecture/00-Context-Map.md`, add a row to the "## API (`06-API/`) and Frontend (`07-Frontend/`)" table, immediately after the `07-Frontend/05-Astro-Components.md` row:

```diff
 | `07-Frontend/05-Astro-Components.md` | `.astro` authoring: frontmatter order, props, class composition, slots | canonical | ~2k |
+| `07-Frontend/06-Test-Strategy.md` | Shared-mock promotion rule, full-suite-always-runs policy (2026-07-16) | canonical | ~1k |
 | `07-Frontend/10-Frontend-Agent-Guide.md` | Condensed frontend agent rules | canonical | ~2k |
```

Add a Context Packs row for test-strategy work, immediately after the "New portable UI primitive" row:

```diff
 | New portable UI primitive | `07-Frontend/04-Modules-And-OOP.md`, `07-Frontend/03-Alpine-Patterns.md`, `app/CLAUDE.md` | ~4k |
+| New test / test-strategy question | `07-Frontend/06-Test-Strategy.md`, `app/CLAUDE.md` | ~3k |
```

- [ ] **Step 3: Verify**

Run: `bash scripts/check-context-map.sh`
Expected: `OK: context map, references, migration ranges, and front-matter are consistent.`

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/07-Frontend/06-Test-Strategy.md docs/architecture/00-Context-Map.md
git commit -m "docs: add frontend Test Strategy doc (shared mocks, full-suite policy)"
```

---

### Task 6: Introduce shared `authClient` mock via `tests/setup.ts`

**Files:**
- Create: `app/tests/mocks/auth-client.mock.ts`
- Create: `app/tests/setup.ts`
- Modify: `app/vitest.config.ts`
- Modify: `app/tests/stores/auth.store.test.ts`
- Modify: `app/tests/lib/auth/login.data.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `createAuthClientMock()` from `app/tests/mocks/auth-client.mock.ts`, returning `{ getSession: Mock, signIn: { email: Mock }, signOut: Mock }`. Globally applied to every test file via `vitest.config.ts`'s `setupFiles`, so `import { authClient } from '@client/auth/client'` resolves to this mock everywhere without a per-file `vi.mock` call.

- [ ] **Step 1: Create the mock factory**

Create `app/tests/mocks/auth-client.mock.ts`:

```ts
import { vi } from 'vitest';

export function createAuthClientMock() {
  return {
    getSession: vi.fn(),
    signIn: { email: vi.fn() },
    signOut: vi.fn(),
  };
}
```

- [ ] **Step 2: Create the global setup file**

Create `app/tests/setup.ts`:

```ts
import { vi } from 'vitest';
import { createAuthClientMock } from './mocks/auth-client.mock';

vi.mock('@client/auth/client', () => ({
  authClient: createAuthClientMock(),
}));
```

- [ ] **Step 3: Register `setupFiles` in `vitest.config.ts`**

```diff
 export default defineConfig({
   test: {
     environment: 'node',
     include: ['tests/**/*.test.ts'],
+    setupFiles: ['./tests/setup.ts'],
   },
```

- [ ] **Step 4: Remove the local mock from `auth.store.test.ts`**

Replace `app/tests/stores/auth.store.test.ts` in full:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authClient } from '@client/auth/client';
import { authStore } from '@stores/auth.store';

describe('authStore.init', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('location', { pathname: '/login', replace: vi.fn() });
  });

  it('treats getSession failure as anonymous on a public page', async () => {
    vi.mocked(authClient.getSession).mockRejectedValue(
      new Error('HTTP 401 Unauthorized'),
    );
    const store = authStore();
    await store.init();
    expect(store.status).toBe('anonymous');
    expect(store.ready).toBe(true);
  });
});

describe('authStore.signIn', () => {
  beforeEach(() => vi.resetAllMocks());

  it('sets authenticated on success', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: {},
      error: null,
    });
    const store = authStore();
    await store.signIn('a@b.nl', 'secret');
    expect(store.status).toBe('authenticated');
  });

  it('throws on SDK error', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: null,
      error: { message: 'Invalid credentials' },
    });
    const store = authStore();
    await expect(store.signIn('a@b.nl', 'wrong')).rejects.toThrow(
      'Invalid credentials',
    );
  });
});

describe('authStore.signOut', () => {
  beforeEach(() => vi.resetAllMocks());

  it('sets anonymous after signOut resolves', async () => {
    vi.mocked(authClient.signOut).mockResolvedValue(undefined);
    const store = authStore();
    store.status = 'authenticated';
    await store.signOut();
    expect(authClient.signOut).toHaveBeenCalled();
    expect(store.status).toBe('anonymous');
  });
});
```

- [ ] **Step 5: Remove the local mock from `login.data.test.ts`**

Replace `app/tests/lib/auth/login.data.test.ts` in full (only the top `vi.mock('@client/auth/client', ...)` block is removed — everything else, including the not-yet-migrated `mapSignInError`/`mapProvisionError` tests, is unchanged):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@client/api/players', () => ({
  provision: vi.fn(),
  ProvisionError: class ProvisionError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = 'ProvisionError';
    }
  },
}));

import { provision } from '@client/api/players';
import { authClient } from '@client/auth/client';
import {
  loginForm,
  mapProvisionError,
  mapSignInError,
  type LoginFormContext,
} from '@auth/login.data';
import { ProvisionError } from '@client/api/players';

describe('mapSignInError', () => {
  it('maps invalid credentials', () => {
    expect(mapSignInError(new Error('Invalid credentials'))).toBe(
      'Email or password is incorrect.',
    );
  });

  it('maps network errors', () => {
    expect(mapSignInError(new Error('fetch failed'))).toBe(
      'Could not reach the server. Try again.',
    );
  });
});

describe('mapProvisionError', () => {
  it('maps provision forbidden', () => {
    expect(
      mapProvisionError(
        new ProvisionError('UNAUTHORIZED', 'Authentication required'),
      ),
    ).toBe('Account setup failed. Contact support.');
  });
});

describe('loginForm.submit', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: { user: { name: 'Levi' }, session: {} },
    });
  });

  it('calls provision after signIn and redirects', async () => {
    vi.mocked(provision).mockResolvedValue({
      playerId: 'p1',
      authUserId: 'a1',
      created: true,
    });
    const replace = vi.fn();
    vi.stubGlobal('location', { replace });

    const form = loginForm();
    (form as unknown as LoginFormContext).$store = {
      auth: {
        signIn: vi.fn().mockResolvedValue(undefined),
      },
    };
    form.email = 'levi@broeksma.nl';
    form.password = 'admin';

    await (form as unknown as LoginFormContext).submit();

    expect(provision).toHaveBeenCalledWith({ displayName: 'Levi' });
    expect(replace).toHaveBeenCalledWith('/');

    vi.unstubAllGlobals();
  });

  it('sets error message on signIn failure', async () => {
    const form = loginForm();
    (form as unknown as LoginFormContext).$store = {
      auth: {
        signIn: vi
          .fn()
          .mockRejectedValue(new Error('Invalid email or password')),
      },
    };
    await (form as unknown as LoginFormContext).submit();
    expect(form.error).toBe('Email or password is incorrect.');
    expect(form.loading).toBe(false);
  });
});
```

- [ ] **Step 6: Verify**

Run: `cd app && npm test`
Expected: `Test Files 10 passed (10)`, `Tests 32 passed (32)` (no test body changed — only where the `authClient` mock is declared).

- [ ] **Step 7: Commit**

```bash
git add app/tests/mocks/auth-client.mock.ts app/tests/setup.ts app/vitest.config.ts \
  app/tests/stores/auth.store.test.ts app/tests/lib/auth/login.data.test.ts
git commit -m "test(app): promote authClient mock to shared tests/mocks/ + global setupFiles"
```

---

### Task 7: Cross-reference the Test Strategy doc from `app/CLAUDE.md` and the Frontend Agent Guide

**Files:**
- Modify: `app/CLAUDE.md`
- Modify: `docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md`

**Interfaces:**
- Consumes: `06-Test-Strategy.md` (Task 5).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the cross-reference to `app/CLAUDE.md`**

In `app/CLAUDE.md`, extend the "## Test-Driven Development (mandatory)" section's closing line:

```diff
 Framework: **Vitest** (`vitest.config.ts` at `app/` root). Commands: `npm test` (CI), `npm run test:watch` (local).
+
+Ground rules beyond the command sequence above (shared-mock promotion threshold, full-suite-always-runs policy): `docs/architecture/07-Frontend/06-Test-Strategy.md`.
```

- [ ] **Step 2: Add the cross-reference to `10-Frontend-Agent-Guide.md`**

In `docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md`, extend the "## 11. Test-driven development" section's closing bullet list:

```diff
 - `.astro` components with variant/branching logic: keep it inline in the component's own frontmatter (D101). This logic is untested — no Astro-component test runner exists in this project — accept that rather than extracting a helper solely for testability.
+- Shared-mock promotion threshold and full-suite-always-runs policy: `06-Test-Strategy.md`.
```

Also add the new doc to the "Related Documents" table at the bottom:

```diff
 | `03-Alpine-Patterns.md` | Alpine factory |
 | `04-Modules-And-OOP.md` | Modules, portable UI |
+| `06-Test-Strategy.md` | Shared mocks, full-suite policy |
```

- [ ] **Step 3: Verify**

Run: `bash scripts/check-context-map.sh`
Expected: `OK: context map, references, migration ranges, and front-matter are consistent.`

- [ ] **Step 4: Commit**

```bash
git add app/CLAUDE.md docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md
git commit -m "docs: cross-reference the Test Strategy doc from app/CLAUDE.md and Frontend Agent Guide"
```

---

### Task 8: Document the zero-exception `.ts` file-location rule

**Files:**
- Modify: `docs/architecture/07-Frontend/02-Folder-Structure.md`
- Modify: `docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md`
- Modify: `app/CLAUDE.md`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by later tasks (Task 9's mechanical check enforces this rule but doesn't need to read the doc to do so).

- [ ] **Step 1: Replace the Colocation vs Promotion table in `02-Folder-Structure.md`**

```diff
 # Colocation vs Promotion
 
 | Scope | Location |
 | ----- | -------- |
-| Auth-related data factories | `lib/auth/` (e.g. `login.data.ts`, `logout.data.ts`) |
-| Domain-specific data factories | `lib/<domain>/` if shared, else colocate under `pages/<route>/` |
-| Stores, forms, modules (multi-page use) | `stores/`, `forms/`, `modules/`, or `components/` |
+| Any `.ts` logic used by a page/component | `lib/<domain>/` — always, even single-route (e.g. `lib/auth/login.data.ts`) |
+| Used by 2+ routes, warrants store/form/module semantics | `stores/`, `forms/`, `modules/` |
 
-**Agent rule:** auth-related `.data.ts` files always live in `lib/auth/`. For other files, if imported from more than one page, promote it out of `pages/`.
+**Agent rule:** no `.ts` file ever lives directly under `components/` or `pages/` — except `pages/api/**` — regardless of single- or multi-consumer use. `<domain>` uses the same vocabulary as `modules/<domain>/` and `stores/<domain>.store.ts` (e.g. `auth`, future `game`, `players`) — never a route or component-folder name.
```

- [ ] **Step 2: Remove the colocated `.data.ts` line from the Authoritative Tree**

```diff
 ├── pages/
 │   └── <route>/
-│       ├── index.astro
-│       └── <route>.data.ts          # optional colocated Alpine.data factory
+│       └── index.astro
```

Bump the version header (Task 4 already moved this file to 0.2.0 with `updated: 2026-07-16`; this is a second substantive edit in the same day, so bump the minor version once more):

```diff
-> **Version:** 0.2.0 (types/ relocated into pages/api/, two-barrel rule, 2026-07-16)
+> **Version:** 0.2.1 (zero-exception .ts file-location rule, 2026-07-16)
```

The front-matter `updated: 2026-07-16` date is already correct from Task 4 — no further change needed.

- [ ] **Step 3: Add the rule to the Forbidden list in `10-Frontend-Agent-Guide.md`**

```diff
 # Forbidden
 
 - Frontend `controllers/` folder
+- `.ts` files directly under `components/` or `pages/` (except `pages/api/**`) — no exceptions, mechanically enforced by `scripts/check-file-locations.sh`
 - `x-init`
```

- [ ] **Step 4: State the exclusion explicitly in `app/CLAUDE.md`**

Replace the "**TypeScript file organization:**" paragraph:

```diff
-**TypeScript file organization:** All `.ts` files in `app/src/lib/` (except stores/forms, which live at `stores/`, `forms/`):
+**TypeScript file organization:** No `.ts` file lives directly under `components/` or `pages/` — except `pages/api/**` (Worker route handlers) — regardless of single- or multi-consumer use; mechanically enforced by `scripts/check-file-locations.sh`. All other `.ts` files live in `app/src/lib/` (except stores/forms, which live at `stores/`, `forms/`):
 - Auth-related: `lib/auth/` (e.g., `login.data.ts`, `logout.data.ts`) — imported via `@auth/` alias
 - Domain-specific: organize by domain folder (e.g., `lib/game/`, `lib/players/`) — imported via `@lib/<domain>/`
 - Utilities: `lib/utils/` (migrating from legacy `utils/` folder) — imported via `@utils/`
```

- [ ] **Step 5: Verify**

Run: `bash scripts/check-context-map.sh`
Expected: `OK: context map, references, migration ranges, and front-matter are consistent.`

- [ ] **Step 6: Commit**

```bash
git add docs/architecture/07-Frontend/02-Folder-Structure.md docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md app/CLAUDE.md
git commit -m "docs: zero-exception rule — no .ts under components/ or pages/ except pages/api/**"
```

---

### Task 9: Add and wire the `check-file-locations.sh` mechanical gate

**Files:**
- Create: `scripts/check-file-locations.sh`
- Modify: `CLAUDE.md`
- Modify: `AGENT.md`
- Modify: `.github/workflows/checks.yml`

**Interfaces:**
- Consumes: nothing.
- Produces: `scripts/check-file-locations.sh`, an executable script exiting 0 when clean, 1 with violations listed on stderr otherwise. Invoked identically from the root Context Maintenance protocol and CI.

- [ ] **Step 1: Create the script**

Create `scripts/check-file-locations.sh`:

```bash
#!/usr/bin/env bash
# File-location gate (docs/architecture/07-Frontend/02-Folder-Structure.md):
# no .ts files directly under components/ or pages/, except pages/api/**.
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

VIOLATIONS=$(find app/src/components app/src/pages -name "*.ts" 2>/dev/null | grep -v '^app/src/pages/api/')
if [ -n "$VIOLATIONS" ]; then
  echo "FAIL: .ts files found outside lib/ (must live under app/src/lib/<domain>/):" >&2
  echo "$VIOLATIONS" >&2
  exit 1
fi
echo "OK: no stray .ts files under components/ or pages/ (excluding pages/api/)."
```

Make it executable:

```bash
chmod +x scripts/check-file-locations.sh
```

- [ ] **Step 2: Verify it passes against the already-clean tree**

Run: `bash scripts/check-file-locations.sh`
Expected: `OK: no stray .ts files under components/ or pages/ (excluding pages/api/).`

- [ ] **Step 3: Wire it into root `CLAUDE.md`'s Context Maintenance step 5**

```diff
-5. Run `scripts/check-context-map.sh` — it must pass.
+5. Run `scripts/check-context-map.sh` and `scripts/check-file-locations.sh` — both must pass.
```

- [ ] **Step 4: Apply the identical edit to `AGENT.md`**

Apply the exact same diff from Step 3 to `AGENT.md`'s Context Maintenance section 5 (the two files are exact mirrors).

- [ ] **Step 5: Verify the mirror still matches**

Run: `diff CLAUDE.md AGENT.md`
Expected: no output, exit code 0.

- [ ] **Step 6: Add the CI step**

Replace `.github/workflows/checks.yml` in full:

```yaml
name: checks

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  structure:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Context-map consistency
        run: bash scripts/check-context-map.sh
      - name: File-location gate
        run: bash scripts/check-file-locations.sh

  app:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: app
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: app/package-lock.json
      - name: Install
        run: npm ci
      - name: Type gate
        run: npx astro check
      - name: Stale-usage gate
        run: npx fallow
```

- [ ] **Step 7: Commit**

```bash
git add scripts/check-file-locations.sh CLAUDE.md AGENT.md .github/workflows/checks.yml
git commit -m "chore: add check-file-locations.sh gate (local + CI)"
```

---

### Task 10: Add centralized error-message mapping (TDD)

**Files:**
- Create: `app/tests/lib/client/errors.test.ts`
- Create: `app/src/lib/client/errors.ts`

**Interfaces:**
- Consumes: `ErrorCode` from `@client/api/types` (Task 2), `ProvisionError` from `@client/api/players` (unchanged, existing export).
- Produces: `getErrorMessage(err: unknown): string` from `@client/errors` — consumed by Task 11.

- [ ] **Step 1: Write the failing test**

Create `app/tests/lib/client/errors.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getErrorMessage } from '@client/errors';
import { ProvisionError } from '@client/api/players';

describe('getErrorMessage', () => {
  it('maps a known ProvisionError code to UX copy', () => {
    expect(
      getErrorMessage(new ProvisionError('PLAYER_NOT_PROVISIONED', 'Player profile not provisioned')),
    ).toBe('Account setup failed. Contact support.');
  });

  it('falls back to the raw message for an unmapped ProvisionError code', () => {
    expect(
      getErrorMessage(new ProvisionError('SERVICE_UNAVAILABLE', 'Service temporarily unavailable')),
    ).toBe('Service temporarily unavailable');
  });

  it('maps a credential-pattern SDK error message to UNAUTHORIZED copy', () => {
    expect(getErrorMessage(new Error('Invalid credentials'))).toBe(
      'Email or password is incorrect.',
    );
  });

  it('falls back to a generic message for an unrecognized error', () => {
    expect(getErrorMessage(new Error('fetch failed'))).toBe(
      'Could not reach the server. Try again.',
    );
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd app && npx vitest run tests/lib/client/errors.test.ts`
Expected: FAIL — `Cannot find module '@client/errors'` (or equivalent resolution error; the module doesn't exist yet).

- [ ] **Step 3: Implement `getErrorMessage`**

Create `app/src/lib/client/errors.ts`:

```ts
import type { ErrorCode } from '@client/api/types';
import { ProvisionError } from './api/players';

const MESSAGES: Partial<Record<ErrorCode, string>> = {
  UNAUTHORIZED: 'Email or password is incorrect.',
  PLAYER_NOT_PROVISIONED: 'Account setup failed. Contact support.',
};
const FALLBACK = 'Could not reach the server. Try again.';

export function getErrorMessage(err: unknown): string {
  if (err instanceof ProvisionError) {
    return (MESSAGES as Record<string, string>)[err.code] ?? err.message;
  }
  if (err instanceof Error && /invalid|credential/i.test(err.message)) {
    return MESSAGES.UNAUTHORIZED!;
  }
  return FALLBACK;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd app && npx vitest run tests/lib/client/errors.test.ts`
Expected: `Test Files 1 passed (1)`, `Tests 4 passed (4)`.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: `Test Files 11 passed (11)`, `Tests 36 passed (36)` (10+1 files, 32+4 tests).

Run: `npx astro check`
Expected: `0 errors, 0 warnings, 0 hints`.

- [ ] **Step 6: Commit**

```bash
git add app/tests/lib/client/errors.test.ts app/src/lib/client/errors.ts
git commit -m "feat(app): add centralized client error-message mapping (getErrorMessage)"
```

---

### Task 11: Wire `getErrorMessage` into `login.data.ts`; retire the local mapping functions

**Files:**
- Modify: `app/src/lib/auth/login.data.ts`
- Modify: `app/tests/lib/auth/login.data.test.ts`
- Modify: `docs/architecture/07-Frontend/00-Overview.md`

**Interfaces:**
- Consumes: `getErrorMessage` from `@client/errors` (Task 10).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Replace `login.data.ts`'s error handling**

Replace `app/src/lib/auth/login.data.ts` in full:

```ts
import { provision } from '@client/api/players';
import { authClient } from '@client/auth/client';
import { getErrorMessage } from '@client/errors';
import type { authStore } from '@stores/auth.store';

type AuthStore = ReturnType<typeof authStore>;

export type LoginFormContext = {
  email: string;
  password: string;
  error: string;
  loading: boolean;
  $store: { auth: Pick<AuthStore, 'signIn'> };
  submit(): Promise<void>;
};

export function loginForm() {
  return {
    email: '',
    password: '',
    error: '',
    loading: false,

    async submit(this: LoginFormContext) {
      this.loading = true;
      this.error = '';

      try {
        await this.$store.auth.signIn(this.email, this.password);

        const session = await authClient.getSession();
        const displayName = session.data?.user?.name;
        await provision(displayName ? { displayName } : undefined);

        location.replace('/');
      } catch (err) {
        this.error = getErrorMessage(err);
        this.loading = false;
      }
    },
  };
}
```

- [ ] **Step 2: Drop the relocated tests from `login.data.test.ts`**

Replace `app/tests/lib/auth/login.data.test.ts` in full:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@client/api/players', () => ({
  provision: vi.fn(),
  ProvisionError: class ProvisionError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = 'ProvisionError';
    }
  },
}));

import { provision } from '@client/api/players';
import { authClient } from '@client/auth/client';
import { loginForm, type LoginFormContext } from '@auth/login.data';

describe('loginForm.submit', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: { user: { name: 'Levi' }, session: {} },
    });
  });

  it('calls provision after signIn and redirects', async () => {
    vi.mocked(provision).mockResolvedValue({
      playerId: 'p1',
      authUserId: 'a1',
      created: true,
    });
    const replace = vi.fn();
    vi.stubGlobal('location', { replace });

    const form = loginForm();
    (form as unknown as LoginFormContext).$store = {
      auth: {
        signIn: vi.fn().mockResolvedValue(undefined),
      },
    };
    form.email = 'levi@broeksma.nl';
    form.password = 'admin';

    await (form as unknown as LoginFormContext).submit();

    expect(provision).toHaveBeenCalledWith({ displayName: 'Levi' });
    expect(replace).toHaveBeenCalledWith('/');

    vi.unstubAllGlobals();
  });

  it('sets error message on signIn failure', async () => {
    const form = loginForm();
    (form as unknown as LoginFormContext).$store = {
      auth: {
        signIn: vi
          .fn()
          .mockRejectedValue(new Error('Invalid email or password')),
      },
    };
    await (form as unknown as LoginFormContext).submit();
    expect(form.error).toBe('Email or password is incorrect.');
    expect(form.loading).toBe(false);
  });
});
```

- [ ] **Step 3: Update the client wrapper responsibilities table in `00-Overview.md`**

In `docs/architecture/07-Frontend/00-Overview.md`:

```diff
 | Concern | `@client/api/client.ts` | Page / form |
 | ------- | ----------------------- | ----------- |
 | Attach Bearer token | Yes | Never |
 | Parse ok/error envelope | Yes | — |
-| Map domain codes to UI messages | Optional helper | Yes |
+| Map domain codes to UI messages | `lib/client/errors.ts` (`getErrorMessage`) — mandatory, single mechanism | Calls it, never re-implements |
 | Retry logic | Yes (retryable only) | — |
 | Business logic | Never | Never |
```

Also fix the doc's stale `types/` reference in "# Client Structure":

```diff
-Browser code uses `@client/` (API client, auth, Alpine factory), top-level `stores/`, `forms/`, `modules/`, and `types/`. Full tree, aliases, and suffix rules: `02-Folder-Structure.md`.
+Browser code uses `@client/` (API client, auth, Alpine factory), top-level `stores/`, `forms/`, `modules/`. Shared API contract types live at `@client/api/types` (re-raised from the Worker's `@routes/types`). Full tree, aliases, and suffix rules: `02-Folder-Structure.md`.
```

Bump the version header and date:

```diff
-> **Version:** 0.3.1
+> **Version:** 0.3.2 (centralized error mapping, types/ relocation, 2026-07-16)
```

```diff
-updated: 2026-07-14
+updated: 2026-07-16
```

- [ ] **Step 4: Verify**

Run: `cd app && npm test`
Expected: `Test Files 11 passed (11)`, `Tests 33 passed (33)` (36 − 3 relocated `mapSignInError`/`mapProvisionError` tests).

Run: `npx astro check`
Expected: `0 errors, 0 warnings, 0 hints`.

Run: `bash ../scripts/check-context-map.sh` (from `app/`, or `bash scripts/check-context-map.sh` from repo root)
Expected: `OK: context map, references, migration ranges, and front-matter are consistent.`

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/auth/login.data.ts app/tests/lib/auth/login.data.test.ts docs/architecture/07-Frontend/00-Overview.md
git commit -m "refactor(app): wire getErrorMessage into login.data.ts, retire local mapping functions"
```

---

### Task 12: Add the self-learning gate to the Context Maintenance protocol

**Files:**
- Modify: `CLAUDE.md`
- Modify: `AGENT.md`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by later tasks — a standing process rule for all future work.

- [ ] **Step 1: Add step 8 to root `CLAUDE.md`'s Context Maintenance section**

```diff
 6. Refresh the knowledge graph: `bash scripts/refresh-graph.sh`, then stage `graphify-out/graph.json` (AST-only — no API cost). Git hooks automate this at commit; this gate item is the backstop when hooks are not installed. If graphify is not set up in this environment, say so in the completion report rather than skipping silently.
 7. Confirm the work is on `main` or an open PR targets `main`; report the PR link (or the reason none exists) in the completion report.
+8. **Self-learning gate:** if this task surfaced a rule that was ambiguous, missing, unenforced, or contradicted by the real code/config — beyond what step 1 already requires for the change itself — propose the specific `CLAUDE.md`/`AGENT.md` sharpening in chat and get the user's explicit approval before writing it. Never apply a rule change unilaterally. If the user declines, leave the rule as-is and move on; the gate exists to keep rule evolution deliberate, not to force a change.
 
 A change that leaves the context map, CLAUDE.md files, decision ledger, **or knowledge graph** stale is incomplete, even if the code works.
```

- [ ] **Step 2: Apply the identical edit to `AGENT.md`**

Apply the exact same diff from Step 1 to `AGENT.md`'s Context Maintenance section.

- [ ] **Step 3: Verify the mirror still matches**

Run: `diff CLAUDE.md AGENT.md`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md AGENT.md
git commit -m "docs: add self-learning gate (step 8) to the Context Maintenance protocol"
```

---

### Task 13: Decisions ledger, context-map registration, graph refresh, final validation

**Files:**
- Modify: `DECISIONS.md`
- Modify: `docs/architecture/00-Context-Map.md`

**Interfaces:**
- Consumes: everything from Tasks 1–12.
- Produces: final validated state of the branch.

- [ ] **Step 1: Add D103–D107 to `DECISIONS.md`**

In `DECISIONS.md`, append to the "## Frontend" table (after `D101`):

```diff
 | D101 | 2026-07-15 | Reverse D99's test-colocation clause and the Frontend Agent Guide's variant-extraction guidance: tests move to a mirrored `app/tests/` tree (never colocated); `.astro` variant/branching logic stays inline in frontmatter instead of an extracted testable `.ts` helper (e.g. former `button-variants.ts`), accepting the resulting loss of Vitest coverage for that logic | Mirrored test tree matches conventional test-layout expectations; a dedicated helper file solely to make trivial variant logic testable was judged not worth the indirection |
+| D103 | 2026-07-16 | Type-raising extended universally (Worker + browser, Zod + hand-authored); contract types relocated from top-level `types/` into owning domain folders (`pages/api/<domain>/types.ts`, new `@routes` alias); `types.ts` standardized as the sole barrel filename, replacing the 2 existing `index.ts` files; TS `interface` declarations raised through a parallel, separate `interfaces.ts` barrel chain (same mechanics, kept out of `types.ts`), excluding `.astro` frontmatter (D92) and `env.d.ts` ambient declarations | Codebase self-audit found these conventions already documented but violated (deep-relative imports, a re-declared Zod schema, an unraised interface) |
+| D104 | 2026-07-16 | Frontend test strategy formalized: new `06-Test-Strategy.md`, shared-mock convention (`tests/mocks/` + `setupFiles`), full-suite-always-runs completion policy | `authClient` was mocked twice with inconsistent shapes; codified the promotion threshold before it recurs |
+| D105 | 2026-07-16 | Zero-exception rule: no `.ts` under `components/`/`pages/` except `pages/api/**`; `lib/<domain>/` always, named after `modules/`/`stores/` domain vocabulary; mechanically enforced via `scripts/check-file-locations.sh` (local + CI) | Prior colocation escape hatch relied on discipline alone, not enforcement |
+| D106 | 2026-07-16 | Centralized client-side error-message mapping (`lib/client/errors.ts`) keyed by the shared `ErrorCode` type; replaces ad hoc per-page mapping functions | `login.data.ts`'s local `mapSignInError`/`mapProvisionError` conflated two distinct error surfaces and weren't reusable |
```

Append to the "## Context & documentation system" table (after `D102`):

```diff
 | D102 | 2026-07-15 | No git worktrees: task branches are checked out directly in the main working copy (`git checkout -b <branch>`), never under `.worktrees/`; `.worktrees/` removed from `.gitignore` | Worktree-per-task left multiple stale worktrees with uncommitted, unrecoverable work sitting undiscovered outside normal branch review |
+| D107 | 2026-07-16 | Self-learning gate added to the Context Maintenance protocol (step 8): rule sharpenings discovered mid-task require explicit user approval before being written, never applied unilaterally | Formalizes the propose-then-confirm pattern this design itself was built through |
```

- [ ] **Step 2: Update the Current Implementation State table in `00-Context-Map.md`**

```diff
 | API docs | v1 frozen; contracts `00`–`04`; `01`/`02` frozen at 1.0.0, `03`→1.2.0 (@-alias + recursive type-raising barrels) (2026-07-13); hardening amendments `00`→1.3.0, `03`→1.3.0, `04`→1.1.0 (2026-07-13) |
+| API docs | v1 frozen; contracts `00`–`04`; `01` frozen at 1.0.0, `02`→1.2.0, `03`→1.4.0 (two-barrel + `interfaces.ts` raising chain, realized alias set) (2026-07-16); hardening amendments `00`→1.3.0, `04`→1.1.0 (2026-07-13) |
-| Frontend docs | Handbook 0.1.0 (`01`–`05`, `10`) + overview 0.3.1 — prerender-default, Alpine factory, client auth gate (D98), auto-cleanup recovery, completed-batch outbox + `_v` store guard, `.astro` authoring conventions; prerendered protected shells decided public-by-design, JWT-gated API is the real boundary (D97, 2026-07-15); tests live under `app/tests/` (never colocated), `.astro` variant logic stays inline in frontmatter (D101, 2026-07-15) |
+| Frontend docs | Handbook `02`→0.2.0, `04`→0.1.1, `10`→0.1.0 (unchanged number, content updated) (`01`, `03`, `05` unchanged), new `06-Test-Strategy.md` 0.1.0, overview `00`→0.3.2 — prerender-default, Alpine factory, client auth gate (D98), auto-cleanup recovery, completed-batch outbox + `_v` store guard, `.astro` authoring conventions; prerendered protected shells decided public-by-design, JWT-gated API is the real boundary (D97, 2026-07-15); tests live under `app/tests/` (never colocated), `.astro` variant logic stays inline in frontmatter (D101, 2026-07-15); type/interface barrel-raising universal, no `.ts` outside `lib/`/`pages/api/`, centralized error mapping, self-learning gate (D103–D107, 2026-07-16) |
 | Application code | Auth middleware with route-class 401/403 handling, frozen envelope/error helpers, player provisioning (D76) complete; logout flow (`signOut`, `LogoutButton`) complete; scaffold otherwise early |
```

- [ ] **Step 3: Refresh the knowledge graph**

Run: `bash scripts/refresh-graph.sh`
Expected: rebuild succeeds (or warns if the `graphify` CLI is absent in this environment — record that in the completion report rather than failing silently).

- [ ] **Step 4: Run every gate**

Run: `bash scripts/check-context-map.sh`
Expected: `OK: context map, references, migration ranges, and front-matter are consistent.`

Run: `bash scripts/check-file-locations.sh`
Expected: `OK: no stray .ts files under components/ or pages/ (excluding pages/api/).`

Run: `cd app && npm run validate:app`
Expected: `db:status`/`db:migrate`/`db:introspect` succeed unchanged; `npx fallow` reports no new issues; `npm test` → `Test Files 11 passed (11)`, `Tests 33 passed (33)`; `astro check` → `0 errors, 0 warnings, 0 hints`; graph refresh step succeeds or warns per above.

- [ ] **Step 5: Commit**

```bash
git add DECISIONS.md docs/architecture/00-Context-Map.md graphify-out/graph.json
git commit -m "docs: record D103-D107, update context-map implementation state, refresh graph"
```

- [ ] **Step 6: Confirm branch/PR state**

Run: `git status` and `git log --oneline -15`
Expected: all 13 tasks' commits present on `refactor/organize-auth-data-files`; working tree clean. Report whether an open PR already targets `main` for this branch (or that none exists yet) in the completion report, per root `CLAUDE.md` Context Maintenance step 7.

---

## Self-Review Notes

- **Spec coverage:** Item 1 (types/interfaces) → Tasks 1–4. Item 2 (test strategy) → Tasks 5–7. Item 3 (file-location rule) → Tasks 8–9. Item 4 (error mapping) → Tasks 10–11. Item 5 (self-learning gate) → Task 12. Decisions ledger + context-map + graph → Task 13. Every fix-list row and doc-update bullet in the spec maps to a step above.
- **Type consistency:** `getErrorMessage(err: unknown): string` (Task 10) is the exact signature consumed in Task 11. `ProvisionedPlayer` (Task 3) matches the field shape (`playerId`, `authUserId`, `created`) used identically in `player.repository.ts` and `player.service.ts`. `createAuthClientMock()` (Task 6) returns exactly the shape both migrated test files already call (`getSession`, `signIn.email`, `signOut`).
- **Placeholder scan:** no TBD/TODO; every step shows complete file contents or an exact diff, not a description of one.
