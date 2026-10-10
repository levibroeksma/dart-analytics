# Home Resume Deck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static homepage resume card with a reusable, data-backed stacked deck of every active game session (routine steps excluded), with animated prev/next.

**Architecture:** `v_active_sessions` gains `is_routine_step` + `configuration`; a pure isomorphic `summarizeProgress()` (modules/game) produces each card's detail/big number from config (+ live turns on the client for the locally held session). An Alpine factory `resumeDeck()` owns fetch, filtering, overlay, navigation and animation phase; `ResumeSessionDeck.astro` renders it using two new generic UI primitives (`CardStack`, `DeckPager`).

**Tech Stack:** Astro 7, Alpine.js 3, Tailwind v4 tokens, Drizzle, Postgres (dbmate), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-10-home-resume-deck-design.md`

## Global Constraints

- Work in `app/` unless stated; run commands from `app/`.
- Read `app/CLAUDE.md`, `app/src/components/CLAUDE.md`, `app/tests/CLAUDE.md` before coding.
- Exported types live in the domain `types.ts` and are re-exported from the barrel (`@lib/types`, `@modules/types`); no inline exported types (gate `check-type-barrels`).
- No inline `//` comments inside function bodies; JSDoc on exported symbols.
- Astro: `cn()` for classes, every `x-show` has `x-cloak`, no `x-init`, no `x-bind:`, no template HTML comments, semantic tokens only, no `!` important modifier.
- Every changed runtime `.ts` ships with a changed test (D224).
- `app/src/db/schema.ts` is regenerated, not hand-read: use `npm run db:introspect` (reading it may be denied).
- Card copy is sentence case (`vs Dartbot · Leg 3 · First to 3 · 2–0`); mono labels uppercase (`TO GO`, `POINTS`, `TARGET`, `DARTS`, `STARTED 18 MIN AGO`).
- Resume always navigates to the game card's setup route (`GAME_CARDS[].href`).
- Commit after every task, message `feat(home): …` / `feat(db): …`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Malformed / legacy config snapshot** (pre-dating a field, or `null` configuration): `summarizeProgress` must return `null` or a shorter detail, never throw; the API must not 500. → Task 2 test "malformed config", Task 3 test "null configuration".
2. **Local store holds a session that is no longer active** (or another player's stale store): overlay applies only on exact `sessionId` match. → Task 5 test "stale store ignored".
3. **Rapid double-tap / swipe during animation:** must not skip two cards or desync index. → Task 5 test "locked while animating".
4. **Exactly one session / zero sessions / fetch error:** no pill, no layers / hidden / hidden. → Task 5 tests `layers`, `visible`.
5. **Routine step that is itself a game (has ruleset key):** excluded from deck and from `/games` `resumeTarget`. → Task 3 + Task 5 tests.

---

### Task 1: View exposes routine flag and configuration

**Files:**
- Create: `database/migrations/0047_active_sessions_progress_inputs.sql`
- Modify: `app/src/db/schema.ts` (via `npm run db:introspect`)
- Modify: `app/src/repositories/session.repository.ts` (`findActiveSessions`, ~:273)
- Test: `app/tests/db/schema-view-drift.test.ts` (must pass unchanged or with regenerated fixture per its own instructions)

**Interfaces:**
- Produces: `findActiveSessions(db, playerId)` rows gain `isRoutineStep: boolean`, `configuration: Record<string, unknown> | null`.

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Migration: 0047_active_sessions_progress_inputs.sql
--
-- Purpose:
-- The homepage resume deck lists active game sessions with a
-- progress summary derived from each session's configuration
-- snapshot, and must leave routine step sessions out. Adds
-- is_routine_step (routine_step_sequence_number IS NOT NULL;
-- standalone sessions leave it NULL, migration 0029) and the
-- session's configuration jsonb (exercise_configurations, one
-- row per session, LEFT JOIN so a missing row is NULL, never a
-- dropped session). Columns otherwise unchanged from 0033.
-- ============================================================

-- migrate:up
DROP VIEW IF EXISTS v_active_sessions;
CREATE VIEW v_active_sessions AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    gt.name               AS game_type_name,
    cm.implementation_key AS capture_mode_key,
    im.implementation_key AS input_mode_key,
    rv.implementation_key AS ruleset_version_key,
    es.started_at,
    es.routine_step_sequence_number IS NOT NULL AS is_routine_step,
    ec.configuration
