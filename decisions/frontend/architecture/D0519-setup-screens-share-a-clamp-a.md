---
id: D0519
status: accepted
date: 2026-11-04
origin: contemporaneous
original-date:
tags: [frontend/architecture, types, error]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Setup screens share a clamp, a preset-start step, a duration part and the solo duration fields

## Context and Problem Statement
the setup clone groups left in the D513 baseline were these copies. Each shared piece takes only what differs as data (bounds, spec, key, fallback), so no flags were needed. Adopting the part in 121 would need a hook per branch and would add `forceRoundsIfGuested` to its surface.

## Decision Drivers
* The setup clone groups left in the D513 baseline: four duration clamps, five preset start bodies, Score Training and TUOD setup data, and two duration markup blocks.
* Factory surfaces and rendered setup HTML must stay unchanged.
* The plan adopts a part only if it needs no flag parameter.

## Considered Options
* Each shared piece takes only what differs as data: bounds, spec, key, fallback (chosen).
* Also adopt the duration setup part in 121.
* Per-game flags on the shared pieces.

## Decision Outcome
Chosen option: "`clampToBounds` (`lib/game/duration-clamp.ts`) is the one integer clamp behind the four `*-duration.ts` files. `startPresetSession(ctx, spec)` (`setup-controller.ts`) is the shared start step: loading, snapshot from the preset (plus optional overrides), create, `SESSION_ALREADY_ACTIVE` retry, error. The factory's `start`, 501, 121, Score Training and TUOD all end in it; 501, 121, Score Training and TUOD keep their own pre-steps (preset choice, clamps, notices, guest rules) and hand-written contexts. `durationSetupData` (`lib/game/duration-setup.data.ts`, typed `DurationSetupContext`) is a spread part for Score Training and TUOD. 121 does not adopt it: it defaults to TARGET and a guest forces TARGET, where the part defaults to ROUNDS and forces ROUNDS. `DurationSoloFields.astro` holds the solo FORMAT toggle and sliders for `DurationField` and `OneTwentyOneSetupForm`.".

### Consequences
`501`, Score Training, 121 and TUOD stay out of the preset factory (09-Adding-A-Game). `"ROUNDS" as TType` in the part is unchecked; callers' duration types must include ROUNDS. Factory surfaces and rendered setup HTML are unchanged. Baseline 54 → 47 rows.

* Good, because the baseline fell from 54 to 47 rows with factory surfaces and rendered setup HTML unchanged.
* Bad, because `"ROUNDS" as TType` in the part is unchecked, so callers' duration types must include ROUNDS.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/lib/game/duration-clamp.test.ts`, `setup-controller.test.ts` and `duration-setup.data.test.ts` cover the new pieces. The surface snapshot stays unchanged. A one-off Astro container render before and after, diffed modulo whitespace, is expected to show no markup difference.

## Pros and Cons of the Options
### Shared pieces taking only differing data (chosen)

* Good, because it needs no flags.

### Adopt the duration part in 121

* Bad, because it would need a hook per branch and would add `forceRoundsIfGuested` to its surface.

### Per-game flags

* Bad, because the plan rules out any flag parameter.

## Evidence / More Information
Decided: 2026-11-04
Supersedes: none. Extends D513.

* `docs/superpowers/plans/2026-11-01-duplication-backlog-phase-2-3a.md` (Global Constraints, Review Focus, Tasks D1–D5): rebuilt Decision Drivers, Confirmation and Pros and Cons.
* `docs/superpowers/specs/2026-10-31-duplication-backlog-design.md` (Phase 2): names the setup-screen phase the plan implements.
* Commit `8340f759` (PR #1214, 2026-11-04; adds the `decisions/frontend/architecture.md` row): rebuilt Consequences.
