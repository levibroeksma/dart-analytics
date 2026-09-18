<!--
status: design
scope: Phase 4 of the configurable-training-routines roadmap — copy-on-share of a player's own routine through a server-generated share code redeemed at accept time
read-when: writing or executing the Phase 4 implementation plan; extends docs/superpowers/specs/2026-09-17-configurable-training-routines-roadmap-design.md §6 and §8
updated: 2026-09-18
-->

# Routine Sharing (Phase 4) — Design

> Drafted without an interactive brainstorm (autonomous session).
> **[decide]** marks judgement calls. Depends on Phase 1. Independent of
> Phases 2 and 3. Sharing crosses a player boundary, so the security notes
> in §7 need human validation before planning.

## 1. Problem

A routine a player built is theirs alone. The roadmap fixed the semantics
(copy, never link) and left recipient identification open; D321 decides it:
a share code.

Why a code and not a player target: `players.display_name` is not unique
(`0003`), the app has no player directory or friends model, and building
one for this feature would be the "generic abstraction before a
requirement" `04-Architecture-patterns.md` warns against.

## 2. Scope

**In:** create a share code for an own routine; revoke it; a recipient
previews and accepts, receiving an independent copy; the owner sees how
many times a code was redeemed.

**Out:** sharing system routines (already visible to all), sharing
schedules, live-linked routines, public galleries, anything that lists
other players.

## 3. Semantics

- **Copy at accept time.** The copy reflects the routine as it is when the
  recipient accepts, not when the code was made. A share of a routine the
  owner has since edited copies the edited routine. **[decide: acceptable, or
  snapshot the steps into the share row at creation]**
- **Independent thereafter.** New UUIDs for the template and every step,
  `player_id` = recipient, `is_system_template = FALSE`, `configuration`
  copied verbatim, same `exercise_template_id`s (all system content today;
  if user-owned exercise templates ever exist, the copy must deepen — noted
  in the Deferred list).
- **Bounds re-apply.** The copy is a user routine; the Phase 1 trigger
  checks it at commit. A routine that has become invalid (a template it
  used lost its defaults) fails the accept with `VALIDATION_FAILED`, never
  half-copies.
- **Own code, own routine:** the owner accepting their own code is rejected
  (`VALIDATION_FAILED`, `reason: "own routine"`); duplicating one's own
  routine is a Phase 1 "save as" feature if wanted, not a share.
- **Name:** the copy keeps the original name. No suffix, no uniqueness
  (Phase 1 §9).

## 4. Database — migration `0042_routine_shares.sql` (number follows the chain at the time)

```sql
CREATE TABLE routine_shares (
    id                    UUID PRIMARY KEY,                 -- UUIDv7
    routine_template_id   UUID NOT NULL,
    owner_player_id       UUID NOT NULL,
    code                  TEXT NOT NULL,                    -- server-generated, see §5.1
    expires_at            TIMESTAMPTZ NOT NULL,
    revoked_at            TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_routine_shares_routine_template FOREIGN KEY (routine_template_id) REFERENCES routine_templates(id) ON DELETE CASCADE,
    CONSTRAINT fk_routine_shares_owner_player     FOREIGN KEY (owner_player_id)     REFERENCES players(id)           ON DELETE CASCADE,
    CONSTRAINT uq_routine_shares_code UNIQUE (code),
    CONSTRAINT chk_routine_shares_expires_after_created CHECK (expires_at > created_at)
);

CREATE TABLE routine_share_redemptions (                    -- a fact: what happened
    id                          UUID PRIMARY KEY,
    routine_share_id            UUID NOT NULL,
    recipient_player_id         UUID NOT NULL,
    copied_routine_template_id  UUID,                        -- SET NULL if the recipient later deletes the copy
    redeemed_at                 TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_routine_share_redemptions_routine_share            FOREIGN KEY (routine_share_id)           REFERENCES routine_shares(id)    ON DELETE CASCADE,
    CONSTRAINT fk_routine_share_redemptions_recipient_player         FOREIGN KEY (recipient_player_id)        REFERENCES players(id)           ON DELETE CASCADE,
    CONSTRAINT fk_routine_share_redemptions_copied_routine_template  FOREIGN KEY (copied_routine_template_id) REFERENCES routine_templates(id) ON DELETE SET NULL,
    CONSTRAINT uq_routine_share_redemptions_routine_share_recipient_player UNIQUE (routine_share_id, recipient_player_id)
);
```

- `routine_shares` is Template-layer (mutable: revocable). The redemption
  table is a fact table: append-only in practice, nothing updates it but the
  `SET NULL`. Store what happened; "redeemed N times" is derived.
