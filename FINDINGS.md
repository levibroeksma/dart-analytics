<!--
status: canonical
scope: open findings — defects and contradictions noticed but deliberately not fixed
read-when: triaging what to fix next; never loaded by a task
updated: 2026-09-02
highest-issued: F58
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

### F5 — A broken script is filed as a deferred feature
Status: Open · Found: 2026-08-19 · Task: claude/governance-spec2
Claim: `scripts/check-context-map.sh`'s migration-range regex cannot tell a seed range from a migration range, so a seed chain quoted as ending at `0003` is compared against the migration chain end and fails
Evidence: `scripts/check-context-map.sh` — the check at its "2. Migration range consistency" section; the workaround was to reword the affected doc line, leaving the script deliberately unfixed (2026-07-26)
Impact: the defect sat in `DECISIONS.md`'s Deferred list among eleven unbuilt features, where "we chose not to build this" and "this is broken" are indistinguishable
Proposed: narrow the regex to skip lines naming seeds — partly done for `decisions/**` and seed lines by D194, but the seed-vs-migration ambiguity itself remains

### F15 — Every game interface repeats a fragile `max-h-2/5 h-full` sizing pair, and one grid item carries a dead `flex-1`
Status: Open · Found: 2026-08-22 · Task: claude/guest-player-x01-architecture-m8ia8v
Claim: fixing a real-device-only (iPhone 12 Pro, not reproducible in this environment's Chromium or in desktop-simulated mobile viewports) overlap in the split scoreboard found the nested `glass` (`backdrop-filter`) stack unique to that path and removed it; this closes the one occurrence actually reported, not the underlying sizing pattern all nine interfaces share
Evidence: every interfaces file passes `class="max-h-2/5 h-full"` (or `min-h-2/5 max-h-2/5 h-full`) to its `SinglePlayerDisplay`/`SplitScoreboard` — `app/src/components/layout/games/interfaces/Shanghai.astro:24`, `app/src/components/layout/games/interfaces/ScoreTraining.astro:23`, `app/src/components/layout/games/interfaces/TenUpOneDown.astro:21`, `app/src/components/layout/games/interfaces/OneTwentyOne.astro:21`, `app/src/components/layout/games/interfaces/DoublesTraining.astro:24`, `app/src/components/layout/games/interfaces/SinglesTraining.astro:24`, `app/src/components/layout/games/interfaces/Bobs27.astro:24`, `app/src/components/layout/games/interfaces/AroundTheClock.astro:23`, `app/src/components/layout/games/interfaces/FiveOhOne.astro:25` — stacking `h-full` (percentage height) on a flex item whose `flex-1` already sets `flex-basis: 0%`, which per spec makes the percentage height inert; separately, `app/src/components/layout/games/SplitScoreboardHalf.astro:53`'s root div carries `flex-1`, but its parent (`app/src/components/layout/games/SplitScoreboard.astro`) is `display: grid`, where `flex-*` properties have no effect at all. The `SplitScoreboard` call site at `app/src/components/layout/games/interfaces/FiveOhOne.astro:76` was changed to h-2/5 (2026-08-22, reported production overlap still visible under the old classes) — this only fixes that one call site, not the pattern across the other eight interfaces
Impact: the pattern was never proven to be the reported bug's cause (the nested `glass` fix was), so it may or may not harbor a real cross-browser sizing risk on the other eight interfaces' own iOS rendering — unverified either way since no WebKit engine is available in this environment; the dead `flex-1` class is harmless but misleads a reader into thinking `SplitScoreboardHalf`'s height is flex-resolved when it is actually grid-row-stretched
Proposed: audit whether `h-full` can simply be dropped everywhere it sits beside `flex-1` (no behavior change per spec, one less redundant declaration), and replace `SplitScoreboardHalf.astro:53`'s `flex-1` with nothing (or an explicit `h-full`, if grid stretch is ever found unreliable) — small, mechanical, but touches nine files and deserves its own task and on-device verification rather than folding into this one

### F27 — Duplication still sits at 14.8%, concentrated in the play-data lifecycle and the Score Training / TUOD engine pair
Status: Open · Found: 2026-08-23 · Task: claude/guest-player-x01-architecture-m8ia8v
Claim: `npx fallow` now exits 0 (76 clone groups, 14.8% duplicated, 0 files above the health threshold), but two large clone families were deliberately left standing rather than refactored
Evidence: `cd app && npx fallow dupes` — an 8-group / 236-line family across `app/src/lib/game/five-oh-one-play.data.ts` and `app/src/lib/game/one-twenty-one-play.data.ts`, a matching 8-group family across `app/src/lib/game/score-training-play.data.ts` and `app/src/lib/game/tuod-play.data.ts` (both centred on `uploadAndCompleteSession` / `playAgain` / `computeStats` around `app/src/lib/game/play-lifecycle.ts`), and one 354-line structural clone between `app/src/modules/game/score-training.engine.module.ts:81-344` (264 lines) and `app/src/modules/game/tuod.engine.module.ts`
Impact: the play-data family was left alone on purpose — that code was hardened days earlier by the Play Again session-participant/config reseating fix, and refactoring it immediately afterwards would put regression risk on the most fragile, most recently repaired path in the app. The engine pair's remaining clone is whole-class structural similarity (two duration-bounded, dual-input engines converted by the same recipe), not a set of extractable blocks; the pieces that WERE extractable have been (`turn-log.module.ts`, `seat-state.module.ts`, `scoreCompareOutcome`). The result is a passing but thin margin: `.fallowrc.jsonc`'s `duplicates.threshold` is configured at `0.0` (unset), so the actual gate is fallow's own inferred default, empirically somewhere between 14.8% (this passes) and 18.6% (the pre-fix state failed) — not a confirmed "15%" figure — so a modest future addition can fail CI again without any new duplication of its own
Proposed: a dedicated task should take the play-data lifecycle family on its own branch, with the Play Again 1v1 path exercised end to end before and after; the engine pair is better left as-is until one of the two rulesets diverges on its own, at which point the clone dissolves without a refactor

### F29 — 5 near-identical `*PlayContext` types restate `PlayLifecycleContext`'s shape instead of reusing it
Status: Open · Found: 2026-08-26 · Task: claude/dart-previews-architecture-9tomxf
Claim: `Bobs27PlayContext`, `SinglesTrainingPlayContext`, `DoublesTrainingPlayContext`, `ShanghaiPlayContext`, `AroundTheClockPlayContext`, `FiveOhOnePlayContext`, `OneTwentyOnePlayContext`, `ScoreTrainingPlayContext`, and `TuodPlayContext` (all in `app/src/lib/game/types.ts`) each hand-declare `hiddenTurnKey`, `hiddenTimer`, `loading`, `error`, `finished`, and the rest of `PlayLifecycleContext<TConfig, TEngine, TResults>`'s fields, rather than being defined in terms of it
Evidence: `app/src/lib/game/types.ts` — compare `PlayLifecycleContext` (around line 181) against any of the 9 named types; each restates the same ~15 fields verbatim with only `TConfig`/`TEngine`/`TResults` substituted by hand
Impact: a future field added to the shared lifecycle contract (e.g. a new timer or status field) must be hand-copied into 9 places instead of one; noticed while extracting `playPreviewSegments`/unifying the reveal timer, then widened when `FiveOhOnePlayContext`/`OneTwentyOnePlayContext`/`ScoreTrainingPlayContext`/`TuodPlayContext` picked up the same fields (D234) — a full generic-based unification is a separate, larger type-level refactor outside either task's scope
Proposed: define each `*PlayContext` as `PlayLifecycleContext<XxxSnapshot, XxxEngine, XxxResultsSnapshot> & { <per-game methods> }` instead of a fully hand-written object type, once a task is scoped to take on that refactor across all 9 files at once

### F42 — Why `fallow`'s duplication gate did not flag the bust/checkout or `otherSeatsComplete` duplication this task extracted was never investigated
Status: Open · Found: 2026-08-27 · Task: claude/engine-module-architecture-5343hv
Claim: before this task's Tasks 1-7, the bust/checkout rule was hand-duplicated 5 times across 3 engine files (up to ~15 lines per site) and `otherSeatsComplete`-shaped inline folds were duplicated 3 times — both clone families large enough that `fallow`'s own duplication gate (which caught a comparable-sized clone once already, D232) plausibly should have flagged at least one of them, yet `npx fallow` was passing on `main` the whole time
Evidence: this task's own design spec, `docs/superpowers/specs/2026-08-27-engine-duplication-cleanup-design.md` (Purpose section, "Explicitly deferred" list, last item); F27's own findings on `fallow`'s threshold sitting at an unconfirmed empirical value rather than a fixed number is a related but distinct question (F27 is about the *threshold*, this is about whether the *clone-detection window/shape* even considers TypeScript method bodies spread across a class the way these 5 sites were)
Impact: the duplication gate's actual detection boundary (line-count minimum, cross-file vs. same-file bias, whether it tokenizes class-method bodies the same as free functions) is unknown, so nobody can currently answer "would fallow have caught this if it were 20% bigger" — the gate's effectiveness as a preventive control for this exact failure mode is unverified in either direction
Proposed: a small investigation task — reproduce the pre-fix duplication on a throwaway branch and run `npx fallow dupes` against it directly, to learn empirically whether the gate's silence was a configuration gap (threshold, ignore list) or a structural blind spot (method-body clones across classes) — the answer decides whether `.fallowrc.jsonc` needs a tuning change or the gate itself has a real capability gap worth reporting upstream

### F43 — No gate enforces that a new resumable ruleset version is wired into its shared play page
Status: Open · Found: 2026-08-29 · Task: fix/prod-seed-drift-shanghai-v2
Claim: `scripts/check-game-engines.sh` enforces that a new engine's `rulesetVersionKey` and its server-side validator land in the same commit (`app/CLAUDE.md`'s Game engines section), but nothing enforces that a shared play page (`*-play.data.ts`) resolves a game's newest ruleset version dynamically rather than a single hardcoded one
Evidence: SHANGHAI_V2 shipped its engine module, validator, registry entry, and setup-screen wiring across commits `8ac3d38`, `b1c9a70`, `de96fae`, `5b61cb7`, but never touched `app/src/lib/game/shanghai-play.data.ts`'s `resumeEngine`, which hardcoded `RULESET_VERSION_KEY: RulesetVersionKey = "SHANGHAI_V1"` (fixed on this branch). `app/src/lib/game/one-twenty-one-play.data.ts` shows the correct pattern for a game with two ruleset versions — a `RESUMABLE_RULESET_VERSIONS` set plus dynamic `getEngineFactory(rulesetVersionKey)` — that Shanghai's play page never received
Impact: every session created under the new ruleset version silently failed to resume — the play page reported "no active session" (`hasActiveSession = false`) with no error surfaced, while the setup screen simultaneously reported the session as still active (`SESSION_ALREADY_ACTIVE`), producing an unrecoverable continue/abandon loop for the player. Reached production once the corresponding seed row was applied (this task)
Proposed: extend `scripts/check-game-engines.sh` (or a new check) to flag a `*-play.data.ts` file whose resume/replay logic references only one `RulesetVersionKey` literal when its game type has more than one `ruleset_versions` row registered in the engine registry — or at minimum, add this exact failure mode to `docs/architecture/07-Frontend/09-Adding-A-Game.md`'s touch list for "adding a second ruleset version to an existing game"

