# Score Training Flow Redesign & Results Modal

**Date:** 2026-07-17  
**Status:** Design approved  
**Scope:** Session lifecycle automation, results modal overlay, pre-commit hook for deprecated Neon config

---

## Overview

The current Score Training flow requires manual session creation on the setup page, leading to errors if the user navigates to play without a session. This redesign:

1. **Automates session creation** during the setup flow, preventing the "no active session" error
2. **Shows results as a modal overlay** on the play page instead of a separate page
3. **Implements post-game actions** (Back / Play again) that are disabled until results are successfully saved
4. **Adds a CI check** to prevent deprecated `neonConfig.fetchConnectionCache` from re-entering the codebase

---

## Architecture: Three-Phase Flow

### Phase 1: Setup Page (`/games/score-training/setup`)

**Initial State:**
- On page mount, fetch active SCORE_TRAINING sessions and configuration presets in parallel
- If active session exists → render modal overlay asking "Continue or Abandon?"
- If no active session → render preset picker immediately

**Active Session Modal:**
- **Continue:** Close modal, navigate to play page (session already in Alpine state)
- **Abandon:** POST to `/api/sessions/{sessionId}` with status `ABANDONED` → close modal → show preset picker

**Preset Picker:**
- User selects a preset from the list
- Clicks "Play" → POST to `/api/sessions` with config from selected preset
- On success: store `sessionId`, `participantRef`, `configSnapshot` in `$store.game`
- Navigate to `/games/score-training/play`
- On error: show inline error message, don't navigate

**Setup Context State:**
```
{
  presets: ConfigurationPresetData[]
  selectedTemplateId: string
  activeSession: ActiveSessionData | null
  showActiveSessionModal: boolean
  loading: boolean
  error: string
}
```

### Phase 2: Play Page (`/games/score-training/play`)

**Initialization:**
- Page assumes session exists (setup guarantees it via navigation contract)
- `$store.game` contains sessionId, config, and empty turns array

**Gameplay:**
- User enters visit scores
- `submitVisit()` records turn in store, checks completion condition
- On completion: set `finished = true` → results modal appears

**Results Modal (Overlay):**
- Displays computed stats from `$store.game.turns`:
  - Total score
  - Average per visit
  - Number of visits
- Two action buttons below: "Back" and "Play again?" — **both disabled initially**
- Simultaneously with modal appearance: POST game data to `/api/sessions/{sessionId}/events/batch`
- On successful 200 response: enable buttons, show success message
- On POST failure: show error message, keep buttons disabled, show "Retry" option

**Button Actions (enabled only after successful save):**
- **"Back":** Navigate to `/games`
- **"Play again?":** 
  - POST to `/api/sessions` with same `configSnapshot` (clone)
  - On success: create new sessionId in store, reset `turns = []`
  - Close modal, stay on play page (same URL, fresh game state)

**Play Context State:**
```
{
  hasActiveSession: boolean
  finished: boolean
  uploadingResults: boolean
  uploadError: string
  engine: ScoreTrainingEngine | null
  timer: SegmentTimer | null
  visitInput: string
  error: string
  completionFailed: boolean
}
```

### Phase 3: Results Modal & State Persistence

**Results Data Source:**
- Computed locally from `$store.game.turns` (no API fetch needed)
- Upload happens asynchronously via POST; modal doesn't wait
- If upload fails, user can still see results but cannot proceed until retry succeeds

**State Persistence:**
- `$store.game` persists to localStorage via `@alpinejs/persist`
- Closing browser mid-game: user can return and resume (store still populated)
- Play page init validates stored sessionId against DB (existing D88 auto-cleanup)

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
| `idempotencyKey` | string \| null | play upload start | batch upload idempotency | Yes |

**State Lifecycle:**

| Step | Action | sessionId | turns | configSnapshot |
|------|--------|-----------|-------|-----------------|
| Setup init | Fetch active/presets | null | [] | null |
| Setup active-session modal | User clicks Continue | populated | [] | populated |
| Setup create session | POST succeeds | populated | [] | populated |
| Play init | Load existing | (unchanged) | [] | (unchanged) |
| Play gameplay | recordTurn() | (unchanged) | grows | (unchanged) |
| Play complete | Results modal shows | (unchanged) | full | (unchanged) |
| Upload succeeds | User clicks Play again? | new ID | reset [] | same |
| User clicks Back | Navigate | (stays in store) | (stays) | (stays) |

