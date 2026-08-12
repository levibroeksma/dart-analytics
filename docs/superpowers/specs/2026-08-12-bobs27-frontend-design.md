# Bob's 27 — Recreational + Analytics Frontend — Design

Status: approved (brainstorming). Source: `app/src/modules/game/bobs27.engine.module.ts`,
`app/src/services/rulesets/bobs27/bobs27.validator.ts`, `docs/game-rules/rulesets/bobs-27.md`
(non-canonical), `docs/superpowers/specs/2026-07-24-bobs27-engine-design.md` (historical, partly
superseded by Phase 1 below).

Split into four phases, each its own plan and branch, executed **sequentially** — each phase's
branch merges to `main` before the next phase's branch is cut from it. Phase N's plan may assume
Phase N-1 is merged.

---

## Phase 1 — Scoring correction (engine)

**Why first:** every later phase's UI displays or tests against running-score deltas; get the
formula right before anything is built on top of it.

**Bug:** `pointValueOf` in `bobs27.engine.module.ts` adds the double's **face value** (D16 hit →
+16). The correct rule — confirmed by the owner, standard Bob's 27 — is the double's **board
value**: D16 hit → +32, bull hit → +50 (unchanged, already board-value). A full-miss visit
subtracts `miss_penalty_multiplier × board value` (D18 triple-miss → −36).

**Change:**

```ts
function pointValueOf(target: BoardTarget, config: Bobs27Snapshot): number {
  return target.kind === "BULL" ? config.bullHitValue : target.number * 2;
}
```

No config schema change — `start_score`/`bull_hit_value`/`miss_penalty_multiplier` keys are
unaffected; only the internal per-hit formula changes. `darts.score` (the persisted fact) already
uses `boardScore()`, the real board value — D142 was already satisfied there; only the derived,
never-persisted running total (`Bobs27State.score`) was wrong.

**Touches:**

- `app/src/modules/game/bobs27.engine.module.ts` — the one-line `pointValueOf` fix.
- `app/tests/modules/game/bobs27.engine.module.test.ts` — every score-delta assertion currently
  encodes face value (e.g. "score 27→28" for a D1 hit, "→26" for a 3-miss D1 visit); rewrite to
  board value (27→29 for D1 hit, 27→25 for 3-miss D1, D18 full-miss →27−36, etc.). Re-derive every
  fixture from the corrected formula — do not just flip signs.
- `docs/game-rules/rulesets/bobs-27.md` — rewrite the Scoring section and its two worked examples
  to board value; update the Glossary's "Full miss visit" entry.
- `decisions/game-engine.md` — new **append-only** entry citing `Supersedes:` against the
  2026-07-26 multi-hit-math resolution (grep the exact D-id before writing — do not renumber or
  edit the old entry).
- `docs/superpowers/specs/2026-07-24-bobs27-engine-design.md` stays untouched (historical); this
  document's Phase 1 is the record of the correction.

**Acceptance:** `bobs27.engine.module.test.ts` green under the corrected formula;
`bash scripts/check-decision-ids.sh` green; `docs/game-rules/rulesets/bobs-27.md`'s worked
examples arithmetically match the new formula.

**Out of scope:** validator, capability table, anything in `app/src/pages`/`components` — the
validator's only numeric check is `dart.score >= 0` and doesn't encode the point-value formula, so
it needs no change here.

---

## Phase 2 — Server-side: ANALYTICS + VISUAL_BOARD capability

**Depends on:** Phase 1 merged (uses the corrected engine as its base, though this phase touches
different functions in the same file).

**Why:** `BOBS27_V1` today only declares RECREATIONAL + DETAILED_DARTS. Phase 4's analytics/board
input has nothing to create a session against without this.

**Changes:**

1. `app/src/lib/game/rulesets/capabilities.ts` — add `VISUAL_BOARD` to `BOBS27_V1`'s pair list.
2. `database/seeds/0007_ruleset_version_capabilities.sql` — mirror the new pair (the parity test
   between this seed and `capabilities.ts` must keep passing).
3. `app/src/services/rulesets/bobs27/bobs27.validator.ts`:
   - `validateConfig` accepts RECREATIONAL+DETAILED_DARTS **or** ANALYTICS+VISUAL_BOARD (D197:
     `validateConfig` must admit every pair `validateBatch` handles).
   - `validateBatch` keeps its existing dart-presence/non-negative-score rule for DETAILED_DARTS
     and delegates to `validateVisualBoardTurns` (`visual-board.validator.ts`) for VISUAL_BOARD —
     same shape as `quick-score.validator.ts`'s `isQuickScoreOrVisualBoardCapture`, but
     DETAILED_DARTS-vs-VISUAL_BOARD instead of QUICK_SCORE-vs-VISUAL_BOARD. Add the analogous
     `isDetailedDartsOrVisualBoardCapture` helper (or inline equivalent) rather than duplicating
     `isVisualBoardCapture`'s body.
