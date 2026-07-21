# Score Training Flow Redesign & Results Modal

**Date:** 2026-07-17  
**Status:** Design approved  
**Scope:** Session lifecycle automation, results modal overlay, CI regression check for deprecated Neon config  
**Supersedes (Score Training UX only):** `2026-07-16-score-training-engine-design.md` results-page navigation — results become a play-page modal; batch → `PATCH COMPLETED` sequence is unchanged.

---

## Overview

The current Score Training flow requires manual session creation on the setup page, leading to errors if the user navigates to play without a session. This redesign:

1. **Automates session creation** during the setup flow, preventing the "no active session" error
2. **Shows results as a modal overlay** on the play page instead of a separate `/results` page
3. **Implements post-game actions** (Back / Play again) that are disabled until the session is fully persisted (batch + `COMPLETED`)
4. **Adds a CI check** to prevent deprecated `neonConfig.fetchConnectionCache` from re-entering the codebase

---

## Architecture: Three-Phase Flow

### Phase 1: Setup Page (`/games/score-training/setup`)

**Initial State:**
- On page mount, fetch active SCORE_TRAINING sessions and configuration presets in parallel
- Reconcile with `$store.game` via the **Shared D88 reconciliation** table below
- If no match-modal case → render preset picker immediately

**Shared D88 reconciliation** (identical on setup and play — same decision table, no page-specific variants). One shared helper, `app/src/lib/game/session-recovery.ts` (name is domain-descriptive, not tied to the `DECISIONS.md` D88 ID), called from both `.data.ts` factories so the tables cannot drift:

```ts
async function reconcileActiveSession(
  localSessionId: string | null,
  serverSessions: SessionActiveData[],
  store: GameStoreLike,
): Promise<{ action: "match" | "no_active" | "abandon_failed"; activeSession: SessionActiveData | null }>
```

| Condition | Returned `action` | Caller behavior |
| --------- | ------------------ | ---------------- |
| Server `ACTIVE` (SCORE_TRAINING) + local `sessionId` **matches** | `"match"` | Resume path (setup: Continue/Abandon modal; play: keep store, `hasActiveSession = true`). Store is untouched. |
| Server `ACTIVE` + local missing or `sessionId` **mismatch**, auto-abandon `PATCH` **succeeds** | `"no_active"` | Helper has already called `store.reset()`. Caller shows its empty state (setup: preset picker; play: "no active session" view). |
| Server `ACTIVE` + local missing or `sessionId` **mismatch**, auto-abandon `PATCH` **fails** | `"abandon_failed"` | Helper does **not** touch the store. Caller stays on a loading/error state, blocks session creation, and offers a retry that re-invokes `reconcileActiveSession`. |
| Local present, **no** matching server `ACTIVE` | `"no_active"` | Helper calls `store.reset()` (local is stale; nothing to abandon). |
| No server `ACTIVE`, local empty | `"no_active"` | No store change; caller shows its empty state. |

The helper never throws for the auto-abandon `PATCH`; it catches internally and reports `"abandon_failed"`. `"match"` is a description of the reconciliation outcome, not a UI instruction — it does **not** imply a modal on both pages: setup renders its Continue/Abandon modal on `"match"`, play resumes silently on `"match"` (no dialog). Naming this `"show_modal"` would be misleading on play, which is why the literal is `"match"`.

**Match vs mismatch (D88):** Continue/Abandon on **match** is intentional user choice for an in-progress session both sides agree on — allowed. Mismatch never shows a dialog (auto-abandon only). Do not conflate the two in UI or docs.

**Auto-abandon PATCH failure (`"abandon_failed"`):** Keep loading/error on the current page; do **not** open the preset picker / enable Play create / set `hasActiveSession` until abandon succeeds or the user explicitly retries reconciliation. Creating a new session while the orphan is still `ACTIVE` violates `uq_sessions_single_active`. A caller that silently treats `"abandon_failed"` the same as `"no_active"` (e.g. swallowing the `PATCH` error and resetting anyway) violates this spec.

After successful mismatch / stale cleanup on **setup:** show preset picker.  
After successful mismatch / stale cleanup on **play:** `hasActiveSession = false` → render the existing “no active session” view (link/CTA back to setup). Do not invent a different abandon UX on play.

