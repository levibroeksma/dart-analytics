# Killer V1 App Wiring (Elimination PR 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Killer playable end to end: two-seat floor, setup with per-person seat numbers, play screen, results, card.

**Architecture:** The engine (`killer.engine.module.ts`), validator, seeds, `SEAT_CAPS` and capabilities shipped in PR 1 (D501). This PR adds the app layer on the shapes every game uses: `createPresetSetupController` + `configOverrides`, a per-game play controller over `play-lifecycle.ts`, a `SeatedPlayScreen` interface, a `ResultsModalShell` modal. Pure helpers (seat-number ordering, seat results) live in their own module so they commit before the wiring commit.

**Tech Stack:** Astro, Alpine.js, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-27-elimination-kernel-design.md` §6, §8, §10. Rules: `docs/game-rules/rulesets/killer.md`.

## Global Constraints

- Route slug and code slug: `killer`. Keys: `KILLER` / `KILLER_V1`.
- Two seats, exactly: one PLAYER plus one guest. No DartBot (`supportsDartbot` stays false).
- Seat numbers 1–20, distinct, one per seat; a number belongs to the person, not the position.
- Lives fixed at 3 (`KillerConfig.lives` is `z.literal(3)`).
- Darts-to-Killer shows `—` when the seat never became Killer.
- An abandoned session shows no winner; it uses the existing abandon flow (`playAbandonAndExit`).
- No `//` comments inside function bodies in `app/src`; JSDoc states the contract, not history.
- Exported types only in `types.ts`/`interfaces.ts`.
- Touch-list wiring (card, both data files, both pages, both Alpine registrations) lands in **one commit** (`check-game-wiring.sh` runs pre-commit; `09-Adding-A-Game.md` §What the gate checks).
- Never `--no-verify`. Discovered work → GitHub issue, not fixed here.

## Decisions this plan makes (Claude's calls, recorded in D502)

| Question | Call |
| --- | --- |
| Two-seat floor | `SEAT_FLOORS` in `session-seats.service.ts`; `rejectSeatRequest` refuses a seat list (or an omitted one, which means solo) below the ruleset's floor. The validator's `seat_numbers.length === 2` then always agrees with the seat count. |
| Seat numbers through the starter step | `configOverrides(ctx)` already runs after `resolveStarter` sets `ctx.starterIndex`, so it returns `seat_numbers` reordered by `starterFirstNumbers(ctx.seatNumbers, ctx.starterIndex)` — the same swap `starterFirst` applies to participants. |
| Seat numbers through Play Again | `buildOverrides` closes over `this.playAgainStarter` and reorders `prior.seatNumbers` with the same `starterFirstNumbers`, then defers to `variantsPlayAgain("KILLER_V1")`. |
| Input keypad | New `KillerRecreationalInput.astro`: `RingKeyRow`, a 5-column 1–20 grid, then BULL and MISS. Reuses `toggleMarksRing`, `recordMarksTap`, `recordMarksMiss` (`marks-play.data.ts`). Visual board comes from `SeatedPlayScreen`'s `BoardInputPanel` as for every game. |
| Number picker | `components/forms/Select.astro`, one per seat, options 1–20, defaults 20 (you) and 19 (guest). |
| Start gating | New optional `SetupShell` prop `startBlockedExpr` (default `"false"`), OR'd into the slide's `disabledExpr` and the submit guard. Killer passes `"!canStart()"`. |
| Active-session card | A `killer` summarizer in `session-progress.module.ts`: detail `1v1 · Killer` or `1v1 · Not Killer`, big = active seat's lives, label `LIVES`. |
| Statistics view | `KILLER_V1` joins `HEATMAP_ONLY_LAYOUTS` (board game; career stats are out of scope, spec §11). |
| Card group / copy | `CLASSICS`, title `Killer`, caption `Hit your double, then hunt theirs.` |

## Review Focus

1. Guest wins the starter step → the guest throws first **and keeps their own number** (setup and Play Again). Test: Task 3 `starterFirstNumbers`, Task 4 start test with `starterIndex: 1`, Task 5 play-again test with `playAgainStarter: 1`.
2. Both seats pick the same number → Start stays disabled with a visible reason; no session is created. Test: Task 4 `canStart` and `start` refusal.
3. Solo or API-created one-seat Killer session → refused before any write. Test: Task 2.
4. Resume mid-visit after reload (dart 2 of a visit, Killer status already toggled) → same active seat, lives and badges. Test: Task 5 resume test.
5. Undo of the dart that ended the game → game reopens, results modal not shown, loser back to 1 life. Test: Task 1 engine test plus Task 5 `undoVisit` test.