FROM exercise_sessions es
    LEFT JOIN game_types gt              ON gt.id = es.game_type_id
    LEFT JOIN capture_modes cm           ON cm.id = es.capture_mode_id
    LEFT JOIN input_modes im             ON im.id = es.input_mode_id
    LEFT JOIN ruleset_versions rv        ON rv.id = es.ruleset_version_id
    LEFT JOIN exercise_configurations ec ON ec.exercise_session_id = es.id
    JOIN game_statuses gs                ON gs.id = es.status_id
WHERE gs.implementation_key = 'ACTIVE';
COMMENT ON VIEW v_active_sessions IS 'Active sessions available for resume, game and non-game alike; game_type_key/game_type_name and the capture/input/ruleset keys are NULL for a training exercise session. is_routine_step marks a routine step session; configuration is the session snapshot (NULL if absent).';

-- migrate:down
DROP VIEW IF EXISTS v_active_sessions;
CREATE VIEW v_active_sessions AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    gt.name               AS game_type_name,
    cm.implementation_key AS capture_mode_key,
    im.implementation_key AS input_mode_key,
    rv.implementation_key AS ruleset_version_key,
    es.started_at
FROM exercise_sessions es
    LEFT JOIN game_types gt       ON gt.id = es.game_type_id
    LEFT JOIN capture_modes cm    ON cm.id = es.capture_mode_id
    LEFT JOIN input_modes im      ON im.id = es.input_mode_id
    LEFT JOIN ruleset_versions rv ON rv.id = es.ruleset_version_id
    JOIN game_statuses gs         ON gs.id = es.status_id