**Rationale for synchronous auto-abandon:** Waiting for PATCH ensures the orphan is `ABANDONED` before the user can create a new session, preventing a create race against `uq_sessions_single_active`. UX cost is a brief loading state (100–500ms) during reconciliation.

**Continue / Abandon Modal** (setup, match case only):
- **Continue:** Close modal, navigate to play (local store already holds matching `sessionId` / `configSnapshot` / `turns`)
- **Abandon:** `PATCH /api/sessions/{sessionId}` with `{ status: "ABANDONED" }` → `store.reset()` → close modal → show preset picker

**Preset Picker:**
- User selects a preset from the list
- Clicks "Play" → `POST /api/sessions` with template-based config:
  ```
  {
    gameTypeKey: "SCORE_TRAINING",
    rulesetVersionKey: "SCORE_TRAINING_V1",
    captureModeKey: "RECREATIONAL",
    inputModeKey: "QUICK_SCORE",
    config: { source: "template", templateRef: <configurationTemplateId> }
  }
  ```
- On success: store `sessionId`, `participantRef`, `configSnapshot` (mapped from preset `configuration`) in `$store.game`
- Navigate to `/games/score-training/play`
- On error: show inline error message, don't navigate

**Setup Context State:**
```
{
  presets: ConfigurationPresetData[]
  selectedTemplateId: string
  activeSession: SessionActiveData | null
  showActiveSessionModal: boolean
  loading: boolean
  error: string
}
```

### Phase 2: Play Page (`/games/score-training/play`)

**Initialization:**
- Run the **same Shared D88 reconciliation** table as setup (`GET /api/sessions/active` vs local `sessionId`)
- Match → resume: keep store (including in-progress `turns`), set `hasActiveSession = true`, do **not** clear turns
- Mismatch / stale → auto-abandon server orphan if needed, `store.reset()`, `hasActiveSession = false`, show “no active session” view
- Setup navigation still guarantees a session when arriving from a successful create / Continue; refresh / deep-link relies on this shared D88 path

**Gameplay:**
- User enters visit scores
- `submitVisit()` records turn in store, checks completion condition
- On completion: in the **same synchronous step**, set `finished = true` **and** `completionStatus = "pending"`, then invoke the completion sequence. `completionStatus` must never be readable as `"succeeded"`-equivalent (i.e. no reliance on independently-false booleans) before the sequence has actually run — see Play Context State below.

**Results Modal (Overlay):**
- Displays computed stats from `$store.game.turns` while `completionStatus !== "succeeded"`; once `"succeeded"`, displays the component-local snapshot (see step 4 below) instead
  - Total score
  - Average per visit
  - Number of visits
- Two action buttons below: "Back" and "Play again?" — **enabled only when `completionStatus === "succeeded"`**
- Simultaneously with modal appearance: run completion sequence (below)
- On full success (`completionStatus = "succeeded"`): enable buttons, show success message
- On failure (`completionStatus = "failed"`): show `completionError` + **Retry** (completion retry); stats stay visible; Back / Play again stay disabled

**Completion sequence** (must finish before enabling buttons / Play again):
1. Mint `idempotencyKey` once if absent; **never remint** for retries of this finished game
2. Set `completionStatus = "saving"`
3. `POST /api/sessions/{sessionId}/events/batch` with `Idempotency-Key` header and `{ stages: [...] }` body
4. `PATCH /api/sessions/{sessionId}` with `{ status: "COMPLETED" }`
5. On success: copy display stats into **component-local** results fields (non-`$persist`), then clear terminal session identity from `$store.game` as needed so a refresh does not hit “local present / no ACTIVE → reset” and blank the UI — **or** keep a persisted `finished` + stats snapshot explicitly documented in the store shape. Default: component-local stats after ACK; `store.reset()`-equivalent for session fields while `finished` stays true in `.data.ts` until Back / Play again.
6. Only then set `completionStatus = "succeeded"` (enables Back / Play again). Any failure in steps 3–4 sets `completionStatus = "failed"` and `completionError` to a user-facing message instead.

