# Tailwind v4 Utility Syntax Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mechanically ban Tailwind v3-era prefix-important (`!utility`) and leading-dash arbitrary negatives (`-left-[45%]`) in `app/src`, and document the Tailwind v4 forms agents must use.

**Architecture:** Extend `scripts/check-style-tokens.sh` (already on husky pre-commit and CI) with two ban families — prefix-important (three grep patterns) and leading-dash arbitrary (one grep). Style Guide is the canonical prose home; agent mirrors / agent-guide stay short pointers. No new script; no husky/CI wiring changes.

**Tech Stack:** bash + `grep -rnE`, Tailwind CSS v4 utility syntax, markdown under `docs/architecture/07-Frontend/`.

**Spec:** `docs/superpowers/specs/2026-07-31-tailwind-v4-utility-syntax-gate-design.md`

## Global Constraints

- Negative scope: arbitrary only (`-prop-[…]` banned); scale negatives (`-mt-4`, `-rotate-45`) stay allowed
- Important form: suffix only (`utility!`); prefix `!utility` banned
- Scan surface: `app/src/**/*.{astro,css}` only
- Must not false-positive Alpine/JS `!loading` / `!isText`, including inside `:class={`…`}`
- Do not scan `@apply` for prefix-`!` (CSS `!important` collision)
- Do not edit `.husky/pre-commit` or `quality.yml`
- No scale-negative ban; no prettier auto-fix; no historical plan/spec rewrites
- `app/CLAUDE.md` and `app/AGENT.md` are full-file byte-identical mirrors — apply the same edit to both
- Decision id: **D174** (after D173) — cite D174 in the script header only in Task 2, after the DECISIONS row exists
- **Branch:** create/use a dedicated branch for this task (e.g. `chore/tailwind-v4-utility-syntax-gate`); do not mix with unrelated UI work on `enhace/ui-style-improvements`
- Worktrees forbidden — checkout the task branch in the main working copy

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `scripts/check-style-tokens.sh` | All style bans including the two Tailwind v4 ban families |
| `docs/architecture/07-Frontend/07-Style-Guide.md` | Canonical “Tailwind v4 class syntax” section + Anti-patterns rows |
| `docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md` | Condensed agent pointer + checklist bullet |
| `app/CLAUDE.md` / `app/AGENT.md` | Style non-negotiables + gate pointer (identical mirrors) |
| `docs/architecture/00-Context-Map.md` | Inventory description for `check-style-tokens.sh` |
| `DECISIONS.md` | D174 row |
| Spec + this plan | Commit with Task 2 |

---

### Task 1: Extend `check-style-tokens.sh`

**Files:**
- Modify: `scripts/check-style-tokens.sh`

**Interfaces:**
- Consumes: `app/src/**/*.{astro,css}` (read-only grep)
- Produces: exit 0 when clean; exit 1 + stderr for any ban (existing three + two new families)

- [ ] **Step 0: Ensure dedicated branch**

```bash
git checkout main   # or latest integration base as appropriate
git pull
git checkout -b chore/tailwind-v4-utility-syntax-gate
```

If already on a clean dedicated branch for this work, skip. Do **not** implement on `enhace/ui-style-improvements` unless that branch’s only remaining work is this gate.

- [ ] **Step 1: Confirm current tree is clean under the new patterns**

```bash
cd "$(git rev-parse --show-toplevel)"

grep -rnE '(^|[^:])class="[^"]*![a-z]|(^|[^:])class='\''[^'\'']*![a-z]|(^|[^:])class=\{`[^`]*![a-z]' \
  app/src --include="*.astro" --include="*.css" || echo "pattern1: none"

grep -rnE '["'\''`]![a-z][a-z0-9]*(-[a-z0-9./\[\]%-]+|\[[^\]]+\])' \
  app/src --include="*.astro" --include="*.css" || echo "pattern2: none"

grep -rnE 'cn\([^)]*["'\''`]![a-z]+["'\''`]' \
  app/src --include="*.astro" || echo "pattern3: none"

grep -rnE '\b-[a-z][a-z0-9]*-\[[^\]]+\]' \
  app/src --include="*.astro" --include="*.css" || echo "neg-arb: none"
