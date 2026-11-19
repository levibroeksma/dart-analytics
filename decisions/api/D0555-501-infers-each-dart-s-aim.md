---
id: D0555
status: accepted
date: 2026-11-12
origin: contemporaneous
original-date:
tags: [api, session, status]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# 501 infers each dart's aim at read time; five 501-only sections read it

## Context and Problem Statement
the owner's training questions (drift of the first dart, inside vs outside on a double, which double to set up for) all need an aim, and 501 stores none. Game state already narrows each dart to a few conventional candidates, so the landing only picks among them and never manufactures one; an ambiguous dart is left out rather than forced. New sections instead of widening `target-accuracy`, `miss-direction` and `grouping`: their metric shapes cannot carry basis, resolution or a wire key. `SINGLE:n` keeps `NUMBER:n`'s "any ring" meaning intact for the derived-intent games. `treble-rate` counts a T19 thrown at T20 as a treble and `double-performance` defines a double attempt differently from `double-accuracy`, so both would contradict the new cards. The spec's `dart_count` skip check was dropped: the fold view filters no darts, so only a null coordinate can make counts differ.

## Decision Drivers
* The owner's training questions (first-dart drift, inside versus outside, which double to set up for) each need an aim. 501 stores none (spec §1).
* A circular accuracy is an anti-goal: the landing point only chooses between candidates the game state already produced (spec §2).
* An ambiguous dart is not forced into a guess, and a card states the size of any known bias (spec §2).
* Read-time only: no migration, no table, no stored aim (spec §3, before the status note's amendment for view `0055`).

## Considered Options
* Infer each dart's aim at read time from game state plus landing point, with five new 501-only sections (chosen).
* Store an aim for 501 darts.
* Widen `target-accuracy`, `miss-direction` and `grouping` with the `intent-inferred` tag, as spec §5 proposed.
* Force a guess for every ambiguous dart.

## Decision Outcome
Chosen option: "501 gains the `intent-inferred` tag (`capabilities.ts`, `siteByTag` `server`). Each dart's aim is inferred from the remaining score and darts left (`candidatesFor`, `x01-aim-candidates.module.ts`: cases A–E, `LEAVE_RANK` 32, 16, 40, 24, 8, 36, 28, 20, 12, 4, wire merge) and the landing point only chooses among those candidates (`resolveAim`, `x01-aim-resolution.module.ts`: `SOLE`, `NEAREST`, or `AMBIGUOUS` when `d1 / d2 > AMBIGUITY_RATIO = 0.75`). Nothing inferred is stored; migration `0055` only adds `location_x`/`location_y` to `v_x01_checkout_darts`. Five new `server` sections, gated to 501 by `games`, read it: `large-target-accuracy`, `aim-drift`, `double-accuracy`, `double-preference`, `setup-success`, each an additive `AimCountMetrics` record keyed by aim, basis and resolution, with ambiguous darts in an `AMBIGUOUS` row. A single aim is the new zone key `SINGLE:n` and a wire `WIRE:a-b`. `heatmap`'s `target` on 501 takes any inferred aim key. `SectionMeta.excludedGames` drops `treble-rate`, `volume`, `checkout-path` and `double-performance` from 501's page; `PAGE_ORDER_OVERRIDES` sets its order. A session with an undecodable snapshot or any coordinate-less dart is skipped whole (`skippedSessions`).".

### Consequences
`10-Statistics/00-Overview.md` 1.7.0 (§2 `excludedGames`, §3 tag row and the narrowed no-inference paragraph, §5 `target`, §12 item 7) and `01-Section-Catalog.md` 1.7.0 (§1 five rows and the resolver note, §2 501 page, §2.1 metric shapes) are updated; the spec carries a status note with its six amendments. Known bias: an ambiguous dart is always a miss, so T20/T18 hit rates read slightly high; the `AMBIGUOUS` count is returned so a card can state it. A change to the rules, `LEAVE_RANK` or `AMBIGUITY_RATIO` bumps the `version` of every section that reads the resolver. `AMBIGUITY_RATIO` lives in the resolution module, not beside the rules. The page UI is a follow-up plan. Plan: `docs/superpowers/plans/2026-11-12-x01-inferred-aim-statistics-backend.md`.

* Neutral, because an ambiguous dart stays in every figure that needs no aim, such as scoring and checkout rate, and leaves every aim metric (spec §4.6).
* Neutral, because the live in-game checkout percentage keeps its own attempt rule and can differ from the page's double figures (spec §9, call 8).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Spec § 7 requires a resolver test for every row of the §4.7 fixture table, two `AMBIGUITY_RATIO` calibration cases and a sweep of `r` 2–501 by `dartsLeft` 1–3. `tests/modules/stats/x01-aim-resolution.module.test.ts` and `tests/modules/stats/x01-aim-candidates.module.test.ts` exist today.

## Pros and Cons of the Options
### Infer each dart's aim at read time
* Good, because it answers the owner's questions about drift, inside versus outside and double set-up (spec §1).
* Good, because the landing point never produces a candidate, which avoids circular accuracy (spec §2, §4.5).
* Bad, because an ambiguous dart is always a miss, so T20 and T18 hit rates read slightly high (spec §4.6).

### Store an aim for 501 darts
* Bad, because spec §3 bars it: read-time only, no stored aim. Persisting inferred aims is a non-goal (spec §2).

### Widen the existing sections
* Bad, because their metric shapes cannot carry basis, resolution or a wire key (plan, Deviations 2).

### Force a guess for every ambiguous dart
* Bad, because spec §2 lists forced guesses as an anti-goal.

## Evidence / More Information
Decided: 2026-11-12
Refines: D369, D370
Supersedes: D364 (in part: its Consequences line that X01 gets no intent-based sections no longer holds for 501).

* `docs/superpowers/specs/2026-11-11-x01-inferred-aim-statistics-design.md` (§1–§6, §7, §9 and the 2026-11-12 status note): rebuilt Decision Drivers, Considered Options, Confirmation, Pros and Cons and Consequences.
* `docs/superpowers/plans/2026-11-12-x01-inferred-aim-statistics-backend.md` (Deviations from the spec, Task 12; the plan does not cite D555): rebuilt Considered Options and Pros and Cons.
* Commit `46138c1a` (2026-11-12, "docs: 501 inferred-aim statistics"; adds the D555 row): source of the Context and Decision Outcome text.
* Applied in: `docs/superpowers/specs/2026-11-14-x01-statistics-page-design.md`, `docs/superpowers/plans/2026-11-14-x01-statistics-page.md`.