Omitting step 4 (`PATCH COMPLETED`) leaves the session `ACTIVE` and blocks `uq_sessions_single_active` for Play again / new setup creates.

**Completion retry (partial failures):**
- Always retry the **full sequence** (steps 3→4: batch POST then `PATCH COMPLETED`). No separate “PATCH-only” client path.
- Reuse the **same** `idempotencyKey` and the **same** batch payload.
- Batch: same key + same hash → server returns stored success while session is still `ACTIVE` (safe after “batch OK, PATCH failed”).
- While `finished === true` / on the completion path only: treat `409 SESSION_ALREADY_COMPLETED` on **either** step as **completion success** (covers “PATCH OK, client never saw the response”). Do not apply this mapping outside the completion path (an `ABANDONED` session also returns that code).
- Do **not** mint a new key after a partial failure; a new key would risk a second write attempt against an already-persisted batch / terminal session.

**Hard-gate vs D90:** This flow **amends D90 UX for Score Training completion** — post-game navigation stays blocked until batch + `COMPLETED` ACK, instead of enqueueing to an outbox and allowing a passive “unsaved — will retry” path. A general outbox remains the canonical pattern for other games / future hardening; this feature opts into a stricter gate so Play again cannot race an unfinished terminal transition.

**Button Actions (enabled only after successful completion sequence):**
- **"Back":** `store.reset()` (clear completed session from `$persist`) → navigate to `/games`
- **"Play again?":**
  - `POST /api/sessions` with **inline** config cloned from `configSnapshot` (map camelCase store fields → API snake_case keys). Inline create is **already supported** end-to-end (`ConfigInput` discriminant, `session.service` branch, `scoreTrainingValidator.validateConfig`, unit tests) — no validator work required for this feature.
    ```
    {
      gameTypeKey: "SCORE_TRAINING",
      rulesetVersionKey: "SCORE_TRAINING_V1",
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
      config: {
        source: "inline",
        config: {
          duration_type: configSnapshot.durationType,
          duration_value: configSnapshot.durationValue,
          max_darts_per_turn: configSnapshot.maxDartsPerTurn
        }
      }
    }
    ```
  - **Play-again failure UX:** results modal **stays open**; stats remain visible; Back and Play again stay **enabled** (prior session is already `COMPLETED`); set `playAgainError` and keep a Play-again retry control. `playAgainError` is a field distinct from `completionError` / `completionStatus` — a play-again failure must never disable the buttons or trigger the completion-retry UI, since the prior session is already terminal. Do **not** mutate `$store.game` until create succeeds — no half-applied `sessionId` / cleared `turns`.
  - On success: clear `playAgainError`, replace `sessionId` / `participantRef`, reset `turns = []`, clear `idempotencyKey` / timer fields, keep `configSnapshot`, reset `completionStatus` to `"pending"` and `finished` to `false`, close modal, stay on play page (same URL, fresh game state)

**Play Context State:**
```
{
  hasActiveSession: boolean
  finished: boolean
  completionStatus: "pending" | "saving" | "succeeded" | "failed"
  completionError: string
  playAgainError: string
  engine: ScoreTrainingEngine | null
  timer: SegmentTimer | null
  visitInput: string
  error: string
}
```

`completionStatus` replaces the earlier `uploadingResults` / `uploadError` / `completionFailed` triad. A single enum removes the failure mode where independently-tracked booleans are all simultaneously falsy (e.g. right when the modal opens, before the async completion sequence has started) and read as "succeeded" by a `!uploadingResults && !uploadError` style check. Buttons must key off `completionStatus === "succeeded"` alone.

### Phase 3: Results Modal & State Persistence

**Results Data Source:**
- Computed locally from `$store.game.turns` (no API fetch needed)
- Completion upload runs when the modal appears; stats remain visible from the store even while upload is in flight
- If upload fails, user can still see results but cannot proceed until retry succeeds

**State Persistence:**
- `$store.game` persists to localStorage via `@alpinejs/persist`
- Closing browser mid-game: user can return and resume (store still populated, including `turns`)
- Play page init uses Shared D88 reconciliation (same table as setup)

---

## Alpine State Management

