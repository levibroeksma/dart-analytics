# Routine Sharing (Phase 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A player creates a share code for an own routine; another player previews it and accepts, receiving an independent copy; the owner sees redemptions and can revoke.

**Architecture:** `routine_shares` (Template-layer, revocable) and `routine_share_redemptions` (fact table). Codes are server-generated Crockford base32, 10 chars, 7-day default expiry. Preview and accept read through `v_routine_share_preview`; accept copies the routine at accept time inside one transaction (new ids, recipient-owned, bounds re-applied by the `0038` trigger). Uniform `NOT_FOUND` for unknown/revoked/expired. A human security review is a task, not a footnote.

**Tech Stack:** PostgreSQL/dbmate, drizzle-orm, Zod, Web Crypto, Alpine.js, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-18-routine-sharing-design.md`. Depends on Phase 1. Independent of Phases 2–3 (renumber the migration to the chain head).

## Global Constraints

- Branch `feat/routine-sharing` off `main`. No commit/PR without the user's word.
- Migration `0041_routine_shares.sql` (or the chain head). No seed.
- The share code is a bearer secret: never logged in full (mask to the first 3 chars in any log line), never in a `details` payload, never echoed back except to its creator.
- Only own, non-system routines can be shared; a share of a system routine is refused in the service.
- `GET /api/shares/:code` and `POST /api/shares/:code/accept` answer `NOT_FOUND` for unknown, revoked and expired alike.
- Copy semantics: at accept time; new UUIDs for template and steps; `player_id` = recipient; `is_system_template = FALSE`; `configuration` copied verbatim; name kept.
- §7 of the spec (security, privacy, GDPR) requires a human reviewer's sign-off before Task 5 merges (Task 4 below). Rate limiting is *out of scope*: no mechanism exists; it is an infrastructure decision for that reviewer.
- TDD, mirrored tests, comment rules, barrels, gates — as Phase 1.

## Resolved judgement calls

| Spec item | Resolution |
| --- | --- |
| §3 copy time | at accept time (no snapshot on the share row) |
| §4 repeat accept | idempotent: returns the existing copy with `200` (a `201` only on first accept) |
| §5.2 rate limits | not built; named in the reviewer checklist |
| §6 login return URL | verified in Task 3; if the gate does not preserve the URL, the accept page shows "Sign in, then open the link again" rather than storing state |
| §9 fact-table doc home | `05-Database/06-Spec/03-Runtime-Layer.md` gets a short "Routine share redemptions" subsection (it is a fact, not gameplay; say so) |

---

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `database/migrations/0041_routine_shares.sql` | two tables, two views |
| `database/verification/0041_routine_share_checks.sql` | constraints; uniform preview filtering; no share on a system routine (query) |
| `app/src/db/schema.ts` | tables + views |
| `app/src/modules/training/routines/share-code.module.ts` | `generateShareCode()`, `SHARE_CODE_ALPHABET`, `isShareCode()` — pure, Web Crypto |
| `app/src/repositories/routine-share.repository.ts`, `interfaces.ts` | reads via views; writes |
| `app/src/services/routine-share.service.ts`, `types.ts` | create/list/revoke/preview/accept |
| `app/src/pages/api/routines/[routineId]/shares/{index,[shareId]}.ts`, `app/src/pages/api/shares/[code]/{index,accept}.ts`, `app/src/pages/api/shares/types.ts` | controllers + Zod |
| `app/src/lib/client/api/shares.ts`, `types.ts` | client |
| `app/src/lib/training/routines/{share-routine.data.ts,accept-share.data.ts,share-route.ts}` | UI state |
| `app/src/components/layout/training/routines/{ShareRoutineModal,SharePreview}.astro` | UI |
| `app/src/pages/training/routines/accept/index.astro` | accept shell |
| `RoutineDetail.astro`, `routine-detail.data.ts` | `Share` button for own routines |
| tests | mirrored |

---

### Task 1: Migration, verification, `schema.ts`

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull && git checkout -b feat/routine-sharing
```

