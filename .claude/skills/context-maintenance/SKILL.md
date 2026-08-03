---
name: context-maintenance
description: Use before claiming any Dart Analytics task done — runs the mandatory context-upkeep steps (CLAUDE.md/AGENT.md sync, context-map registration, decisions/** entry, gate scripts, branch/PR check, self-learning gate) so the context system never goes stale.
---

# Context Maintenance

Before claiming any task done on this repository:

1. **CLAUDE.md/AGENT.md sync.** Update the `CLAUDE.md` nearest to what you changed if your change adds, alters, or invalidates a rule in it — and its `AGENT.md` mirror in the same directory, if one exists, kept byte-for-byte identical (repo root, `app/`, `app/src/db/`, `app/src/pages/api/`, `database/`, `docs/`).
2. **Context map.** Register new, moved, renamed, or deleted docs in `docs/architecture/00-Context-Map.md` in the same change.
3. **Decision ledger.** `DECISIONS.md` is a router, not a record — never add a decision row there. Follow `DECISIONS.md`'s own "How to add a decision" section verbatim (domain-file routing, next-id derivation, block format, `Supersedes:`, new-file⇒routing-table registration). Run `scripts/check-decision-ids.sh` and confirm it passes before claiming the task done.
4. **Dates.** Add an ISO date (`YYYY-MM-DD`) to every newly added or changed docs row entry.
5. **Gate scripts.** Invoke the `run-all-gates` skill and confirm every script it runs passes.
6. **Knowledge graph.** Freshness is CI-owned: `.github/workflows/graph.yml` rebuilds `graphify-out/graph.json` on every merge to `main` and opens a PR with the delta. No local refresh action is required, and no deferred-list entry is needed for graph staleness — this step is a no-op by design.
7. **Branch/PR.** Confirm the work is on `main` or an open PR targets `main`; report the PR link (or the reason none exists) in the completion report.
8. **Self-learning gate.** If this task surfaced a rule that was ambiguous, missing, unenforced, or contradicted by the real code/config — beyond what step 1 already requires for the change itself — propose the specific `CLAUDE.md`/`AGENT.md` sharpening in chat and get the user's explicit approval before writing it. Never apply a rule change unilaterally. If the user declines, leave the rule as-is and move on; the gate exists to keep rule evolution deliberate, not to force a change.

A change that leaves the context map, CLAUDE.md files, decision ledger, or knowledge graph stale is incomplete, even if the code works.