- A share of a *system* routine is unrepresentable by service rule
  (`owner_player_id` must equal the routine's `player_id`); a `CHECK`
  cannot see the other table, so a verification query asserts it.
- `uq_…_recipient_player` makes a repeat accept by the same player a
  no-op (`409`-class → the service returns the existing copy's
  `RoutineExecution` **[decide: return existing vs. reject]**).
- Views: `v_routine_shares` (owner-facing: code, expiry, revoked,
  `redemption_count`), `v_routine_share_preview` (code → routine name,
  description, steps, owner `display_name`, `expires_at`; filtered to
  unrevoked, unexpired).

## 5. API

| Endpoint | Body / Response | Notes |
| --- | --- | --- |
| `POST /api/routines/:routineId/shares` | `{ expiresInDays?: 1..30 }` → `201 { shareId, code, url, expiresAt }` | own, non-system routine only |
| `GET /api/routines/:routineId/shares` | `RoutineShare[]` | own; includes revoked/expired with state |
| `DELETE /api/routines/:routineId/shares/:shareId` | `204` | sets `revoked_at`; never deletes (the redemption facts hang off it) |
| `GET /api/shares/:code` | `RoutineSharePreview` | authenticated; unknown, revoked or expired → `NOT_FOUND` (one answer for all three — no oracle) |
| `POST /api/shares/:code/accept` | → `201 RoutineExecution` (the copy) | one transaction: preview read → insert template + steps → insert redemption |

### 5.1 Code

Server-generated with `crypto.getRandomValues`, 10 characters from the
Crockford base32 alphabet (no `I L O U`), ≈50 bits. Uniqueness by the unique
constraint with one retry on collision. Default expiry 7 days, max 30.
The `url` is `<origin>/training/routines/accept?code=<code>`. The code is a
bearer secret: whoever holds it can copy the routine and see the owner's
display name — this is the intended product behaviour, and §7 lists what
follows from it.

### 5.2 Rate limits **[decide — needs infrastructure validation]**

`GET /api/shares/:code` is a guessable-input endpoint. 50 bits and a
7-day window make enumeration impractical, but a per-player request cap
on that route (the middleware layer, `06-API/02-Middleware-And-Layering.md`)
is cheap insurance. No mechanism exists today; adding one is a decision
for an infrastructure reviewer, not this spec.

## 6. Frontend

| Route / component | Content |
| --- | --- |
| Detail page (Phase 1), own routines | `Share` `IconBtn` → `ShareRoutineModal.astro`: creates a code, shows it with a copy button and `navigator.share` where available, lists existing codes with redemption count and `Revoke` |
| `/training/routines/accept?code=<code>` | prerendered shell; reads the code, calls the preview, renders `RoutineDetail.astro` read-only with "Shared by <display name>" and an `Add to my routines` CTA; on accept navigates to the copy's detail route |
| Unauthenticated visitor | the existing auth gate applies (`07-Frontend/01-Rendering-Strategy.md` D97 model): redirected to login; the accept route re-reads `code` from the URL on return, so no state is stored client-side **[decide: verify the login flow preserves the return URL]** |

## 7. Security, privacy and compliance notes (human validation required)

- **Data exposed by a code:** routine name, description, steps, owner
  display name. No email, no auth id, no statistics. Display name is
  already visible to guests in shared-session play; this widens it to
  anyone with the code. The owner opts in per routine by creating a code.
- **Revocation is immediate** for future previews/accepts; copies already
  made are the recipient's. Say so in the modal.
- **Logging:** `requestId` and player ids are logged as for every route;
  codes must not be logged in full (mask to the first 3 characters) —
  a rule for the plan, to check in `server/` logging.
- **GDPR:** a player deletion cascades their shares and redemptions
  (`ON DELETE CASCADE` on both player FKs); copies they *received* are
  their own routines and go with them; copies they *gave* stay with the
  recipient, as any copied text would. Confirm with whoever owns the
  privacy notice.
- **No new authentication mechanism:** identity from the JWT, as every
  player-scoped write (D306).

## 8. Tests

| File | Asserts |
| --- | --- |
| `tests/services/routine-share.service.test.ts` | own/non-system only; code format and length; revoke sets timestamp; preview hides revoked/expired uniformly; accept copies steps and config with new ids in one transaction; own-code rejected; repeat accept idempotent; expiry bounds |
| `tests/pages/api/shares.test.ts` | codes/envelopes; `NOT_FOUND` uniformity |
| `tests/lib/training/routines/share-routine.data.test.ts` | modal state; clipboard fallback when `navigator.share` is absent |
| verification SQL | expiry `CHECK`; unique code; unique redemption; no share on a system routine |

## 9. Documentation and decisions owed

- `02-Template-Layer.md` (shares), `05-Views/00-Overview.md`, and a fact
  table section for redemptions under the runtime/read-model chapter that
  fits (**[decide]** — it is a fact but not gameplay).
- `06-API/00-Overview.md`, `04-Endpoint-Contracts.md`, `03-Shared-Conventions.md`
  only if a rate-limit convention is adopted.
- `09-Training/01-Routines.md` §19–20: ownership and origin now include
  "copied from a share" as origin, still not a separate routine kind.
- `DECISIONS.md` Deferred list: remove the sharing entry; add "deep copy of
  user-owned exercise templates, if those ever exist".
- Decisions: share code over player targeting; copy at accept time;
  redemptions as facts; uniform `NOT_FOUND`.

## 10. Plan seeds

1. Migration + views + verification.
2. Service/repository/API (TDD), code generation, transaction.
3. Share modal on the detail page; accept route.
4. Security review of §7 with the reviewer's notes folded into the plan.
5. Docs, decisions, gates.