- [ ] **Step 2: Verification first** — `database/verification/0041_routine_share_checks.sql` (fixture: two players, one 30-minute user routine owned by A; `BEGIN…ROLLBACK`):

1. `expires_at <= created_at` → `check_violation`;
2. duplicate `code` → `unique_violation`;
3. duplicate (share, recipient) redemption → `unique_violation`;
4. `v_routine_share_preview` shows an unexpired, unrevoked share and hides it once `revoked_at` is set and once `expires_at` is in the past (three counts);
5. `v_routine_shares.redemption_count` equals inserted redemptions;
6. deleting player B cascades their redemption; deleting player A cascades the share and its redemptions;
7. anti-vacuity query: no share row references a system routine (`count = 0`).

- [ ] **Step 3: Migration**

```sql
-- ============================================================
-- Migration: 0041_routine_shares.sql
--
-- Purpose:
-- Copy-on-share of a player's own routine through a server-
-- generated share code (spec 2026-09-18-routine-sharing-design.md,
-- D321). routine_shares is Template-layer (mutable: revocable).
-- routine_share_redemptions is a fact table: append-only in
-- practice, nothing updates it but the SET NULL when the recipient
-- later deletes their copy. "Redeemed N times" is derived.
--
-- A share of a system routine is a service rule (owner must equal
-- the routine's player_id); a CHECK cannot see the other table, so
-- the verification script asserts it by query.
-- ============================================================

-- migrate:up
CREATE TABLE routine_shares (
    id                    UUID PRIMARY KEY,
    routine_template_id   UUID NOT NULL,
    owner_player_id       UUID NOT NULL,
    code                  TEXT NOT NULL,
    expires_at            TIMESTAMPTZ NOT NULL,
    revoked_at            TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_routine_shares_routine_template FOREIGN KEY (routine_template_id) REFERENCES routine_templates(id) ON DELETE CASCADE,
    CONSTRAINT fk_routine_shares_owner_player     FOREIGN KEY (owner_player_id)     REFERENCES players(id)           ON DELETE CASCADE,
    CONSTRAINT uq_routine_shares_code UNIQUE (code),
    CONSTRAINT chk_routine_shares_expires_after_created CHECK (expires_at > created_at)
);
COMMENT ON TABLE routine_shares IS 'A share code for an own routine: bearer secret, expiring, revocable (revoked_at). Copies are made at accept time.';

CREATE INDEX idx_routine_shares_routine_template ON routine_shares (routine_template_id);

CREATE TABLE routine_share_redemptions (
    id                          UUID PRIMARY KEY,
    routine_share_id            UUID NOT NULL,
    recipient_player_id         UUID NOT NULL,
    copied_routine_template_id  UUID,
    redeemed_at                 TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_routine_share_redemptions_routine_share           FOREIGN KEY (routine_share_id)           REFERENCES routine_shares(id)    ON DELETE CASCADE,
    CONSTRAINT fk_routine_share_redemptions_recipient_player        FOREIGN KEY (recipient_player_id)        REFERENCES players(id)           ON DELETE CASCADE,
    CONSTRAINT fk_routine_share_redemptions_copied_routine_template FOREIGN KEY (copied_routine_template_id) REFERENCES routine_templates(id) ON DELETE SET NULL,
    CONSTRAINT uq_routine_share_redemptions_routine_share_recipient_player UNIQUE (routine_share_id, recipient_player_id)
);
COMMENT ON TABLE routine_share_redemptions IS 'Fact: who accepted which share, and the copy it produced (NULL once the recipient deletes it).';

CREATE VIEW v_routine_shares AS
SELECT s.id AS share_id,
    s.routine_template_id,
    s.owner_player_id,
    s.code,
    s.expires_at,
    s.revoked_at,
    s.created_at,
    (s.revoked_at IS NULL AND s.expires_at > now()) AS is_live,
    (SELECT count(*) FROM routine_share_redemptions r WHERE r.routine_share_id = s.id)::int AS redemption_count
FROM routine_shares s;
COMMENT ON VIEW v_routine_shares IS 'Owner-facing share list; filter by owner_player_id. is_live = unrevoked and unexpired.';

CREATE VIEW v_routine_share_preview AS
SELECT s.code,
    s.id AS share_id,
    s.owner_player_id,
    p.display_name AS owner_display_name,
    s.expires_at,
    rt.id   AS routine_template_id,
    rt.name AS routine_name,
    rt.description AS routine_description,
    rs.sequence_number,
    et.id   AS exercise_template_id,
    et.name AS exercise_name,
    et.description AS exercise_description,
    rs.duration_value,
    dt.implementation_key AS duration_type_key,
    rs.configuration AS step_configuration
FROM routine_shares s
    JOIN players p            ON p.id = s.owner_player_id
    JOIN routine_templates rt ON rt.id = s.routine_template_id
    JOIN routine_steps rs     ON rs.routine_template_id = rt.id
    JOIN exercise_templates et ON et.id = rs.exercise_template_id
    JOIN duration_types dt    ON dt.id = rs.duration_type_id
WHERE s.revoked_at IS NULL
    AND s.expires_at > now();
COMMENT ON VIEW v_routine_share_preview IS 'What a share code resolves to while live: the routine as it is now, step by step, plus the owner''s display name. Revoked or expired shares produce no rows — the one answer for all three.';

-- migrate:down
DROP VIEW IF EXISTS v_routine_share_preview;
DROP VIEW IF EXISTS v_routine_shares;
DROP TABLE IF EXISTS routine_share_redemptions;
DROP TABLE IF EXISTS routine_shares;
```

