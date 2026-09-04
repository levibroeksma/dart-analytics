<!--
status: canonical
scope: architecture/dartbot
read-when: re-anchoring LEVEL_SKILL_TABLE, auditing the D-L refit's provenance
updated: 2026-09-04
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

See `08-DartBot.md` §Resolved: D-L level-curve refit, §Resolved: D-N
level-curve recalibration, and
`docs/superpowers/specs/2026-09-04-dartbot-level-curve-refit-design.md` for
the D-L method. D-N has no separate design doc — a direct data recalibration
per explicit user-specified guardrails, following D-L's established
anchor/rescale/interpolate method rather than introducing a new one.
