# Hardening for First Cloudflare Deploy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Score Training API resilient and contract-conformant so v1 can be deployed to Cloudflare for live testing.

**Architecture:** A global error boundary in Astro middleware maps uncaught exceptions to the frozen envelope (`SERVICE_UNAVAILABLE`/`INTERNAL_ERROR`); the session service guards the single-active-session invariant with a pre-check plus a race-safe unique-violation catch (new `SESSION_ALREADY_ACTIVE` code); read repositories project view rows to their DTO shape (no `player_id` leak); the browser API client parses defensively and retries idempotent GETs. Layering is unchanged (Controller → Service → Repository; JWT in middleware; writes transactional; UUIDv7 in service).

**Tech Stack:** Astro (Cloudflare adapter), TypeScript, Drizzle (neon-http + neon-serverless), Zod, Vitest, Alpine.js.

**Source spec:** `docs/superpowers/specs/2026-07-22-hardening-first-deploy-design.md`

**Branch:** `feat/harden-first-deploy` (already based on current `main`, carries the spec commit).

## Global Constraints

- **TDD mandatory (D99):** red → green → refactor. Tests live under `app/tests/`, mirroring `app/src/`, never colocated. The full suite always runs (`npm test`).
- **No inline body comments** in `app/src/**/*.ts` (`//` or `/* */` inside function/method bodies). Put necessary detail in JSDoc above the declaration. Exempt: `// fallow-ignore-next-line …` and `///` triple-slash.
- **No `export type` / `export interface` in implementation files.** Type declarations live in the folder-level `types.ts`; interfaces in `interfaces.ts`. Inline anonymous casts (`x as { … }`) are allowed.
- **Envelope-only API responses**, built via `ok()` / `fail()`; error codes come only from the registry in `lib/server/errors.ts`.
- **Frozen-contract amendments are recorded as DECISIONS.md entries** (D131, D132) with targeted doc updates — see Task 11.
- **Reads are view-backed and player-scoped; writes are transactional; UUIDv7 minted in the service; JWT verified only in middleware.**
- **Alias imports** (`@server`, `@lib`, `@db`, `@routes`, `@services`, `@repositories`, `@client`); no deep relative chains. Middleware uses its existing `./…` relative imports.
- **Formatting:** Prettier (`singleAttributePerLine`). Run `npm run format` before committing if needed.
- **Completion gate:** `npm run validate:app` green; all 5 context check scripts pass; `graphify-out/graph.json` refreshed and staged.
- **Commits** end with the trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File Structure

**Create:**
- `app/src/lib/server/classify-error.ts` — pure classifier: thrown error → `SERVICE_UNAVAILABLE | INTERNAL_ERROR`.
- `app/tests/lib/server/classify-error.test.ts`
- `app/tests/middleware.test.ts`

**Modify:**
- `app/src/lib/server/errors.ts` — add `SESSION_ALREADY_ACTIVE` (Task 1).
- `app/src/middleware.ts` — global api-route error boundary (Task 3).
- `app/src/repositories/interfaces.ts` — add `ActiveSessionSummary` (Task 4).
- `app/src/repositories/session.repository.ts` — add `findActiveSessionForGameType`; project the two read queries (Tasks 4, 6).
- `app/src/services/session.service.ts` — single-active pre-check + race-safe catch (Task 5).
- `app/src/lib/client/api/types.ts` — add optional `details` to `ApiErrorBody` (Task 7).
- `app/src/lib/client/api/client.ts` — robust parse + GET retry (Task 7).
- `app/src/lib/game/score-training-setup.data.ts` — handle `SESSION_ALREADY_ACTIVE` on create (Task 8).
- `app/package.json` — deterministic `check` script (Task 10).
- Docs + `DECISIONS.md` (Task 11).

**Test files touched:** `errors.test.ts`, `session.repository.test.ts`, `session.service.test.ts`, `client/api/client.test.ts`, `score-training-setup.data.test.ts`.

---

## Task 1: Add `SESSION_ALREADY_ACTIVE` to the error registry

**Files:**
- Modify: `app/src/lib/server/errors.ts`
- Test: `app/tests/lib/server/errors.test.ts`

**Interfaces:**
- Produces: registry key `SESSION_ALREADY_ACTIVE` (409, `retryable:false`). `ErrorCode = keyof typeof ERROR_HTTP` gains this member automatically, so services/clients may use it.

- [ ] **Step 1: Write the failing test** — append inside the existing `describe("ERROR_HTTP registry", …)` in `app/tests/lib/server/errors.test.ts`:

```typescript
  it("maps SESSION_ALREADY_ACTIVE to 409, non-retryable", () => {
    expect(ERROR_HTTP.SESSION_ALREADY_ACTIVE.status).toBe(409);
    expect(ERROR_HTTP.SESSION_ALREADY_ACTIVE.retryable).toBe(false);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/server/errors.test.ts`
Expected: FAIL — `Property 'SESSION_ALREADY_ACTIVE' does not exist` (type error) / `undefined`.

- [ ] **Step 3: Add the registry entry** — in `app/src/lib/server/errors.ts`, add after the `SESSION_ALREADY_COMPLETED` entry:

```typescript
  SESSION_ALREADY_ACTIVE: {
    status: 409,
    message: "An active session already exists for this game type",
    retryable: false,
  },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/lib/server/errors.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/server/errors.ts app/tests/lib/server/errors.test.ts
git commit -m "feat(api): add SESSION_ALREADY_ACTIVE error code (D132)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Error classification helper (H1)

**Files:**
- Create: `app/src/lib/server/classify-error.ts`
- Test: `app/tests/lib/server/classify-error.test.ts`

**Interfaces:**
- Produces: `classifyThrownError(error: unknown): "SERVICE_UNAVAILABLE" | "INTERNAL_ERROR"`.

- [ ] **Step 1: Write the failing test** — create `app/tests/lib/server/classify-error.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { classifyThrownError } from "@server/classify-error";

describe("classifyThrownError", () => {
  it("classifies fetch/connection failures as SERVICE_UNAVAILABLE", () => {
    expect(classifyThrownError(new TypeError("fetch failed"))).toBe(
      "SERVICE_UNAVAILABLE",
    );
    expect(
      classifyThrownError(new Error("Connection terminated unexpectedly")),
    ).toBe("SERVICE_UNAVAILABLE");
    expect(classifyThrownError(new Error("ETIMEDOUT"))).toBe(
      "SERVICE_UNAVAILABLE",
    );
  });

  it("classifies everything else as INTERNAL_ERROR", () => {
    expect(
      classifyThrownError(new Error("Cannot read properties of undefined")),
    ).toBe("INTERNAL_ERROR");
    expect(classifyThrownError("weird")).toBe("INTERNAL_ERROR");
    expect(classifyThrownError(null)).toBe("INTERNAL_ERROR");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/server/classify-error.test.ts`
Expected: FAIL — cannot find module `@server/classify-error`.

- [ ] **Step 3: Implement the helper** — create `app/src/lib/server/classify-error.ts`:

```typescript
import type { ErrorCode } from "./types";

const TRANSIENT_PATTERNS =
  /fetch failed|network|econnreset|econnrefused|etimedout|timeout|connection|terminated|socket hang up|503|service unavailable|too many connections|could not connect/i;

/**
 * Classifies an uncaught error thrown while handling an API request into the
 * frozen registry code the middleware boundary returns. Transient
 * connectivity/database failures (recoverable by a client retry) map to
 * SERVICE_UNAVAILABLE; everything else is an INTERNAL_ERROR. Pattern-based on
 * purpose: a genuine bug must surface as a non-retryable 500, never a
 * retry-forever 503.
 */
export function classifyThrownError(
  error: unknown,
): Extract<ErrorCode, "SERVICE_UNAVAILABLE" | "INTERNAL_ERROR"> {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const name = error instanceof Error ? error.name : "";
  return TRANSIENT_PATTERNS.test(message) || TRANSIENT_PATTERNS.test(name)
    ? "SERVICE_UNAVAILABLE"
    : "INTERNAL_ERROR";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/lib/server/classify-error.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/server/classify-error.ts app/tests/lib/server/classify-error.test.ts
git commit -m "feat(api): add thrown-error classifier for the middleware boundary (D131)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Middleware error boundary (H1)

**Files:**
- Modify: `app/src/middleware.ts`
- Test: `app/tests/middleware.test.ts` (create)

**Interfaces:**
- Consumes: `classifyThrownError` (Task 2), `fail` (`@server/envelope`).
- Produces: any uncaught throw during `api-provision` / `api-protected` handling returns the frozen error envelope (`5xx`) with `requestId`; page-route throws are left to Astro.

- [ ] **Step 1: Write the failing test** — create `app/tests/middleware.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@lib/auth/verify-jwt", () => ({ verifyBearerToken: vi.fn() }));
vi.mock("@db/client", () => ({ getDb: vi.fn() }));

import { verifyBearerToken } from "@lib/auth/verify-jwt";
import { getDb } from "@db/client";
import { onRequest } from "../src/middleware";

function ctxFor(path: string) {
  return {
    locals: {} as Record<string, unknown>,
    url: new URL(`https://x${path}`),
    request: new Request(`https://x${path}`, {
      headers: { authorization: "Bearer t" },
    }),
  };
}

describe("middleware error boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyBearerToken).mockResolvedValue({
      authUserId: "u1",
    } as never);
    vi.mocked(getDb).mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([{ id: "p1" }]) }),
        }),
      }),
    } as never);
  });

  it("envelopes a generic thrown error as 500 INTERNAL_ERROR", async () => {
    const next = vi.fn(() => {
      throw new Error("boom");
    });
    const res = await onRequest(ctxFor("/api/sessions/active") as never, next as never);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, error: { code: "INTERNAL_ERROR" } });
    expect(body.requestId).toBeTruthy();
  });

  it("envelopes a transient thrown error as 503 SERVICE_UNAVAILABLE", async () => {
    const next = vi.fn(() => {
      throw new Error("Connection terminated");
    });
    const res = await onRequest(ctxFor("/api/sessions/active") as never, next as never);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(body.error.retryable).toBe(true);
  });

  it("does not envelope a thrown error on a page route", async () => {
    const next = vi.fn(() => {
      throw new Error("page boom");
    });
    await expect(
      onRequest(ctxFor("/games") as never, next as never),
    ).rejects.toThrow("page boom");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/middleware.test.ts`
Expected: FAIL — the first two cases reject (throw) instead of returning a `5xx` envelope.

- [ ] **Step 3: Refactor middleware to add the boundary** — replace the body of `app/src/middleware.ts` with:

```typescript
import type { MiddlewareHandler } from "astro";
import { eq } from "drizzle-orm";
import { getDb } from "./db/client";
import { players } from "./db/schema";
import { verifyBearerToken } from "./lib/auth/verify-jwt";
import { fail } from "./lib/server/envelope";
import { classifyThrownError } from "./lib/server/classify-error";
import { classifyRoute } from "./lib/utils/route-class";

type Ctx = Parameters<MiddlewareHandler>[0];
type Next = Parameters<MiddlewareHandler>[1];

/**
 * Resolves identity for the two API route classes and runs the handler.
 * `api-provision` (D62): JWT verified, player lookup skipped. `api-protected`:
 * JWT verified and player resolved. Any error thrown here (including inside the
 * downstream handler via next()) propagates to the boundary in onRequest.
 */
async function handleApiRequest(
  ctx: Ctx,
  next: Next,
  cls: "api-provision" | "api-protected",
): Promise<Response> {
  const verified = await verifyBearerToken(
    ctx.request.headers.get("authorization"),
  );
  if (!verified) return fail("UNAUTHORIZED", ctx.locals.requestId);

  if (cls === "api-provision") {
    ctx.locals.auth = {
      authUserId: verified.authUserId,
      ...(verified.name ? { name: verified.name } : {}),
    };
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

/**
 * Route-class auth gate with an API error boundary. On `api-*` routes an
 * uncaught error is classified (D131) to SERVICE_UNAVAILABLE (transient) or
 * INTERNAL_ERROR and returned in the frozen envelope with requestId; the raw
 * error is logged server-side, never sent to the client. Page routes
 * (D97/D98) bypass the boundary — navigation UX is enforced by auth.store
 * init(), not here.
 */
export const onRequest: MiddlewareHandler = async (ctx, next) => {
  ctx.locals.requestId = crypto.randomUUID();
  const cls = classifyRoute(ctx.url.pathname);

  if (cls === "public-page" || cls === "asset") return next();

  if (cls === "api-provision" || cls === "api-protected") {
    try {
      return await handleApiRequest(ctx, next, cls);
    } catch (error) {
      console.error(
        `[api] uncaught error requestId=${ctx.locals.requestId}`,
        error,
      );
      return fail(classifyThrownError(error), ctx.locals.requestId);
    }
  }

  return next();
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/middleware.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full suite to confirm no regression**

Run: `cd app && npm test`
Expected: PASS (all existing tests + the new ones).

- [ ] **Step 6: Commit**

```bash
git add app/src/middleware.ts app/tests/middleware.test.ts
git commit -m "feat(api): global error boundary in middleware for api routes (D131)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Repository — `findActiveSessionForGameType` (H3)

**Files:**
- Modify: `app/src/repositories/interfaces.ts`, `app/src/repositories/session.repository.ts`
- Test: `app/tests/repositories/session.repository.test.ts`

**Interfaces:**
- Produces: `interface ActiveSessionSummary { sessionId: string; startedAt: string }`; `findActiveSessionForGameType(db, playerId, gameTypeId): Promise<ActiveSessionSummary | undefined>` (active ⇔ `completed_at IS NULL`, D69, matching the `uq_sessions_single_active` predicate).

- [ ] **Step 1: Write the failing test** — append to `app/tests/repositories/session.repository.test.ts`:

```typescript
describe("findActiveSessionForGameType", () => {
  it("returns the active session summary when one exists", async () => {
    const row = { sessionId: "s1", startedAt: "2026-07-22T10:00:00.000Z" };
    const db = { select: vi.fn(() => fakeSelect([row])) } as any;
    const { findActiveSessionForGameType } = await import(
      "@repositories/session.repository"
    );
    const result = await findActiveSessionForGameType(db, "p1", "gt1");
    expect(result).toEqual(row);
  });

  it("returns undefined when no active session exists", async () => {
    const db = { select: vi.fn(() => fakeSelect([])) } as any;
    const { findActiveSessionForGameType } = await import(
      "@repositories/session.repository"
    );
    expect(await findActiveSessionForGameType(db, "p1", "gt1")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/repositories/session.repository.test.ts`
Expected: FAIL — `findActiveSessionForGameType` is not exported.

- [ ] **Step 3a: Add the interface** — append to `app/src/repositories/interfaces.ts`:

```typescript
export interface ActiveSessionSummary {
  sessionId: string;
  startedAt: string;
}
```

- [ ] **Step 3b: Add the query** — in `app/src/repositories/session.repository.ts`, add `ActiveSessionSummary` to the existing `import type { … } from "./interfaces";` list, then add:

```typescript
export async function findActiveSessionForGameType(
  db: Db,
  playerId: string,
  gameTypeId: string,
): Promise<ActiveSessionSummary | undefined> {
  const [row] = await db
    .select({
      sessionId: exerciseSessions.id,
      startedAt: exerciseSessions.startedAt,
    })
    .from(exerciseSessions)
    .where(
      and(
        eq(exerciseSessions.playerId, playerId),
        eq(exerciseSessions.gameTypeId, gameTypeId),
        isNull(exerciseSessions.completedAt),
      ),
    )
    .limit(1);
  return row;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/repositories/session.repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/repositories/interfaces.ts app/src/repositories/session.repository.ts app/tests/repositories/session.repository.test.ts
git commit -m "feat(repo): add findActiveSessionForGameType (D132)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Session service — single-active pre-check + race-safe backstop (H3)

**Files:**
- Modify: `app/src/services/session.service.ts`
- Test: `app/tests/services/session.service.test.ts`

**Interfaces:**
- Consumes: `findActiveSessionForGameType` (Task 4), `SESSION_ALREADY_ACTIVE` (Task 1).
- Produces: `createSession` returns `{ ok:false, code:"SESSION_ALREADY_ACTIVE", details:{ sessionId, startedAt } }` when an active session exists (pre-check) or when the `uq_sessions_single_active` unique violation fires (race). Non-conflict insert errors are re-thrown so the middleware boundary classifies them (Task 3).

- [ ] **Step 1: Write the failing tests** — in `app/tests/services/session.service.test.ts`:
  1. Add `findActiveSessionForGameType: vi.fn(),` to the `vi.mock("@repositories/session.repository", …)` override object.
  2. In the `describe("createSession", …)` `beforeEach`, add:
     `vi.mocked(repo.findActiveSessionForGameType).mockResolvedValue(undefined);`
  3. Append these tests inside `describe("createSession", …)`:

```typescript
  it("returns SESSION_ALREADY_ACTIVE with details when one is active (pre-check)", async () => {
    vi.mocked(repo.findActiveSessionForGameType).mockResolvedValue({
      sessionId: "active-1",
      startedAt: "2026-07-22T10:00:00.000Z",
    });
    const result = await createSession("player-1", inlineRequest);
    expect(result).toMatchObject({
      ok: false,
      code: "SESSION_ALREADY_ACTIVE",
      details: { sessionId: "active-1", startedAt: "2026-07-22T10:00:00.000Z" },
    });
    expect(repo.insertSessionRecords).not.toHaveBeenCalled();
  });

  it("returns SESSION_ALREADY_ACTIVE on a unique-violation race", async () => {
    vi.mocked(repo.findActiveSessionForGameType)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        sessionId: "active-2",
        startedAt: "2026-07-22T11:00:00.000Z",
      });
    vi.mocked(repo.insertSessionRecords).mockRejectedValue(
      Object.assign(
        new Error(
          'duplicate key value violates unique constraint "uq_sessions_single_active"',
        ),
        { code: "23505", constraint: "uq_sessions_single_active" },
      ),
    );
    const result = await createSession("player-1", inlineRequest);
    expect(result).toMatchObject({
      ok: false,
      code: "SESSION_ALREADY_ACTIVE",
      details: { sessionId: "active-2" },
    });
  });

  it("re-throws a non-conflict insert error for the middleware boundary", async () => {
    vi.mocked(repo.insertSessionRecords).mockRejectedValue(
      new Error("Connection terminated"),
    );
    await expect(createSession("player-1", inlineRequest)).rejects.toThrow(
      "Connection terminated",
    );
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/services/session.service.test.ts`
Expected: FAIL — no pre-check yet; insert errors are not caught.

- [ ] **Step 3a: Add the imports and conflict predicate** — in `app/src/services/session.service.ts`, add `findActiveSessionForGameType` to the `@repositories/session.repository` import list, then add this module-level helper (above `createSession`):

```typescript
/**
 * True when the error is the uq_sessions_single_active unique violation
 * (Postgres 23505 on that partial index), i.e. an active session for this
 * (player, game type) already exists.
 */
function isActiveSessionConflict(error: unknown): boolean {
  const e = error as { code?: string; constraint?: string; message?: string };
  return (
    e?.code === "23505" &&
    (e?.constraint === "uq_sessions_single_active" ||
      (e?.message?.includes("uq_sessions_single_active") ?? false))
  );
}
```

- [ ] **Step 3b: Add the pre-check and wrap the insert** — in `createSession`, replace the block that currently reads:

```typescript
  const sessionId = generateId();
  const participantId = generateId();

  await insertSessionRecords({
    activityId: generateId(),
    sessionId,
    configurationId: generateId(),
    participantId,
    playerId,
    gameTypeId: gameTypeRuleset.gameTypeId,
    rulesetVersionId: gameTypeRuleset.rulesetVersionId,
    captureModeId,
    inputModeId,
    activeStatusId,
    playerParticipantTypeId,
    displayName,
    configuration: validated.config,
  });

  return {
    ok: true,
    data: {
      sessionId,
      participants: [
        { ref: participantId, participantTypeKey: "PLAYER", displayName },
      ],
    },
  };
```

with:

```typescript
  const existingActive = await findActiveSessionForGameType(
    db,
    playerId,
    gameTypeRuleset.gameTypeId,
  );
  if (existingActive) {
    return {
      ok: false,
      code: "SESSION_ALREADY_ACTIVE",
      details: existingActive,
    };
  }

  const sessionId = generateId();
  const participantId = generateId();

  try {
    await insertSessionRecords({
      activityId: generateId(),
      sessionId,
      configurationId: generateId(),
      participantId,
      playerId,
      gameTypeId: gameTypeRuleset.gameTypeId,
      rulesetVersionId: gameTypeRuleset.rulesetVersionId,
      captureModeId,
      inputModeId,
      activeStatusId,
      playerParticipantTypeId,
      displayName,
      configuration: validated.config,
    });
  } catch (error) {
    if (!isActiveSessionConflict(error)) throw error;
    const active = await findActiveSessionForGameType(
      db,
      playerId,
      gameTypeRuleset.gameTypeId,
    );
    return active
      ? { ok: false, code: "SESSION_ALREADY_ACTIVE", details: active }
      : { ok: false, code: "INTERNAL_ERROR" };
  }

  return {
    ok: true,
    data: {
      sessionId,
      participants: [
        { ref: participantId, participantTypeKey: "PLAYER", displayName },
      ],
    },
  };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/services/session.service.test.ts`
Expected: PASS (existing createSession tests still green; 3 new ones green).

- [ ] **Step 5: Commit**

```bash
git add app/src/services/session.service.ts app/tests/services/session.service.test.ts
git commit -m "feat(api): guard single-active-session invariant on create (D132)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Read repositories — project to DTO, drop player_id (C1)

**Files:**
- Modify: `app/src/repositories/session.repository.ts`
- Test: `app/tests/repositories/session.repository.test.ts`

**Interfaces:**
- Produces: `findActiveSessions` returns rows shaped exactly as `SessionActive` (no `playerId`); `findConfigurationPresets` returns rows shaped exactly as `ConfigurationPreset` (no `playerId`).

- [ ] **Step 1: Write the failing tests** — append to `app/tests/repositories/session.repository.test.ts`:

```typescript
describe("findActiveSessions projection", () => {
  it("selects DTO columns and never player_id", async () => {
    const selectMock = vi.fn(() => fakeSelect([{ sessionId: "s1" }]));
    const db = { select: selectMock } as any;
    const { findActiveSessions } = await import(
      "@repositories/session.repository"
    );
    await findActiveSessions(db, "p1");
    const projection = selectMock.mock.calls[0][0] as Record<string, unknown>;
    expect(projection).not.toHaveProperty("playerId");
    expect(Object.keys(projection).sort()).toEqual(
      [
        "captureModeKey",
        "gameTypeKey",
        "gameTypeName",
        "inputModeKey",
        "rulesetVersionKey",
        "sessionId",
        "startedAt",
      ].sort(),
    );
  });
});

describe("findConfigurationPresets projection", () => {
  it("selects DTO columns and never player_id", async () => {
    const selectMock = vi.fn(() => fakeSelect([{ configurationTemplateId: "c1" }]));
    const db = { select: selectMock } as any;
    const { findConfigurationPresets } = await import(
      "@repositories/session.repository"
    );
    await findConfigurationPresets(db, "SCORE_TRAINING", "p1");
    const projection = selectMock.mock.calls[0][0] as Record<string, unknown>;
    expect(projection).not.toHaveProperty("playerId");
    expect(Object.keys(projection).sort()).toEqual(
      [
        "configuration",
        "configurationTemplateId",
        "description",
        "gameTypeKey",
        "isSystemTemplate",
        "name",
      ].sort(),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/repositories/session.repository.test.ts`
Expected: FAIL — bare `select()` is called with no projection argument (`mock.calls[0][0]` is `undefined`).

- [ ] **Step 3: Add explicit projections** — in `app/src/repositories/session.repository.ts`, replace `findActiveSessions` and `findConfigurationPresets` with:

```typescript
export async function findActiveSessions(db: Db, playerId: string) {
  return db
    .select({
      sessionId: vActiveSessions.sessionId,
      gameTypeKey: vActiveSessions.gameTypeKey,
      gameTypeName: vActiveSessions.gameTypeName,
      captureModeKey: vActiveSessions.captureModeKey,
      inputModeKey: vActiveSessions.inputModeKey,
      rulesetVersionKey: vActiveSessions.rulesetVersionKey,
      startedAt: vActiveSessions.startedAt,
    })
    .from(vActiveSessions)
    .where(eq(vActiveSessions.playerId, playerId));
}

export async function findConfigurationPresets(
  db: Db,
  gameTypeKey: string,
  playerId: string,
) {
  return db
    .select({
      configurationTemplateId: vConfigurationPresets.configurationTemplateId,
      gameTypeKey: vConfigurationPresets.gameTypeKey,
      name: vConfigurationPresets.name,
      description: vConfigurationPresets.description,
      configuration: vConfigurationPresets.configuration,
      isSystemTemplate: vConfigurationPresets.isSystemTemplate,
    })
    .from(vConfigurationPresets)
    .where(
      and(
        eq(vConfigurationPresets.gameTypeKey, gameTypeKey),
        or(
          isNull(vConfigurationPresets.playerId),
          eq(vConfigurationPresets.playerId, playerId),
        ),
      ),
    );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/repositories/session.repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/repositories/session.repository.ts app/tests/repositories/session.repository.test.ts
git commit -m "fix(api): project read views to DTO shape, drop player_id leak (C1)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Client `apiRequest` — robust parse + GET retry (H2)

**Files:**
- Modify: `app/src/lib/client/api/types.ts`, `app/src/lib/client/api/client.ts`
- Test: `app/tests/lib/client/api/client.test.ts`

**Interfaces:**
- Produces: `apiRequest` always resolves to an `ApiResult<T>` (never rejects on transport/parse failure); a non-envelope / network failure becomes a retryable `SERVICE_UNAVAILABLE` `ApiFailure`; GET requests retry up to 2× with backoff on retryable failures; non-GET requests never auto-retry.

- [ ] **Step 1: Write the failing tests** — append to `app/tests/lib/client/api/client.test.ts` (inside `describe("apiRequest", …)`):

```typescript
  it("returns a retryable SERVICE_UNAVAILABLE failure on a non-JSON 500 (no throw)", async () => {
    vi.mocked(getAccessToken).mockResolvedValue("test-jwt");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 500,
        json: async () => {
          throw new SyntaxError("Unexpected token < in JSON");
        },
      }),
    );
    const result = await apiRequest("/api/sessions/active");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
      expect(result.error.retryable).toBe(true);
    }
    vi.unstubAllGlobals();
  });

  it("retries a GET on a retryable failure, then succeeds", async () => {
    vi.useFakeTimers();
    vi.mocked(getAccessToken).mockResolvedValue("test-jwt");
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({ ok: true, data: [], requestId: "r" }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const pending = apiRequest("/api/sessions/active");
    await vi.runAllTimersAsync();
    const result = await pending;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not retry a POST", async () => {
    vi.mocked(getAccessToken).mockResolvedValue("test-jwt");
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);
    const result = await apiRequest("/api/sessions", {
      method: "POST",
      body: "{}",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    vi.unstubAllGlobals();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/client/api/client.test.ts`
Expected: FAIL — the current `apiRequest` throws on the parse error / does not retry.

- [ ] **Step 3a: Add optional `details` to the error body** — in `app/src/lib/client/api/types.ts`, change `ApiErrorBody` to:

```typescript
export type ApiErrorBody = {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
};
```

- [ ] **Step 3b: Rewrite the client** — replace the contents of `app/src/lib/client/api/client.ts` with:

```typescript
import { getAccessToken } from "@client/auth/client";
import type { ApiFailure, ApiResult } from "./types";

const UNAUTHORIZED: ApiFailure = {
  ok: false,
  requestId: "",
  error: {
    code: "UNAUTHORIZED",
    message: "Authentication required",
    retryable: false,
  },
};

const MAX_GET_RETRIES = 2;
const RETRY_BASE_MS = 200;

function serviceUnavailable(status?: number): ApiFailure {
  return {
    ok: false,
    requestId: "",
    error: {
      code: "SERVICE_UNAVAILABLE",
      message: "Service temporarily unavailable",
      retryable: true,
      ...(status === undefined ? {} : { details: { status } }),
    },
  };
}

function isEnvelope<T>(value: unknown): value is ApiResult<T> {
  return typeof value === "object" && value !== null && "ok" in value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Performs a single fetch attempt and normalizes any transport or parse
 * failure into a retryable SERVICE_UNAVAILABLE envelope instead of throwing.
 */
async function attempt<T>(
  path: string,
  init: RequestInit,
  headers: Headers,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers });
  } catch {
    return serviceUnavailable();
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return serviceUnavailable(response.status);
  }
  if (!isEnvelope<T>(body)) return serviceUnavailable(response.status);
  return body;
}

/**
 * Authenticated JSON request against the Worker API. Always resolves to an
 * ApiResult — transport/parse failures become a retryable SERVICE_UNAVAILABLE
 * failure. GET requests (idempotent) retry with backoff on retryable failures;
 * writes are never auto-retried (they own idempotency keys at the call site).
 */
export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  const token = await getAccessToken();
  if (!token) return UNAUTHORIZED;

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const method = (init.method ?? "GET").toUpperCase();
  const maxAttempts = method === "GET" ? MAX_GET_RETRIES + 1 : 1;

  let result = await attempt<T>(path, init, headers);
  for (let i = 1; i < maxAttempts; i++) {
    if (result.ok || !result.error.retryable) break;
    await sleep(RETRY_BASE_MS * i);
    result = await attempt<T>(path, init, headers);
  }
  return result;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/client/api/client.test.ts`
Expected: PASS (existing 2 + new 3).

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/client/api/types.ts app/src/lib/client/api/client.ts app/tests/lib/client/api/client.test.ts
git commit -m "fix(client): robust envelope parse + GET retry in apiRequest (H2)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Setup flow — handle `SESSION_ALREADY_ACTIVE` on create (H3 client wiring)

**Files:**
- Modify: `app/src/lib/game/score-training-setup.data.ts`
- Test: `app/tests/lib/game/score-training-setup.data.test.ts`

**Interfaces:**
- Consumes: `retryReconciliation()` (existing), the `SESSION_ALREADY_ACTIVE` code from `createSession` (Tasks 1/5).
- Produces: when `start()`'s `createSession` reports `SESSION_ALREADY_ACTIVE`, the flow re-runs the existing D118 reconciliation (fetches active sessions → Continue/Abandon modal) instead of showing the generic error. Reuses the tested reconcile path; no `details` plumbing required.

- [ ] **Step 1: Write the failing test** — append inside `describe("session creation", …)` in `app/tests/lib/game/score-training-setup.data.test.ts`:

```typescript
    it("re-reconciles into the active-session modal when create reports SESSION_ALREADY_ACTIVE", async () => {
      const setup = createSetup({
        selectedTemplateId: "template-1",
        presets: [
          {
            configurationTemplateId: "template-1",
            name: "Standard",
            configuration: {
              duration_type: "ROUNDS",
              duration_value: 20,
              max_darts_per_turn: 3,
            },
          } as any,
        ],
      });

      vi.mocked(sessionsApi.createSession).mockRejectedValue(
        Object.assign(new Error("already active"), {
          code: "SESSION_ALREADY_ACTIVE",
        }),
      );
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "active-1", gameTypeKey: "SCORE_TRAINING" } as any,
      ]);
      store.game.sessionId = "active-1";

      await setup.start();

      expect(setup.showActiveSessionModal).toBe(true);
      expect(setup.activeSession).toMatchObject({ sessionId: "active-1" });
      expect(setup.loading).toBe(false);
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/score-training-setup.data.test.ts`
Expected: FAIL — `showActiveSessionModal` stays `false`; `error` is set to the generic message.

- [ ] **Step 3: Handle the conflict in `start()`** — in `app/src/lib/game/score-training-setup.data.ts`, replace the `catch` block of `start()` (currently `} catch { this.error = "Could not start the session. Try again."; }`) with:

```typescript
      } catch (err: unknown) {
        const code = (err as { code?: string }).code;
        if (code === "SESSION_ALREADY_ACTIVE") {
          await this.retryReconciliation();
          return;
        }
        this.error = "Could not start the session. Try again.";
      } finally {
        this.loading = false;
      }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/score-training-setup.data.test.ts`
Expected: PASS (existing setup tests still green + the new one).

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/score-training-setup.data.ts app/tests/lib/game/score-training-setup.data.test.ts
git commit -m "feat(game): reconcile into active-session modal on create conflict (D132)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Add a real `canonicalize` unit test (M2)

**Files:**
- Test: `app/tests/services/session.service.test.ts`

**Interfaces:**
- Consumes: `canonicalize` (already imported in this test file; currently unused → `ts6133` warning).

- [ ] **Step 1: Write the test** — append to `app/tests/services/session.service.test.ts` (top-level, after the `canonicalize / hashBatchPayload` describe):

```typescript
describe("canonicalize", () => {
  it("recursively sorts object keys", () => {
    expect(canonicalize({ b: 1, a: { d: 2, c: 3 } })).toEqual({
      a: { c: 3, d: 2 },
      b: 1,
    });
    expect(JSON.stringify(canonicalize({ b: 1, a: 2 }))).toBe('{"a":2,"b":1}');
  });

  it("preserves array order", () => {
    expect(canonicalize([3, 1, 2])).toEqual([3, 1, 2]);
  });
});
```

- [ ] **Step 2: Run the test to verify it passes (green immediately — it exercises existing behavior)**

Run: `cd app && npx vitest run tests/services/session.service.test.ts`
Expected: PASS.

- [ ] **Step 3: Confirm the ts6133 warning is gone**

Run: `cd app && rm -rf .astro && npx astro check`
Expected: 0 errors, 0 warnings, 0 hints (the previously-reported unused `canonicalize` import warning is resolved).

- [ ] **Step 4: Commit**

```bash
git add app/tests/services/session.service.test.ts
git commit -m "test(api): cover canonicalize; clears unused-import warning (M2)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Deterministic `astro check` (M1)

**Files:**
- Modify: `app/package.json`

**Interfaces:**
- Produces: `npm run check` clears the `.astro` type cache first, so `astro check` cannot report phantom errors from stale generated types; `validate:app` calls `npm run check`.

- [ ] **Step 1: Update the scripts** — in `app/package.json`, change the `check` script and the `astro check` occurrence inside `validate:app`:

```json
    "check": "rm -rf .astro && astro check",
    "validate:app": "npm run db:status && npm run db:migrate && npm run db:introspect && npx fallow && npm test && npm run check && bash ../scripts/refresh-graph.sh"
```

- [ ] **Step 2: Verify determinism** — run the check twice; both must report 0 errors:

Run: `cd app && npm run check && npm run check`
Expected: Both runs → `0 errors`.

- [ ] **Step 3: Commit**

```bash
git add app/package.json
git commit -m "chore(app): clear .astro cache before astro check for determinism (M1)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Docs, decision ledger, and Context Maintenance gate

**Files:**
- Modify: `DECISIONS.md`, `docs/architecture/06-API/00-Overview.md`, `docs/architecture/06-API/02-Middleware-And-Layering.md`, `docs/architecture/06-API/03-Shared-Conventions.md`, `docs/architecture/06-API/04-Endpoint-Contracts.md`, `docs/architecture/05-Database/06-Spec/04-Runtime-Layer.md`, `docs/architecture/00-Context-Map.md`

**Interfaces:** N/A (documentation). Verification is the check scripts + `validate:app`.

> **For every edited `docs/architecture/**` file, also set its front-matter `updated:` field to `2026-07-22`** (in addition to the in-body version line). `scripts/check-context-map.sh` validates front-matter dates — a stale `updated:` will fail the gate.

- [ ] **Step 1: Append decisions** — add to `DECISIONS.md` (API section table):

```markdown
| D131 | 2026-07-22 | API error boundary in middleware: uncaught exceptions on `api-*` routes are classified (`lib/server/classify-error.ts`) to `SERVICE_UNAVAILABLE` (transient connectivity/DB) or `INTERNAL_ERROR` and returned in the frozen envelope with `requestId`; raw error text is logged server-side, never sent to the client | Activates the frozen `SERVICE_UNAVAILABLE` retry contract that had no emitter; formalizes the previously "optional" envelope-on-error rule for Cloudflare/Neon scale-to-zero |
| D132 | 2026-07-22 | Server-guarded single-active-session invariant: `POST /api/sessions` pre-checks for an existing ACTIVE session (`findActiveSessionForGameType`, `completed_at IS NULL`) and catches the `uq_sessions_single_active` (23505) violation as a race-safe backstop, returning new `409 SESSION_ALREADY_ACTIVE` with the existing `{ sessionId, startedAt }` in `details`; Score Training client re-reconciles (D118) into the Continue/Abandon modal. Reopens the v1 error registry (D70) by explicit decision for this hardening pass | Two rapid taps / two tabs / a failed orphan-abandon previously produced an uncaught 500; server now defends the invariant instead of relying on the client |
```

- [ ] **Step 2: `03-Shared-Conventions.md`** — add a row to the Error-Code Registry table (after `SESSION_ALREADY_COMPLETED`):

```markdown
| `SESSION_ALREADY_ACTIVE` | 409 | no | 2026-07-22 |
```

Bump the doc version line to `1.6.0` with a one-line changelog noting the added code (2026-07-22).

- [ ] **Step 3: `00-Overview.md`** — add `SESSION_ALREADY_ACTIVE` to the "Initial domain codes" list; under "Read Contract", add a note:

```markdown
> **v1 implementation status (2026-07-22):** the Score Training first-deploy implements `POST /api/sessions`, `GET /api/sessions/active`, `PATCH /api/sessions/:id`, `POST /api/sessions/:id/events/batch`, `GET /api/configuration-templates`, and `POST /api/players/provision`. The remaining frozen read endpoints (`GET /api/sessions` list, `GET /api/sessions/:id`, `/replay`, `/darts`) are contract-defined but implemented after the first engine — not a contract change. (S1)
```

Bump the doc version to `1.4.0` (2026-07-22).

- [ ] **Step 4: `02-Middleware-And-Layering.md`** — add a row to the "Owned by middleware" table:

```markdown
| API error boundary (uncaught → enveloped 5xx) | Yes (api-* routes) | Never |
```

Add Rule 8 under "# Rules":

```markdown
8. Uncaught errors on `api-*` routes are caught by middleware and returned as an enveloped `SERVICE_UNAVAILABLE`/`INTERNAL_ERROR` (D131); page routes are not enveloped.
```

Bump the doc version to `1.3.0` (2026-07-22).

- [ ] **Step 5: `04-Endpoint-Contracts.md`** — under `POST /api/sessions` **Outcomes**, add:

```markdown
- An existing ACTIVE session for the same game type → `409 SESSION_ALREADY_ACTIVE`, with `error.details = { sessionId, startedAt }` (the existing session). Service-enforced by a pre-check plus a race-safe `uq_sessions_single_active` catch (D132). <!-- 2026-07-22 -->
```

Bump the doc version to `1.2.0` (2026-07-22).

- [ ] **Step 6: `05-Database/06-Spec/04-Runtime-Layer.md`** — under `exercise_sessions` → **Rules**, append to the single-active line:

```markdown
This invariant is now server-guarded (D132): `POST /api/sessions` pre-checks for an active session and catches the `uq_sessions_single_active` violation, in addition to the DB partial unique index. <!-- 2026-07-22 -->
```

- [ ] **Step 7: `00-Context-Map.md`** — bump the map version; update the ISO dates on the `06-API/00`, `02`, `03`, `04`, and `DECISIONS.md` inventory rows to reflect the 2026-07-22 changes; add a one-line note in "Current Implementation State" that the API now has an error boundary (D131) and single-active guard (D132).

- [ ] **Step 8: Run all five context check scripts**

Run:
```bash
cd /Users/levi/Development/dart-analytics
bash scripts/check-context-map.sh && bash scripts/check-file-locations.sh && bash scripts/check-agent-mirrors.sh && bash scripts/check-astro-class-composition.sh && bash scripts/check-astro-conventions.sh
```
Expected: all five print `OK`.

- [ ] **Step 9: Refresh the knowledge graph**

Run: `cd /Users/levi/Development/dart-analytics && bash scripts/refresh-graph.sh`
Expected: graph rebuilt (or a warning if the CLI is absent — record it in the completion report).

- [ ] **Step 10: Commit**

```bash
git add DECISIONS.md docs/ graphify-out/graph.json
git commit -m "docs: record D131/D132, S1 markers, and context maintenance

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final Verification

- [ ] **Run the full validation gate**

Run: `cd app && npm run validate:app`
Expected: `db:status`/`db:migrate`/`db:introspect` succeed against the dev branch, `npx fallow` clean, `npm test` all green (200 existing + the new tests), `npm run check` 0 errors, graph refresh done. Record any graph-not-refreshed warning in the completion report.

> **DB-free fallback:** `db:status`/`db:migrate`/`db:introspect` require the Neon dev-branch env (`app/.env`). If the executing environment has no DB access, run the DB-free gate instead — `cd app && npm test && npm run check` — and note in the completion report that the DB steps were skipped. None of this plan's changes alter schema, so introspection output is unchanged.

- [ ] **Confirm branch integration readiness (D96)**

Run: `cd /Users/levi/Development/dart-analytics && git log --oneline main..feat/harden-first-deploy`
Expected: the spec commit + the task commits above. Open a PR from `feat/harden-first-deploy` → `main` when the user asks.

---

## Notes for the Implementer

- **Server returns `details`, client re-reconciles.** D132's `error.details = { sessionId, startedAt }` is part of the API contract (useful for logging and other clients), but the Score Training client deliberately does not parse it — it re-runs the existing, tested `reconcile` path (Task 8). Do not add `details` plumbing to `SessionApiError`.
- **The middleware boundary is the catch-all under domain errors.** Domain failures (`SESSION_ALREADY_ACTIVE`, `NOT_FOUND`, …) are still returned as `ServiceResult` and mapped by the controller; only genuinely *uncaught* throws hit the boundary. Task 5 deliberately re-throws non-conflict insert errors so the boundary classifies them.
- **DB-touching tests never hit a real database** — mock `@repositories/*` (service tests), the `db` chain via `fakeSelect` (repository tests), or `@db/client`/`fetch` (middleware/client tests), per the existing patterns.
- **Do not commit** until the user authorizes execution; the commit steps are part of the TDD cadence during execution, on `feat/harden-first-deploy`.