- [ ] **Step 4: `schema.ts`**; `cd app && npm test -- tests/db`; commit

```bash
git add database/migrations/0041_routine_shares.sql database/verification/0041_routine_share_checks.sql app/src/db/schema.ts
git commit -m "feat(db): 0041 routine shares and redemptions; preview and owner views"
```

---

### Task 2: Code generator, repository, service

**Interfaces:**

```ts
// modules/training/routines/share-code.module.ts
export const SHARE_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";  // Crockford, no I L O U
export const SHARE_CODE_LENGTH = 10;
export function generateShareCode(random: (length: number) => Uint8Array = webCryptoBytes): string;
export function isShareCode(value: string): boolean;
export function maskShareCode(code: string): string;   // "ABC…" for logs
// services/types.ts
export type RoutineShare = { shareId: string; code: string; url: string; expiresAt: string; revokedAt: string | null; isLive: boolean; redemptionCount: number; createdAt: string };
export type RoutineSharePreview = { code: string; routineName: string; description: string | null; ownerDisplayName: string; expiresAt: string; steps: { sequenceNumber: number; exerciseName: string; exerciseDescription: string | null; durationValue: number; durationTypeKey: string }[] };
// services/routine-share.service.ts
createShare(playerId, routineId, { expiresInDays?: number }, origin: string) → ServiceResult<RoutineShare>   // own non-system only; default 7, max 30
listShares(playerId, routineId) → ServiceResult<RoutineShare[]>
revokeShare(playerId, routineId, shareId) → ServiceResult<null>
previewShare(playerId, code) → ServiceResult<RoutineSharePreview>   // NOT_FOUND uniformly
acceptShare(playerId, code) → ServiceResult<{ routine: RoutineExecution; created: boolean }>
```

- [ ] **Step 1: Failing module tests** (`share-code.module.test.ts`): length 10; only alphabet chars; a stubbed `random` returning fixed bytes yields a deterministic code; two calls with real crypto differ; `isShareCode` rejects lowercase/`I`/length 9; `maskShareCode("ABCDEFGHJK") === "ABC…"`.

- [ ] **Step 2: Implement**

```ts
const BYTES_PER_CHAR = 1;

function webCryptoBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/** Rejection sampling over 32 symbols from bytes 0..255 keeps every symbol equiprobable. */
export function generateShareCode(random = webCryptoBytes): string {
  let out = "";
  while (out.length < SHARE_CODE_LENGTH) {
    for (const byte of random(SHARE_CODE_LENGTH * BYTES_PER_CHAR)) {
      if (byte >= 224) continue;
      out += SHARE_CODE_ALPHABET[byte % 32];
      if (out.length === SHARE_CODE_LENGTH) break;
    }
  }
  return out;
}
```