---

### Task 1: Deferred engine edge tests

Test-only; closes the PR 1 review minors.

**Files:**
- Test: `app/tests/modules/game/killer.engine.module.test.ts`

**Interfaces:**
- Consumes: `KillerEngine`, `killerEngineFactory`, `foldKillerState` (PR 1).

- [ ] **Step 1: Add the tests** (same helpers the file already uses for seats `p1`/`p2`, numbers `[20, 19]`):
  - `it("eliminates on dart 2 and closes the visit at the match end")` — p2 at 1 life, p1 Killer; p1's visit `S5, D19` → `status === "COMPLETE"`, that turn's `completedAt` non-null, `darts.length === 2`, `winningSideKey === "A"`, `outOrder === ["p2"]`.
  - `it("undo of an eliminating dart reopens the game")` — after the above, `undo()` → `status === "IN_PROGRESS"`, p2 `lives === 1`, `out === false`, turn `completedAt === null`, active seat `p1`.
  - `it("wouldComplete is true mid-visit only for the eliminating dart")` — at p2 = 1 life, p1 Killer, one dart thrown: `wouldComplete(D19) === true`, `wouldComplete(D18) === false`, `wouldComplete(D20) === false`.
  - `it("folds three seats and skips the out seat in the rota")` — `foldKillerState` with three seats, numbers `[20, 19, 18]`; eliminate p2; next visit after p1 is p3.
- [ ] **Step 2: Run** `cd app && npx vitest run tests/modules/game/killer.engine.module.test.ts` — expect PASS (behaviour exists; a FAIL is a bug to fix in the engine under TDD).
- [ ] **Step 3: Commit** `test(killer): dart-2 elimination, undo, mid-visit wouldComplete, three-seat rota`.

### Task 2: Two-seat floor

**Files:**
- Modify: `app/src/services/session-seats.service.ts` (beside `SEAT_CAPS`; inside `rejectSeatRequest`)
- Test: `app/tests/services/session-seats.service.test.ts`
- Modify: `docs/architecture/06-API/04-Endpoint-Contracts.md` (the seat-cap row: add the floor)

**Interfaces:**
- Produces: `rejectSeatRequest(participants, rulesetVersionKey)` refuses below `SEAT_FLOORS[key] ?? 1` with `` `${key} needs at least ${floor} seats.` ``.

- [ ] **Step 1: Failing tests**

```ts
it("refuses an omitted seat list for a ruleset with a two-seat floor", () => {
  expect(rejectSeatRequest(undefined, "KILLER_V1")).toBe(
    "KILLER_V1 needs at least 2 seats.",
  );
});
it("refuses a lone PLAYER seat for KILLER_V1", () => {
  expect(rejectSeatRequest([player], "KILLER_V1")).toBe(
    "KILLER_V1 needs at least 2 seats.",
  );
});
it("accepts PLAYER + GUEST for KILLER_V1", () => {
  expect(rejectSeatRequest([player, guest], "KILLER_V1")).toBeNull();
});
```

- [ ] **Step 2: Run** `npx vitest run tests/services/session-seats.service.test.ts` — the first two FAIL (null returned).
- [ ] **Step 3: Implement** `const SEAT_FLOORS: Record<string, number> = { KILLER_V1: 2 };`. The floor check runs first for `undefined` (omitted = one seat) and after the min/max check for a list. Extend the JSDoc of `rejectSeatRequest` with one sentence on the floor.
- [ ] **Step 4: Run** the file and `tests/services/session.service.test.ts` — PASS.
- [ ] **Step 5: Commit** `feat(seats): two-seat floor for KILLER_V1`.

### Task 3: Killer pure helpers

**Files:**
- Create: `app/src/lib/game/killer-seats.ts`
- Modify: `app/src/lib/game/types.ts` (add `KillerSeatResult`, `KillerResultsSnapshot`, `KillerSetupContext`, `KillerPlayContext`)
- Test: `app/tests/lib/game/killer-seats.test.ts`

