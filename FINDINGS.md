<!--
status: canonical
scope: open findings — defects and contradictions noticed but deliberately not fixed
read-when: triaging what to fix next; never loaded by a task
updated: 2026-08-22
highest-issued: F20
-->

# Findings

> Things an agent noticed while doing something else. A finding is **not** a
> work item: it is logged here and named in the completion report, never fixed
> in the same pass. Acting on one requires explicit user permission, and is a
> new task on its own branch. (Root `CLAUDE.md`, Hard Invariants; D214.)
>
> **Opposite lifecycle to `DECISIONS.md`.** Decisions are permanent and
> append-only. Findings are open until closed, and a closed finding is
> **deleted** — the record of the fix is the commit that fixed it, plus a
> decision in `decisions/**` where the fix embodied a real choice. Nothing
> accumulates here.
>
> Guarded by `scripts/check-findings-log.sh`.

## How to add a finding

- Next id is `highest-issued` in the front matter **plus one**. Bump that line
  in the same edit. Ids are never reused — because entries are deleted, the id
  cannot be derived by scanning the file, which is exactly what the high-water
  mark is for.
- `Status:` is `Open` (logged, not yet shown to the user) or `Raised` (named in
  a completion report). There is no `Resolved`: when a finding is fixed, delete
  its block.
- `Evidence:` cites at least one real path, optionally with a `:line` locator.
  The gate checks every cited path still exists, so a finding whose subject was
  deleted or moved fails the build until the entry is corrected or removed.
- Block format:

```markdown
### F<next> — Short statement of what is wrong
Status: Open · Found: YYYY-MM-DD · Task: <branch>
Claim: what the repo asserts
Evidence: `path/to/file.md:12` vs what is actually true
Impact: what it costs an agent that trusts the claim
Proposed: the smallest change that would resolve it — a proposal, not a plan
```

---

### F1 — `permissions.allow` pre-approves a CLI that is not installed
Status: Open · Found: 2026-08-19 · Task: claude/governance-spec2
Claim: `.claude/settings.json:20-22` grants `Bash(gh pr view:*)`, `Bash(gh pr list:*)` and `Bash(gh pr diff:*)`
Evidence: `.claude/settings.json:20` — `command -v gh` finds nothing in the session container; GitHub access runs through the `mcp__github__*` tools instead
Impact: an agent reading the allowlist as a capability inventory tries `gh pr diff`, gets a shell error, and spends a round discovering the MCP tools it should have used first
Proposed: drop the three `gh` entries, or keep them and note in the settings file that they cover a locally-installed `gh` only

### F3 — `DECISIONS.md` states a stale maximum decision id
Status: Open · Found: 2026-08-19 · Task: claude/governance-spec2
Claim: "How to add a decision" names `D198` as the current maximum
Evidence: `DECISIONS.md:45` vs the derived max `D213`; the same line's ID-gap note at `DECISIONS.md:62` independently says `D212`
Impact: an agent trusting either number issues a colliding id; the derive command on the same line is correct, so the stale figures are pure trap
Proposed: drop both parentheticals and keep only the derive command, so there is no number to go stale

### F4 — `.graphifyignore` excludes a directory the invariants make impossible
Status: Open · Found: 2026-08-19 · Task: claude/governance-spec2
Claim: `.graphifyignore:6` ignores `.worktrees/`
Evidence: `.graphifyignore:6` vs `CLAUDE.md`'s "No git worktrees" hard invariant (D102), which forbids the directory from ever existing
Impact: small — a dead ignore line. It is logged because it is exactly the kind of residue that reads as evidence the practice is allowed
Proposed: delete the line

### F5 — A broken script is filed as a deferred feature
Status: Open · Found: 2026-08-19 · Task: claude/governance-spec2
Claim: `scripts/check-context-map.sh`'s migration-range regex cannot tell a seed range from a migration range, so a seed chain quoted as ending at `0003` is compared against the migration chain end and fails
Evidence: `scripts/check-context-map.sh` — the check at its "2. Migration range consistency" section; the workaround was to reword the affected doc line, leaving the script deliberately unfixed (2026-07-26)
Impact: the defect sat in `DECISIONS.md`'s Deferred list among eleven unbuilt features, where "we chose not to build this" and "this is broken" are indistinguishable
Proposed: narrow the regex to skip lines naming seeds — partly done for `decisions/**` and seed lines by D194, but the seed-vs-migration ambiguity itself remains

