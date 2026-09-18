<!--
status: canonical
scope: architecture/dartbot
read-when: re-anchoring LEVEL_SKILL_TABLE, auditing the D-L refit's provenance
updated: 2026-09-18
-->

# DartBot Level-Curve Anchor Log

> Append-only (same discipline as `decisions/**`): a re-anchor is a new row
> below, never an edit to an existing one. `LEVEL_SKILL_TABLE`'s live
> anchor-level row must always match this log's latest entry — not
> mechanically gated; keep it true by hand.

| Date | Anchor level | Data source | Measured values (sigmaAlongMm / sigmaAcrossMm / biasXMm / biasYMm / outlierRate) | Spread exponent `p` | Verified level-1 three-dart-average band | Task branch |
| ---- | ------------- | ----------- | ---------------------------------------------------------------------------------- | -------------------- | ------------------------------------------ | ------------ |
| 2026-09-04 | 6 | `D-E-extract.md`, 328 `PLAYER`-only rows (`participant_type_id = 1`); thin sample, `intended_zone_key` composition almost entirely `DOUBLE`/`INNER_BULL` | 27.5 / 20.1 / -5.0 / 3.1 / 0.3% | 2.3125 | 26–31 (target); 27.10 measured at the search seed (`dartbot-level-curve-refit.ts`), 26.68 measured at `tier-bands.test.ts`'s own seed | `claude/dartbot-level-select-stats-23x2l0` |
| 2026-09-04 | 1 and 15 (level 6 untouched — still the D-E row above) | User-specified guardrails, not measured production data: level 1 three-dart average 20–30 / checkout% 5–20%, level 15 three-dart average 90+ / checkout% 45–80%. Level 1's own two guardrails are mutually unsatisfiable in this engine — checkout 5%+ only appears once average is already past ~40 — so level 1 was anchored to a compromise (~32–37 average, ~3–4% checkout) per explicit user direction rather than either literal band. `dartbot-level-curve-recalibration.ts` binary-searches a uniform spread scale per anchor (level 1 against its average compromise band, level 15 against its checkout band, average checked only as a floor), then interpolates every other level in two log-space segments (1→6, 6→15) that preserve the pre-recalibration curve's relative shape. Level 6 stays fixed at the row above's exact values throughout. | scale 0.64375 (level 1), scale 2.3125 (level 15) | 32–37 (compromise target); 32.64 measured at the search seed, 32.15 measured at `tier-bands.test.ts`'s own seed | `claude/dartbot-config-insights-g8on7o` |
| 2026-09-18 | none — anchors untouched (1, 6 and 15 unchanged) | No new data. Flat-spot removal only: levels 7/8, 9/10 and 12/13 shared an exact `biasXMm`/`biasYMm` pair inherited from the pre-D-L table, and both D-L's power-law rescale and D-N's log-space interpolation are ratio-preserving, so two refits carried the duplication forward unchanged (issue #286). Each pair was re-derived by geometric interpolation between its nearest distinct neighbours (`app/scripts/dartbot-bias-flatspot-fix.ts`), yielding `biasXMm`/`biasYMm` of 2.22/2.54 (level 7), 1.63/2.08 (8), 1.34/1.57 (9), 1.1/1.19 (10), 0.62/0.62 (12) and 0.43/0.43 (13); `biasXMm`'s 7/8 pair brackets against level 5 rather than level 6, whose measured -5.0 is a sign anomaly rather than a curve point. No sigma, outlier or decisionQuality value changed. | unchanged — no new measurement | unchanged | level 1 / 8 / 15 bands re-verified at `tier-bands.test.ts`'s own seed (`BASE_SEED = 700000 + level`, 5000 visits): level 1 three-dart average 32.15, checkout 0.0214, treble 0.0565, miss 0.138; level 8 three-dart average 60.54, checkout 0.152, treble 0.1673, miss 0.00053; level 15 three-dart average 136.11, checkout 0.63, treble 0.6343, miss 0. Level 8's measured treble rate sits close to its 0.15 band floor (~11% clearance); this margin is inherited from the D-N recalibration, not created here — the pre-change value at the same seed was 0.1670, so this change moved treble slightly away from the floor rather than toward it. A future refit should note how little clearance remains there. | `fix/p4-dartbot-bias-flatspots` |

See `08-DartBot.md` §Resolved: D-L level-curve refit, §Resolved: D-N
level-curve recalibration, and
`docs/superpowers/specs/2026-09-04-dartbot-level-curve-refit-design.md` for
the D-L method. D-N has no separate design doc — a direct data recalibration
per explicit user-specified guardrails, following D-L's established
anchor/rescale/interpolate method rather than introducing a new one.
