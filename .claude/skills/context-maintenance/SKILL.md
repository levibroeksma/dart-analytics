---
name: context-maintenance
description: Use before claiming any Dart Analytics task done — runs the mandatory context-upkeep steps (CLAUDE.md sync, context-map registration, decisions/** entry, gate scripts, branch/PR check, findings gate) so the context system never goes stale.
---

# Context Maintenance

Before claiming any task done on this repository:

1. **CLAUDE.md sync.** Update the `CLAUDE.md` nearest to what you changed if your change adds, alters, or invalidates a rule in it. `AGENT.md` files are pointer stubs, not mirrors — never copy rules into them; `scripts/check-agent-mirrors.sh` rejects any `AGENT.md` that carries content.
2. **Context map.** Register new, moved, renamed, or deleted docs in `docs/architecture/00-File-Inventory.md` in the same change, and append the version entry to `docs/architecture/00-Context-Map-History.md` — never to `00-Context-Map.md`, which is the router and stays small.
3. **Decision ledger.** `DECISIONS.md` is a router, not a record — never add a decision row there. Follow `DECISIONS.md`'s own "How to add a decision" section verbatim (domain-file routing, next-id derivation, block format, `Supersedes:`, new-file⇒routing-table registration). Run `scripts/check-decision-ids.sh` and confirm it passes before claiming the task done.
4. **Dates.** Add an ISO date (`YYYY-MM-DD`) to every newly added or changed docs row entry.
5. **Gate scripts.** Invoke the `run-all-gates` skill and confirm every script it runs passes.
6. **Knowledge graph.** Freshness is CI-owned: `.github/workflows/graph.yml` rebuilds `graphify-out/graph.json` on every merge to `main` and opens a PR with the delta. No local refresh action is required, and no deferred-list entry is needed for graph staleness — this step is a no-op by design.
7. **Branch/PR.** Confirm the work is on `main` or an open PR targets `main`; report the PR link (or the reason none exists) in the completion report.
8. **Findings gate.** Anything this task surfaced that it was not asked to change — a contradiction, an unenforced rule, a stale doc, a bug outside scope — is appended to `FINDINGS.md` as a new `F` entry (bump `highest-issued:` in the same edit) and named in the completion report. Never fix it in the same pass; never apply a rule change unilaterally. A rule sharpening is just a finding whose subject is a rule — it uses this same path, not a separate one. If the user approves acting on a finding, that is a new task on its own branch, and the entry is deleted when it lands. Run `scripts/check-findings-log.sh` and confirm it passes.

9. **Component inventory.** If this task added, renamed, or removed a shared component under `app/src/components/ui/`, `components/forms/`, or the shared (non-per-game) part of `components/layout/games/`, update `docs/architecture/07-Frontend/08-Component-Inventory.md` in the same change. Per-game components (`interfaces/`, `result-modals/`, `*SetupForm.astro`) are out of scope.

A change that leaves the context map, CLAUDE.md files, decision ledger, or knowledge graph stale is incomplete, even if the code works.
