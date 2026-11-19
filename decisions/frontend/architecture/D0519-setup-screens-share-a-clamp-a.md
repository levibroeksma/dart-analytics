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
<!-- backfill: pending -->

# Setup screens share a clamp, a preset-start step, a duration part and the solo duration fields

## Context and Problem Statement
the setup clone groups left in the D513 baseline were these copies. Each shared piece takes only what differs as data (bounds, spec, key, fallback), so no flags were needed. Adopting the part in 121 would need a hook per branch and would add `forceRoundsIfGuested` to its surface.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`clampToBounds` (`lib/game/duration-clamp.ts`) is the one integer clamp behind the four `*-duration.ts` files. `startPresetSession(ctx, spec)` (`setup-controller.ts`) is the shared start step: loading, snapshot from the preset (plus optional overrides), create, `SESSION_ALREADY_ACTIVE` retry, error. The factory's `start`, 501, 121, Score Training and TUOD all end in it; 501, 121, Score Training and TUOD keep their own pre-steps (preset choice, clamps, notices, guest rules) and hand-written contexts. `durationSetupData` (`lib/game/duration-setup.data.ts`, typed `DurationSetupContext`) is a spread part for Score Training and TUOD. 121 does not adopt it: it defaults to TARGET and a guest forces TARGET, where the part defaults to ROUNDS and forces ROUNDS. `DurationSoloFields.astro` holds the solo FORMAT toggle and sliders for `DurationField` and `OneTwentyOneSetupForm`.".

### Consequences
`501`, Score Training, 121 and TUOD stay out of the preset factory (09-Adding-A-Game). `"ROUNDS" as TType` in the part is unchecked; callers' duration types must include ROUNDS. Factory surfaces and rendered setup HTML are unchanged. Baseline 54 → 47 rows.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-04
Supersedes: none. Extends D513.
