# Handoff — PR2 UI Polish (post style-guide alignment)

> **Date:** 2026-07-22  
> **After:** [PR #32](https://github.com/levibroeksma/dart-analytics/pull/32) — `docs/ui: style guide alignment + cn() CI gate`  
> **Base:** `origin/main` @ `4ab73bf` (merge commit of #32)  
> **Parent spec:** `docs/superpowers/specs/2026-07-22-style-guide-alignment-design.md` (§1 PR2)  
> **Parent plan (PR1 done):** `docs/superpowers/plans/2026-07-22-style-guide-alignment.md`

---

## One-liner

PR1 locked the **visual contract + authoring gates**. PR2 is **visual/UX polish + adopt or retire the unwired UI kit** — do not re-litigate tokens, `cn()`, or Alpine rules.

---

## Start here

```bash
git fetch origin
git checkout main
git pull --ff-only origin main   # tip should be 4ab73bf or later
git checkout -b ui/score-training-polish   # name flexible; no worktrees
```

If local `main` is blocked by untracked `app/.vscode/settings.json`, move/remove that file then pull.

**Do not** use git worktrees (D102).

---

## What PR1 already shipped (do not redo)

| Area | Status on `main` |
|------|------------------|
| Style guide v0.2.0 | `docs/architecture/07-Frontend/07-Style-Guide.md` — sky/glass/`surface`/`foreground` |
| Agent cascade | `10-Frontend-Agent-Guide.md` §12 + `app/CLAUDE.md`/`AGENT.md` Style non-negotiables |
| `cn()` gate | `scripts/check-astro-class-composition.sh` + CI `structure` job + Context Maintenance |
| Props naming | `{...props}` not `{...rest}` (D128); documented in `05` |
| Legacy purge | No `class:list`, `font-medium`, `text-fg*`, `bg-bg*`, `{...rest}` in live UI (final fix in #32) |
| Decisions | D126 style rewrite · D127 cn() CI · D128 `{...props}` · D129 fallow ignore (temporary) |
| Score Training | Play UI + `ScoreInputBuffer` + Modal/ConfirmDialog path already on main via #31/#32 |

**Gates that must stay green:**

```bash
bash scripts/check-context-map.sh
bash scripts/check-file-locations.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-astro-class-composition.sh
bash scripts/check-astro-conventions.sh   # CI already runs this; not yet in CLAUDE step 5
cd app && npm run validate:app
```

---

## PR2 goal

Remaining Score Training / shared-component **visual and UX polish**, plus **route-adopt or delete** design-system primitives that PR1 shipped under fallow ignore (D129).

Does **not**: rewrite the style guide, change Alpine/`cn()` rules, or invent new conventions.

---

## Must-do backlog (from PR1 final review + D129)

### 1. Clear D129 — adopt or delete unwired UI kit

`app/.fallowrc.jsonc` ignores unused `src/components/ui/*` primitives and `CustomTabs.astro` until routes use them.

**PR2 success:** either wire each ignored component into a real page, or delete it; then **remove** the corresponding `ignorePatterns` / tighten health overrides; record superseding D129 (or note “D129 retired”).

**UI inventory on `main` (`app/src/components/ui/`):**

Alert, Badge, BulletItem, BulletList, Card, CardWrapper, Checkbox, ConfirmDialog, Field, Fieldset, GradientCard, Input, IsLoading, Link, LinkCard, LogoutButton, Modal, NavPill, Radio, Range, Section, Select, SelectOption, Tab, TabPanel, Tabs, Textarea  

Plus: `app/src/components/CustomTabs.astro` (suspected scraped Raycast placeholder — **delete or replace**, do not ship as-is).

**Already “real” (likely keep):** Modal, ConfirmDialog, LogoutButton, and anything already imported by Score Training / layouts / login.

**Health overrides to revisit:** `CardWrapper`, `ScoreInput` thresholds in fallow config — drop when templates are healthy.

### 2. Frontmatter section purity

Several components still place derived consts between `// Props` and `// Lib` (noted: `Field`, `Link`, `Alert`). Align strictly with `05-Astro-Components.md` order: Props → imports → Data → Styles.

### 3. CLAUDE Context Maintenance ↔ CI parity (optional but good)

CI runs `check-astro-conventions.sh`; root `CLAUDE.md` / `AGENT.md` step 5 lists four scripts and **omits** conventions. Add it as a fifth checker (byte-identical mirrors) so local protocol matches CI (D123).

### 4. Visual / UX polish (primary creative scope)

Work from live Score Training flows and the style guide:

| Surface | Suggested focus |
|---------|-----------------|
| Games index / `GameCard` | Spacing, glass/card hierarchy, empty states |
| Setup (`SetupSessionForm`, `NoSessionPanel`, ContinueSession) | Form density, alerts, loading |
| Play (`ScoreTraining`, `ScoreInput`, `SinglePlayerDisplay`, `StatRow`) | Keypad/readout hierarchy, timer/visit chrome, finish/undo affordances |
| Results modal | Summary typography, success/error rows, CTA row |
| Login / shell / BottomNav | Consistency with glass/raised system after `.surface` retirement |
| Shared kit | Only polish components you keep after D129 cleanup |

Smoke: setup → play → finish confirm → results → back / play again.

---

## Out of scope for PR2

- New game types / engines  
- Theme toggle / light mode  
- Regenerating architecture docs  
- Reopening style-token vocabulary debates (fix drift only if `global.css` and guide disagree — CSS wins, update guide)  
- Portable kit members not already present (toast/chart/etc.)

---

## Suggested task order

1. Branch from current `main`  
2. Triage UI kit: keep list vs delete list (table in PR description)  
3. Delete `CustomTabs` (or replace with real `Tabs` usage)  
4. Wire keepers into pages **or** delete; shrink `.fallowrc.jsonc`; retire D129  
5. Frontmatter order pass on touched files  
6. Visual polish pass on Score Training + shell (minimal diffs; follow `07-Style-Guide.md`)  
7. Optional: add `check-astro-conventions.sh` to Context Maintenance step 5  
8. `validate:app` + open PR targeting `main`

---

## Context pack (load these)

From `docs/architecture/00-Context-Map.md` — Frontend page/component + gameplay packs:

- `07-Frontend/10-Frontend-Agent-Guide.md`  
- `07-Frontend/00-Overview.md`  
- `07-Frontend/05-Astro-Components.md`  
- `07-Frontend/07-Style-Guide.md`  
- `07-Frontend/03-Alpine-Patterns.md` (if touching play Alpine)  
- `app/CLAUDE.md`  

Authority: docs over code; after PR1, `global.css` wins token/primitive drift vs the style guide.

---

## Verification checklist (PR2)

- [ ] `bash scripts/check-astro-class-composition.sh`  
- [ ] `bash scripts/check-astro-conventions.sh`  
- [ ] Other Context Maintenance checkers  
- [ ] `cd app && npm run validate:app` — fallow clean **without** broad UI `ignorePatterns` (or only justified, temporary leftovers with a decision note)  
- [ ] Manual smoke: Score Training setup / play / results  
- [ ] `DECISIONS.md` updated if D129 retired or kit policy changes  
- [ ] No git worktrees  

---

## References

| Doc | Why |
|-----|-----|
| `docs/superpowers/specs/2026-07-22-style-guide-alignment-design.md` | PR1/PR2 split |
| `docs/superpowers/plans/2026-07-22-style-guide-alignment.md` | What PR1 executed |
| `DECISIONS.md` D126–D129 | Contract + temporary fallow ignore |
| `.superpowers/sdd/progress.md` | PR1 SDD ledger + minor roll-up (local scratch; may be gitignored) |

---

## Handoff note for the next agent

Start with **brainstorming** only if PR2 scope is unclear (e.g. which kit components to keep). If the keep/delete list above is accepted as-is, go straight to **writing-plans** for PR2, then **subagent-driven-development** or **executing-plans**. Prefer a dedicated branch from `main` (`4ab73bf`+), not a long-lived `docs/style-guide-alignment` continuation.