**`$store.game` (persisted):**
| Field | Type | Set By | Used By | Persists |
|-------|------|--------|---------|----------|
| `sessionId` | string \| null | setup POST → play init | play submissions, upload | Yes |
| `participantRef` | string \| null | setup POST | batch upload | Yes |
| `gameTypeKey` | string | setup | — | Yes |
| `configSnapshot` | GameConfigSnapshot | setup POST | play display, play-again | Yes |
| `turns` | RecordedTurn[] | play recordTurn() | display, upload, stats | Yes |
| `timerRemainingMs` | number \| null | play timer tick | display | Yes |
| `idempotencyKey` | string \| null | play upload start | `Idempotency-Key` header | Yes |

**State Lifecycle:**

| Step | Action | sessionId | turns | configSnapshot |
|------|--------|-----------|-------|----------------|
| Setup init (no active / after D88 auto-abandon) | Fetch presets | null / cleared | [] | null |
| Setup match modal | User clicks Continue | populated (unchanged) | as stored (may be mid-game) | populated |
| Setup create session | POST succeeds | populated | [] | populated |
| Play init | Resume / continue | (unchanged) | **(unchanged — keep for resume)** | (unchanged) |
| Play gameplay | recordTurn() | (unchanged) | grows | (unchanged) |
| Play complete | Results modal shows | (unchanged) | full | (unchanged) |
| Completion succeeds | User clicks Play again? | new ID | reset [] | same |
| User clicks Back | `store.reset()` then navigate | null | [] | null |

---

## API Contract

Shapes match `docs/architecture/06-API/04-Endpoint-Contracts.md`. Success payloads are the envelope `data` value (arrays are bare arrays, not wrapped objects).

### Setup Page Endpoints

**GET `/api/sessions/active`**
- Fetches all active sessions for authenticated player
- Response `data`: `SessionActiveData[]`
- Error handling: show toast, allow preset picker to load as fallback

**GET `/api/configuration-templates?gameType=SCORE_TRAINING`**
- Fetches available presets for Score Training
- Response `data`: `ConfigurationPreset[]`
- Error handling: show toast, disable preset picker

**POST `/api/sessions`**
- Creates a new session; `config` is a discriminated union (`source: "template" | "inline"`)
- Body: `{ gameTypeKey, rulesetVersionKey, captureModeKey, inputModeKey, config: ConfigInput }`
- Response `data`: `{ sessionId, participants: [{ ref, displayName, participantTypeKey }] }`
- Error handling: show error in setup, don't navigate

**PATCH `/api/sessions/{sessionId}`**
- Updates session status (`ABANDONED` on setup abandon; `COMPLETED` after successful batch on play)
- Body: `{ status: "ABANDONED" | "COMPLETED" }`
- Error handling: show error in modal, allow retry

### Play Page Endpoints

**POST `/api/sessions/{sessionId}/events/batch`**
- Uploads completed turns as a batch
- Header: `Idempotency-Key: <store.idempotencyKey>` (mint once at completion; reuse on retry)
- Body: `{ stages: [...] }` (`buildEventsBatch` / `EventsBatchRequest` shape)
- Response `data`: `{ created: { stages: number, turns: number, darts: number } }`
- Error handling: show error in results modal, keep buttons disabled until retry of the full completion sequence succeeds (same `idempotencyKey`; `SESSION_ALREADY_COMPLETED` → treat as success)

**PATCH `/api/sessions/{sessionId}`** (completion)
- After successful batch: `{ status: "COMPLETED" }`
- Required before enabling Back / Play again

---

## Issue 1: CI Check for `fetchConnectionCache`

**Problem:** `neonConfig.fetchConnectionCache` is a deprecated Neon API option. It is **already removed** from `app/src/db/client.ts`, and `app/src/db/CLAUDE.md` already forbids it. Remaining work is a regression guard.

**Solution:** Add CI check to `.github/workflows/checks.yml` (not a local pre-commit hook)

```yaml
- name: Check for deprecated neonConfig.fetchConnectionCache
  run: |
    if grep -r "fetchConnectionCache" app/src --include="*.ts" --include="*.js"; then
      echo "❌ Error: fetchConnectionCache is deprecated and must not be used"
      exit 1
    fi
```