**Interfaces:**
- Consumes: `KillerSeatState`, `KillerState` (`@modules/types`); `SeatFact` (`@lib/types`).
- Produces:
  - `starterFirstNumbers(numbers: readonly number[], starterIndex: 0 | 1): number[]` — `starterIndex` 1 swaps the two entries; 0 returns a copy.
  - `killerSeatResult(seat: KillerSeatState): KillerSeatResult`
  - `KillerSeatResult = { participantRef: string; sideKey: string; number: number; livesLeft: number; livesTaken: number; dartsToKiller: number | null; out: boolean }`
  - `KillerResultsSnapshot = { status: "COMPLETE"; winningSideKey: string | null; outOrder: string[]; seats: KillerSeatResult[] }`
  - `outOrderNames(outOrder: readonly string[], seats: readonly SeatFact[]): string` — display names joined `" → "`; empty string for none.

- [ ] **Step 1: Failing tests**
  - `starterFirstNumbers([20, 19], 0)` → `[20, 19]`; `([20, 19], 1)` → `[19, 20]`; input not mutated.
  - `killerSeatResult` of a seat `{ number: 20, lives: 2, livesTaken: 3, dartsToKiller: 4, out: false, … }` → `{ number: 20, livesLeft: 2, livesTaken: 3, dartsToKiller: 4, out: false, participantRef, sideKey }`; `dartsToKiller: null` stays `null`.
  - `outOrderNames(["p2"], seats)` → `"Guest"`; `outOrderNames([], seats)` → `""`.
- [ ] **Step 2: Run** `npx vitest run tests/lib/game/killer-seats.test.ts` — FAIL (module missing).
- [ ] **Step 3: Implement** the three functions and the types.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(killer): seat-number ordering and seat results helpers`.

### Task 4: Progress summarizer and stats layout

**Files:**
- Modify: `app/src/modules/game/session-progress.module.ts` (`SUMMARIZERS`)
- Modify: `app/src/lib/stats/constants.ts` (`HEATMAP_ONLY_LAYOUTS`)
- Test: `app/tests/modules/game/session-progress.module.test.ts`, `app/tests/lib/stats/constants.test.ts`

**Interfaces:**
- Consumes: `foldKillerState` (`@modules/game/killer.engine.module`).

- [ ] **Step 1: Failing tests**
  - `summarizeProgress("KILLER_V1", config, EMPTY_FACTS)` with seats `[p1, p2]`, `{ lives: 3, seatNumbers: [20, 19] }` → `{ detail: "1v1 · Not Killer", big: { value: "3", label: "LIVES" } }`.
  - After p1 hits `D20` (three-dart visit `D20, S1, S1`, closed): active is p2 → detail `"1v1 · Not Killer"`; after p2's `D19`: active p1 → `"1v1 · Killer"`.
  - `HEATMAP_ONLY_LAYOUTS.has("KILLER_V1") === true`.
- [ ] **Step 2: Run** both files — FAIL.
- [ ] **Step 3: Implement** `function killer(config: Seated<KillerSnapshot>, facts: EngineFacts): SessionProgress` with `joinSubtitle(["1v1", seat?.killer ? "Killer" : "Not Killer"])` and `big(seat?.lives, "LIVES")`; register `KILLER_V1: killer`; add the set entry.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(killer): active-session progress and heatmap stats layout`.

> Tasks 5–8 build the touch list. **Do not commit** until Task 8: a partial commit fails `check-game-wiring.sh`. Run each task's tests before moving on.

### Task 5: Setup controller, form, Start gating

**Files:**
- Create: `app/src/lib/game/killer-setup.data.ts`
- Create: `app/src/components/layout/games/setup/KillerSetupForm.astro`
- Modify: `app/src/components/layout/games/setup/SetupShell.astro` (prop `startBlockedExpr`)
- Test: `app/tests/lib/game/killer-setup.data.test.ts`

**Interfaces:**
- Consumes: `createPresetSetupController`, `starterFirstNumbers` (Task 3).
- Produces: `killerSetup()`; `KillerSetupContext = PresetSetupContext & { seatNumbers: [number, number]; canStart(): boolean; startBlockedReason(): string }`.