WHERE gs.implementation_key = 'ACTIVE';
COMMENT ON VIEW v_active_sessions IS 'Active sessions available for resume, game and non-game alike; game_type_key/game_type_name and the capture/input/ruleset keys are NULL for a training exercise session.';
```

Before writing, `grep -rn "v_active_sessions" database/` to confirm no later migration or dependent view references it (a dependent view would block `DROP VIEW`).

- [ ] **Step 2: Apply and regenerate**

Run: `npm run db:status && npm run db:migrate && npm run db:introspect && npm run db:drift`
Expected: 0047 applied; `vActiveSessions` in `schema.ts` gains `isRoutineStep` and `configuration`; drift OK. If no DB is reachable, stop and report BLOCKED.

- [ ] **Step 3: Extend the repository select**

In `findActiveSessions` add to the select object:

```ts
      isRoutineStep: vActiveSessions.isRoutineStep,
      configuration: vActiveSessions.configuration,
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/db tests/repositories tests/services/session.service.test.ts`
Expected: PASS (update `schema-view-drift` expectations only as its header instructs).

- [ ] **Step 5: Commit** — `feat(db): v_active_sessions exposes routine flag and configuration`

---

### Task 2: `summarizeProgress` module

**Files:**
- Create: `app/src/modules/game/session-progress.module.ts`
- Modify: `app/src/modules/game/types.ts` (add `SessionProgress`), ensure re-export via `@modules/types`
- Test: `app/tests/modules/game/session-progress.module.test.ts`

**Interfaces:**
- Consumes: every `foldXState` (signatures in `app/src/modules/game/*.engine.module.ts`), `EngineFacts` (`modules/game/types.ts:464`), `joinSubtitle`/`orderModeLabel` (`lib/game/play-subtitle.ts`), `doublesPath` (as used by `lib/game/bobs27-play.data.ts:217`), `SeatFact`.
- Produces:

```ts
export type SessionProgress = {
  detail: string;
  big: { value: string; label: string } | null;
};
export const EMPTY_FACTS: EngineFacts; // { stages: [], turns: [] }
export function summarizeProgress(
  rulesetVersionKey: string,
  config: unknown,
  facts: EngineFacts,
): SessionProgress | null;
```

**Behaviour (exact strings):**

| Ruleset key(s) | `detail` | `big` |
|---|---|---|
| `501_V1` | `joinSubtitle([opponents ? "vs " + opponents : "", "Leg " + max(stages.length,1), "First to " + legsToWin, sides>1 ? a + "–" + b : ""])` where a = first seat's side legs won, b = best other side | `{ value: String(first seat remainingScore), label: "TO GO" }` |
| `121_V1`, `121_V2` | `Round n of m` (or `Round n` with no budget) — port `one-twenty-one-play.data.ts:454` | current target label, `TARGET` |
| `CRICKET_V1`, `TACTICS_V1` | `Solo · N objectives` — port `cricket-play.data.ts:159` / `tactics-play.data.ts:172` | darts thrown, `DARTS` |
| `SCORE_TRAINING_V1` | `Round n of m`, or `Round n` when duration is minutes — port `score-training-play.data.ts:206` | active seat `totalScore`, `POINTS` |
| `SINGLES_V1..V3`, `DOUBLES_TRAINING_V1` | `orderModeLabel(config.orderMode)` in sentence case via `ORDER_MODE_LABELS` (e.g. `Low → High`) | current target label, `TARGET` |
| `BOBS27_V1` | `Double n of m`, m = `doublesPath().length` | active seat `score`, `POINTS` |
| `TUOD_V1` | `Round n of m` — port `tuod-play.data.ts:294` | current target label, `TARGET` |
| `SHANGHAI_V1`, `SHANGHAI_V2` | `Round n of 7` (`SHANGHAI_ROUNDS`) — port `shanghai-play.data.ts:264` | current target label, `TARGET` |
| `AROUND_THE_CLOCK_V1`, `_V2` | `Lap n · first → last` — port `around-the-clock-play.data.ts:386` | current target label, `TARGET` |
| any other key | — | returns `null` |

- "Opponents": `seats` display names excluding the first seat whose `participantTypeKey === "PLAYER"`, joined with ` & `; empty when one seat.
- "Current target label": reuse the same derivation the play factory's `currentTargetLabel*` uses (`atc :329, bobs27 :230, doubles :211, singles :438, 121 :387, shanghai :280, tuod :270`). If that derivation lives in the `.data.ts` and is not pure, move the pure part into the engine module (or `modules/game/board-progression.module.ts`) and have the play factory call it — do **not** import any `*.data.ts` from the module.
- Timer-based folds get `timerExpired = false`.
- The whole per-ruleset branch runs inside one `try`; any throw → `null`. Missing optional state field → omit that part / `big: null`.

- [ ] **Step 1: Write failing tests.** For each ruleset row: build a valid config the way existing engine tests do (see `app/tests/modules/game/<engine>.engine.module.test.ts` fixtures) with seats `[player "You", dartbot "Dartbot"]` where the game allows 2 seats, and assert exact `detail`/`big` for (a) `EMPTY_FACTS`, (b) facts after a couple of turns (build them via `factory.create(config).…` input path the engine tests use, then `.facts()`). Plus:

```ts
it("returns null for an unknown ruleset", () => {
  expect(summarizeProgress("NOPE_V1", {}, EMPTY_FACTS)).toBeNull();
});
it("returns null for a malformed config instead of throwing", () => {
  expect(summarizeProgress("501_V1", { seats: "x" }, EMPTY_FACTS)).toBeNull();
});
it("501 with empty facts against Dartbot", () => {
  expect(summarizeProgress("501_V1", fiveOhOneConfig, EMPTY_FACTS)).toEqual({
    detail: "vs Dartbot · Leg 1 · First to 3 · 0–0",
    big: { value: "501", label: "TO GO" },
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/modules/game/session-progress.module.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement: a `Record<string, (config, facts) => SessionProgress>` dispatch table plus `summarizeProgress` wrapper with the `try`. Keep each summarizer ≤ 15 lines.
- [ ] **Step 4:** Re-run → PASS. Run any play-factory tests touched by an extraction: `npx vitest run tests/lib/game`.
- [ ] **Step 5: Commit** — `feat(game): summarizeProgress for active-session cards`

---

### Task 3: API returns `isRoutineStep` and `progress`; `/games` ignores routine steps

**Files:**
- Modify: `app/src/services/session.service.ts` (`listActiveSessions`)
- Modify: `app/src/pages/api/sessions/types.ts` (`SessionActive`)
- Modify: `app/src/lib/game/games-index.data.ts` (`resumeTarget`, `activeRulesetKeys` keep routine steps — only `resumeTarget` filters)
- Test: `app/tests/services/session.service.test.ts`, `app/tests/pages/api/sessions/active.test.ts`, `app/tests/lib/game/games-index.data.test.ts`

**Interfaces:**
- Consumes: Task 1 rows; Task 2 `summarizeProgress`, `EMPTY_FACTS`; `snapshotOf` (`modules/stats/x01-checkout-sessions.module.ts:143`).
- Produces: `SessionActiveData` gains `isRoutineStep: boolean`, `progress: { detail: string; big: { value: string; label: string } | null } | null`. `configuration` is **not** sent to the client.

- [ ] **Step 1: Failing tests**

```ts
describe("listActiveSessions", () => {
  it("adds isRoutineStep and a config-derived progress, dropping configuration", async () => {
    vi.mocked(repo.findActiveSessions).mockResolvedValue([
      { sessionId: "s1", rulesetVersionKey: "501_V1", isRoutineStep: false,
        configuration: fiveOhOneWireConfigWithSeats, startedAt: "2026-10-10T10:00:00.000Z" } as never,
    ]);
    const [row] = await listActiveSessions("p1");
    expect(row).not.toHaveProperty("configuration");
    expect(row.isRoutineStep).toBe(false);
    expect(row.progress?.big).toEqual({ value: "501", label: "TO GO" });
  });
  it("progress is null for a null ruleset or null configuration", async () => {
    vi.mocked(repo.findActiveSessions).mockResolvedValue([
      { sessionId: "s2", rulesetVersionKey: null, isRoutineStep: true, configuration: null } as never,
    ]);
    const [row] = await listActiveSessions("p1");
    expect(row.progress).toBeNull();
  });
});
```

`games-index.data.test.ts`: `resumeTarget` skips a newer session with `isRoutineStep: true` and returns the older standalone one. Update existing fixtures to include `isRoutineStep: false, progress: null`.

- [ ] **Step 2:** Run the three test files → FAIL.
- [ ] **Step 3: Implement**

```ts
export async function listActiveSessions(playerId: string) {
  const db = getDb();
  const rows = await findActiveSessions(db, playerId);
  return rows.map(({ configuration, ...row }) => ({
    ...row,
    progress:
      row.rulesetVersionKey === null
        ? null
        : summarizeProgress(
            row.rulesetVersionKey,
            snapshotOf(row.rulesetVersionKey, configuration),
            EMPTY_FACTS,
          ),
  }));
}
```

(`summarizeProgress` receives `null` when `snapshotOf` fails and returns `null`.) Add JSDoc. Schema:

```ts
  isRoutineStep: z.boolean(),
  progress: z
    .object({
      detail: z.string(),
      big: z.object({ value: z.string(), label: z.string() }).nullable(),
    })
    .nullable(),
```

`resumeTarget`: filter `!session.isRoutineStep` before sorting; update its JSDoc.

- [ ] **Step 4:** Re-run → PASS; also `npx vitest run tests/lib/client`.
- [ ] **Step 5: Commit** — `feat(api): active sessions carry routine flag and progress summary`

---

### Task 4: `startedAgo` helper

**Files:**
- Create: `app/src/lib/utils/started-ago.ts`
- Test: `app/tests/lib/utils/started-ago.test.ts`

**Interfaces:** Produces `startedAgo(startedAt: string, now: Date): string`.

- [ ] **Step 1: Failing tests**

```ts
const now = new Date("2026-10-10T12:00:00.000Z");
const at = (ms: number) => new Date(now.getTime() - ms).toISOString();
const MIN = 60_000, H = 60 * MIN, D = 24 * H;
it.each([
  [at(0), "JUST NOW"],
  [at(59_000), "JUST NOW"],
  [at(MIN), "1 MIN AGO"],
  [at(18 * MIN), "18 MIN AGO"],
  [at(59 * MIN), "59 MIN AGO"],
  [at(H), "1 H AGO"],
  [at(23 * H), "23 H AGO"],
  [at(D), "YESTERDAY"],
  [at(2 * D - 1), "YESTERDAY"],
  [at(2 * D), "2 D AGO"],
  [new Date(now.getTime() + 5 * MIN).toISOString(), "JUST NOW"],
])("%s → %s", (iso, label) => expect(startedAgo(iso, now)).toBe(label));
```

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement with floor division on elapsed ms (negative clamps to 0).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** — `feat(home): startedAgo label helper`

---

### Task 5: `resumeDeck()` Alpine factory

**Files:**
- Create: `app/src/lib/game/resume-deck.data.ts`
- Modify: `app/src/lib/game/types.ts` (add `ResumeCard`, `ResumeDeckPhase`, `ResumeDeckContext`; re-export via `@lib/types`)
- Modify: `app/src/lib/client/alpine/register-route-data.ts` (`Alpine.data("resumeDeck", resumeDeck)`)
- Test: `app/tests/lib/game/resume-deck.data.test.ts`

**Interfaces:**
- Consumes: `fetchActiveSessions`, `GAME_CARDS`, `summarizeProgress`, `startedAgo`, `$store.game` (`sessionId`, `rulesetVersionKey`, `configSnapshot`, `stages`, `turns`).
- Produces:

```ts
export type ResumeCard = {
  sessionId: string;
  title: string;
  href: string;
  started: string;                                   // "STARTED 18 MIN AGO"
  detail: string;
  big: { value: string; label: string } | null;
};
export type ResumeDeckPhase = "idle" | "out" | "rise" | "in";
export type LocalGame = {
  sessionId: string | null;
  rulesetVersionKey: string | null;
  configSnapshot: unknown;
  stages: StageFact[];
  turns: TurnFact[];
};
export function toResumeCards(
  sessions: SessionActiveData[],
  local: LocalGame | null,
  now: Date,
  cards?: readonly GameCardDescriptor[],
): ResumeCard[];
export function resumeDeck(): {
  cards: ResumeCard[]; index: number; phase: ResumeDeckPhase;
  loading: boolean; failed: boolean; swipeX: number | null; swipeY: number | null;
  init(): Promise<void>;
  top(): ResumeCard | null; position(): string; layers(): number; visible(): boolean;
  next(): void; prev(): void; settle(): void;
  swipeStart(e: PointerEvent): void; swipeEnd(e: PointerEvent): void;
  resume(): void; navigate(path: string): void;
};
```

**Behaviour:**
- `toResumeCards`: drop `isRoutineStep`; drop sessions whose `rulesetVersionKey` has no `GAME_CARDS` entry; sort `startedAt` desc; `started = "STARTED " + startedAgo(...)`; `detail/big` from `session.progress` (fallback `detail: ""`, `big: null`); if `local?.sessionId === session.sessionId` and `local.rulesetVersionKey === session.rulesetVersionKey`, replace with `summarizeProgress(key, local.configSnapshot, { stages: local.stages, turns: local.turns })` when non-null.
- `init`: `loading = true`; try `cards = toResumeCards(await fetchActiveSessions(), this.$store.game, new Date())`; catch → `failed = true`; finally `loading = false`.
- `top()` = `cards[index] ?? null`; `position()` = `${index + 1} / ${cards.length}`; `layers()` = `Math.min(Math.max(cards.length - 1, 0), 2)`; `visible()` = `!failed && (loading || cards.length > 0)`.
- `next()`: ignore unless `phase === "idle"` and `cards.length > 1`; `phase = "out"`. `prev()`: same guard; `index = (index - 1 + n) % n`; `phase = "in"`.
- `settle()` (bound to `@animationend` on the top card): `"out"` → `index = (index + 1) % n`, `phase = "rise"`; `"rise"` / `"in"` → `phase = "idle"`.
- Reduced motion: component CSS makes animations a fade, so `animationend` still fires; no JS branch.
- Swipe: `swipeStart` stores `clientX/Y`; `swipeEnd` computes dx/dy, clears; if `|dx| >= 40 && |dx| > |dy|`: `dx < 0 ? next() : prev()`.
- `resume()`: `navigate(top().href)` when top exists. `navigate(path)` sets `globalThis.location.href` (mirrors `homeSnapshot.navigate`, mockable).

- [ ] **Step 1: Failing tests** covering: routine filtered; unknown ruleset filtered; sort; started label; server progress used; local overlay on match; **stale store ignored** (sessionId mismatch); overlay ignored when local summary is `null`; `layers()` for 0/1/2/3/5 cards; `visible()` loading/failed/empty; `next()` → `out` → `settle()` → index+1 `rise` → `settle()` idle; wrap at end; `prev()` wraps from 0 to n−1 with phase `in`; **locked while animating** (`next(); next(); settle(); settle()` advances exactly one); single card: `next()` no-op; swipe left ≥40 → `out`; swipe 30px → no-op; vertical-dominant → no-op; `resume()` calls `navigate` with card href; fetch reject → `failed`, `visible()` false. Call factory methods with an explicit `this` built as `Object.assign(resumeDeck(), { $store: { game: … } })`, as other `*.data.test.ts` do.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement + register.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** — `feat(home): resumeDeck Alpine factory`

---

### Task 6: Reusable UI primitives, deck component, homepage wiring

**Files:**
- Create: `app/src/components/ui/CardStack.astro` — generic stacked-card wrapper
- Create: `app/src/components/ui/DeckPager.astro` — generic `‹ n / N ›` pill
- Create: `app/src/components/layout/sessions/ResumeSessionDeck.astro`
- Modify: `app/src/styles/global.css` (`@theme` keyframes + reduced-motion overrides)
- Modify: `app/src/pages/index.astro` (swap component)
- Modify: `app/src/lib/home/home-snapshot.data.ts`, `app/src/lib/home/types.ts` (remove `resume`, `resumeGame`, `navigate` if now unused, `HomeResume`)
- Delete: `app/src/components/layout/home/ResumeGameCard.astro`
- Test: `app/tests/lib/home/home-snapshot.data.test.ts`

**Interfaces:**
- `CardStack.astro` props: `layersExpr: string` (Alpine expr → 0|1|2), `class?`; default slot = top card. Renders `div.relative` with `:class` adding `pb-4` when layers>0 (`pb-2` for 1); back slabs: layer 2 `absolute inset-x-6 bottom-0 h-10 rounded-b-[18px] bg-accent/… ` and layer 1 `absolute inset-x-3 bottom-2 h-10 rounded-b-[19px]`, each `x-show` + `x-cloak`, `aria-hidden="true"`. Pick colours from existing tokens (match design: layer 1 ≈ `oklch(40% .09 238 / .75)`, layer 2 ≈ `oklch(30% .06 240 / .6)`); if no token fits, add `--color-stack-1/2` tokens in `global.css` `@theme` next to the accent tokens.
- `DeckPager.astro` props: `positionExpr`, `prevExpr`, `nextExpr`, `prevLabel`, `nextLabel`, `class?`. Renders a pill `h-7 rounded-full bg-foreground/12 font-mono text-[11px] font-semibold` with `IconBtn` (`variant="ghost"`, chevron icons from `@icons`, size-6) around `<span aria-live="polite" x-text={positionExpr}>`.
- `ResumeSessionDeck.astro`: no props except `class?`; root `<section x-data="resumeDeck()" x-show="visible()" x-cloak>`. Inside:
  - Loading skeleton (`x-show="loading" x-cloak`): `.home-feature-card` with skeleton line boxes per `ResultValue.astro` pattern (`inline-block h-lh animate-pulse rounded-md bg-skeleton align-top` + widths `w-24`, `w-40`, `w-12`) and a disabled-looking button block `h-12 rounded-lg bg-skeleton`.
  - Loaded (`x-show="!loading" x-cloak`): `<CardStack layersExpr="layers()">` containing the top card `.home-feature-card flex flex-col gap-3.5 rounded-2xl p-4 backdrop-blur-sm touch-pan-y` with `:class="{ 'animate-deck-out': phase === 'out', 'animate-deck-rise': phase === 'rise', 'animate-deck-in': phase === 'in' }"`, `@animationend.self="settle()"`, `@pointerdown="swipeStart($event)"`, `@pointerup="swipeEnd($event)"`, `@pointercancel="swipeX = null"`.
  - Header: `IN PROGRESS` + (`cards.length > 1` → `<DeckPager positionExpr="position()" prevExpr="prev()" nextExpr="next()" prevLabel="Previous open game" nextLabel="Next open game" />`, else `x-text="top()?.started"` span).
  - Body: copy markup from the deleted `ResumeGameCard.astro`, bound to `top()?.title`, `top()?.detail`, `top()?.big?.value`, `top()?.big?.label`; big column `x-show="top()?.big"` + `x-cloak`.
  - Button: `forms/Button` "Resume game", `variant="secondary"`, `loadingExpr="false"`, `class="glass-button h-12 w-full rounded-lg text-[15px]"`, `@click="resume()"`, `PlayIcon` slot.
- `global.css` `@theme`:

```css
  --animate-deck-out: deck-out 240ms var(--ease-in, ease-in) forwards;
  --animate-deck-rise: deck-rise 220ms var(--ease-out);
  --animate-deck-in: deck-in 240ms var(--ease-out);

  @keyframes deck-out {
    to { opacity: 0; transform: translateX(-110%) rotate(-6deg); }
  }
  @keyframes deck-rise {
    from { opacity: 0.6; transform: translateY(8px) scale(0.94); }
  }
  @keyframes deck-in {
    from { opacity: 0; transform: translateX(-110%) rotate(-6deg); }
  }
```

  and in the base layer:

```css
  @media (prefers-reduced-motion: reduce) {
    .animate-deck-out, .animate-deck-rise, .animate-deck-in {
      animation: deck-fade 150ms linear;
    }
  }
  @keyframes deck-fade { from { opacity: 0.4; } }
```

  (Check whether `--ease-in` exists; if not use plain `ease-in`.)

- [ ] **Step 1: Update failing test** — `home-snapshot.data.test.ts`: remove `resume`/`resumeGame` expectations; add `expect(homeSnapshot()).not.toHaveProperty("resume")`. Run → FAIL.
- [ ] **Step 2:** Remove `resume`, `resumeGame`, `HomeResume` (and `navigate` if unused) from data + types + barrel. Run → PASS.
- [ ] **Step 3:** Create `CardStack.astro`, `DeckPager.astro`, `ResumeSessionDeck.astro`, keyframes; swap import in `index.astro` (place `<ResumeSessionDeck />` where `<ResumeGameCard />` was — it is its own `x-data` scope nested in `homeSnapshot()`, which is fine); delete `ResumeGameCard.astro`.
- [ ] **Step 4:** Run `npm run check` (astro check), `bash ../scripts/check-astro-conventions.sh`, `bash ../scripts/check-astro-class-composition.sh`, `bash ../scripts/check-style-tokens.sh`, `bash ../scripts/check-file-locations.sh` → all OK.
- [ ] **Step 5: Visual check** — `npm run dev`; open `/` signed in with 0, 1 and 3 active games (start games from `/games/*/setup`, leave them). Verify: hidden at 0; plain card at 1; 2 layers + pill at 3; next slides out and the next card rises; prev slides in; swipe both directions; reduced-motion (DevTools emulation) fades. Report what was checked; if the app cannot be run, say so.
- [ ] **Step 6: Commit** — `feat(home): stacked resume deck replaces static resume card`

---

### Task 7: Docs, decision, issues, gates

**Files:**
- Modify: `docs/architecture/07-Frontend/08-Component-Inventory.md` (home section ~:177-187: remove `ResumeGameCard`, add `ResumeSessionDeck`; ui section: add `CardStack`, `DeckPager`; same column format as neighbours)
- Modify: `decisions/frontend/style.md` (next free `D4xx` — `grep -rhoE "^### D[0-9]+" decisions | sort -V | tail -1` + 1)
- Modify: `docs/architecture/07-Frontend/02-Folder-Structure.md` if it enumerates `components/layout/*` folders (add `sessions/`)

- [ ] **Step 1:** Decision entry: "Homepage resume deck: lists every active non-routine game session newest first; progress is config-derived on the server (turns upload only at session end) and recomputed from `$store.game` for the locally held session; supersedes D425's always-visible static resume card." Cite spec path.
- [ ] **Step 2:** Inventory rows.
- [ ] **Step 3:** `gh issue comment 815 --body "…"` — partially addressed by this branch: config-derived summary for all, live for locally held session; remaining: incremental fact upload. Capture follow-up issue via the `capturing-discovered-work` skill: "/games ResumeSessionCard should use ResumeSessionDeck".
- [ ] **Step 4:** Run `validate-app` and `run-all-gates` skills; fix anything red.
- [ ] **Step 5: Commit** — `docs: resume deck decision and inventory`