```

Expected: all four print `…: none`. Known allowed: `BaseLayout` `left-[-…]` / `bottom-[-…]`; `GameCard` `flex-row!`, `-rotate-45`; `ScoreInput` `:class={`!${value}…`}`.

- [ ] **Step 2: Write the extended script**

Replace `scripts/check-style-tokens.sh` with (header cites D161 only until Task 2 adds D174):

```bash
#!/usr/bin/env bash
# Style-token gate (app/CLAUDE.md "Style non-negotiables" / D108, D126, D128, D161):
# - no font-medium, no {...rest} spread, no raw bg-bg*/text-fg* palette utilities
# - no Tailwind v3 prefix-important (!utility) — use utility! (v4)
# - no leading-dash arbitrary negatives (-left-[45%]) — use left-[-45%]
# Scan: app/src/**/*.{astro,css}.
#
# Prefix-! patterns (avoid Alpine/JS !ident and :class boolean negation):
#   1. Static class= / class={`...`} only — (^|[^:]) so :class= is excluded
#   2. Quoted/backticked compound !util-… or !util[…] (cn multiline, :class compounds)
#   3. Bare "!flex" on the same line as cn(
# Gaps (accepted): variable-held "!flex"; bare :class={`!flex`}; @apply !util
#   (@apply skipped — collides with CSS !important).
# Neg-arbitrary: -left-[45%] banned; -inset-x-[10%] caught via trailing -x-[10%].
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

FAIL=0

FONT_MEDIUM=$(grep -rnE 'font-medium' app/src --include="*.astro" --include="*.css")
if [ -n "$FONT_MEDIUM" ]; then
  echo "FAIL: font-medium found — use font-normal/font-semibold/font-bold instead:" >&2
  echo "$FONT_MEDIUM" >&2
  FAIL=1
fi

REST_SPREAD=$(grep -rnE '\{\.\.\.rest\}' app/src --include="*.astro")
if [ -n "$REST_SPREAD" ]; then
  echo "FAIL: {...rest} found — forward leftover attributes as {...props} instead:" >&2
  echo "$REST_SPREAD" >&2
  FAIL=1
fi

RAW_PALETTE=$(grep -rnE '\b(bg-bg[a-z0-9-]*|text-fg[a-z0-9-]*)\b' app/src --include="*.astro" --include="*.css")
if [ -n "$RAW_PALETTE" ]; then
  echo "FAIL: raw palette utility found — use semantic tokens (surface/foreground/muted*/accent*/states) instead:" >&2
  echo "$RAW_PALETTE" >&2
  FAIL=1
fi

PREFIX_IMPORTANT=$(
  {
    grep -rnE '(^|[^:])class="[^"]*![a-z]|(^|[^:])class='\''[^'\'']*![a-z]|(^|[^:])class=\{`[^`]*![a-z]' \
      app/src --include="*.astro" --include="*.css" || true
    grep -rnE '["'\''`]![a-z][a-z0-9]*(-[a-z0-9./\[\]%-]+|\[[^\]]+\])' \
      app/src --include="*.astro" --include="*.css" || true
    grep -rnE 'cn\([^)]*["'\''`]![a-z]+["'\''`]' \
      app/src --include="*.astro" || true
  } | sort -u
)
if [ -n "$PREFIX_IMPORTANT" ]; then
  echo "FAIL: Tailwind prefix-important (!utility) found — use suffix form (utility!) instead:" >&2
  echo "$PREFIX_IMPORTANT" >&2
  FAIL=1
fi

# -inset-x-[10%] matches via substring -x-[10%]
NEG_ARBITRARY=$(grep -rnE '\b-[a-z][a-z0-9]*-\[[^\]]+\]' app/src --include="*.astro" --include="*.css")
if [ -n "$NEG_ARBITRARY" ]; then
  echo "FAIL: leading-dash arbitrary utility (-prop-[…]) found — put the minus inside the brackets (prop-[-…]):" >&2
  echo "$NEG_ARBITRARY" >&2
  FAIL=1