4. `app/src/modules/game/bobs27.engine.module.ts`'s `record()` — currently hardcodes
   `locationX: null, locationY: null` on every dart regardless of the observation. Pass through
   `observation.locationX`/`observation.locationY` instead. Required for board taps to carry a
   coordinate at all — without it, `classify()` re-derivation in the validator and marker
   rendering on the board both break for every Bob's 27 board session.
5. `app/src/lib/game/session-mode-resolution.ts`'s `resolveSessionModePair` — its fallback is
   currently the hardcoded `QUICK_SCORE` pair, which `BOBS27_V1` doesn't support at all (its own
   doc comment already flags this as a known gap for a future non-QUICK_SCORE caller). Generalize
   the fallback to the ruleset's own first declared pair in `RULESET_CAPABILITIES` instead of the
   hardcoded constant, so a Bob's 27 setup page with an unresolved `settings` store still starts a
   session the ruleset actually supports.

**Acceptance:** `capabilities.test.ts` parity check green; `0007_capability_seed_checks.sql` green
against a real branch if run; `bobs27.validator.test.ts` covers both mode pairs' accept/reject
paths; `check-game-engines.sh` and `check-refinement-coverage.sh` stay green (no schema change).

**Out of scope:** no page/component work — this phase is entirely `app/src/lib`,
`app/src/modules`, `app/src/services`, `database/seeds`.

---

## Phase 3 — Setup page + routing

**Depends on:** Phase 2 merged (setup page must be able to request either mode pair via
`resolveSessionModePair`).

**Changes:**

- `app/src/lib/game/rulesets/games-visibility.ts` — add a `BOBS27_V1` entry to `GAME_CARDS`:
  `href: "/games/bobs27/setup"`, title "Bob's 27", caption per the corrected ruleset description.
- `app/src/pages/games/bobs27/setup/index.astro` — mirrors `pages/games/501/setup/index.astro`'s
  shell (reconciliation, `ContinueSessionModal`, `ReconciliationBlocked`, `IsLoading`).
- `app/src/components/layout/games/setup/Bobs27SetupForm.astro` — V1 has zero editable settings
  (start score, path, mode are all locked per the ruleset doc's own "Config & presets" table), so
  this is `SetupShell` + `UserSection` + `InfoSection` only — no `Toggle`/`Input`. `InfoSection`
  description text (board-value corrected):

  > "3 targets at the designated double, for each double hit, add the double's board value to
  > your total. For each three darts missed, deduct the target double's board value from your
  > total. E.g. miss all three darts at D18 → deduct 36; hit two D16 → add 2 × 32 = 64."

- `app/src/lib/game/bobs27-setup.data.ts` — mirrors `five-oh-one-setup.data.ts` minus the
  score/legs fields: `init()` reconciles an active session against the one seeded preset, `start()`
  creates a session via `resolveSessionModePair("BOBS27_V1", this.$store.settings)` and
  `startSessionInput`, no clamp/override logic since nothing is editable.

**Acceptance:** `/games/bobs27/setup` reachable from `/games` under either app mode (RECREATIONAL
or ANALYTICS, per Phase 2's capability); starting a session under each mode succeeds and lands on
`/games/bobs27/play` (Phase 4 renders a stub or `NoSessionPanel` until that phase lands — the route
must exist and not 404, but full gameplay is not required for this phase's acceptance if sequencing
requires it; prefer landing Phase 3 and Phase 4 together if that's simpler than a genuinely
incomplete intermediate state).

**Out of scope:** play page, preview component, recreational/analytics inputs, results modal.

---

## Phase 4 — Play page: preview, recreational input, analytics input, results

**Depends on:** Phase 3 merged.

### Shared visit preview

New `app/src/components/layout/games/Bobs27VisitPreview.astro`: 3 segments in the `ScoreInput`
bordered/glass grid style, each showing a placeholder, a hit mark, or a miss mark, with a "D1 D2
D3" caption row underneath. Reads the last turn's darts off `$store.game.turns` (same source
`markersForTurns` already reads for the board), rendered above **both** inputs.

### Recreational input

New `app/src/components/layout/games/Bobs27RecreationalInput.astro`: 3 buttons, same
bordered/glass row as `ScoreInput`'s keypad — **Undo** (icon) · **MIS** · **D‹target›** (or
**BULL** at path end). No submit button; each tap commits one dart immediately via the page's
`recordTap(hit: boolean)`, which synthesizes a `DartObservation`:

- Hit: `{ hitTargetNumber: target.kind === "BULL" ? 25 : target.number, hitZoneKey: target.kind === "BULL" ? "INNER_BULL" : "DOUBLE", locationX: null, locationY: null }`
- Miss: `{ hitTargetNumber: null, hitZoneKey: "MISS", locationX: null, locationY: null }`

(same convention the board's bounce-out already uses for an unseen dart).

### Analytics input

Reuses `BoardInputPanel.astro` unchanged — no edits to it or to `board-input.data.ts`. The
1.5-second reveal-then-clear behavior is Bob's-27-only and lives entirely in
`bobs27-play.data.ts`:

- After a dart resolves a visit **while `$store.game.inputModeKey === 'VISUAL_BOARD'`**, start a
  `setTimeout(1500)` that records that visit's `clientKey` into a local `hiddenTurnKey` field.
- `visitMarkers()` (overridden on the object this factory returns, after spreading
  `...boardInputData(...)` — object-literal key order means the later definition wins, so this
  needs no change to the shared module) and the preview's dart-read both return empty when
  `$store.game.turns.at(-1)?.clientKey === hiddenTurnKey`.
- `undoVisit()` clears `hiddenTurnKey` unconditionally, so an undo — before or after the 1.5s mark
  — always shows the real reopened turn.
- Recreational mode never sets `hiddenTurnKey`, so its preview just lingers until the next tap
  (same "last turn" read `markersForTurns`/D201 already establish for 501/Score Training) — no
  timer needed there, matching that the 1.5s delay was only specified for analytics mode.

### Play-page orchestration

`app/src/lib/game/bobs27-play.data.ts` mirrors `five-oh-one-play.data.ts`'s shape minus everything
checkout-related — Bob's 27 has no bust/double ambiguity, every tap or board hit is unambiguous,
so **no confirm dialogs** are needed (simpler than 501's `showDoubleConfirm`/
`showMatchFinishConfirm`). `recordTap(hit)` and `recordDart(observation)` both funnel into one
`commitDart`: record → mirror to `$store.game` via `recordFacts` → check `engine.isComplete()` →
upload-and-complete on completion. `undoVisit()` calls `engine.undo()` and re-mirrors, same shape
as 501's.

`app/src/pages/games/bobs27/play/index.astro` mirrors `pages/games/501/play/index.astro`'s shell
(`ReconciliationBlocked`, `NoSessionPanel`, the gameplay interface, results modal) minus the
double-checkout/match-finish confirm dialogs.

`app/src/components/layout/games/interfaces/Bobs27.astro`: `SinglePlayerDisplay` (target = current
double or BULL), `Bobs27VisitPreview`, then `Bobs27RecreationalInput` (`x-show` gated on
`inputModeKey !== 'VISUAL_BOARD'`) and `BoardInputPanel` (gated the opposite way) — same
show/hide split `FiveOhOne.astro` already uses between `ScoreInput` and `BoardInputPanel`.

### Results modal

New `app/src/components/layout/games/result-modals/Bobs27Results.astro`, same shell as
`FiveOhOneResults.astro` (glass card, `StatRow`s, `completionStatus` machine, Back/Play again
buttons), headlined **Won**/**Lost** off the engine's `result()` plus final score and darts
thrown. No existing win/loss modal precedent in this codebase — new (small) pattern, not a
generalization of the existing results modals.

**Acceptance:** a full recreational game (D1→BULL) playable end to end, win and loss paths both
reachable and uploadable; a full analytics/board game playable end to end with the 1.5s
reveal-then-clear observed and undo-recoverable; `npm run validate:app` green.

---

## Cross-phase notes

- Each phase runs the `run-all-gates` skill and the mandatory `context-maintenance` skill before
  its own branch is considered done — do not defer context-map/decision-ledger updates to a final
  cleanup phase, since `main` must stay consistent between merges.
- Phase 1's decision-ledger entry is the only ledger write across all four phases; the other three
  are pure mechanical extension of already-decided patterns (D196 capability declaration, D198
  shape-dispatch, D201 marker lingering) and need no new decision row.
- Branch-stack-cap: since phases are sequential and each merges before the next is cut, no more
  than one Bob's-27 branch is ever open against another at a time — the gate should never trip if
  the merge-before-next-branch rule above is followed.