### F58 — Three already-landed plans' `context-maintenance` passes skipped the Version History entry
Status: Open · Found: 2026-09-02 · Task: claude/rebase-pr-three-docs-4tm39h
Claim: `dartbot-setup-wiring-fixes` (commit `f90583e`), `alpine-reactivity-fold-fixes` (`c30b733`), and `preview-seat-scoping-fixes` (`fbec686`) each shipped a "docs: context maintenance for ..." commit closing their own findings (F45/F54-F57, F31, F32/F33 respectively), but none of the three added a `docs/architecture/00-Context-Map-History.md` Version History entry — the mandatory step this same skill's own procedure requires (root `CLAUDE.md`, Context Maintenance section)
Evidence: `git log --oneline --all -S"F54 —" -- FINDINGS.md` / `-S"F31 —"` / `-S"F32 —"` each resolve to the three commits named above, all already on this branch; `grep -n "alpine-reactivity\|dartbot-setup-wiring\|preview-seat-scoping" docs/architecture/00-Context-Map-History.md` returns nothing, while every other 2026-09-02 plan on this branch (board-dart-bull-double-checkout, tuod-hardening, scoring-stats-correctness) has its own Version entry
Impact: the Version History section is meant to be the running, authoritative record of what changed and why (per its own file header and `00-File-Inventory.md`'s "Current Implementation State" disclaimer added by F53); a reader relying on it to reconstruct why Singles Training/Around the Clock/Bob's27/Singles Training now fold `$store.game` directly, why DartBot's 501/121/Singles Training setup screens seat bots the way they do, or why the two preview strips scope to the throwing seat, would find no entry — only the commit messages and the plans themselves
Proposed: a follow-up doc-only task should backfill three Version History entries (1.x slots between 1.35.0 and 1.37.0, chronologically) summarizing each plan's actual shipped diff from its own commits — cheap since the plans and commits are already complete and on this branch; no code change involved