(224 = 7 × 32: bytes ≥ 224 are discarded so `% 32` is unbiased.)

- [ ] **Step 3: Failing repository tests** (`routine-share.repository.test.ts`, `renderingDb`): `findShareRows(db, ownerPlayerId, routineId)` reads `v_routine_shares` with both predicates; `findSharePreviewRows(db, code)` reads `v_routine_share_preview` by `code`; `insertShareRecord`, `revokeShareRecord(db, { shareId, routineId, ownerPlayerId })` (UPDATE `revoked_at = now` WHERE … AND `revoked_at IS NULL`, returns boolean); `findRedemption(db, shareId, recipientPlayerId)`; `insertRedemptionRecord(tx, …)`.

- [ ] **Step 4: Failing service tests** (`routine-share.service.test.ts`, mocking the repository, `getRoutine` and the Phase-1 write repository functions):

- create: foreign/unknown routine → `NOT_FOUND`; system → `VALIDATION_FAILED "system routine is read-only"`; `expiresInDays` 0 or 31 → `VALIDATION_FAILED`; success inserts with a 10-char code, `expiresAt = createdAt + 7 days`, `url = <origin>/training/routines/accept?code=<code>`; a `23505` on `uq_routine_shares_code` retries once with a new code (mock `insertShareRecord` to reject then resolve; assert two codes differ).
- preview: no rows → `NOT_FOUND { }` (no reason string that could distinguish cases); rows → grouped preview.
- accept: no rows → `NOT_FOUND`; owner accepting own code → `VALIDATION_FAILED { reason: "own routine" }`; existing redemption → `{ created: false, routine: <existing copy via getRoutine> }` and no write; success: one `withTransaction` that inserts template (new id, recipient, `isSystemTemplate: false`), steps with new ids and copied `configuration`, then the redemption; returns `{ created: true, routine }`; the `0038` bound violation → `VALIDATION_FAILED { reason: "routine duration out of bounds" }` (reuse `matchesConstraintError` if Phase 3 landed, else the Phase 1 helper).

Note: `insertRoutineStepRecords` from Phase 1 writes `configuration: null`; extend it with an optional per-step `configuration?: unknown` (default `null`) so the copy carries step overrides — add the assertion to Phase 1's repository test.

- [ ] **Step 5: Implement the service** — `createShare` reads `getRoutine`, then `insertShareRecord` inside a two-attempt loop; `acceptShare`:

```ts
export async function acceptShare(playerId: string, code: string) {
  if (!isShareCode(code)) return { ok: false, code: "NOT_FOUND", details: {} };
  const db = getDb();
  const rows = await findSharePreviewRows(db, code);
  const first = rows[0];
  if (!first) return { ok: false, code: "NOT_FOUND", details: {} };
  if (first.ownerPlayerId === playerId) {
    return { ok: false, code: "VALIDATION_FAILED", details: { reason: "own routine" } };
  }
  const existing = await findRedemption(db, first.shareId, playerId);
  if (existing?.copiedRoutineTemplateId) {
    const routine = await getRoutine(playerId, existing.copiedRoutineTemplateId);
    if (routine.ok) return { ok: true, data: { routine: routine.data, created: false } };
  }
  const durationTypeId = await findDurationTypeId(db, "MINUTES");
  …INTERNAL_ERROR guard…
  const routineId = generateId();
  try {
    await withTransaction(async (tx) => {
      await insertRoutineTemplateRecord(tx, { routineId, playerId, name: first.routineName, description: first.routineDescription });
      await insertRoutineStepRecords(tx, {
        routineId, durationTypeId,
        steps: rows.map((row) => ({ id: generateId(), exerciseTemplateId: row.exerciseTemplateId, durationValue: row.durationValue, configuration: row.stepConfiguration })),
      });
      await insertRedemptionRecord(tx, { id: generateId(), shareId: first.shareId, recipientPlayerId: playerId, copiedRoutineTemplateId: routineId });
    });
  } catch (error) {
    if (!isRoutineDurationViolation(error)) throw error;
    return { ok: false, code: "VALIDATION_FAILED", details: { reason: "routine duration out of bounds" } };
  }
  const routine = await getRoutine(playerId, routineId);
  return routine.ok ? { ok: true, data: { routine: routine.data, created: true } } : routine;
}
```

