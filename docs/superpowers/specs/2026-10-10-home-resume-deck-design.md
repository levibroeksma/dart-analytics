# Home resume deck — design

**Status:** approved in chat 2026-10-10 · **Branch:** `feat/home-resume-deck`
**Source:** Claude Design project `cdea52ee-4746-4efb-b646-81448a40c033`, `Darts Home.dc.html`, frame `home-multi` ("Multiple games in progress").
**Related:** D425 (homepage static pass), issue #815 (resume progress read), D378 (routine resume).

## Goal

Replace the static homepage `ResumeGameCard` with a reusable, data-backed
**resume deck**: one card per active **game** session (routine steps
excluded), stacked, with previous/next navigation that animates the top card
out of / into the stack.

## Constraints found

- `GET /api/sessions/active` already lists every active session but carries
  only ids, modes, `gameTypeName`, `rulesetVersionKey`, `startedAt`.
- Game turns reach the server **only at session end** (`appendBatch` from
  `playUploadAndCompleteSession` / abandon in `lib/game/play-lifecycle.ts`).
  A server fold of an ACTIVE session sees zero turns; live progress exists only
  in the client's persisted `$store.game` (one session at a time).
- `v_active_sessions` (migration 0033) exposes neither config nor routine
  membership. Routine step sessions set
  `exercise_sessions.routine_step_sequence_number`; standalone games leave it
  NULL (every session has an `activity_id`).
- Every engine module exports a pure `foldXState(facts, config[, timerExpired])`.

## Decisions

| Topic             | Decision                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Progress source   | **Hybrid.** Server returns a config-derived summary for every session; the client recomputes it from live turns for the session held in `$store.game`. |
| Routine exclusion | API flags `isRoutineStep`; the deck filters. API keeps returning routine steps so setup-page recovery is unchanged.                                    |
| Navigation        | `‹ n / N ›` pill buttons + horizontal swipe; wraps both ways.                                                                                          |
| Stack             | Back layers = `min(N − 1, 2)`. N = 1: plain card, no pill. N = 0 or fetch error: deck hidden.                                                          |
| Resume target     | The game's setup route from `GAME_CARDS` (owns Continue/Abandon via `reconcileActiveSession`).                                                         |
| Order             | Newest `startedAt` first. Sessions with no `GAME_CARDS` entry are dropped.                                                                             |

## 1. Server

### Repository join (no migration)

Revised 2026-10-10: `app/src/db/schema.ts` is off-limits in this workspace,
so the view is unchanged. `findActiveSessions` keeps reading
`v_active_sessions` and inner-joins `exercise_sessions` (for
`routine_step_sequence_number IS NOT NULL` → `isRoutineStep`) and left-joins
`exercise_configurations` (→ `configuration`). Follow-up issue: fold both
columns into `v_active_sessions` in a later migration.

### Module `app/src/modules/game/session-progress.module.ts`

Pure, isomorphic (no `@client/*`, no Alpine).

```ts
export type SessionProgress = {
  detail: string; // card subtitle, sentence case
  big: { value: string; label: string } | null;
};
export function summarizeProgress(
  rulesetKey: string,
  config: unknown, // camelCase snapshot (toSnapshot)
  facts: EngineFacts, // { stages, turns }; empty on server
): SessionProgress | null; // null: unknown ruleset / bad config
```