fi

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi
echo "OK: no font-medium, {...rest}, raw bg-bg*/text-fg*, prefix-important (!utility), or leading-dash arbitrary (-prop-[…]) under app/src."
```

- [ ] **Step 3: Green — clean tree passes**

Run: `bash scripts/check-style-tokens.sh`  
Expected: exit 0; OK line lists all ban families.

- [ ] **Step 4: Red — static `class="!max-w-none"` fails**

```bash
FIX=app/src/.style-gate-fixture.astro
cat > "$FIX" <<'EOF'
---
---
<div class="!max-w-none"></div>
EOF
bash scripts/check-style-tokens.sh; echo "exit=$?"
rm -f "$FIX"
```

Expected: exit 1; stderr mentions prefix-important.

- [ ] **Step 5: Red — leading-dash arbitrary fails**

```bash
FIX=app/src/.style-gate-fixture.astro
cat > "$FIX" <<'EOF'
---
---
<div class="-left-[45%]"></div>
EOF
bash scripts/check-style-tokens.sh; echo "exit=$?"
rm -f "$FIX"
```

Expected: exit 1; stderr mentions leading-dash arbitrary.

- [ ] **Step 6: Red — bare `cn("!flex")` same-line fails**

```bash
FIX=app/src/.style-gate-fixture.astro
cat > "$FIX" <<'EOF'
---
const x = cn("!flex", "gap-2");
---
<div></div>
EOF
bash scripts/check-style-tokens.sh; echo "exit=$?"
rm -f "$FIX"
```

Expected: exit 1; prefix-important.

- [ ] **Step 7: Red — multiline compound `cn` (pattern 2) fails**

```bash
FIX=app/src/.style-gate-fixture.astro
cat > "$FIX" <<'EOF'
---
const x = cn(
  "!size-[130vmin]",
  "gap-2",
);
---
<div></div>
EOF
bash scripts/check-style-tokens.sh; echo "exit=$?"
rm -f "$FIX"
```

Expected: exit 1; prefix-important (pattern 2).

- [ ] **Step 8: Green — must-pass forms (allowed utilities + Alpine)**

```bash
FIX=app/src/.style-gate-fixture.astro
cat > "$FIX" <<'EOF'
---
---
<div
  class="left-[-45%] max-w-none! -rotate-45 -mt-4"
  x-show="!loading"
  :class={`!loading && 'text-muted-foreground'`}
></div>
<span :class={`!${value} && 'text-muted-foreground'`}></span>
EOF
bash scripts/check-style-tokens.sh; echo "exit=$?"
rm -f "$FIX"
```

Expected: exit 0. (Suffix `!`, in-bracket minus, scale negatives, `x-show` / `:class` Alpine negation all OK.)

- [ ] **Step 9: Commit**

```bash
git add scripts/check-style-tokens.sh
git commit -m "$(cat <<'EOF'
Extend style-tokens gate for Tailwind v4 utility syntax.

Ban prefix-important (!utility) and leading-dash arbitrary negatives
(-prop-[…]) so agents cannot land deprecated class forms.
EOF
)"
```

---

### Task 2: Docs, agent mirrors, context map, D174

**Files:**
- Modify: `scripts/check-style-tokens.sh` (header: add D174 citation only)
- Modify: `docs/architecture/07-Frontend/07-Style-Guide.md`
- Modify: `docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md`
- Modify: `app/CLAUDE.md`
- Modify: `app/AGENT.md`
- Modify: `docs/architecture/00-Context-Map.md`
- Modify: `DECISIONS.md`
- Add (commit): `docs/superpowers/specs/2026-07-31-tailwind-v4-utility-syntax-gate-design.md`
- Add (commit): `docs/superpowers/plans/2026-07-31-tailwind-v4-utility-syntax-gate.md`

**Interfaces:**
- Consumes: Task 1 gate behavior
- Produces: docs + D174; mirrors green; context-map/budget green

- [ ] **Step 1: Style Guide — pin version and place section before Anti-patterns**

In `docs/architecture/07-Frontend/07-Style-Guide.md`:

1. Set front-matter `updated: 2026-07-31`
2. Set version line to `> **Version:** 0.2.1 (2026-07-31 — Tailwind v4 utility syntax)`
3. Insert the following block **immediately before** the existing `# Anti-patterns` heading (not after Spacing):

```markdown
# Tailwind v4 class syntax

This repo uses Tailwind CSS v4 utility forms. Agents must not emit v3-era variants.

| Do | Don't |
| -- | ----- |
| Suffix important: `max-w-none!`, `flex-row!`, `size-[130vmin]!` | Prefix important: `!max-w-none`, `!flex`, `!size-[130vmin]` |
| Negative inside arbitrary: `left-[-45%]`, `bottom-[-25%]` | Leading-dash arbitrary: `-left-[45%]`, `-bottom-[25%]` |

Scale negatives without arbitrary brackets stay fine (`-mt-4`, `-rotate-45`, `-translate-x-1/2`). Mechanically enforced by `scripts/check-style-tokens.sh` (D174).
```

4. Append to the Anti-patterns table:

```markdown
| Prefix important `!utility` | Suffix important `utility!` (Tailwind v4) |
| Leading-dash arbitrary `-prop-[…]` | `prop-[-…]` (minus inside brackets) |
```

- [ ] **Step 2: Frontend Agent Guide — pin 0.1.6**

In `docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md`:

1. Set `updated: 2026-07-31`
2. Set version to `> **Version:** 0.1.6 (2026-07-31 — Tailwind v4 utility syntax)`
3. In §12 Styling, append this sentence to the end of the existing paragraph (one space after the prior period):