### F6 — The file inventory still describes `AGENT.md` as a byte-identical mirror
Status: Open · Found: 2026-08-19 · Task: claude/governance-spec2
Claim: `docs/architecture/00-File-Inventory.md` describes `scripts/check-agent-mirrors.sh` as asserting "every `CLAUDE.md` has a byte-identical `AGENT.md` sibling", and the `AGENT.md` row as an "Exact mirror of the sibling `CLAUDE.md` … edit both together"
Evidence: `docs/architecture/00-File-Inventory.md` — both rows, against D213 in `decisions/context-system.md`, which reduced all six `AGENT.md` files to pointer stubs and inverted the gate to assert the stub
Impact: an agent following the inventory copies rules into an `AGENT.md` and the inverted gate rejects the commit; the stale row says to do the exact thing the gate now forbids
Proposed: restate both rows against the stub behaviour D213 actually shipped

### F7 — Per-game capability verification scripts each assert the complete capability set
Status: Open · Found: 2026-08-19 · Task: claude/consistency-spec3
Claim: `database/verification/0010_around_the_clock_capability_checks.sql` is scoped to the one additive `AROUND_THE_CLOCK_V1` row, but its check 2 asserts "the table now holds exactly the 12 triples", i.e. every earlier game's rows too
Evidence: `database/verification/0010_around_the_clock_capability_checks.sql` header check 2, and the same shape in `database/verification/0009_121_capability_checks.sql`
Impact: game ten's seed makes both scripts fail on their exact-count assertion, so adding a game means either editing every earlier per-game verification script or knowingly leaving them stale — neither is what a per-game, additive script implies
Proposed: keep the exact-count parity assertion in the one shared `0007_capability_seed_checks.sql` and narrow the per-game scripts to their own rows

### F8 — One of the six preset setup files lost its shared doc line
Status: Open · Found: 2026-08-19 · Task: claude/consistency-spec3
Claim: five of the six preset-driven setup data modules carry the JSDoc line "V1 seeds exactly one configuration preset; index 0 is always that preset"; `doubles-training-setup.data.ts` carries none
Evidence: `app/src/lib/game/doubles-training-setup.data.ts` against its five siblings, e.g. `app/src/lib/game/bobs27-setup.data.ts`
Impact: cosmetic only — the fact is now stated once on `createPresetSetupController` itself, so the per-file line is arguably redundant in all six rather than missing in one
Proposed: decide once — either drop the line from all six now that the factory documents it, or add it to the sixth

### F9 — A game-frontend plan written one-commit-per-task collides with `check-game-wiring.sh`'s atomicity requirement
Status: Open · Found: 2026-08-20 · Task: claude/tuod-implementation-2lb1mh
Claim: `docs/architecture/07-Frontend/09-Adding-A-Game.md`'s touch list, and a plan written by `writing-plans` from it, break a new game's frontend into sequential per-file tasks (setup controller, setup page, play controller, play page, wiring), each with its own commit
Evidence: `scripts/check-game-wiring.sh`'s "3a"/"3b" checks require a ruleset to be fully wired (both setup/play data modules, both pages, both Alpine registrations, and its games-visibility card) or fully absent — "half a row is a failure whichever half it fell on" — in the state of every commit, not just the final one; TUOD's frontend plan (`docs/superpowers/plans/2026-08-20-tuod-frontend.md`) called for one commit per task, and the first task's commit (setup controller alone) failed the pre-commit `game-wiring` hook because `app/src/lib/game/tuod-setup.data.ts` existed while `app/src/lib/game/rulesets/games-visibility.ts` still had no `TUOD_V1` card
Impact: an agent following either the doc's task breakdown or a plan written from it hits a rejected pre-commit hook on the first task, discovers the constraint only by trial, and must fall back to committing the whole frontend fan-out in one commit instead of the plan's intended per-task history
Proposed: note the atomicity requirement in `09-Adding-A-Game.md` (e.g., "land all six trees in one commit, or hold every task's changes uncommitted until wiring lands") so a future plan is written commit-shape-aware from the start