Per ruleset (folds via the module's `foldXState`, `timerExpired = false`):

| Ruleset                             | `detail`                                                                        | `big`                                      |
| ----------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------ |
| `501_V1`                            | `vs <opponents> · Leg N · First to X · a–b` (opponents/score only when >1 side) | remaining score of the first seat, `TO GO` |
| `121_V1`                            | `Round n of m`                                                                  | current target, `TARGET`                   |
| `CRICKET_V1`, `TACTICS_V1`          | `Solo · N objectives`                                                           | darts thrown, `DARTS`                      |
| `SCORE_TRAINING_V1`                 | `Round n of m` / `Round n` (minutes mode)                                       | total score, `POINTS`                      |
| `SINGLES_V1`, `DOUBLES_TRAINING_V1` | order-mode label (`Low → High`)                                                 | current target, `TARGET`                   |
| `BOBS27_V1`                         | `Double n of m` (doubles path length)                                           | score, `POINTS`                            |
| `TUOD_V1`                           | `Round n of m`                                                                  | current target, `TARGET`                   |
| `SHANGHAI_V1`                       | `Round n of 7`                                                                  | current target, `TARGET`                   |
| Around the Clock                    | `Lap n · 1 → 20`                                                                | current target, `TARGET`                   |

"Opponents" = seat display names other than the first PLAYER seat, joined
with `&`. Parts are joined with `joinSubtitle`. The plan pins exact
strings per ruleset against each fold's state fields; any field a fold
lacks yields a shorter `detail` or `big: null`, never a throw.

### API

`listActiveSessions` (`services/session.service.ts`) maps each row:
`isRoutineStep`, `progress = summarizeProgress(key, snapshotOf(key, configuration), EMPTY_FACTS)`.
`SessionActive` (`pages/api/sessions/types.ts`) gains
`isRoutineStep: boolean` and `progress: SessionProgress | null`. Client type
`fetchActiveSessions()` follows.

## 2. Client

### `app/src/lib/game/resume-deck.data.ts` — Alpine factory `resumeDeck()`

Registered in `register-route-data.ts`.

- **State:** `cards: ResumeCard[]`, `index`, `phase: "idle" | "out" | "in"`,
  `loading`, `failed`.
- **`init()`:** `fetchActiveSessions()` → pure `toResumeCards(sessions, local, now)`:
  drop `isRoutineStep` and sessions without a `GAME_CARDS` entry, sort newest
  first, and for the one whose `sessionId` equals `$store.game.sessionId`,
  replace `progress` with `summarizeProgress(key, store.configSnapshot, {stages, turns})`.
- **`ResumeCard`:** `{ sessionId, title, href, started, detail, big }` where
  `started = startedAgo(startedAt, now)`.
- **`next()` / `prev()`:** no-op unless `phase === "idle"` and `cards.length > 1`;
  set `phase`, swap `index` (mod N) at the animation midpoint via
  `animationend`, return to `idle`.
- **Swipe:** `pointerdown`/`pointerup` on the top card; `|dx| ≥ 40px` and
  `|dx| > |dy|` → `dx < 0 ? next() : prev()`.
- **`resume()`:** `navigate(card.href)`.
- **Getters:** `top`, `position` (`"2 / 3"`), `layers` (`min(N−1, 2)`),
  `visible` (`!failed && (loading || N > 0)`).

### `app/src/lib/utils/started-ago.ts` — `startedAgo(startedAt, now)`

`JUST NOW` (< 1 min), `N MIN AGO`, `N H AGO` (< 24 h), `YESTERDAY`, `N D AGO`.
Matches the design's `STARTED 18 MIN AGO` header (component prefixes `STARTED`).

### Homepage

`homeSnapshot()` drops `resume` / `resumeGame()` and `HomeResume` type;
`index.astro` swaps `ResumeGameCard` for `ResumeSessionDeck`;
`ResumeGameCard.astro` is deleted.

## 3. Component — `app/src/components/layout/sessions/ResumeSessionDeck.astro`

Self-contained `x-data="resumeDeck()"`, so any page can drop it in.

- Wrapper `relative pb-4` when layers > 0; back layers are absolutely
  positioned slabs (`inset-x-6 bottom-0 h-10`, `inset-x-3 bottom-2 h-10`),
  rendered with `x-show` per layer count.
- Top card: `.home-feature-card` styling per design (gradient, inner border).
  Header: `IN PROGRESS` + either `STARTED …` (N = 1) or the pill
  (`IconBtn` prev, `aria-live="polite"` position, `IconBtn` next; labels
  "Previous open game" / "Next open game").
- Body: title (Michroma 20px) + `detail`; right: `big.value` / `big.label`
  when `big` is set.
- Action: `forms/Button` "Resume game", `variant="secondary"`, glass, play icon.
- Loading: the same card with `bg-skeleton` line boxes (`min-h-lh`, `x-show`
  - `x-cloak`), no layers, no pill.
- Follows `app/src/components/CLAUDE.md`: `cn()`, `x-cloak` on every `x-show`,
  no `x-init`, semantic tokens only.

### Animation

Keyframe tokens in `app/src/styles/global.css` `@theme`:

- `--animate-deck-out` (240 ms ease-in): top card → `translateX(-110%) rotate(-6deg)`, opacity 0.
- `--animate-deck-rise` (220 ms ease-out): new top card from first-layer
  position (`translateY(8px) scale(.94)`, opacity .6) → rest.
- `--animate-deck-in` (240 ms ease-out): previous card from
  `translateX(-110%) rotate(-6deg)` → rest, over the stack.

Next = `out` then `rise`; previous = `in`. Under
`prefers-reduced-motion: reduce` all three become a 150 ms opacity fade.
Input during a running animation is ignored.

## 4. Testing

- `tests/modules/game/session-progress.module.test.ts`: each ruleset with empty
  facts and with representative facts; unknown ruleset / malformed config → `null`.
- `tests/lib/utils/started-ago.test.ts`: boundaries.
- `tests/lib/game/resume-deck.data.test.ts`: filter (routine, unknown card),
  sort, local overlay only on matching `sessionId`, wrap both ways, input
  locked while `phase !== "idle"`, swipe thresholds, `visible`/`layers`.
- `tests/lib/home/home-snapshot.data.test.ts`: updated for removed `resume`.
- Integration (`tests/integration/*.itest.ts`): `GET /api/sessions/active`
  returns `isRoutineStep` (true for a routine step session) and `progress`.
- Gates: `validate:app`, `run-all-gates`.

## 5. Docs

- `docs/architecture/07-Frontend/08-Component-Inventory.md`: add
  `ResumeSessionDeck`, remove `ResumeGameCard`.
- `decisions/frontend/style.md` (D441): resume deck, hybrid progress source;
  amends D425 for the resume card.
- Comment on #815 (partially addressed: config summary; live progress only for
  the locally held session). Capture follow-up issue: `/games`
  `ResumeSessionCard` → `ResumeSessionDeck`.

## Out of scope

- Incremental fact upload during play (needed for live progress of
  sessions not held locally).
- Routines on the deck.
- Replacing `/games` `ResumeSessionCard`.
