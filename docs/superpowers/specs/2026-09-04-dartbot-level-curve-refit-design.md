# Design: DartBot level-curve refit (D-L)

> status: historical record once implemented — specs are never rewritten
> (`docs/CLAUDE.md`)

## Problem

D-E (`08-DartBot.md` §Resolved: D-E population prior) measured one pooled
real-player scatter — `sigmaAlongMm: 27.5, sigmaAcrossMm: 20.1, biasXMm: -5.0,
biasYMm: 3.1, outlierRate: 0.3%` — from 328 real darts. It is not per-level
data; `LEVEL_SKILL_TABLE` (`skill-profile.module.ts`) is still the original
15 hand-set rows from before any real measurement existed. D-D's own text
("an average band cannot be claimed before D-E fits the level curve")
names this refit as the next required step, and it is still undone — the
D-E entry's "Not yet done" line says so explicitly.

This design refits `LEVEL_SKILL_TABLE`'s spatial fields against the D-E
prior. It does not build `fitProfile()` (phase 10's per-player shrinkage),
does not touch D-K (auto level), and does not touch the level-picker UI —
all three stay out of scope, per prior scoping in this task.

## Non-goals

- `decisionQuality`, `bedOffsetMm`, `bounceOutRate`, `deflectionRadiusMm`,
  `covarianceRotationDegrees` — D-E measured spatial scatter only; nothing
  about decision-making, collisions, or rotation. These fields are
  untouched.
- `fitProfile()`, D-K, the level-picker average/checkout UI.
- Any change to `DEFAULT_BOT_LEVEL` (stays 8) — the anchor level (6) is a
  calibration concept, not the default seat level; the two are independent.

## The anchor log

`docs/architecture/08-DartBot-Anchor-Log.md` — a new canonical doc, append-only
(same discipline as `decisions/**`: a re-anchor is a new row, never an edit to
an existing one). `08-DartBot.md` has no subfolder (unlike `05-Database/`), so
this is a sibling file rather than a restructure.

Columns: date, anchor level, data source (extract file, sample size, and its
caveats), the measured `sigmaAlongMm`/`sigmaAcrossMm`/`biasXMm`/`biasYMm`/
`outlierRate` at that anchor, the resulting spread exponent `p`, the verified
level-1 three-dart-average band, and the task branch that ran it.

**Rule, stated in the doc, not mechanically gated:** `LEVEL_SKILL_TABLE`'s live
anchor-level row must always match the log's latest entry. No existing gate
script covers this relationship; adding one is out of scope here.

`08-DartBot.md`'s Calibration section and Related Documents table both
reference this log. The D-L entry (below) cites a row in it rather than
restating the numbers inline, so a future re-anchor updates one file.

## Refit method

**1. Anchor.** Level 6's `sigmaAlongMm`, `sigmaAcrossMm`, `biasXMm`,
`biasYMm`, `outlierRate` become the exact D-E values, replacing the current
hand-set row outright.

**2. Preserve shape, rescale magnitude.** For every other level `L`, compute
`ratio_L = currentValue_L / currentValue_6` once, from today's (pre-edit)
table — separately for `sigmaAlongMm`, `sigmaAcrossMm`, bias magnitude, and
`outlierRate`. A tunable exponent `p` then gives:

```
newValue_L = DEValue_6 × ratio_L ^ p
```

`p = 1` is a straight proportional rescale; `p > 1` widens the gap between
weak and strong levels beyond proportional, `p < 1` narrows it. Bias keeps
each level's current x/y direction (only magnitude is rescaled) — D-E's own
bias direction is one sample's idiosyncrasy, not a skill-linked property
worth propagating level-by-level.

**3. Search `p`.** `app/tests/modules/dartbot/harness/simulate-tier.ts`
already throws simulated visits through the real `throwDart()`/
`skillProfileForLevel()` pipeline and reports `threeDartAverage` per level.
A new one-off script, `app/scripts/dartbot-level-curve-refit.ts` (mirroring
`dartbot-population-prior.ts`'s precedent — reads input, prints a result, not
a production consumer), binary-searches `p` — level 6 anchored throughout —
until `simulateTierStats(1, seed, N)`'s `threeDartAverage` lands in **26–31**.
`N` large enough for a stable average under binary search (existing
`tier-bands.test.ts` uses 5000 visits per level; this script may use more,
since it runs once rather than in CI).

**4. Apply.** The resulting 15-row table (sigma/bias/outlier fields only)
replaces the current values in `LEVEL_SKILL_TABLE`. `decisionQuality`,
`bedOffsetMm`, `bounceOutRate`, `deflectionRadiusMm`,
`covarianceRotationDegrees` are copied through unchanged.

## Files touched

- `app/src/modules/dartbot/skill-profile.module.ts` — `LEVEL_SKILL_TABLE`'s
  sigma/bias/outlier fields, all 15 levels.
- `app/scripts/dartbot-level-curve-refit.ts` — new, one-off calibration
  script (not imported by production code).
- `app/tests/scripts/dartbot-level-curve-refit.test.ts` — covers the script's
  pure logic (ratio computation, the `p`-exponent transform), per D224.
- `app/tests/modules/dartbot/harness/tier-bands.test.ts` — band assertions
  for levels 1/8/15 updated to match the refit output. Monotonicity
  assertions need no change — a power-law transform of positive ratios
  preserves ordering.
- `app/tests/modules/dartbot/throw-engine.determinism.test.ts.snap` —
  regenerated; it pins exact simulated landings, which depend on the
  table's values.
- `docs/architecture/08-DartBot-Anchor-Log.md` — new, first row.
- `docs/architecture/08-DartBot.md` — new **D-L** entry under a "Resolved"
  heading; the D-E entry's "Not yet done" line corrected (sigma/bias/outlier
  are now refit; `decisionQuality` etc. and `fitProfile()` itself remain the
  open gap); Related Documents table gains the anchor log.

## Testing

Per D224, every touched runtime `.ts` file needs a covering test.

- `dartbot-level-curve-refit.test.ts`: given a stub current-table shape and
  stub D-E-shaped anchor values, `ratio_L` computation and the `p`-exponent
  transform produce the expected per-level values; level 6 always returns
  the anchor values exactly regardless of `p`.
- `tier-bands.test.ts`: existing structure kept, only the numeric bands for
  levels 1/8/15 change to match the refit output (level 1's band is fixed at
  the 26–31 target by construction).
- `skill-profile.module.test.ts`: existing coverage of
  `skillProfileForLevel()`'s clamping/lookup behavior is unaffected by a data
  change and needs no new assertions beyond what already exists.

`.astro` markup is not touched by this design — no UI change.

## Non-goals (restated)

- `fitProfile()` (phase 10), D-K (auto level) — both still blocked on
  `fitProfile()` itself, unaffected by this refit.
- The level-picker average/checkout UI — still deferred, to be brainstormed
  as its own task once this refit lands.
- A mechanical gate enforcing `LEVEL_SKILL_TABLE` ↔ anchor-log consistency —
  stated as a rule in the log, not scripted.