**Why CI-only, not local git hook:**
- No developer setup friction
- Enforced on all PRs (including forks)
- Already runs on every PR via checks workflow

**Documentation:**
- No new forbid-rule text required in `app/src/db/CLAUDE.md` (already present). CI is the enforcement addition.
- If `checks.yml` gains the grep step, mention it once in `app/src/db/CLAUDE.md` or `app/CLAUDE.md` as “enforced by CI” so agents know the rule is mechanically checked — optional one-liner, not a new rule.

---

## Documentation & rule enforcement (required deliverable)

This redesign **amends** published recovery/completion UX. Leaving canonical docs on the old wording would make Context Maintenance fail and cause agents to reintroduce outbox-only / results-page behavior. Implementation is incomplete until the following land in the **same change** (root `CLAUDE.md` Context Maintenance):

| Artifact | Update |
| -------- | ------ |
| `DECISIONS.md` | New row: Score Training completion hard-gate (block Back / Play again until batch + `COMPLETED` ACK; amends D90 UX for this game). Note supersession of D112 results-via-query-params / dedicated results page for this flow. |
| `07-Frontend/03-Alpine-Patterns.md` | Recovery: shared D88 table (match Continue/Abandon vs mismatch auto-abandon); Completed-Batch Outbox: Score Training may use synchronous hard-gate instead of outbox enqueue for v1 play completion. |
| `07-Frontend/00-Overview.md` | Align completion/recovery paragraphs with hard-gate + match-modal clarification; drop implication that Score Training always navigates to a results page. |
| `07-Frontend/10-Frontend-Agent-Guide.md` §Recovery | State hard-gate exception + “no manual abandon on **mismatch**” (match modal still allowed). |
| `05-Database/06-Spec/05-Read-Model-Layer.md` (`v_active_sessions`) | Replace stale “offer resume or abandon” with D88: resume when local matches; else auto-abandon (no prompt). |
| Route / results | Remove or redirect `/games/score-training/results` usage from app code; if the route file is deleted, no context-map row is required (pages are not inventoried there). Update any agent/plan references only if touched. |
| Context checkers | `scripts/check-context-map.sh`, `check-file-locations.sh`, `check-agent-mirrors.sh` must pass; refresh `graphify-out/graph.json` when code/docs change. |

**Authority:** Spec + implementation must not contradict higher docs after those edits. Until `DECISIONS.md` / Alpine handbook are updated, treat this spec as the task authority for Score Training only; do not silently generalize the hard-gate to other games.

---

## Error Handling & Edge Cases

**Setup Page Errors:**
- Active session fetch fails → show toast, show preset picker (graceful degradation)
- Presets fetch fails → show toast, disable picker
- Session creation fails → show inline error, stay on setup, allow retry
- User Abandon `PATCH` fails → show error in modal, allow retry
- D88 auto-abandon `PATCH` fails → block create / stay in loading+retry; do not show preset picker as if clear

**Play Page Errors:**
- Batch or `COMPLETED` `PATCH` fails → show error in modal, keep Back / Play again disabled, Retry re-runs full completion sequence with the same `idempotencyKey`; on completion path only, treat `SESSION_ALREADY_COMPLETED` as success
- D88 auto-abandon `PATCH` fails → stay on play loading/error; do not flip to “no active session” as if cleaned
- "Play again" session creation fails → modal stays open with results visible; Back / Play again remain enabled; inline error + retry; store unchanged until create succeeds

**Edge Case: User navigates back during active-session modal**
- If user leaves setup and returns: re-fetch + shared D88 reconcile, show fresh state

**Edge Case: Browser closed mid-game**
- Store persists locally → user returns → play page shared D88 path; match resumes `turns`, mismatch auto-abandons + “no active session”

**Edge Case: Browser closed after completion ACK, before Back**
- Server session is `COMPLETED` (not in `active`). Local must not rely on stale `sessionId` alone for the results UI — use component-local (or explicit finished snapshot) stats per completion step 5. Refresh may show results if `finished` snapshot remains, or “no active session” if only session fields were cleared; either is acceptable if documented in implementation, but must not re-`PATCH` abandon a completed session.

**Edge Case: User clicks "Play again?" but closes browser before new session initializes**
- Store must not mutate until create succeeds, so refresh still shows completed-results state or setup — not a half-new session