---

## API Contract

### Setup Page Endpoints

**GET `/api/sessions/active`**
- Fetches all active sessions for authenticated player
- Response: `{ sessions: ActiveSessionData[] }`
- Error handling: show toast, allow preset picker to load as fallback

**GET `/api/configuration-templates?gameTypeKey=SCORE_TRAINING`**
- Fetches available presets for Score Training
- Response: `{ presets: ConfigurationPresetData[] }`
- Error handling: show toast, disable preset picker

**POST `/api/sessions`**
- Creates a new session with specified config template
- Body: `{ gameTypeKey, rulesetVersionKey, captureModeKey, inputModeKey, config }`
- Response: `{ sessionId, participants: [{ ref, displayName, participantTypeKey }] }`
- Error handling: show error in setup, don't navigate

**PUT `/api/sessions/{sessionId}`**
- Updates session status (used to mark as ABANDONED)
- Body: `{ status: "ABANDONED" }`
- Error handling: show error in modal, allow retry

### Play Page Endpoints

**POST `/api/sessions/{sessionId}/events/batch`**
- Uploads completed turns as a batch
- Body: `{ stages: [...] }` (ScoreTrainingEngine payload format)
- Response: `{ created: number }`
- Error handling: show error in results modal, keep buttons disabled until retry succeeds

---

## Issue 1: Pre-commit Hook for `fetchConnectionCache`

**Problem:** `neonConfig.fetchConnectionCache = true` in `app/src/db/client.ts` uses a deprecated Neon API option that no longer exists in newer versions.

**Solution:** Add CI check to `.github/workflows/checks.yml`

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
- Update `app/src/db/CLAUDE.md` rule: "You MUST NEVER use deprecated `neonConfig.fetchConnectionCache = true`"

---

## Error Handling & Edge Cases

**Setup Page Errors:**
- Active session fetch fails → show toast, show preset picker (graceful degradation)
- Presets fetch fails → show toast, disable picker
- Session creation fails → show inline error, stay on setup, allow retry

**Play Page Errors:**
- Results upload fails → show error in modal, keep buttons disabled
- "Play again" session creation fails → show error, stay on modal, allow retry

**Edge Case: User navigates back during active-session modal**
- If user leaves setup and returns: modal re-fetches, shows fresh state

**Edge Case: Browser closed mid-game**
- Store persists locally → user returns → play page validates sessionId against DB (D88 auto-cleanup)

**Edge Case: User clicks "Play again?" but closes browser before new session initializes**
- Store has partial state (new sessionId set, old turns still present)
- On return: play page init validates sessionId, proceeds normally

---

## Success Criteria

✅ No manual session creation on setup page  
✅ No "no active session" error on play page  
✅ Results display as modal overlay (same URL)  
✅ Post-game buttons disabled until save succeeds  
✅ "Play again?" creates new session without revisiting setup  
✅ Deprecated Neon config check prevents regressions  
✅ Active session flow shows Continue/Abandon, not preset picker  

---

## Testing Strategy

**Manual Testing:**
1. Setup → Preset picker → Play → Results modal → Back to /games
2. Setup → Preset picker → Play → Results modal → Play again → New game
3. Setup → Active session modal → Continue → Play existing
4. Setup → Active session modal → Abandon → Preset picker
5. Results upload failure → Retry button works
6. Browser refresh mid-game → Resume from store

**Unit Tests:**
- `scoreTrainingSetup.data.test.ts`: active session detection, continue/abandon flows
- `scoreTrainingPlay.data.test.ts`: results computation, play-again session creation
- Store reset/initialization with various initial states

**Integration Tests:**
- Setup → play navigation with session handoff
- Results upload idempotency (same idempotency key, retry succeeds)

---

## Non-Negotiables

- Session creation must complete before setup navigates to play (prevents race conditions)
- Results buttons must remain disabled until POST succeeds (prevents orphaned data)
- Active session modal is overlay, not page-level conditional (prevents loop risk on setup re-render)
- Store persists across page reloads (durability for mid-game resume)