### F10 — TUOD's ladder can climb onto a target no double can finish
Status: Open · Found: 2026-08-20 · Task: claude/tuod-implementation-2lb1mh
Claim: `applyTuodAttempt` floors the target at 2 on a miss but has no ceiling on a success, so a run of checkouts walks the ladder past 170 and onto bogey numbers on the way (41, 51, … 161, 171; a penalty can land it on 159, 162, 163, 165, 166, 168, 169)
Evidence: `app/src/modules/game/tuod.engine.module.ts` — `MIN_FINISHABLE_TARGET` is applied only to the failure branch, while the success branch is `state.currentTarget + config.finishBonus` with no bound; `checkoutPathFor` returns null for every one of those targets
Impact: once the ladder reaches such a target the session can only ever record failures — `submitVisit` skips the checkout dialog when the chart has no route (matching 501's bogey-number behaviour, D217), so the target drops by `missPenalty` each attempt until it re-enters the chart. Reaching 171 needs 13 consecutive checkouts inside 10 rounds or 10 minutes, so it is unreachable in practice today; it becomes reachable the moment `duration_value` or `finish_bonus` is made editable
Proposed: decide whether the ladder caps at 170 (the chart's ceiling), skips unfinishable targets on the way up, or is left unbounded on the grounds that the duration ends the session first — and record it, since the current behaviour is unstated rather than chosen

### F11 — A capability-seed verification script's row-count assertions had already drifted stale
Status: Open · Found: 2026-08-20 · Task: claude/tuod-analytics-plan-os3v5f
Claim: `database/verification/0007_capability_seed_checks.sql` asserted `ruleset_version_capabilities` held exactly 14 rows, with a VALUES list of 14 declared triples to match
Evidence: `database/verification/0007_capability_seed_checks.sql` (before this task's fix) vs `database/seeds/0007_ruleset_version_capabilities.sql`, which already held 17 rows at the start of this task — three other rulesets' own `ANALYTICS + VISUAL_BOARD` additions had updated the seed without a matching update to this verification script. This task corrected the count to the real 17 → 18 (after adding TUOD's own row) rather than the originally-planned 14 → 15, but left one descriptive comment ("Driven by a fixed 9-row VALUES list, so this can only be short if the VALUES list above was edited down") unchanged — it was already inaccurate before this task (the list has always had far more than 9 rows) and remains so
Impact: an agent trusting the row-count text (or the "9-row" comment) as ground truth for how many capability pairs exist would undercount before this fix, and the leftover comment can still mislead about the VALUES list's actual size after it
Proposed: reword or remove the "9-row" comment near `database/verification/0007_capability_seed_checks.sql`'s Step 2 count-check to state what it actually guards (that the checked-triple count matches the declared VALUES list, whatever its current length), rather than naming a specific row count

### F13 — `scripts/verify-db.ts` does not cover the two dart analytics views
Status: Open · Found: 2026-08-21 · Task: claude/guest-player-x01-architecture-m8ia8v
Claim: migration `0023` changes `v_dart_analytics` and `v_dart_locations`, but neither view has a `database/verification/*.sql` script, so no automated check proves the new participant filter behaves as intended against a real database
Evidence: `database/verification/` holds scripts for `0007` capabilities, `0021` player settings and `0022` player profile among others, with no `0014`/`0018`/`0023` dart-view equivalent; `app/package.json:23` `db:verify` runs `app/scripts/verify-db.ts`
Impact: the filter's correctness rests on reading the SQL. The specific case worth proving — a session with one PLAYER and one GUEST returns only the PLAYER's dart rows, while `v_game_replay` returns both — is exactly the one no existing test covers, and this task could not run any database check at all (no `DATABASE_URL` in the execution container)
Proposed: add `database/verification/0023_owner_scoped_dart_view_checks.sql` asserting the two views' owner scoping and `v_game_replay`'s deliberate lack of it, following `0022_player_profile_checks.sql`'s shape

### F14 — A prior task's spec and plan never got their context-map-history rows
Status: Open · Found: 2026-08-21 · Task: claude/guest-player-x01-architecture-m8ia8v
Claim: every completed task's spec/plan pair is registered as a row in `docs/architecture/00-Context-Map-History.md` (this file's own mandatory step 2)
Evidence: `docs/superpowers/specs/2026-08-21-guest-player-501-setup-ui-design.md` (commit `5cec9fa`) and its plan `docs/superpowers/plans/2026-08-21-guest-player-501-setup-ui.md` have no row in `docs/architecture/00-Context-Map-History.md` — the file's last row before this task's own additions was for the guest-player-x01-implementation plan (`docs/superpowers/plans/2026-08-20-guest-player-x01-implementation.md`)
Impact: an agent scanning the history for what shipped the guest-add UI (the very feature this task hardened) would not find it there; the provenance trail has a gap for one committed task
Proposed: append the two missing rows following the existing table's format, dated to their actual commit

### F15 — Every game interface repeats a fragile `max-h-2/5 h-full` sizing pair, and one grid item carries a dead `flex-1`
Status: Open · Found: 2026-08-22 · Task: claude/guest-player-x01-architecture-m8ia8v
Claim: fixing a real-device-only (iPhone 12 Pro, not reproducible in this environment's Chromium or in desktop-simulated mobile viewports) overlap in the split scoreboard found the nested `glass` (`backdrop-filter`) stack unique to that path and removed it; this closes the one occurrence actually reported, not the underlying sizing pattern all nine interfaces share
Evidence: every interfaces file passes `class="max-h-2/5 h-full"` (or `min-h-2/5 max-h-2/5 h-full`) to its `SinglePlayerDisplay`/`SplitScoreboard` — `app/src/components/layout/games/interfaces/Shanghai.astro:24`, `app/src/components/layout/games/interfaces/ScoreTraining.astro:23`, `app/src/components/layout/games/interfaces/TenUpOneDown.astro:21`, `app/src/components/layout/games/interfaces/OneTwentyOne.astro:21`, `app/src/components/layout/games/interfaces/DoublesTraining.astro:24`, `app/src/components/layout/games/interfaces/SinglesTraining.astro:24`, `app/src/components/layout/games/interfaces/Bobs27.astro:24`, `app/src/components/layout/games/interfaces/AroundTheClock.astro:23`, `app/src/components/layout/games/interfaces/FiveOhOne.astro:25` — stacking `h-full` (percentage height) on a flex item whose `flex-1` already sets `flex-basis: 0%`, which per spec makes the percentage height inert; separately, `app/src/components/layout/games/SplitScoreboardHalf.astro:53`'s root div carries `flex-1`, but its parent (`app/src/components/layout/games/SplitScoreboard.astro`) is `display: grid`, where `flex-*` properties have no effect at all. The `SplitScoreboard` call site at `app/src/components/layout/games/interfaces/FiveOhOne.astro:76` was changed to h-2/5 (2026-08-22, reported production overlap still visible under the old classes) — this only fixes that one call site, not the pattern across the other eight interfaces
Impact: the pattern was never proven to be the reported bug's cause (the nested `glass` fix was), so it may or may not harbor a real cross-browser sizing risk on the other eight interfaces' own iOS rendering — unverified either way since no WebKit engine is available in this environment; the dead `flex-1` class is harmless but misleads a reader into thinking `SplitScoreboardHalf`'s height is flex-resolved when it is actually grid-row-stretched
Proposed: audit whether `h-full` can simply be dropped everywhere it sits beside `flex-1` (no behavior change per spec, one less redundant declaration), and replace `SplitScoreboardHalf.astro:53`'s `flex-1` with nothing (or an explicit `h-full`, if grid stretch is ever found unreliable) — small, mechanical, but touches nine files and deserves its own task and on-device verification rather than folding into this one

### F16 — Around the Clock and Bob's 27 engines now share a duplicated logic clone group
Status: Open · Found: 2026-08-22 · Task: claude/guest-player-x01-architecture-m8ia8v
Claim: `fallow` (this repo's duplication checker) flags a new clone group between `app/src/modules/game/around-the-clock.engine.module.ts` and `app/src/modules/game/bobs27.engine.module.ts` after both were converted to the shared `MultiSeatState` pattern
Evidence: reported by the Task 9 implementer's own `fallow` run during the single-opponent-seat-remaining-engines plan; not independently re-run or narrowed to specific line ranges here
Impact: the two engines' seat-folding/rotation/win-condition wiring now reads as near-identical boilerplate in two places, which is expected given both follow the same `MultiSeatState<TSeat>` conversion recipe used across all seven engines in this plan — but it is unassessed whether this specific pair crosses the project's duplication threshold enough to warrant a shared helper, or is an acceptable cost of "minimal diffs, follow the established per-engine pattern"
Proposed: after all seven engines in the current plan land, run `fallow` once across the whole branch and decide whether any of the resulting clone groups (this one or others from the same conversion) warrant extracting a shared per-engine scaffold — not mid-plan, since the pattern is intentionally repeated seven times by design

### F18 — TUOD's live-stats banner shows combined-seat data during the post-match save window
Status: Open · Found: 2026-08-22 · Task: claude/guest-player-x01-architecture-m8ia8v
Claim: `TenUpOneDownResults.astro`'s pre-existing "live" `<dl>` block (unfiltered `x-show="completionStatus !== 'succeeded'"`) reads `$store.game.turns.length`/filtered counts and `currentTargetLabel()` as if there is exactly one player throwing
Evidence: `app/src/components/layout/games/result-modals/TenUpOneDownResults.astro` — the live stats block, against `app/src/lib/game/tuod-play.data.ts`'s `currentTargetLabel()`, which now delegates to whichever seat is `activeParticipantRef` (added when TUOD gained 1v1 support in this plan's Task 12)
Impact: during the brief `pending`/`saving` window right after a 1v1 TUOD match finishes, this block shows attempt/success/failure counts summed across BOTH seats' turns, and a "Target reached" value keyed to whichever seat happened to be active last — not the viewer's own seat. Harmless while TUOD was solo-only (one player, one set of turns); now seat-count-dependent and misleading for the one window it's visible
Proposed: scope the live block's `turns`/`currentTargetLabel` reads to the viewer's own seat (or to `state()?.activeParticipantRef`'s seat specifically), mirroring the seat-scoped accessors (`*For(seatRef)`) already added elsewhere in this file's sibling engines during this plan

### F17 — `foldAroundTheClockState` is exported but has no consumer outside its own module
Status: Open · Found: 2026-08-22 · Task: claude/guest-player-x01-architecture-m8ia8v
Claim: `app/src/modules/game/around-the-clock.engine.module.ts:136`'s own doc comment on `foldAroundTheClockState` says it is "the same function the engine's own `deriveState()` delegates to and the play page calls directly for reactive display, mirroring `foldOneTwentyOneState`" — implying the frontend play page imports and calls it directly, the way `one-twenty-one-play.data.ts`'s `state()` calls `foldOneTwentyOneState`
Evidence: `app/src/lib/game/around-the-clock-play.data.ts`'s `state()` accessor (added this task) reads `this.engine?.state() ?? null` instead — the same `this.engine?.state()` pattern Bob's 27 uses, which never exported a standalone fold function to begin with. `foldAroundTheClockState` is only called internally by the engine class's own `deriveState()` in the same file, so `npx fallow` flags it under "Unused exports" ("no known consumers") both before and after this task's change (confirmed via `git stash` against the pre-task commit `b8be5f9`) — this task's own step-2 test (`currentTargetLabelFor`/`turnsSoFarFor` stubbing `ctx.engine.state()` directly) locks `state()` into the `this.engine?.state()` form, so switching it to call `foldAroundTheClockState` directly would break that test
Impact: `npx fallow` (part of `npm run validate:app`'s completion bar) fails on this one dead export; the doc comment inside the engine module overstates how the function is actually consumed, which could mislead a future reader into assuming a call site exists that does not
Proposed: either drop the doc comment's play-page claim (and, if nothing else needs the top-level export, remove `export` so the function is a plain module-private helper again), or — if a future task's `state()` design changes to fold directly from `$store.game` config/turns instead of `this.engine?.state()` — update that doc comment to match. Either fix touches `around-the-clock.engine.module.ts`, outside this task's designated files

### F19 — `scripts/check-context-budget.sh` fails: FINDINGS.md's File Inventory token estimate has drifted stale
Status: Open · Found: 2026-08-22 · Task: claude/guest-player-x01-architecture-m8ia8v
Claim: `docs/architecture/00-File-Inventory.md`'s row for `FINDINGS.md` claims `~4.2k` tokens; the gate's own chars/4 estimate now computes `~5.5k`, a 23% drift past the script's 20% per-file tolerance
Evidence: `docs/architecture/00-File-Inventory.md:195` (`| \`FINDINGS.md\` | ... | canonical | ~4.2k |`); `bash scripts/check-context-budget.sh` — `FAIL: FINDINGS.md claimed=~4.2k computed=~5.5k (drift=23% > 20%)`; reproduced on `git stash` against this branch's pre-task HEAD (`e98eec6`), so the drift predates this task and was not introduced by it — most likely accumulated from F15–F18 being appended to `FINDINGS.md` (2026-08-22) without their added length being reflected back into the inventory row's estimate
Impact: `scripts/check-context-budget.sh` (part of the `run-all-gates`/context-maintenance "Always run" set) fails on every run until the estimate is refreshed, unrelated to whatever task last touched the repo; not otherwise harmful — the actual `FINDINGS.md` content is unaffected, only its inventory-row token estimate is out of date
Proposed: bump `docs/architecture/00-File-Inventory.md:195`'s `~4.2k` to `~5.5k` (or the then-current chars/4 estimate) — a one-line, mechanical fix once someone re-derives the number, but outside every individual task's own designated files so deferred here rather than folded into unrelated work

### F20 — `foldShanghaiState`'s `winningSideKey` reads non-null for a solo session that ends on a Shanghai
Status: Open · Found: 2026-08-22 · Task: claude/guest-player-x01-architecture-m8ia8v
Claim: `raceWinner` is called unconditionally on every seat, including a solo (1-seat) session; a lone seat that hits a Shanghai is the sole `finished: true` entry, so `raceWinner` returns that seat's own `sideKey` rather than `null` — flagged as a Minor, non-blocking review note on the prior task that added this function, deferred to this task to determine whether it leaks into the frontend
Evidence: `app/src/modules/game/shanghai.engine.module.ts:165-170` (`raceResult = raceWinner(seats.map(...))`, no `seats.length > 1` guard, unlike the `compareResult` branch two lines below which does gate on `seats.length > 1`); confirmed via `foldShanghaiState`'s own solo-Shanghai test in `app/tests/lib/game/shanghai-play.data.test.ts` ("SINGLE, DOUBLE, TREBLE in one visit wins instantly with a Shanghai"), whose `resultsSnapshot.winningSideKey` is the solo seat's own `"A"`, not `null`
Impact: currently masked in the UI — `ShanghaiResults.astro`'s banner logic short-circuits to the classic solo "Shanghai!"/"Session complete" text whenever `($store.game.seats?.length ?? 1) < 2`, regardless of `winningSideKey`, so today's rendering is unaffected (verified this task). But `winningSideKey` is otherwise documented/used everywhere else as "null unless a 2+-seat match has a decided winner" (mirrors `AroundTheClockState`/`TuodState`'s own field), so any future direct consumer of `ShanghaiState.winningSideKey` (a stat view, a different UI surface) that does not itself re-check seat count would misread a solo Shanghai as having a "winning side"
Proposed: gate `raceResult` on `seats.length > 1` in `foldShanghaiState`, matching the `compareResult` branch's own existing guard two lines below — restores `winningSideKey: null` for every solo completion, symmetric with the rest of the function; outside this task's designated files (`app/src/modules/game/shanghai.engine.module.ts` is Task 13's file, not Task 14's)
