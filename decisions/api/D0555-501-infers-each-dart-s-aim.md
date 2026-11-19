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
<!-- backfill: pending -->

# 501 infers each dart's aim at read time; five 501-only sections read it

## Context and Problem Statement
the owner's training questions (drift of the first dart, inside vs outside on a double, which double to set up for) all need an aim, and 501 stores none. Game state already narrows each dart to a few conventional candidates, so the landing only picks among them and never manufactures one; an ambiguous dart is left out rather than forced. New sections instead of widening `target-accuracy`, `miss-direction` and `grouping`: their metric shapes cannot carry basis, resolution or a wire key. `SINGLE:n` keeps `NUMBER:n`'s "any ring" meaning intact for the derived-intent games. `treble-rate` counts a T19 thrown at T20 as a treble and `double-performance` defines a double attempt differently from `double-accuracy`, so both would contradict the new cards. The spec's `dart_count` skip check was dropped: the fold view filters no darts, so only a null coordinate can make counts differ.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "501 gains the `intent-inferred` tag (`capabilities.ts`, `siteByTag` `server`). Each dart's aim is inferred from the remaining score and darts left (`candidatesFor`, `x01-aim-candidates.module.ts`: cases A–E, `LEAVE_RANK` 32, 16, 40, 24, 8, 36, 28, 20, 12, 4, wire merge) and the landing point only chooses among those candidates (`resolveAim`, `x01-aim-resolution.module.ts`: `SOLE`, `NEAREST`, or `AMBIGUOUS` when `d1 / d2 > AMBIGUITY_RATIO = 0.75`). Nothing inferred is stored; migration `0055` only adds `location_x`/`location_y` to `v_x01_checkout_darts`. Five new `server` sections, gated to 501 by `games`, read it: `large-target-accuracy`, `aim-drift`, `double-accuracy`, `double-preference`, `setup-success`, each an additive `AimCountMetrics` record keyed by aim, basis and resolution, with ambiguous darts in an `AMBIGUOUS` row. A single aim is the new zone key `SINGLE:n` and a wire `WIRE:a-b`. `heatmap`'s `target` on 501 takes any inferred aim key. `SectionMeta.excludedGames` drops `treble-rate`, `volume`, `checkout-path` and `double-performance` from 501's page; `PAGE_ORDER_OVERRIDES` sets its order. A session with an undecodable snapshot or any coordinate-less dart is skipped whole (`skippedSessions`).".

### Consequences
`10-Statistics/00-Overview.md` 1.7.0 (§2 `excludedGames`, §3 tag row and the narrowed no-inference paragraph, §5 `target`, §12 item 7) and `01-Section-Catalog.md` 1.7.0 (§1 five rows and the resolver note, §2 501 page, §2.1 metric shapes) are updated; the spec carries a status note with its six amendments. Known bias: an ambiguous dart is always a miss, so T20/T18 hit rates read slightly high; the `AMBIGUOUS` count is returned so a card can state it. A change to the rules, `LEAVE_RANK` or `AMBIGUITY_RATIO` bumps the `version` of every section that reads the resolver. `AMBIGUITY_RATIO` lives in the resolution module, not beside the rules. The page UI is a follow-up plan. Plan: `docs/superpowers/plans/2026-11-12-x01-inferred-aim-statistics-backend.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-12
Refines: D369, D370
Supersedes: D364 (in part: its Consequences line that X01 gets no intent-based sections no longer holds for 501).
