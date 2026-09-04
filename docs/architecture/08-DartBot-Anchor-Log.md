# DartBot Level-Curve Anchor Log

> Append-only (same discipline as `decisions/**`): a re-anchor is a new row
> below, never an edit to an existing one. `LEVEL_SKILL_TABLE`'s live
> anchor-level row must always match this log's latest entry — not
> mechanically gated; keep it true by hand.

| Date | Anchor level | Data source | Measured values (sigmaAlongMm / sigmaAcrossMm / biasXMm / biasYMm / outlierRate) | Spread exponent `p` | Verified level-1 three-dart-average band | Task branch |
| ---- | ------------- | ----------- | ---------------------------------------------------------------------------------- | -------------------- | ------------------------------------------ | ------------ |
| 2026-09-04 | 6 | `D-E-extract.md`, 328 `PLAYER`-only rows (`participant_type_id = 1`); thin sample, `intended_zone_key` composition almost entirely `DOUBLE`/`INNER_BULL` | 27.5 / 20.1 / -5.0 / 3.1 / 0.3% | 2.3125 | 26–31 (target); 27.10 measured at the search seed (`dartbot-level-curve-refit.ts`), 26.68 measured at `tier-bands.test.ts`'s own seed | `claude/dartbot-level-select-stats-23x2l0` |

See `08-DartBot.md` §Resolved: D-L level-curve refit and
`docs/superpowers/specs/2026-09-04-dartbot-level-curve-refit-design.md` for
the method.
