# Track T2.3 — Nine Lives (Around the Clock V3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Nine Lives as Around the Clock V3 (a solo, three-lives setting) with its own CLASSICS card, and give preset cards their own tags and difficulty (#1051), adding no new duplication.

**Architecture:**
- **Engine (Tasks 1–3):** two lives policies in `track-policies.ts`, each with this game as first caller (D468). The Around the Clock engine gains a V3 key; its rules, seat state and outcome learn `lives` and `OUT`. V1 and V2 fold byte for byte as before.
- **Config and data (Tasks 2, 4):** `AroundTheClockV3Config` built from the V2 fields (shared const, literal overrides), validator built from one shared builder, capability rows in `0007`, seed `0049`.
- **Card tags (Tasks 5–7, #1051):** a `ruleset_version_tags` table and a `CARD` branch in `v_catalog_tags`; the generator reads a `Card ruleset:` header from `nine-lives.md`; the games page prefers a card's own tag set over its game type's.
- **UI (Tasks 8–9):** Lives switch on the existing setup form, one shared query-param reader, a lives tile and results rows on the existing interface and modal.

**Tech Stack:** TypeScript, Zod, Vitest, Astro + Alpine, PostgreSQL migration + seeds, bash gates.

**Spec:** `docs/superpowers/specs/2026-10-21-track-wave-t2-design.md` (T2.3). Rules: `docs/game-rules/rulesets/nine-lives.md`, `docs/game-rules/rulesets/around-the-clock.md` (Nine Lives row). Model plans: `docs/superpowers/plans/2026-10-22-track-t2-snakes-ladders.md` (shipped, PR #1058), `2026-10-21-track-t2-halve-it.md` (PR #1055).

## Global Constraints

- **Branch:** `feat/track-t2-nine-lives`, cut from `origin/main` at `6cae8f0`. The PR targets `main`. Never merge to `main`; never use `--no-verify`.
- **TDD** per `app/CLAUDE.md` §TDD: failing test first, watch it fail, then code. Run from `app/` with `npm test -- <path>`.
- **Comments:** none inside function bodies; JSDoc above declarations only, no decision history.
- **Quality gates:** fallow complexity ≤ 15, CRAP ≤ 30, no unused exports; `npm run validate:app` exits 0 with the type gate at 0/0/0. It needs a temporary `app/.env` with `DATABASE_URL=postgres://postgres@localhost:5433/integration?sslmode=disable`; delete it afterwards.
- **Types:** inline `export type` in implementation files is forbidden (`check-type-barrels.sh`); new types go in the module's `types.ts`.
- **Type-check:** `npm run check` at the end of every code task.
- **Coverage gate:** `scripts/check-test-coverage.sh` runs per commit; each task's Files list names the covering test.
- **Tests:** existing tests are append-only. A test may be re-pointed only when its subject migrates, by ledgered ruling.
- **Migrations:** never modify `0001`–`0048`. This plan adds `0049` (card tags), unmerged, proven pending only by `db:status` rules in the repo `CLAUDE.md`.
- **Seed:** number `0049` (highest seed on `main`: `0048`). Ids, none in use:
  - ruleset version `0198f100-0000-7000-8000-000000000019`
  - (highest in use: `…000018`; re-check with `grep -rho "0198f100-0000-7000-8000-0000000000[0-9a-f]*" database/seeds | sort -u | tail -1`)
- **Decisions:** `D481` (V3 and the lives policies, Task 10) and `D482` (card-level tags, Task 10). `bash scripts/next-decision-id.sh` printed `D481` on 2026-10-22; re-run before the PR and renumber with `scripts/renumber-decision.sh` if it moved.
- **Discovered work:** anything else goes to a `discovered-work` issue; never fix it here. #1051 is in scope; the PR closes it.
- **Commits** end with:
  ```
  Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_017ishGxJ81EA5Sn8MYrA7Gg
  ```
  The commit hook is slow: 400000 ms timeout, output redirected to a log in the workspace.
- **Before the PR:** `cd app && npm run format && npm run format:check`.
- **Naming:** policies `noteVisitHit`, `loseLifeOnBlank`; types `LivesTrackExt`, `AroundTheClockLivesExt`, `AroundTheClockV3Config`, `AroundTheClockV3Snapshot`; key `AROUND_THE_CLOCK_V3`; card title `Nine Lives`; card href `/games/around-the-clock/setup?lives=3`.
- **Duplication:** the Reuse audit above is binding. Task 1 Step 0 records `npx fallow dupes --mode semantic --min-tokens 30 <path>` for `src/modules/game`, `src/services/rulesets`, `src/lib/game`, `src/components/layout/games`; Task 11 re-runs it. No path's duplicated-line count may rise.

## Spec refinements (write back into the spec on approval)

1. **`lives` is required on V3, not nullable (§3).** `AroundTheClockV3Config` = V2 fields + `lives: z.literal(3)`. The setup form selects V3 only when lives are on, so a nullable `lives` is a branch nothing reaches, and the seat cap becomes a plain `SEAT_CAPS.AROUND_THE_CLOCK_V3 = 1` (the seat check sees the ruleset key only). Built from a shared `AroundTheClockV2Fields` object with literal overrides `difficulty: z.literal("EASY")`, `duration_type: z.literal("UNTIMED")`, `duration_value: z.null()`, so V3 has no `superRefine` and no refinement contract of its own. The V2-through-V3 replay test becomes "V2 snapshot folds identically with the lives-aware engine".
2. **`loseLifeOnBlank` reads a visit-hit flag, not `hitsThisVisit` (§2.2).** Easy's `advanceOnHit` zeroes `hitsThisVisit` on each hit, so `hitsThisVisit === 0` would charge a life for a visit that hit on dart 1. A new per-dart policy `noteVisitHit` sets `ext.visitHit`; `loseLifeOnBlank` reads and clears it at visit close.
   - `LivesTrackExt = { lives: number | null; visitHit: boolean }`. `lives: null` makes both policies no-ops, so V1/V2 take the same code path.
   - The engine-internal ext is `AroundTheClockLivesExt = AroundTheClockTrackExt & LivesTrackExt`; `AroundTheClockTrackExt` itself is unchanged (existing tests build it).
3. **Seat state (§4).** `AroundTheClockSeatState` gains optional `lives` and `visitHit`, present only when the snapshot carries `lives`, and `status` gains `"OUT"`. Optional, because existing tests build the type and goldens must not change. `AroundTheClockRules` gains optional `lives`.
4. **Outcome (§3).** The session is over when the solo seat is `COMPLETE` or `OUT`; solo status maps both to `COMPLETE`. The result records `lives` left and `out`.
5. **Validators.** `aroundTheClockV2Validator`'s wrapper becomes `aroundTheClockVariantValidator(schema)`; V2 and V3 call it. No third copy of the OUTER_SINGLE gate.
6. **Card-level tags (#1051).**
   - Migration `0049_ruleset_version_tags.sql`: table `ruleset_version_tags (ruleset_version_id, tag_id, is_primary, created_at)`, a partial unique index for one primary tag, and a `CARD` branch in `v_catalog_tags` (type_key is the ruleset version key; context `STANDALONE`). The migration carries the view recreate.
   - `nine-lives.md` gains the header `Card ruleset: \`AROUND_THE_CLOCK_V3\``; the generator reads it and writes the card's tags to `ruleset_version_tags`. A rules file with a card header and no game type is not "unbuilt".
   - The catalog response gains `cards: Record<rulesetVersionKey, CatalogTagSet>`.
   - A card's own set replaces its game type's set wholesale; a card with no row falls back as today. `gameTags(gameTypeKey, cardKey?)` and `gameLevel(gameTypeKey, cardKey?)` gain the optional second parameter (existing calls unchanged).
7. **Rules-file edits.** `nine-lives.md` Format tag `SOLO` only (V1 ships one seat; the file's `SOLO, ONE_V_ONE, MULTIPLAYER` would label a card for modes it cannot play); `Current version:` → `V1 (shipped 2026-10-22)`. `around-the-clock.md` `Current version:` → `V3`. Tag seed regenerated.
8. **Card preset.** `href` carries `?lives=3`. The setup `init` reads it through one shared `searchParamFromLocation(name)` (new, `lib/location.ts`); `routineIdFromLocation` is rewritten on top of it, so there is one query reader, not two. This replaces the spec's `setupPresetFromLocation` in `setup-controller.ts`: one game, one key, so the generic option map and `presetQuery` option would be machinery with a single caller. `check-game-wiring.sh` must read the route slug through the query; if it does not, the gate's href parse is fixed in the same task (ledgered).

## Reuse audit (2026-10-22): duplicates found in the first draft and how this plan avoids them

| Would-be duplicate | Existing piece | Resolution |
| --- | --- | --- |
| Third `"pathDirection" in config ? … : …` key ternary, in the engine and again in the play data | engine `keyOf` and play-data `keyOf` (two copies today) | engine exports `rulesetKeyOf`; play data imports it and deletes its copy (Task 3, Task 9) |
| V3 config re-listing the V2 fields and the V2 duration `superRefine` | `AroundTheClockV2Config` | shared `AroundTheClockV2Fields`; V3 overrides with literals, no refine (Task 2) |
| V3 refinement contract copying V2's duration cases | `aroundTheClockV2Contract` | none needed: V3 has no refinement (Task 2) |
| V3 validator wrapper copying V2's OUTER_SINGLE gate | `aroundTheClockV2Validator` | `aroundTheClockVariantValidator(schema)` (Task 2) |
| New per-ruleset capability verification SQL (the 11th copy of `0027`) | `0007_capability_seed_checks.sql` owns exact-count parity and already lists every ruleset's rows | add V3 to `0007`'s lists only; no `0049` verification file (Task 4) |
| Second query-string reader | `routineIdFromLocation` | one `searchParamFromLocation`; routines rewritten on it (Task 8) |
| Third copy of the play-again "resend variants as overrides" block | the same block in `around-the-clock-play.data.ts` (V2) and `shanghai-play.data.ts` (V2) | one `variantsPlayAgain(key)` beside `runPlayAgain`; both games and V3 call it (Task 9) |
| `Reached` result row declared in `TIMED_ROWS` and again in `LIVES_ROWS` | `TIMED_ROWS` | one `REACHED_ROW` const used by both (Task 9) |
| Card-tag generator branch copying the game and exercise branches | `linkInserts` | `linkInserts` gains the third table kind and shares its row build (Task 6) |
| Third link table, third view branch | `game_type_tags`, `exercise_type_tags`, `v_catalog_tags` | **kept, by decision**: the repo rule is one typed link table per tagged entity (no EAV, no polymorphic FK), and a ruleset version is a third entity. Folding it into `game_type_tags` means a nullable second FK and a reworked primary key on live data. Flagged for your call |

## Review Focus

1. **Hit on dart 1, then two misses keeps the life.** The Easy trap: a hit advances the target and zeroes `hitsThisVisit`. Pinned in Task 1 (`a visit with an earlier hit keeps its life`) and Task 3 (`hit then two misses keeps the life`).
2. **Third blank visit puts the seat out; darts are refused.** The kernel's last visit-close dart sets `OUT`; `record` then throws; session status is `COMPLETE`. Pinned in Task 1 (`out at zero lives`) and Task 3 (`the third blank visit ends the session`, `record refuses after out`).
3. **A bull hit with lives left completes, and costs nothing.** The visit closes early on the bull; `visitHit` is true so no life is lost. Pinned in Task 3 (`bull hit with lives left completes`).
4. **V1 and V2 are untouched.** No `lives` key on their seat states; goldens and V2 replays identical; a V2 snapshot never reads as V3. Pinned in Task 3 (`V2 snapshot folds without lives fields`, the existing goldens re-run).
5. **V3 config refuses what it cannot play.** Lives with HARD or timed, `lives: 2`, and a missing `lives`. Two seats are refused by the seat check. Pinned in Task 2 (`V3 refuses...`, `SEAT_CAPS`).
6. **The card never starts a V2 session.** `?lives=3` opens setup with lives on; toggling lives off before start sends V2; adding a guest or bot turns lives off. Pinned in Task 8.
7. **The Nine Lives card shows its own tags; the Around the Clock card keeps its own.** Pinned in Task 7.
8. **Undo across a life loss.** Undoing the third dart of a blank visit restores the life (lives are folded, never stored). Pinned in Task 3 (`undo restores the life`).

---

### Task 1: Lives policies

**Files:**
- Modify: `app/src/modules/game/track-policies.ts`, `app/src/modules/game/types.ts`
- Test: append to `app/tests/modules/game/track-policies.test.ts`

**Interfaces:**
- Produces (types.ts):
  ```ts
  export type LivesTrackExt = { lives: number | null; visitHit: boolean };
  export type AroundTheClockLivesExt = AroundTheClockTrackExt & LivesTrackExt;
  ```
  and (track-policies.ts):
  ```ts
  export function noteVisitHit<TExt extends LivesTrackExt>(seat: TrackSeat<TExt>, dart: JudgedDart): TrackSeat<TExt>;
  export function loseLifeOnBlank<TExt extends LivesTrackExt>(seat: TrackSeat<TExt>): TrackSeat<TExt>;
  ```

- [ ] **Step 0: Duplication baseline.** Run `cd app && npx fallow dupes --mode semantic --min-tokens 30 <path>` for the four paths in Global Constraints. Ledger the duplicated-line counts.
- [ ] **Step 1: Write the failing tests.** Append, reusing the file's existing seat and dart builders (read them first; names below are placeholders for them):
  ```ts
  describe("lives policies", () => {
    const seat = (ext: LivesTrackExt): TrackSeat<LivesTrackExt> => ({
      participantRef: "p",
      sideKey: "A",
      targetIndex: 4,
      score: 0,
      dartsThisVisit: 3,
      hitsThisVisit: 0,
      status: "IN_PROGRESS",
      ext,
    });

    it("noteVisitHit marks a hit and ignores a miss", () => {
      const start = seat({ lives: 3, visitHit: false });
      expect(noteVisitHit(start, judged(true)).ext.visitHit).toBe(true);
      expect(noteVisitHit(start, judged(false))).toBe(start);
    });

    it("a blank visit costs one life", () => {
      const next = loseLifeOnBlank(seat({ lives: 3, visitHit: false }));
      expect(next.ext).toEqual({ lives: 2, visitHit: false });
      expect(next.status).toBe("IN_PROGRESS");
    });

    it("a visit with an earlier hit keeps its life and clears the flag", () => {
      const next = loseLifeOnBlank(seat({ lives: 3, visitHit: true }));
      expect(next.ext).toEqual({ lives: 3, visitHit: false });
    });

    it("out at zero lives", () => {
      const next = loseLifeOnBlank(seat({ lives: 1, visitHit: false }));
      expect(next.ext.lives).toBe(0);
      expect(next.status).toBe("OUT");
    });

    it("with no lives set both policies leave the seat as is", () => {
      const start = seat({ lives: null, visitHit: false });
      expect(noteVisitHit(start, judged(true))).toBe(start);
      expect(loseLifeOnBlank(start)).toBe(start);
    });
  });
  ```
- [ ] **Step 2: Run** `npm test -- tests/modules/game/track-policies.test.ts`. Expected: FAIL; the policies are not exported.
- [ ] **Step 3: Implement.**
  - `types.ts`: add the two types beside `AroundTheClockTrackExt`.
  - `track-policies.ts`, after `lapOnWrap`:
    ```ts
    /** Per-dart policy: a hit sets the visit-hit flag the lives rule reads; a no-lives seat is untouched. */
    export function noteVisitHit<TExt extends LivesTrackExt>(
      seat: TrackSeat<TExt>,
      dart: JudgedDart,
    ): TrackSeat<TExt> {
      if (seat.ext.lives === null || !dart.hit) return seat;
      return { ...seat, ext: { ...seat.ext, visitHit: true } };
    }

    /** Visit-close policy: a visit with no hit costs a life, the third lost life puts the seat `OUT`; the flag resets. */
    export function loseLifeOnBlank<TExt extends LivesTrackExt>(
      seat: TrackSeat<TExt>,
    ): TrackSeat<TExt> {
      const { lives, visitHit } = seat.ext;
      if (lives === null) return seat;
      const left = visitHit ? lives : lives - 1;
      const next = { ...seat, ext: { ...seat.ext, lives: left, visitHit: false } };
      return left <= 0 ? { ...next, status: "OUT" } : next;
    }
    ```
    Import `LivesTrackExt` from `./types`.
- [ ] **Step 4: Run** the Step 2 command, then two mutation checks (each reverted after): `visitHit ? lives : lives - 1` → `lives - 1` fails `keeps its life`; `left <= 0` → `left < 0` fails `out at zero lives`. Then `npm run check`. Expected: PASS, 0/0/0.
- [ ] **Step 5: Commit**
  ```bash
  git add app/src/modules/game app/tests/modules/game/track-policies.test.ts
  git commit -m "feat(track): noteVisitHit and loseLifeOnBlank lives policies"
  ```

---

### Task 2: V3 key, config, validator, registries, seat cap

**Files:**
- Modify: `app/src/lib/game/rulesets/types.ts` (Zod config, key union, `RULESET_CONFIGS`, snapshot, `ConfigSnapshotFor`, `AroundTheClockEngineConfig`), `app/src/lib/game/rulesets/capabilities.ts`, `app/src/services/rulesets/around-the-clock/around-the-clock.validator.ts`, `app/src/services/rulesets/registry.ts`, `app/src/services/session-seats.service.ts`, `app/src/modules/game/session-progress.module.ts`
- Test: append to `app/tests/lib/game/rulesets/types.test.ts`, `app/tests/services/rulesets/around-the-clock/around-the-clock.validator.test.ts`, `app/tests/services/session-seats.service.test.ts`, `app/tests/lib/game/rulesets/capabilities.test.ts`, `app/tests/services/rulesets/registry.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const AroundTheClockV3Config: ZodType;
  export type AroundTheClockV3Snapshot = AroundTheClockV2Snapshot & { lives: 3 };
  ```
  `RulesetVersionKey` gains `"AROUND_THE_CLOCK_V3"`; `AroundTheClockEngineConfig` gains `Seated<AroundTheClockV3Snapshot>`.

- [ ] **Step 1: Write the failing tests.**
  - `types.test.ts`: `V3 accepts the V2 fields with lives 3 on Easy untimed`; `V3 refuses lives with HARD`; `V3 refuses lives with a timed run`; `V3 refuses a duration_value`; `V3 refuses lives 2`; `V3 refuses a missing lives`; `V3 refuses an unknown key`; `V2 schema behaviour unchanged after the field extraction` (the existing V2 tests re-run).
  - validator test: `V3 refuses outer single outside VISUAL_BOARD capture` (mirror the V2 case); `V3 accepts any segment on keypad capture`.
  - seats test: `a second seat is refused for AROUND_THE_CLOCK_V3`; `one seat is accepted`.
  - capabilities test: `AROUND_THE_CLOCK_V3 declares DETAILED_DARTS and VISUAL_BOARD`; dartbot unsupported (`supportsDartbot("AROUND_THE_CLOCK_V3")` is false).
  - registry test: `AROUND_THE_CLOCK_V3 has a validator`.
- [ ] **Step 2: Run** the five files. Expected: FAIL on the missing key, schema and caps.
- [ ] **Step 3: Implement.**
  - `types.ts`: extract V2's `z.object({...})` into a module const `AroundTheClockV2Fields` (V2 then wraps it with its existing `.strict().superRefine(...)`, unchanged behaviour), then
    ```ts
    export const AroundTheClockV3Config = AroundTheClockV2Fields.extend({
      difficulty: z.literal("EASY"),
      duration_type: z.literal("UNTIMED"),
      duration_value: z.null(),
      lives: z.literal(3),
    }).strict();
    ```
    Add `AROUND_THE_CLOCK_V3` to `RulesetVersionKey`, `RULESET_CONFIGS`, `ConfigSnapshotFor` (the camel-cased snapshot), and the engine-config union.
  - `refinement-contract.ts`: no change (V3 has no refinement); run `check-refinement-coverage.sh` to confirm.
  - `capabilities.ts`: add V3 to the three maps with the V2 values; leave it out of `RULESET_DARTBOT`.
  - validator: extract `aroundTheClockVariantValidator(schema)` from `aroundTheClockV2Validator`'s IIFE; V2 calls it with `AroundTheClockV2Config`, V3 with `AroundTheClockV3Config`. `registry.ts`: `AROUND_THE_CLOCK_V3: aroundTheClockV3Validator`.
  - `session-seats.service.ts`: `AROUND_THE_CLOCK_V3: 1`.
  - `session-progress.module.ts`: `AROUND_THE_CLOCK_V3: aroundTheClock` in `SUMMARIZERS`.
- [ ] **Step 4: Run** the Step 2 files, then `npm run check`. Fix every exhaustive `Record<RulesetVersionKey, …>` the type gate names by adding the V3 row (V2's value). Expected: PASS, 0/0/0.
- [ ] **Step 5: Commit**
  ```bash
  git add app/src app/tests
  git commit -m "feat(game): Around the Clock V3 key, config, validator and seat cap"
  ```

---

### Task 3: Engine — lives, OUT, outcome, factories

**Files:**
- Modify: `app/src/modules/game/around-the-clock.engine.module.ts`, `app/src/modules/game/types.ts`
- Test: append to `app/tests/modules/game/around-the-clock.engine.module.test.ts` and `app/tests/modules/game/around-the-clock.golden.test.ts`

**Interfaces:**
- Consumes: `noteVisitHit`, `loseLifeOnBlank`, `AroundTheClockLivesExt` (Task 1); `AroundTheClockV3Snapshot` (Task 2).
- Produces: `rulesetKeyOf(config): RulesetVersionKey` (exported); `AroundTheClockRules.lives?: number`; `AroundTheClockSeatState.lives?: number`, `.visitHit?: boolean`, `.status` gains `"OUT"`; `aroundTheClockV3EngineFactory`.

- [ ] **Step 1: Write the failing tests** (build a `v3` helper like the golden file's `v2` helper, `lives: 3`; use the file's observation helpers):
  - `hit then two misses keeps the life` (target 1 hit on dart 1, darts 2–3 miss: `lives` 3, target index 1).
  - `the first two blank visits cost a life each` (`lives` 1 after two).
  - `the third blank visit ends the session` (`status` `OUT`, engine `deriveState().status` `COMPLETE`, `isComplete()`).
  - `record refuses after out` (throws the session-ended refusal).
  - `bull hit with lives left completes` (walk to the bull with hits; last dart on the bull: seat `COMPLETE`, lives unchanged).
  - `undo restores the life` (after the third blank visit's last dart, `undoLastDart` returns lives 1, status `IN_PROGRESS`).
  - `lives apply with odds first and high to low` (path settings combine).
  - `V2 snapshot folds without lives fields` (a V2 seat state `not.toHaveProperty("lives")`; `rulesOf` of V2 has no `lives`).
  - `rulesetKeyOf reads lives`: engine built from a V3 snapshot reports `AROUND_THE_CLOCK_V3`; a V2 snapshot reports V2.
  - golden: append a `"v3 lives, odds first"` config to `CONFIGS` (the file's own mechanism); run the file; existing snapshots are unchanged, one new snapshot is written and reviewed.
- [ ] **Step 2: Run** the two files. Expected: FAIL (new tests); existing goldens PASS.
- [ ] **Step 3: Implement** in `around-the-clock.engine.module.ts`:
  - `rulesOf`: when `"lives" in config`, return `{ …, lives: config.lives }`. `V1_RULES` unchanged.
  - `initialSeatState(seat, lives?)`: spread `{ lives, visitHit: false }` only when `lives !== undefined`; `initialAroundTheClockState` passes `rulesOf(config).lives`.
  - `clockRules` returns `TrackRules<AroundTheClockLivesExt>`:
    ```ts
    onDart: easy
      ? (seat, dart) => advanceOnHit(noteVisitHit(seat, dart), dart)
      : noteVisitHit,
    onVisitClose: easy
      ? (seat) => wrap(loseLifeOnBlank(seat))
      : (seat) => wrap(judge(loseLifeOnBlank(seat))),
    ```
    Type `wrap` and `judge` on `AroundTheClockLivesExt`.
  - `toTrackSeat`: `status` `COMPLETE`→`DONE`, `OUT`→`OUT`, else `IN_PROGRESS`; `ext: { laps, lives: lives ?? null, visitHit: visitHit ?? false }`.
  - `toClockSeat`: status maps `DONE`→`COMPLETE`, `OUT`→`OUT`; spread `{ lives, visitHit }` only when `seat.ext.lives !== null`.
  - `foldAroundTheClockState`: `initialExt` is `() => ({ laps: 0, lives: rules.lives ?? null, visitHit: false })`; the `activeSeat` completion predicate and the solo status use `status !== "IN_PROGRESS"`; `scoreCompareOutcome`'s `completed` stays `=== "COMPLETE"` (an `OUT` seat is solo-only).
  - `wouldCompleteSession`: untimed `seatDone = after.status !== "IN_PROGRESS"`.
  - `clockSpec.rulesetVersionKeys` adds `"AROUND_THE_CLOCK_V3"`; `keyOf` becomes the exported `rulesetKeyOf` and returns V3 when `"lives" in config`; one unexported V3 factory is built and registered beside the V1 and V2 ones (the exported V1/V2 factories stay: tests import them).
  - `types.ts`: the type changes listed in Interfaces. Update the engine JSDoc to name V3.
- [ ] **Step 4: Run** Step 2's files, then the whole `tests/modules/game`, `tests/modules/stats`, `tests/lib/stats`, `tests/lib/game` directories, then `npm run check`. Expected: PASS, 0/0/0; no existing snapshot changes. Two mutation checks: drop `noteVisitHit` from `onDart` (fails `hit then two misses keeps the life`); change the solo status to `=== "COMPLETE"` only (fails `the third blank visit ends the session`).
- [ ] **Step 5: Commit**
  ```bash
  git add app/src/modules/game app/tests/modules/game
  git commit -m "feat(game): Around the Clock V3 engine with lives and out"
  ```

---

### Task 4: Seed `0049` and capability rows

**Files:**
- Create: `database/seeds/0049_around_the_clock_v3_ruleset.sql`
- Modify: `database/seeds/0007_ruleset_version_capabilities.sql`, `database/verification/0007_capability_seed_checks.sql`, `database/README.md`
- Test: `0007_capability_seed_checks.sql` on the throwaway Postgres; `app/tests/lib/game/rulesets/capabilities.test.ts` (Task 2) pins the TS side

**Interfaces:** none.

- [ ] **Step 1: Write** the seed as `0027_around_the_clock_v2_game_engine_reference.sql` does: one `INSERT INTO ruleset_versions` with id `0198f100-0000-7000-8000-000000000019`, game type `0198f000-0000-7000-8000-000000000009`, key `AROUND_THE_CLOCK_V3`, `version_number` 3, a description naming lives and the single seat, `ON CONFLICT (id) DO NOTHING`.
- [ ] **Step 2: No new verification file.** `0007_capability_seed_checks.sql` owns exact-count parity for every ruleset's capability rows; the per-ruleset files (`0010`, `0027`, `0031`, …) are copies of one another and a twelfth adds nothing the parity check does not assert. Ledger the ruling.
- [ ] **Step 3: Add** the four V3 capability tuples to `0007` at each of its three lists (lines 65–66 pattern, 119–120, 242–243) and the matching expected-count rows in `0007_capability_seed_checks.sql`; the count rises by two.
- [ ] **Step 4: Run** on the throwaway Postgres: `npm run db:migrate`, `npm run db:seed`, `psql -f database/verification/0007_capability_seed_checks.sql`. Expected: every row `PASS`, the counts at their new values.
- [ ] **Step 5: Commit**
  ```bash
  git add database
  git commit -m "feat(db): seed Around the Clock V3 ruleset and capabilities"
  ```

---

### Task 5: Migration `0049` — `ruleset_version_tags` and the `CARD` view branch

**Files:**
- Create: `database/migrations/0049_ruleset_version_tags.sql`
- Modify: `app/src/db/schema.ts` (table and view, by `npm run db:introspect`), `database/README.md`, `docs/architecture/05-Database/**` (the tag tables chapter, found via the context map)
- Test: `app/tests/db/**` schema-drift gate and `statistics-sql`/view integration test that reads `v_catalog_tags` (find with `grep -rln v_catalog_tags app/tests`); append a CARD case

**Interfaces:**
- Produces: `ruleset_version_tags (ruleset_version_id UUID, tag_id SMALLINT, is_primary BOOLEAN, created_at TIMESTAMPTZ)`; `v_catalog_tags` rows with `entity_kind = 'CARD'`, `type_key` the ruleset implementation key, `context_key = 'STANDALONE'`.

- [ ] **Step 1: Prove** `0049` is unused: `ls database/migrations | tail -1` is `0048_…`; `npm run db:status` runs on the throwaway cluster.
- [ ] **Step 2: Write the failing test** (integration): insert a `ruleset_version_tags` row for `AROUND_THE_CLOCK_V3` with one primary tag, read `v_catalog_tags`, expect one row `entity_kind = 'CARD'`, the ruleset key as `type_key`, and a unique-primary violation on a second primary tag for the same ruleset.
- [ ] **Step 3: Write** the migration:
  ```sql
  CREATE TABLE ruleset_version_tags (
      ruleset_version_id UUID NOT NULL,
      tag_id SMALLINT NOT NULL,
      is_primary BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (ruleset_version_id, tag_id),
      CONSTRAINT fk_ruleset_version_tags_ruleset_version FOREIGN KEY (ruleset_version_id) REFERENCES ruleset_versions(id) ON DELETE CASCADE,
      CONSTRAINT fk_ruleset_version_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE RESTRICT
  );
  CREATE UNIQUE INDEX uq_ruleset_version_tags_primary ON ruleset_version_tags (ruleset_version_id)
      WHERE is_primary;
  COMMENT ON TABLE ruleset_version_tags IS '...';
  ```
  Then `CREATE OR REPLACE VIEW v_catalog_tags` with the 0047 body plus a third `UNION ALL` branch:
  ```sql
  SELECT 'CARD'::text AS entity_kind, rv.implementation_key AS type_key,
      'STANDALONE'::text AS context_key, ta.implementation_key AS axis_key,
      t.implementation_key AS tag_key, t.name AS tag_name,
      rvt.is_primary, t.sort_order, ar.axis_rank
  FROM ruleset_version_tags rvt
      JOIN ruleset_versions rv ON rv.id = rvt.ruleset_version_id
      JOIN tags t ON t.id = rvt.tag_id
      JOIN axis_ranks ar ON ar.tag_id = t.id
      JOIN tag_axes ta ON ta.id = t.tag_axis_id
  ```
  `CREATE OR REPLACE VIEW` may only append columns, not change the body shape: if Postgres refuses, use `DROP VIEW` + `CREATE VIEW` as 0047 does (ledgered). Header, `Contains:` list and `COMMENT ON` per `database/CLAUDE.md`'s checklist; update the view comment to name `CARD`.
- [ ] **Step 4: Run** `npm run db:migrate`, `npm run db:drift`, `npm run db:introspect`; apply the `schema.ts` diff the introspection prints. Run the Step 2 test. Expected: PASS; no drift.
- [ ] **Step 5: Commit**
  ```bash
  git add database app/src/db app/tests docs/architecture/05-Database
  git commit -m "feat(db): ruleset_version_tags and a CARD branch in v_catalog_tags"
  ```

---

### Task 6: Tag generator reads card tags

**Files:**
- Modify: `app/scripts/tags/parse-tags.ts`, `app/scripts/generate-tag-seed.ts`, `docs/game-rules/rulesets/nine-lives.md`, `docs/game-rules/rulesets/around-the-clock.md`, `database/seeds/0042_catalog_tags.sql` (generated), `docs/game-rules/TAGS.md` (only if it documents the header fields)
- Test: append to `app/tests/scripts/generate-tag-seed.test.ts` and the parser's test (`app/tests/scripts/tags/`, find with `grep -rln parseRulesFile app/tests`)

**Interfaces:**
- Produces: `parseRulesFile(md, axes)` returns `{ gameTypeKey, exerciseTypeKey, cardRulesetKey, blocks }`; `SeedInput.cards: Map<string, TagBlock[]>`.

- [ ] **Step 1: Write the failing tests.**
  - parser: `reads the Card ruleset header` (`Card ruleset: \`AROUND_THE_CLOCK_V3\`` → `cardRulesetKey`); `a file without it returns null`.
  - generator: `emits card tags into ruleset_version_tags guarded by the ruleset existing` (output contains `INSERT INTO ruleset_version_tags` and `WHERE v.ruleset_version_id IS NOT NULL`); `clears the table before refilling` (`DELETE FROM ruleset_version_tags;`); `a card file is not a duplicate game type`; `card blocks use the STANDALONE block only`.
- [ ] **Step 2: Run** both. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - parser: `const cardRulesetKey = /^Card ruleset: \`([A-Z0-9_]+)\`\s*$/m.exec(md)?.[1] ?? null;` returned with the rest.
  - generator: `generate()` collects `cards` for files with a `cardRulesetKey` (not stored in `games`); `buildSeedSql` writes, after the game links:
    ```
    INSERT INTO ruleset_version_tags (ruleset_version_id, tag_id, is_primary, created_at)
    SELECT * FROM (VALUES
      ((SELECT id FROM ruleset_versions WHERE implementation_key = 'AROUND_THE_CLOCK_V3'), 6, TRUE, now()), …
    ) AS v (ruleset_version_id, tag_id, is_primary, created_at)
    WHERE v.ruleset_version_id IS NOT NULL;
    ```
    plus `DELETE FROM ruleset_version_tags;` beside the other two deletes. Share the row-building code with the exercise branch (`linkInserts` already builds `rows`); extend it with a third table kind rather than copying it (no new duplicate).
  - `nine-lives.md`: header gains `Card ruleset: \`AROUND_THE_CLOCK_V3\``; `Current version: V1 (shipped 2026-10-22)`; Format row → `SOLO`; Features rows stay. `around-the-clock.md`: `Current version: V3 (shipped 2026-10-22)`.
- [ ] **Step 4: Run** `npm test -- tests/scripts`, `npm run tags:generate`, `npm run tags:generate -- --check`, `bash scripts/check-game-rules.sh`, `bash scripts/test-check-game-rules.sh`. If the game-rules gate rejects a ruleset file with a card header and no `Game type:`, extend the gate and its fixture test in this task (ledgered). Expected: PASS; the regenerated `0042` differs only by the card rows and the cleared table.
- [ ] **Step 5: Commit**
  ```bash
  git add app/scripts app/tests/scripts docs/game-rules database/seeds/0042_catalog_tags.sql
  git commit -m "feat(tags): generator reads card tags from a Card ruleset header"
  ```

---

### Task 7: Catalog tags serve and the games page uses card tags

**Files:**
- Modify: `app/src/repositories/catalog.repository.ts` (none expected: the view's new rows flow through), `app/src/services/catalog.service.ts`, `app/src/lib/catalog/types.ts`, `app/src/lib/game/games-index.data.ts`, `app/src/pages/games/index.astro`, `app/src/pages/api/catalog-tags/types.ts` and `index.ts` (response schema, if declared there)
- Test: append to `app/tests/services/catalog.service.test.ts`, `app/tests/lib/game/games-index.data.test.ts`, the catalog-tags API types test

**Interfaces:**
- Produces: `CatalogTagsResponse.cards: Record<string, CatalogTagSet>`; `gameTags(gameTypeKey: string, cardKey?: string): CatalogTag[]`; `gameLevel(gameTypeKey: string, cardKey?: string): DifficultyLevel | null`.

- [ ] **Step 1: Write the failing tests.**
  - service: `CARD rows land under cards keyed by ruleset key`; `a CARD row never leaks into games`; `cards is empty when no CARD rows`.
  - games-index: `gameTags prefers the card's own set`; `gameTags falls back to the game type when the card has none`; `gameLevel reads the card's difficulty`; `existing one-argument calls unchanged`.
  - API types test: the response schema accepts `cards`.
- [ ] **Step 2: Run** the three files. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `collect` in `catalog.service.ts` gains a `cards: Map<string, RankedTag[]>` branch for `entityKind === "CARD"` (reuse `pushTo`, `finishSet`); the response builder fills `cards` from it. The `else throw` stays for unknown kinds.
  - `types.ts`: `cards` in `CatalogTagsResponse`.
  - `games-index.data.ts`: both getters read `this.catalogTags?.cards[cardKey]` first when `cardKey` is given, else the game-type path; `index.astro` passes `'${game.rulesetVersionKey}'` as the second argument in both calls.
- [ ] **Step 4: Run** Step 2's files, `npm run check`. Expected: PASS, 0/0/0.
- [ ] **Step 5: Commit**
  ```bash
  git add app/src app/tests
  git commit -m "feat(catalog): cards carry their own tags and difficulty (#1051)"
  ```

---

### Task 8: Setup form, preset query, card

**Files:**
- Create: `app/src/lib/location.ts`
- Modify: `app/src/lib/training/routines/routine-route.ts`, `app/src/lib/game/around-the-clock-setup.data.ts`, `app/src/lib/game/types.ts` (`AroundTheClockSetupContext.lives`), `app/src/components/layout/games/setup/AroundTheClockSetupForm.astro`, `app/src/lib/game/rulesets/games-visibility.ts`, `docs/architecture/07-Frontend/09-Adding-A-Game.md` (preset cards may carry a query)
- Test: append to `app/tests/lib/game/around-the-clock-setup.data.test.ts`, `app/tests/lib/location.test.ts` (create), `app/tests/lib/training/routines/routine-route.test.ts` (existing, re-run unchanged), `app/tests/lib/game/rulesets/games-visibility.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function searchParamFromLocation(name: string): string | null;
  ```
  The trimmed non-empty value of `?<name>=` on the current page, or `null` (also `null` outside a browser).

- [ ] **Step 1: Write the failing tests.**
  - location: `reads a present param`; `null when absent`; `null when blank`; `null outside a browser`. `routineIdFromLocation` behaves as before (its existing tests re-run unchanged).
  - setup data: `lives on selects V3 with lives 3 and Easy untimed overrides`; `lives off selects V2`; `adding a guest turns lives off`; `adding a bot turns lives off`; `init turns lives on for ?lives=3 and leaves it off for ?lives=2 or no query`; `lives on ignores a typed duration`.
  - visibility: `the Nine Lives card is in CLASSICS with the lives href and the V3 key`; `it shows only where V3 is supported for the mode`; `the Around the Clock card is unchanged`.
- [ ] **Step 2: Run** the three files. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `lib/location.ts`: `searchParamFromLocation`; `routine-route.ts`: `routineIdFromLocation` returns `searchParamFromLocation(ROUTINE_PARAM)`.
  - setup data: wrap the controller's `init` (`async init() { this.lives = searchParamFromLocation("lives") === "3"; await controller.init.call(this); }`), the same wrapping `addGuest`/`addBot` already use.
  - setup data: `lives: false` in `V2_DEFAULTS` (typed on `AroundTheClockSetupContext`); `rulesetVersionKey: (ctx) => ctx.bot ? V1 : ctx.lives ? V3 : V2`; `v2Overrides` returns `{ …, lives: 3, difficulty: "EASY", duration_type: "UNTIMED", duration_value: null }` when `ctx.lives`; `addGuest` and `addBot` set `lives = false`; `init` reads `?lives=3` as above.
  - setup form: a `Switch` `label="Nine Lives"` `hint="Three lives. A visit with no hit costs one. Solo only."` `x-model="lives"` inside the no-guest block (`x-show="guests.length === 0"`), and `x-show="!lives"` on the difficulty and duration blocks; extend `infoSection.description` by one sentence.
  - `games-visibility.ts`: CLASSICS entry `{ rulesetVersionKey: "AROUND_THE_CLOCK_V3", gameTypeKey: "AROUND_THE_CLOCK", group: "CLASSICS", href: "/games/around-the-clock/setup?lives=3", title: "Nine Lives", caption: "Three lives. Miss a whole visit and one goes." }`, after the Around the Clock card.
- [ ] **Step 4: Run** Step 2's files, `npm run check`, then `bash scripts/check-game-wiring.sh`. If the gate fails on the `?lives=3` href (its route slug is read from the href), make the slug parse stop at `?` and add a case to its own test; ledger the ruling. Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add app/src app/tests docs/architecture/07-Frontend scripts
  git commit -m "feat(game): Nine Lives setup switch, preset query and card"
  ```

---

### Task 9: Play surface, results, progress, replay

**Files:**
- Modify: `app/src/lib/game/play-lifecycle.ts` (`variantsPlayAgain`), `app/src/lib/game/shanghai-play.data.ts`, `app/src/lib/game/around-the-clock-play.data.ts`, `app/src/lib/game/types.ts` (`AroundTheClockSeatResult`, play context), `app/src/components/layout/games/interfaces/AroundTheClock.astro`, `app/src/components/layout/games/result-modals/AroundTheClockResults.astro`, `app/src/modules/game/session-progress.module.ts`, `app/src/lib/stats/replay-presenters.ts`
- Test: append to `app/tests/lib/game/around-the-clock-play.data.test.ts`, `app/tests/modules/game/session-progress.module.test.ts`, `app/tests/lib/stats/replay-games.test.ts` (or the file the existing ATC presenter test lives in; find with `grep -rln "AROUND_THE_CLOCK" app/tests/lib/stats`)

**Interfaces:**
- Produces: `AroundTheClockSeatResult` gains `lives: number | null` and `out: boolean`; play context `livesLeft(): string` (empty without lives).

- [ ] **Step 1: Write the failing tests.**
  - play data: `livesLeft reads the active seat's lives` (`"3"`, `"1"`); `livesLeft is empty under V2`; `statsFor records lives and out`; `resultsTitle says out on the target stood on`; `resultsTitle for a finished lives run says session complete`; `variantsPlayAgain strips seats and wires the rest` (new helper, tested in the lifecycle's test file); `playAgain resends V3 overrides with lives`. The existing Around the Clock V2 and Shanghai V2 play-again tests re-run unchanged.
  - progress: `V3 detail names lives left`.
  - replay: `a V3 turn shows a Lives cell`; `a session out reads "Out"` (the existing `progressLabel` already turns `OUT` into `Out`; the test pins it).
- [ ] **Step 2: Run** the three files. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - play data: `variantsPlayAgain(key)` in `play-lifecycle.ts` returns the `buildOverrides` callback both games hand `runPlayAgain` (`(prior) => { const { seats: _seats, ...variants } = prior; return { snapshot: variants, wire: toWireConfig(key, variants) }; }`); Around the Clock passes it for V2 and V3, Shanghai for V2, and their inline copies are deleted; `keyOf` is deleted and `rulesetKeyOf` imported from the engine; `RESUMABLE` gains V3; `livesLeft` getter; `statsFor` sets `lives: seat.lives ?? null`, `out: seat.status === "OUT"`, and `targetAtEnd` also for an `out` seat (reuse `labelOf`); `resultsTitle` first branch: `out` → `Out on ${targetAtEnd}`; `keyOf` and `playAgain` handle V3.
  - interface astro: tile `{ label: "Lives", value: (c) => c("livesLeft"), showWhen: (c) => c("livesLeft") }`.
  - results astro: `REACHED_ROW = { label: "Reached", key: "targetAtEnd", skeletonWidth: "w-6" }` shared by `TIMED_ROWS` and `LIVES_ROWS = [...STAT_ROWS, { label: "Lives left", key: "lives", skeletonWidth: "w-6" }, REACHED_ROW]` rendered through a third `x-if` on `hasLives()`; the existing two blocks stay.
  - `session-progress.module.ts`: detail adds `Lives n` when the seat carries lives.
  - presenter: a `valueCell("Lives", seat.lives)` in the turn cells when `seat.lives !== undefined`.
- [ ] **Step 4: Run** Step 2's files, then `npm test -- tests/lib tests/modules tests/components` and `npm run check`. Expected: PASS, 0/0/0.
- [ ] **Step 5: Commit**
  ```bash
  git add app/src app/tests
  git commit -m "feat(game): Nine Lives play tile, results rows, progress and replay"
  ```

---

### Task 10: Docs and decisions D481, D482

**Files:**
- Modify: `decisions/**` (domain file per `DECISIONS.md`'s routing table), `docs/architecture/00-File-Inventory.md`, `docs/architecture/00-Context-Map-History.md`, `docs/architecture/05-Database/**` (tag tables), `docs/architecture/07-Frontend/09-Adding-A-Game.md`, the engine/kernel docs named in the context map for game engines, `docs/superpowers/specs/2026-10-21-track-wave-t2-design.md` (§13 refinements), `app/CLAUDE.md` if a rule changes

- [ ] **Step 1:** `bash scripts/next-decision-id.sh`; append `D481` (Around the Clock V3: required `lives`, `noteVisitHit`/`loseLifeOnBlank`, optional seat fields, `OUT` solo outcome; refines D243) and `D482` (card-level tags via `ruleset_version_tags` and the `CARD` view branch; closes #1051) in the domain files the router names.
- [ ] **Step 2:** Spec §13: the refinements above, as §11/§12 did. File Inventory rows for new files (`0049` migration and seeds, verification, the plan); raise any `~Nk` claim `check-context-budget.sh` reports. Context-map history entry. Database docs: the tag tables and view. Adding-A-Game: the preset-query option.
- [ ] **Step 3:** Run, each as its own `bash scripts/<name>` call: `check-decision-ids.sh`, `check-context-map.sh`, `check-doc-links.sh`, `check-context-budget.sh`; then `check-doc-sync.sh` after this commit lands.
- [ ] **Step 4: Commit**
  ```bash
  git add decisions docs
  git commit -m "docs: Nine Lives (Around the Clock V3) and card-level tags, D481, D482"
  ```

---

### Task 11: Gates, duplication, finish

- [ ] **Step 1:** Re-run the Task 1 Step 0 duplication commands; ledger the counts. None may rise; if one does, extract the shared piece first.
- [ ] **Step 2:** Integration fixture: confirm the routine-stats fixture is untouched (Nine Lives is not a routine step; `game-step.ts` keeps V2 only). Ledger that no step count changes.
- [ ] **Step 3:** Temporary `app/.env`; start the throwaway cluster; `cd app && npm run format && npm run format:check && npm run validate:app` (exit 0, 0/0/0); run the `run-all-gates` skill's lists for `app/`, `database/`, `decisions/`; delete `app/.env`; stop the cluster.
- [ ] **Step 4:** Opus final review with the Review Focus above; Critical and Important fixed RED→GREEN; Minors ledgered.
- [ ] **Step 5:** Delete the SDD workspace; re-run `bash scripts/next-decision-id.sh`; `git push -u origin feat/track-t2-nine-lives`; open the PR from `.github/pull_request_template.md` (closes #1051); `subscribe_pr_activity`; `send_later` 50 minutes.