- [ ] **Step 1: Failing tests** (copy `baseball-setup.data.test.ts`'s store/preset harness; preset `configuration: { lives: 3 }`):
  - `seatNumbers` defaults to `[20, 19]`.
  - `canStart()` false with no guest (`startBlockedReason() === "Add a guest to play Killer."`); false with a guest and `seatNumbers [7, 7]` (`"Pick different numbers."`); true with a guest and `[20, 19]`; reason `""`.
  - `start()` with guest, `starterIndex 0`, `[20, 19]` → `createSession` called with `config.overrides.seat_numbers === [20, 19]`, participants `[PLAYER A, GUEST B]`; `startSession` snapshot has `seatNumbers: [20, 19]`.
  - Same with `starterIndex 1` → `overrides.seat_numbers === [19, 20]`, participants `[GUEST A, PLAYER B]`, snapshot `seatNumbers [19, 20]`.
  - `start()` when `!canStart()` → `createSession` not called.
- [ ] **Step 2: Run** `npx vitest run tests/lib/game/killer-setup.data.test.ts` — FAIL.
- [ ] **Step 3: Implement** `killerSetup()`: `createPresetSetupController<KillerSetupContext>({ gameTypeKey: "KILLER", rulesetVersionKey: "KILLER_V1", playHref: "/games/killer/play", label: "Killer", configOverrides: (ctx) => ({ seat_numbers: starterFirstNumbers(ctx.seatNumbers, ctx.starterIndex) }) })`, spread with `seatNumbers: [20, 19]`, `canStart`, `startBlockedReason`, and a `start` that returns early when `!this.canStart()` before delegating to the factory's `start`.
- [ ] **Step 4: Form.** `KillerSetupForm.astro`: `<SetupShell title="Killer" startBlockedExpr="!canStart()">`, `<UserSection allowGuests />`, a settings section (`SettingSectionShell`) with two `Select` rows — `You` → `model="seatNumbers[0]"`, guest name (`guests[0]?.displayName ?? 'Guest'`) → `model="seatNumbers[1]"`, options `1`–`20` built at build time; the guest row `x-show="guests.length === 1"`; a muted line `x-text="startBlockedReason()"`; `InfoSection` with the rules copy: "Each player picks a number. Hit your own double to become a Killer, then hit an opponent's double to take one of their three lives. Hit your own double again and you lose Killer status. Last player standing wins. 1v1 against a guest. Locked rules."
- [ ] **Step 5: SetupShell.** Add `startBlockedExpr?: string` (default `"false"`), applied as `@submit.prevent="loading || loadingReconciliation || (${startBlockedExpr}) || beginStart()"` and `disabledExpr="loading || loadingReconciliation || (${startBlockedExpr})"`; one `@param` line in its JSDoc. Every other form omits it, so their behaviour is unchanged.
- [ ] **Step 6: Run** the setup test file and `tests/lib/game/setup-session.test.ts` — PASS.

### Task 6: Play controller, interface, keypad

**Files:**
- Create: `app/src/lib/game/killer-play.data.ts`
- Create: `app/src/components/layout/games/interfaces/Killer.astro`
- Create: `app/src/components/layout/games/KillerRecreationalInput.astro`
- Test: `app/tests/lib/game/killer-play.data.test.ts`

**Interfaces:**
- Consumes: `KillerEngine`, `foldKillerState`; `playInit`, `playCommitDart`, `playUndoVisit`, `playUploadAndCompleteSession`, `playVisitMarkers`, `playPreviewSegments`, `playBack`, `playAbandonAndExit`, `playRetryReconciliation`, `runPlayAgain`, `variantsPlayAgain` (`play-lifecycle.ts`); `playAgainStarterData`; `boardInputData`; `toggleMarksRing`, `recordMarksTap`, `recordMarksMiss`; `killerSeatResult`, `starterFirstNumbers` (Task 3); `matchWinnerName`.
- Produces: `killerPlay()` with the accessor pairs `SeatedPlayScreen` calls — `livesLabel()/livesLabelFor(ref)` (`"3"`), `numberLabel()/numberLabelFor(ref)` (`"20"`), `statusLabel()/statusLabelFor(ref)` (`"KILLER"`, `"OUT"`, or `"—"`); `subtitle()`; `ring`, `setRing`, `recordNumber(n)`, `recordBull()`, `recordMiss()`; `resultsTitle()`; `outOrderLabel()`; `playAgain()`.

- [ ] **Step 1: Failing tests** (copy `baseball-play.data.test.ts`'s store/engine harness; snapshot `{ lives: 3, seatNumbers: [20, 19], seats: [p1 A, p2 B] }`):
  - `subtitle()` → `"YOU: 20 · GUEST: 19"` using seat display names uppercased (`"<NAME1>: 20 · <NAME2>: 19"`).
  - `recordNumber(20)` with `ring` DOUBLE commits `{ hitTargetNumber: 20, hitZoneKey: "DOUBLE" }` and resets `ring` to SINGLE; `statusLabelFor("p1") === "KILLER"`.
  - `recordBull()` commits `{ hitTargetNumber: 25, hitZoneKey: "OUTER_BULL" }`; `recordMiss()` commits MISS.
  - Resume: `init()` with stored turns `[p1: D20, S1, S1 (closed)], [p2: D19 (open)]` → `state().activeParticipantRef === "p2"`, both `statusLabelFor` = `"KILLER"`.
  - Game end: p1 Killer takes p2 to 0 → `finished === true`, `resultsSnapshot` equals `{ status: "COMPLETE", winningSideKey: "A", outOrder: ["p2"], seats: [killerSeatResult…] }`, `resultsTitle() === "<p1 name> wins!"`, `outOrderLabel() === "<p2 name>"`.
  - Undo of the eliminating dart → `finished === false`, `livesLabelFor("p2") === "1"`.
  - `playAgain()` with `playAgainStarter: 1` → `createSession` `config.overrides.seat_numbers === [19, 20]` and participants guest-first; with `playAgainStarter: 0` → `[20, 19]`.
- [ ] **Step 2: Run** `npx vitest run tests/lib/game/killer-play.data.test.ts` — FAIL.
- [ ] **Step 3: Implement** `killerPlay()` on Baseball's skeleton (`resumeEngine`, `state()`, `seatOf`, lifecycle delegations, `boardInputData`, `playAgainStarterData`). Specifics:
  - `recordNumber(n)` → `recordMarksTap(this, n)`; `recordBull()` → `recordMarksTap(this, 25)`; `recordMiss()` → `recordMarksMiss(this)`; `setRing(r)` → `toggleMarksRing(this, r)`.
  - `previewSegments()` → `playPreviewSegments(turns, hiddenTurnKey, (dart) => dart.hitZoneKey === "DOUBLE" ? "hit" : "miss")`.
  - `uploadAndCompleteSession()` → `playUploadAndCompleteSession(this, (s) => ({ status: "COMPLETE", winningSideKey: s.winningSideKey, outOrder: [...s.outOrder], seats: s.seats.map(killerSeatResult) }))`.
  - `resultsTitle()` → winner name `+ " wins!"`, else `"Session complete"`.
  - `playAgain()` → `runPlayAgain(this, "KILLER", "KILLER_V1", narrow, (prior) => variantsPlayAgain<KillerSnapshot>("KILLER_V1")({ ...prior, seatNumbers: starterFirstNumbers(prior.seatNumbers, this.playAgainStarter ?? 0) }))`.
  - `isBullVisit()` → `false`.
- [ ] **Step 4: Interface.** `Killer.astro`: `SeatedPlayScreen` with `big={{ isTarget: false, value: (c) => c("livesLabel") }}`, tiles `[{ label: "Number", value: (c) => c("numberLabel") }, { label: "Status", value: (c) => c("statusLabel") }]`, `idle={{ label: "Number", value: (c) => c("numberLabel") }}`; default slot: `<VisitPreview />` and `<KillerRecreationalInput x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'" x-cloak />`.
- [ ] **Step 5: Keypad.** `KillerRecreationalInput.astro`: `input-well flex flex-col`; `<RingKeyRow />`; a `grid-cols-5` grid of `InputButton`s 1–20 (`@click="recordNumber(n)"`, disabled while `finished`); a `grid-cols-2` row: BULL (`recordBull()`, disabled while `finished || ring === 'TREBLE'`) and MISS. JSDoc names the layout like `CricketRecreationalInput.astro`.
- [ ] **Step 6: Run** the play test file — PASS.

### Task 7: Results modal

**Files:**
- Create: `app/src/components/layout/games/result-modals/KillerResults.astro`

**Interfaces:**
- Consumes: `resultsSnapshot: KillerResultsSnapshot`, `resultsTitle()`, `outOrderLabel()` (Task 6).

- [ ] **Step 1: Build** on `BaseballResults.astro` minus the solo summary and grids: `ResultsModalShell overline="Killer · Summary"`, the title `h2`, `ComparisonSummary` with `STAT_ROWS`:
  - `{ label: "Lives left", key: "livesLeft", hero: true, skeletonWidth: "w-8" }`
  - `{ label: "Lives taken", key: "livesTaken", side: true, skeletonWidth: "w-6" }`
  - `{ label: "Darts to Killer", key: "dartsToKiller", side: true, skeletonWidth: "w-6", fallback: "'—'" }`
  
  and `winnerExpr` as Baseball's. Below it, one eyebrow row "Out order" with `x-text="outOrderLabel()"`.
- [ ] **Step 2: Check** `npm run check` reports 0 errors/warnings/hints for the new files (the `.astro` carve-out, D101: no unit test).

### Task 8: Card, pages, registration, rules file, docs — one commit

**Files:**
- Modify: `app/src/lib/game/rulesets/games-visibility.ts` (after Baseball: `{ rulesetVersionKey: "KILLER_V1", gameTypeKey: "KILLER", group: "CLASSICS", href: "/games/killer/setup", title: "Killer", caption: "Hit your double, then hunt theirs." }`)
- Create: `app/src/pages/games/killer/setup/index.astro`, `app/src/pages/games/killer/play/index.astro` (copy Baseball's; `x-data="killerSetup()"` / `"killerPlay()"`, title `Killer`, `NoSessionPanel href="/games/killer/setup"`)
- Modify: `app/src/lib/client/alpine/register-route-data.ts` (`killerSetup`, `killerPlay`)
- Modify: `app/tests/lib/game/rulesets/games-visibility.test.ts` (append `"KILLER_V1"` to the recreational list, the CLASSICS group and — if capable — the analytics list; Killer declares `ANALYTICS + VISUAL_BOARD`, so it is)
- Modify: `docs/game-rules/rulesets/killer.md` — `Current version: V1 (shipped 2026-10-28)` (use the merge date if later); add `` Game type: `KILLER` `` under `Entry points:` (the visibility parity test and tag generator read it)
- Regenerate: `database/seeds/0042_catalog_tags.sql` via `cd app && npm run tags:generate`
- Docs: `docs/architecture/07-Frontend/09-Adding-A-Game.md` (one line: Killer is the `SHARED`-stage shell exemplar for a player-chosen config value carried through the starter step and Play Again); `07-Frontend/08-Component-Inventory.md` rows (`KillerRecreationalInput`, `KillerSetupForm`, `KillerResults`, `SetupShell` `startBlockedExpr`); `00-File-Inventory.md` rows; `00-Context-Map-History.md` row; `decisions/game-engine.md` **D502** (the table under "Decisions this plan makes"); spec §3 status note → PR 2 shipped.

- [ ] **Step 1: Failing test** — update `games-visibility.test.ts` lists; run it — FAIL.
- [ ] **Step 2: Add** the card, pages, registrations, rules-file headers; run `npm run tags:generate`.
- [ ] **Step 3: Run** `npx vitest run tests/lib/game` — PASS; `bash scripts/check-game-wiring.sh`, `check-game-rules.sh`, `check-tag-seeds.sh`, `check-game-engines.sh` — PASS.
- [ ] **Step 4: Docs** as listed; `bash scripts/check-doc-sync.sh` — PASS.
- [ ] **Step 5: Commit** everything from Tasks 5–8 in one commit: `feat(killer): setup, play, results and card (Killer V1 playable)`.

### Task 9: Gates, smoke, PR

- [ ] **Step 1:** `cd app && npm run format && npm run format:check` — clean (commit any diff).
- [ ] **Step 2:** `npm test`, `npm run check` (0 hints), `npx fallow` (complexity ≤ 15) — all pass. `validate:app` DB steps need `DATABASE_URL`; when absent, say so in the report.
- [ ] **Step 3:** Smoke via the `run` skill: start the dev server, open `/games/killer/setup`, add a guest, pick 20/19, start, play `D20 ×1` then pass; confirm badges, lives and the keypad render. Screenshot if the harness allows.
- [ ] **Step 4:** `run-all-gates` and `context-maintenance` skills; capture discovered work as issues.
- [ ] **Step 5:** `finishing-a-dart-branch` → push `claude/charming-hawking-bu1cg6`, open the PR (only when the user asks).