`Tailwind v4: use suffix important (\`utility!\`) not prefix (\`!utility\`); arbitrary negatives as \`prop-[-…]\` not \`-prop-[…]\` (\`scripts/check-style-tokens.sh\`).`

4. In Pre-Completion Checklist styling bullet, append: `; no prefix !utility; no -prop-[…] arbitrary negatives`

- [ ] **Step 3: Update `app/CLAUDE.md` and `app/AGENT.md` to identical contents**

Under **Style non-negotiables**, after the `font-medium` bullet, add:

```markdown
- Tailwind v4 utilities only — suffix important (`utility!`), never prefix (`!utility`); arbitrary negatives as `left-[-45%]`, never `-left-[45%]`
```

Replace the final “Full rules” bullet with:

```markdown
- Full rules: `docs/architecture/07-Frontend/07-Style-Guide.md` (visual) and `07-Frontend/05-Astro-Components.md` (class composition / props); `font-medium`/`{...rest}`/raw palette utilities/Tailwind v4 `!utility` + `-prop-[…]` mechanically enforced by `scripts/check-style-tokens.sh` (2026-07-31)
```

Copy the same bytes into both files (`check-agent-mirrors.sh` requires full-file identity).

- [ ] **Step 4: Context map inventory**

In `docs/architecture/00-Context-Map.md`, set the `check-style-tokens.sh` row to:

```markdown
| `scripts/check-style-tokens.sh` | Guard: no `font-medium`, `{...rest}`, raw `bg-bg*`/`text-fg*`, Tailwind prefix-important (`!utility`), or leading-dash arbitrary (`-prop-[…]`) under `app/src/**/*.{astro,css}` | canonical |
```

Bump that file’s header `updated` / version note to 2026-07-31 per its local convention.

- [ ] **Step 5: DECISIONS.md — D174 + script header citation**

Append after D173:

```markdown
| D174 | 2026-07-31 | `scripts/check-style-tokens.sh` also bans Tailwind v3 prefix-important (`!utility`) and leading-dash arbitrary negatives (`-prop-[…]`) in favor of v4 `utility!` / `prop-[-…]` | Agents repeatedly landed deprecated forms; prose in the Style Guide was not enough — same latency pattern as D161 |
```

Then update the first comment line of `scripts/check-style-tokens.sh` to include D174:

```bash
# Style-token gate (app/CLAUDE.md "Style non-negotiables" / D108, D126, D128, D161, D174):
```

- [ ] **Step 6: Verify gates (context-maintenance subset)**

```bash
bash scripts/check-style-tokens.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-map.sh
bash scripts/check-context-budget.sh
```

Expected: all exit 0.

- [ ] **Step 7: Commit docs, decisions, spec, plan, script header**

```bash
git add \
  scripts/check-style-tokens.sh \
  docs/architecture/07-Frontend/07-Style-Guide.md \
  docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md \
  app/CLAUDE.md \
  app/AGENT.md \
  docs/architecture/00-Context-Map.md \
  DECISIONS.md \
  docs/superpowers/specs/2026-07-31-tailwind-v4-utility-syntax-gate-design.md \
  docs/superpowers/plans/2026-07-31-tailwind-v4-utility-syntax-gate.md
git commit -m "$(cat <<'EOF'
Document and register Tailwind v4 utility syntax bans (D174).

Style Guide owns the rule; agent mirrors, context map, and the
style-tokens gate description keep agents off prefix ! and -prop-[…].
EOF
)"
```

---

## Spec coverage (self-review)

| Spec section | Task |
| ------------ | ---- |
| §4.1 Prefix important (3 patterns, `:class` / `!important` guards, gaps) | Task 1 |
| §4.2 Leading-dash arbitrary + inset-x note | Task 1 |
| §6 red/green incl. multiline cn + Alpine `:class` | Task 1 Steps 4–8 |
| §5 Style Guide (before Anti-patterns, 0.2.1) | Task 2 Step 1 |
| §5 Agent guide (0.1.6) | Task 2 Step 2 |
| §5 CLAUDE/AGENT full mirrors | Task 2 Step 3 |
| §5 Context map | Task 2 Step 4 |
| §5 DECISIONS D174 + script citation order | Task 2 Step 5 |
| §6.4 context-maintenance scripts | Task 2 Step 6 |
| Spec + plan committed | Task 2 Step 7 |
| Dedicated branch | Task 1 Step 0 |
| Out of scope (scale negatives, prettier, husky, `@apply` scan) | Honored |

Known gaps called out in script header and spec §4.1 — not treated as incomplete work.