---

## Success Criteria

✅ No manual session creation on setup page  
✅ No "no active session" error on play page after setup create / Continue  
✅ Results display as modal overlay (same URL; supersedes dedicated results page for this flow)  
✅ Post-game buttons disabled until batch + `COMPLETED` succeed  
✅ "Play again?" creates new session without revisiting setup (only after prior session is `COMPLETED`)  
✅ CI check prevents `fetchConnectionCache` regressions  
✅ Continue/Abandon modal only when local + server `sessionId` match; mismatches auto-abandon on **both** setup and play (shared D88 table)  
✅ Play mismatch → “no active session” view (same cleanup as setup, different surface)  
✅ Completion retry: full sequence, same Idempotency-Key; `SESSION_ALREADY_COMPLETED` counts as success  
✅ Play-again failure keeps results modal + enabled Back / Play again; no half-applied store  
✅ Play again uses existing inline `POST /api/sessions` support (no new validator work)  
✅ Canonical docs updated (DECISIONS + Alpine recovery/outbox + agent guide + `v_active_sessions` blurb) so D90 hard-gate / D88 match-vs-mismatch are enforceable  
✅ Shared D88 helper (or equivalent single implementation) used by setup and play  

---

## Testing Strategy

**Manual Testing:**
1. Setup → Preset picker → Play → Results modal → Back to /games (store cleared)
2. Setup → Preset picker → Play → Results modal → Play again → New game
3. Setup → match modal → Continue → Play existing (including mid-game `turns`)
4. Setup → match modal → Abandon → Preset picker
5. Setup → server ACTIVE + empty/mismatched local → auto-abandon, no modal
6. Play → mismatch / stale local → auto-abandon if needed, “no active session” view
7. Auto-abandon PATCH failure → create blocked until retry succeeds
8. Results: batch OK then COMPLETED fails → Retry (same key) completes; also cover COMPLETED-already (`SESSION_ALREADY_COMPLETED` → buttons enable)
9. Play again fails → modal stays, results visible, Back still works, retry create
10. Browser refresh mid-game → Resume from store (`turns` retained)
11. Browser refresh after completion ACK → no erroneous abandon of completed session; results or no-active per step 4

**Unit Tests:**
- `scoreTrainingSetup.data.test.ts`: match Continue/Abandon; mismatch auto-abandon; template create body; abandon failure blocks picker
- `scoreTrainingPlay.data.test.ts`: shared D88 mismatch → no-active view; completion = batch + PATCH; partial-failure retry + completion-path `SESSION_ALREADY_COMPLETED` success; play-again inline create without mutating store on failure; Back resets store
- Shared recovery helper tests if extracted
- Store reset/initialization with various initial states

**Integration Tests:**
- Setup → play navigation with session handoff
- Results upload idempotency (same idempotency key, retry succeeds)
- Play again blocked until prior session is terminal
- Setup and play D88 produce the same abandon/reset outcomes for identical inputs

**Docs / context gate:**
- `scripts/check-context-map.sh`, `check-file-locations.sh`, `check-agent-mirrors.sh` pass
- `DECISIONS.md` + frontend recovery docs updated as in Documentation & rule enforcement

---

## Non-Negotiables

- Session creation must complete before setup navigates to play (prevents race conditions)
- Results buttons remain disabled until **batch + `PATCH COMPLETED`** succeed (keeps single-active invariant; Score Training hard-gate amendment to D90 UX)
- Continue/Abandon modal only on **sessionId match**; mismatches use shared D88 auto-abandon (no prompt) on setup **and** play
- Auto-abandon must succeed before allowing a new session create
- Active session modal is overlay, not page-level conditional (prevents loop risk on setup re-render)
- Store persists across page reloads for mid-game resume; **Back clears** completed state via `store.reset()`
- All session status changes use **`PATCH`**, never PUT/POST-to-status
- Completion retries reuse one `idempotencyKey`; never remint for the same finished game
- Play-again create uses `source: "inline"` (already supported by API + Score Training validator)
- Same change updates canonical docs / DECISIONS so agents do not re-apply pre-amendment D90/D88 wording
