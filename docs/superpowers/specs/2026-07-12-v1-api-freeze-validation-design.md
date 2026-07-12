# v1 API Freeze — Final Validation & Reconciliation (Design)

> **Status:** Design (pre-freeze)
> **Date:** 2026-07-12
> **Branch:** `claude/v1-api-freeze-bjus0o` (the session-designated branch for the `v1-api-freeze` work; sits at `main`'s tip)
> **Phase:** Documentation/design only — no `app/` implementation. This is the last validation round of the `06-API/` set before frontend architecture begins.

---

## 1. Purpose

Perform the final consistency pass over the frozen-candidate API design set
(`architecture/docs/architecture/06-API/00`–`04`) and reconcile every gap found against:

1. the discussed application goals (`01-Principles.md`),
2. the database design (`05-Database/06-Spec/` reference, template, runtime, read-model layers), and
3. the endpoints the UI actually needs (`07-Frontend/00-Overview.md`).

The transport contract, envelope, auth flow, idempotency model, and engine-agnostic
write path were validated as **internally consistent and correct** in the review that
preceded this design. This spec captures only the **decisions that close the gaps** so the
v1 API surface can be frozen honestly before the frontend phase.

### Goals

- Freeze a v1 API surface where **every field the database requires has an input path** and
  **every read endpoint is view-backed** (per the "reads via views only" principle).
- Keep the v1 surface **small and honest**: multiplayer, routine execution, and statistics
  aggregation are explicitly deferred rather than half-specified.
- Leave a decision record so the freeze is auditable.

### Non-goals (this phase)

- No `app/` TypeScript. All contract changes are design-level Zod sketches / prose in the
  architecture docs.
- No new migrations, seeds, or view changes. (Deferred views like `v_statistics_overview`
  are named as future work, not authored.)
- No new endpoints beyond reconciling what is already documented; deferred features are
  marked deferred, not built.

---

## 2. Review outcome — what was validated

The following were confirmed consistent across `00`–`04`, the DB spec, the frontend doc,
and the principles, and are **frozen as-is**:

- Success/error envelope, `X-Request-Id` echo, `retryable` semantics, and the error-code
  registry (`00`/`02`/`03` agree).
- Frontend → Worker → Postgres ownership split; Worker-generated UUIDv7; `implementation_key`
  (not UUID) payloads; reads via `v_*` views; writes in a single transaction.
- Engine-agnostic `stages → turns → darts` batch write shape maps cleanly onto the runtime
  hierarchy; `stageTypeKey` / `intendedZoneKey` / `hitZoneKey` reference seeded lookup keys.
- Idempotency contract (`00`) ↔ registry (`03`) ↔ `session_write_idempotency` table
  (migration `0012`) all agree on `(session_id, idempotency_key, hash, result)`.

---

## 3. Findings & decisions

Severity: **High** = the API cannot express something the DB requires, or contradicts a
stated principle. **Low** = doc-consistency / clarity.

| # | Sev | Finding | Decision |
| - | --- | ------- | -------- |
| F1 | High | `participants` are modelled in the runtime layer and `TurnFact.participantRef` assumes they exist, but `CreateSessionRequest` has no way to declare any participant. | **D1** — v1 is single-participant; server derives the sole `PLAYER` participant. Multi-participant input deferred. |
| F2 | High | `exercise_sessions` requires `capture_mode_id` + `input_mode_id` (RESTRICT) and `v_active_sessions` exposes both, but `CreateSessionRequest` never supplies them. | **D2** — add `captureModeKey` + `inputModeKey` to `CreateSessionRequest`. |
| F3 | High | The middleware flow (`verify JWT → resolve player → 403 PLAYER_NOT_PROVISIONED`) would reject `POST /api/players/provision` itself. | **D3** — add a third route class: authenticated-but-provision-exempt. |
| F4 | High | `GET /api/statistics/overview` is sourced from "overview aggregation" with no `v_*` view, contradicting "the API consumes views — never raw tables." | **D4** — defer statistics endpoints to post-v1; when built they must be view-backed. |
| F5 | High | The DB models one activity : many sessions (for routine runs) with an `ACTIVE → COMPLETED/ABANDONED` lifecycle, but the API only ever mints a fresh activity per `POST /api/sessions`, has no `activityId` input, and no activity/routine-run write path. | **D5** — v1 is 1 activity : 1 session, activity managed server-side; multi-session activities + routine-run writes deferred. |
| F6 | Low | `v_routine_execution` is step-level, but `04` uses it for both the routine list and detail; the list needs aggregation no view defines. | **D6** — document that the list projection aggregates step rows to one summary per routine. |
| F7 | Low | `00`'s Read Contract table omits `GET /api/sessions/:sessionId` and the routine list/detail sources that `04` adds. | **D7** — reconcile the two tables. |
| F8 | Low | `GET /api/sessions/:sessionId/darts` (`v_dart_analytics`) is analytics-only by the view's definition and returns empty for recreational sessions. | **D8** — state this explicitly in the contract. |

---

## 4. Decision detail

### D1 — Single-participant v1; multiplayer deferred (closes F1)

- On `POST /api/sessions`, the server creates **exactly one** participant of type `PLAYER`
  for the authenticated player. `display_name` is copied from `players.display_name`
  (matches the runtime-layer participant constraint).
- The **creation response is extended** to return the created participant reference(s) so the
  client can populate `TurnFact.participantRef` on the subsequent batch write. In v1 there is
  exactly one, the player.
- `TurnFact.participantRef` in the batch write **must match** a participant ref returned at
  creation; an unmatched ref maps to `BATCH_REFERENCE_MISSING`.
- **Deferred (post-v1):** guest / DartBot play. Added later as an **additive, non-breaking**
  optional `participants[]` array on `CreateSessionRequest` (each `{ ref, participantTypeKey,
  displayName? }`). No existing field changes; the single-`PLAYER` default remains.

### D2 — Explicit capture & input mode on creation (closes F2)

- Add two required fields to `CreateSessionRequest`:
  - `captureModeKey` — `capture_modes.implementation_key` (`RECREATIONAL` | `ANALYTICS`)
  - `inputModeKey` — `input_modes.implementation_key` (`QUICK_SCORE` | `DETAILED_DARTS`)
- The client may default these from `player_settings`, but the **API contract requires them
  explicitly** so every session is self-describing (consistent with the runtime layer storing
  the actual modes used).
- Validated against the ruleset at creation (a ruleset may require `ANALYTICS` /
  `DETAILED_DARTS`); invalid combinations rejected via a registered error code.

```
CreateSessionRequest = {
  gameTypeKey,            // game_types.implementation_key
  rulesetVersionKey,      // ruleset_versions.implementation_key
  captureModeKey,         // capture_modes.implementation_key      (NEW)
  inputModeKey,           // input_modes.implementation_key        (NEW)
  config: { source: "template", templateRef, overrides? } | { source: "inline", config },
}
CreateSessionResponse = {
  sessionId,              // UUIDv7
  participants: [ { ref, participantTypeKey, displayName } ],   // NEW — v1: single PLAYER
}
```

### D3 — Provision-exempt route class (closes F3)

- Introduce a **third route classification** in `02-Middleware-And-Layering.md`:
  - **Public** — no JWT.
  - **Protected** — JWT verified **and** player resolved; missing player → `403 PLAYER_NOT_PROVISIONED`.
  - **Authenticated-unprovisioned** — JWT verified, **player-resolution gate skipped**. The
    only member is `POST /api/players/provision`.
- Middleware flow updated so the `PLAYER_NOT_PROVISIONED` branch does not apply to the
  provisioning route; that route is allowed to reach its handler with a valid JWT and no
  `players` row (which is exactly the state it exists to resolve).

### D4 — Defer statistics to post-v1 (closes F4)

- Move `GET /api/statistics/overview` from the v1 surface to **Deferred (post-v1)**, alongside
  the already-deferred `trends` and `checkouts`. Rationale: it has no defined backing view, and
  shipping a read endpoint sourced from ad-hoc aggregation would violate the view-backed-reads
  principle at the moment of freeze.
- **When built (post-v1):** the endpoint must be backed by a dedicated `v_statistics_overview`
  view, authored under the read-model layer. Recorded as future work, not authored now.
- Frontend consequence: the v1 statistics page renders from data the user already has (session
  history / dart analytics endpoints) or ships after the view lands. `07-Frontend/00-Overview.md`
  is updated to note statistics reads are post-v1.

> **Open decision for spec review:** this is the most debatable call, because long-term
> progression tracking is the app's headline goal. The recommendation defers only the
> *aggregated overview endpoint*, not data capture — all dart/turn/session facts are still
> stored in v1, so no history is lost and the view can be added later without a migration to
> the runtime layer. If you'd rather keep `overview` in v1, the alternative is to author
> `v_statistics_overview` now as part of this freeze (promotes F4 into a read-model-layer change).

### D5 — 1 activity : 1 session in v1; grouping deferred (closes F5)

- v1 contract: each `POST /api/sessions` creates its own activity implicitly. No `activityId`
  input; no standalone activity API.
- Activity lifecycle is **server-managed** and tracks its single session: completing the
  session via `PATCH /api/sessions/:sessionId` also transitions the parent activity to
  `COMPLETED`. Abandonment detection is a server/background concern, **out of v1 API scope**.
- **Deferred (post-v1):** multi-session activities and the **routine-run write path** (an
  endpoint that starts a routine and produces one activity containing several sessions).
  Routines stay **read-only** in v1 (`GET` only) — the read endpoints already documented are
  correct; only their *execution/write* is deferred.

### D6 — Routine list aggregation note (closes F6)

- Document in `04` that `GET /api/routines` projects the step-level `v_routine_execution` rows
  to **one summary row per routine** (distinct on routine identity) for the `RoutineSummary`
  list shape, while `GET /api/routines/:routineId` / `.../execution` return the full ordered
  step set. A dedicated `v_routine_summary` view may be introduced later if service-layer
  aggregation proves awkward; **not required for v1**.

### D7 — Reconcile the two Read Contract tables (closes F7)

- Update `00-Overview.md`'s Read Contract table to include the rows `04` already documents:
  `GET /api/sessions/:sessionId` → `v_session_overview`, and the routine list/detail sources.
  `00` and `04` must list the same read surface after this edit.

### D8 — State darts endpoint is analytics-only (closes F8)

- Document that `GET /api/sessions/:sessionId/darts` (`v_dart_analytics`) exposes **only darts
  with complete intention data** and therefore returns an **empty array for recreational
  sessions**. This is expected behaviour, not an error.

---

## 5. Deliverables (applied after this spec is approved)

All edits are minimal, dated `2026-07-12`, and keep the docs subordinate to the frozen
`00-Overview.md` authority. Version bumps reflect the reconciliation.

| File | Change |
| ---- | ------ |
| `06-API/00-Overview.md` | Route Surface: move `statistics/overview` to Deferred (D4); note single-participant creation (D1) + capture/input mode (D2). Read Contract table reconciled with `04` (D7) + darts analytics-only note (D8). Frozen Decisions: statistics scope now fully deferred. Version bump. |
| `06-API/02-Middleware-And-Layering.md` | Add the third route class + updated middleware flow for the provision-exempt route (D3). |
| `06-API/04-Endpoint-Contracts.md` | `CreateSessionRequest` gains `captureModeKey` + `inputModeKey` (D2); creation prose + response returns participant ref, single-`PLAYER` v1 rule, deferred `participants[]` note (D1); `participantRef` resolution rule on the write path (D1). Reads table: `statistics/overview` marked deferred (D4), darts analytics-only (D8), routine list aggregation note (D6). |
| `07-Frontend/00-Overview.md` | Note statistics reads are post-v1 (D4); no other change. |
| `architecture/DECISIONS.md` | One-line ledger entries for D1–D5 (feature scope decisions) dated `2026-07-12`. |
| `00-Context-Map.md` | Update the API-docs row versions/date and the "Current Implementation State" statistics line; register nothing new (no files added/removed). |

No new files under `06-API/`; no `app/` code; no migrations/seeds/views.

---

## 6. Authority & consistency

- Every change is subordinate to the frozen `00-Overview.md` and consistent with
  `01-Implementation-Strategy.md` and `02-Middleware-And-Layering.md`.
- Respects principles: config copied not referenced; ruleset owns limits; **statistics derived
  in views** (D4 upholds this by refusing a viewless stats endpoint at freeze); UUIDv7
  app-generated; runtime immutability preserved.
- Cross-checked against DB layers: D1/D2 make `CreateSessionRequest` produce every NOT-NULL /
  RESTRICT column `exercise_sessions` + `participants` require; D5 respects the
  activities-group-sessions model by deferring, not contradicting, it.
- Run `scripts/check-context-map.sh` after doc edits (mandatory context-maintenance gate).

---

## 7. Definition of done (for the edit phase that follows approval)

1. `06-API/00`, `02`, `04` and `07-Frontend/00` edited per §5 with `2026-07-12` dates.
2. `00-Overview.md` and `04-Endpoint-Contracts.md` list an identical read/write surface.
3. `CreateSessionRequest` supplies every field `exercise_sessions` requires; `participantRef`
   resolution is defined.
4. Provision route is reachable by a JWT-valid, unprovisioned user (no self-block).
5. Statistics endpoints appear only under Deferred; no viewless read remains in the v1 surface.
6. `DECISIONS.md` + `00-Context-Map.md` updated; `scripts/check-context-map.sh` passes.
7. No `app/` code, migrations, seeds, or view definitions introduced.
