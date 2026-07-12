<!--
Default pull request description for dart-analytics.
Fill each section; delete a section only when it is genuinely N/A.
Authority for the architecture checklist below:
architecture/docs/architecture/099-engineering-workflow-and-decision-framework.md
-->

## Summary

<!-- What changed and why, in 2-4 sentences. Link the spec / plan / ADR if one exists. -->

## Changes

<!-- The concrete changes, grouped by area (database / API / frontend / docs). -->

-

## Architectural decisions

<!-- New or changed decisions this PR introduces. Add a one-line row to
     architecture/DECISIONS.md for each. Delete this section if there are none. -->

-

## Verification

<!-- How you validated the change. Paste the relevant output. Typical checks:
     - scripts/check-context-map.sh (docs/context changes)
     - tests
     - npx fallow (app/ changes — stale type validation)
     - replay / API / SQL verification where applicable -->

## Architecture checklist

<!-- The Pull Request Checklist from 099-engineering-workflow-and-decision-framework.md,
     as checkboxes. Confirm each or mark N/A. -->

- [ ] Preserves architectural principles and ownership boundaries
- [ ] Introduces no duplicated data or business logic
- [ ] Follows naming conventions (`v_*`, `idx_*`, `fk_*`, `uq_*`, `chk_*`)
- [ ] Preserves replayability
- [ ] Completed gameplay remains immutable (corrections create new records)
- [ ] Statistics remain derived — no persisted stats
- [ ] Documentation updated (context map, `DECISIONS.md`, affected docs)
- [ ] An ADR was added if an architectural decision was made

## Notes

<!-- Anything reviewers should know: deferrals, follow-ups, known cosmetic issues. -->