A copy of a routine whose steps are all `MINUTES` is what Phase 1 allows; if a shared routine carried a `ROUNDS` step (only system routines could, and they cannot be shared), the durationTypeId shortcut would be wrong — assert in the service that every preview row has `durationTypeKey === "MINUTES"`, else `VALIDATION_FAILED { reason: "unsupported step duration" }`.

- [ ] **Step 6: Green; commit**

```bash
cd app && npm test && cd ..
git add app/src/modules/training/routines/share-code.module.ts app/src/repositories app/src/services app/tests
git commit -m "feat(sharing): share codes, routine-share repository/service — create, list, revoke, preview, accept-as-copy"
```

---

### Task 3: API, client, UI

- [ ] **Step 1: Contracts** (`pages/api/shares/types.ts`): `CreateShareRequest = z.object({ expiresInDays: z.number().int().min(1).max(30).default(7) })`; `RoutineShareResponse`, `RoutineSharePreviewResponse`, `AcceptShareResponse = RoutineExecutionResponse` (from Phase 1 types).

- [ ] **Step 2: Routes** — `routines/[routineId]/shares/index.ts` (GET list; POST 201; `origin` from `new URL(request.url).origin`), `routines/[routineId]/shares/[shareId].ts` (DELETE → revoke → 204), `shares/[code]/index.ts` (GET preview), `shares/[code]/accept.ts` (POST → 201 when `created`, else 200; body is the `RoutineExecution`). Route tests as Phase 1 Task 5; add one asserting the code never appears in a `fail(...)` details payload (mock the service to return `NOT_FOUND` and check the JSON body has no `code` string equal to the request's).

- [ ] **Step 3: Client** `lib/client/api/shares.ts`: `createShare(routineId, body)`, `listShares(routineId)`, `revokeShare(routineId, shareId)`, `previewShare(code)`, `acceptShare(code)`. Tests.

- [ ] **Step 4: UI state**

`share-route.ts`: `shareCodeFromLocation()` (`?code=`), `acceptPath(code)`.
`share-routine.data.ts` (`shareRoutine(routineId)`): `open()` loads `listShares`; `create()` → new code on top; `copy(code)` via `navigator.clipboard.writeText` with a textarea fallback; `share(code)` via `navigator.share` when present (`canNativeShare()`); `revoke(shareId)` then reload; `expiresLabel(share)`; all errors as text. Tests: create/copy fallback when `navigator.share` is absent/revoke.
`accept-share.data.ts` (`acceptShare()`): reads the code; `previewShare` → `preview`; `NOT_FOUND` → "This link is no longer valid."; `accept()` → `acceptShare(code)` → navigate to `routineDetailPath(routine.routineId)`; `own routine` → message. Tests.

Verify the login return URL: open `/training/routines/accept?code=X` logged out; after login, confirm the browser lands back on that URL (read `app/src/lib/client/auth/client.ts` and `middleware.ts` for how the gate redirects). If it does not, the accept page shows "Sign in, then open your link again." and stores nothing — record which branch was taken in the task notes.

- [ ] **Step 5: Components and pages**

`ShareRoutineModal.astro` (on `Modal`/`ConfirmDialog` primitives per `08-Component-Inventory.md`): create button, list of codes with `redemptionCount`, `expiresLabel`, `Copy`, `Share` (native, `x-show="canNativeShare()"`), `Revoke`; copy stating "Revoking stops new copies; copies already made stay with their owners."
`RoutineDetail.astro` gains a `Share` `Button` (own routines only) toggling the modal (`x-data="shareRoutine(routine.routineId)"` on the modal wrapper).
`SharePreview.astro`: read-only routine list, "Shared by <display name>", `Add to my routines` `Button` with `loadingExpr="accepting"`.
`pages/training/routines/accept/index.astro`: prerendered shell mounting `acceptShare()`.

- [ ] **Step 6: Gates; commit**

```bash
cd app && npm test && npm run validate:app && npm run format && cd ..
bash scripts/check-astro-conventions.sh && bash scripts/check-style-tokens.sh && bash scripts/check-file-locations.sh && bash scripts/check-test-coverage.sh
git add -A app/src/pages/api/routines app/src/pages/api/shares app/src/lib/client/api app/src/lib/training/routines app/src/components/layout/training/routines app/src/pages/training/routines app/tests
git commit -m "feat(sharing): share endpoints, client, share modal and accept page"
```

---

### Task 4: Security review checkpoint (human)

Blocking before Task 5. Hand the reviewer this checklist, drawn from spec §7, and fold their notes back into the code and docs on this branch:

- [ ] Data exposed by a code: routine name/description/steps/owner display name only — confirm the preview view projects nothing else (`v_routine_share_preview` columns).
- [ ] Codes never logged in full: grep `app/src/lib/server/` and `services/routine-share.service.ts` for `code` in log calls; only `maskShareCode(code)` appears.
- [ ] Uniform `NOT_FOUND`: unknown/revoked/expired indistinguishable by status, body and timing (a single view read for all three).
- [ ] Rate limiting on `GET /api/shares/:code` and `POST …/accept`: not built; reviewer decides whether a middleware cap is required before release, and files the infrastructure issue if so.
- [ ] GDPR: player deletion cascades shares and redemptions; copies given away remain with recipients — reviewer confirms this matches the privacy notice or asks for a change.
- [ ] Identity from the JWT only; no new auth surface.

Record the reviewer's name, date and outcome in the PR description; if any item requires a code change, add it as a task step here before continuing.

---

### Task 5: Docs, decisions, gates

- `02-Template-Layer.md` (`routine_shares`), `03-Runtime-Layer.md` or the fact-table chapter the reviewer agrees on (`routine_share_redemptions`), `05-Views/00-Overview.md` (two views), `03-Migrations.md` (`## 0041…`), chain range everywhere.
- `06-API/00-Overview.md` + `04-Endpoint-Contracts.md` "Routine Sharing" section (contract, DTOs, uniform `NOT_FOUND`, accept `201`/`200`); `03-Shared-Conventions.md` untouched unless a rate-limit convention was adopted in Task 4.
- `09-Training/01-Routines.md` §19–20: "copied from a share" is an origin, not a kind.
- `07-Frontend/08-Component-Inventory.md`: `ShareRoutineModal`, `SharePreview`; `RoutineDetail` row updated.
- `DECISIONS.md` Deferred list: remove the sharing entry; add "deep copy of user-owned exercise templates, if those ever exist".
- Decisions (derive ids): `decisions/api.md` — share code over player targeting, uniform `NOT_FOUND`, copy at accept, idempotent re-accept; `decisions/database.md` — redemptions as a fact table.
- File Inventory rows; history entry; `context-maintenance`; `run-all-gates`; discovered work → issues.

```bash
git add docs decisions DECISIONS.md CLAUDE.md database/CLAUDE.md
git commit -m "docs: routine sharing — shares/redemptions, API contract, security review outcome, decisions"
```

---

## Self-review against the spec

§3 → Task 2 (accept semantics incl. own-code, idempotency, bounds); §4 → Task 1; §5 + §5.1 → Tasks 2–3 (code generation, url, expiry bounds); §5.2 → Task 4 (reviewer decision); §6 → Task 3; §7 → Task 4; §8 → Tasks 1–3; §9 → Task 5. Names consistent: `generateShareCode`, `isShareCode`, `maskShareCode`, `findSharePreviewRows`, `insertShareRecord`, `revokeShareRecord`, `findRedemption`, `insertRedemptionRecord`, `createShare`, `listShares`, `revokeShare`, `previewShare`, `acceptShare`, `shareCodeFromLocation`, `acceptPath`.
