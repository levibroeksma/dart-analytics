# #916 PR D — Routine Completion States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One owner for the routine play page's per-panel completion states (finish confirm, failed-upload block, saving block), rendered HTML unchanged.

**Architecture:** New `components/layout/training/routines/RoutineCompletionStates.astro` renders, inside the panel's existing `x-data="game"` scope, the optional `showFinishConfirm` dialog, the `completionStatus === 'failed'` block and the saving block. The four game panels in `pages/training/routines/play/index.astro` (TUOD, Score Training, 121, Around the Clock) each replace their copy with one tag. Proof is a before/after diff of the prerendered page (`dist/client/training/routines/play/index.html`), which is deterministic (checked: two clean builds are byte-identical).

**Tech Stack:** Astro, Alpine.js (`app/`).

**Spec:** `docs/superpowers/specs/2026-10-20-916-play-engine-dedupe-design.md` §PR D.

**Branch:** `refactor/916-routine-completion-states` (from `origin/main`).

**Spec choice resolved:** the spec gives the component two props, `description` and `savingText`, and says it renders the finish confirm. But only TUOD and Score Training have the same confirm (`showFinishConfirm`, `cancelFinish()`/`confirmFinish()`, `routine-finish-confirm-title`). 121's confirm has its own flag, handlers, title, labels and titleId (`showSessionFinishConfirm`, `routine-session-finish-confirm-title`, "Check out 170?"). Around the Clock has no confirm. So `description` is optional. When it is omitted, no confirm renders. 121's confirm stays in its panel as a panel-specific gate, like `CheckoutConfirm`. All four panels share the failed and saving blocks.

**Visual check:** the spec asks for before/after Playwright screenshots, or, if that is not practical, for the PR to say so. Reaching each panel's confirm or saving state means playing a routine against the API, and the container has no `DATABASE_URL`. This plan diffs the prerendered HTML instead. That covers every state at once, including the `x-cloak`ed blocks a screenshot cannot see. The PR states that the screenshot check is left open.

## Global Constraints

- Rendered HTML of `/training/routines/play` is identical after whitespace normalization (Task 1 Step 1 script). Nothing else may differ: not an `x-show` expression, an id, a class or a text string.
- `x-show` expressions verbatim: `showFinishConfirm`, `finished && completionStatus === 'failed'`, `finished && completionStatus !== 'failed'`.
- titleId verbatim: `routine-finish-confirm-title`.
- Saving copy verbatim: `Saving your finishing session…`, `Saving your scoring session…`, `Saving your 121 session…`, `Saving your Around the Clock session…` (each with U+2026).
- Finish-confirm descriptions verbatim: TUOD `This attempt completes the session. Confirm to save and finish, or cancel to reconsider.`; Score Training `This visit completes the session. Confirm to save and finish, or cancel to reconsider.`
- Every `x-show` keeps `x-cloak` on the same element (`check-astro-conventions.sh`). Template comments use `{/* */}`, never `<!-- -->`.
- `.astro` has no unit tests (D101). The HTML diff is this PR's test. Do not extract a `.ts` helper to make it testable.
- `astro check --minimumFailingSeverity hint`: 0 errors, 0 warnings, 0 hints.
- Commit trailer on every commit:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_012Jy7Bud9eXY6WqP2khUKcW
  ```
- `git commit` runs the full pre-commit, which takes more than 2 minutes. Use a 600000 ms timeout, redirect the output to a scratch log and read its tail. Never use `--no-verify`.
- Discovered work goes into a GitHub issue with the `discovered-work` label. It is never fixed here.
- `$SCRATCH` = `/tmp/claude-0/-home-user-dart-analytics/402af0cf-11f6-5d19-a94b-3001f8d4c0d4/scratchpad`.

## Review Focus

1. **121 gains a second confirm.** Passing `description` on 121 would render a `showFinishConfirm` dialog that 121's store never raises. That is dead markup, and it duplicates the id. The HTML diff catches it, and Task 1 Step 6 also pins the count of `routine-finish-confirm-title` at 2.
2. **Scope leak.** The component's markup must land inside each panel's `<div x-data="game">`. If it ends up outside, `finished` and `completionStatus` resolve against `routinePlay()` and the blocks never show. The HTML diff checks where it lands.
3. **Order of gates.** In TUOD, `CheckoutConfirm` must stay before the finish confirm. In 121, `CheckoutConfirm` and the session-finish confirm must stay before the failed and saving blocks. Moving them changes stacking. The HTML diff checks the order.
4. **Whitespace inside the saving `<p>`.** Around the Clock's copy is multi-line in the source today. The normalized diff treats only collapsible whitespace as equal, so the reviewer confirms that every remaining difference sits at a tag boundary or is a whitespace run.
5. **Dupes.** The three fallow clone groups in `play/index.astro` (lines 160–191 / 224–255 / 295–323 / 343–365 today) must be gone, and no new group may appear in the component.

---

### Task 1: `RoutineCompletionStates` + four panels

**Files:**
- Create: `app/src/components/layout/training/routines/RoutineCompletionStates.astro`
- Modify: `app/src/pages/training/routines/play/index.astro` (four game panels, today `:150-191`, `:214-255`, `:295-323`, `:343-365`)
- Test: before/after `dist/client/training/routines/play/index.html` diff (no `.astro` unit test, D101)

**Interfaces:**
- Produces: `<RoutineCompletionStates description?={string} savingText={string} />`, used only inside a routine play panel's `x-data="game"` scope. It reads `showFinishConfirm`, `cancelFinish()`, `confirmFinish()`, `stepContextRow()`, `finished`, `completionStatus`, `completionError` and `uploadAndCompleteSession()` from that scope.

- [ ] **Step 1: Capture the baseline and write the compare script**

Run on the unchanged tree:

```bash
cd app && npx astro build > $SCRATCH/build-before.log 2>&1; tail -2 $SCRATCH/build-before.log
cp dist/client/training/routines/play/index.html $SCRATCH/play-before.html
grep -c 'routine-finish-confirm-title' $SCRATCH/play-before.html
```

Expected: `Complete!`, then `2`.

Write `$SCRATCH/htmlnorm.py`:

```python
import re, sys
def norm(p):
    s = open(p, encoding="utf-8").read()
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r">\s+", ">", s)
    s = re.sub(r"\s+<", "<", s)
    return s
a, b = norm(sys.argv[1]), norm(sys.argv[2])
if a == b:
    print("IDENTICAL")
    sys.exit(0)
n = min(len(a), len(b))
i = next((k for k in range(n) if a[k] != b[k]), n)
print("DIFF at", i)
print("before:", a[max(0, i - 200): i + 200])
print("after: ", b[max(0, i - 200): i + 200])
sys.exit(1)
```

Run: `python3 -I $SCRATCH/htmlnorm.py $SCRATCH/play-before.html $SCRATCH/play-before.html`
Expected: `IDENTICAL`.

- [ ] **Step 2: Create the component**

`app/src/components/layout/training/routines/RoutineCompletionStates.astro`:

```astro
---
/**
 * Presentational — a routine game step's completion states, rendered inside
 * that step's `x-data="game"` scope: the finish confirm (`showFinishConfirm`),
 * the failed-upload block with Retry, and the saving block once `finished`.
 * @param {string} [description] Finish-confirm text; omit when the step has no
 *   `showFinishConfirm` gate
 * @param {string} savingText Saving-block copy
 */
interface Props {
  description?: string;
  savingText: string;
}

// Props
const { description, savingText } = Astro.props;

// Components
import ConfirmDialog from "@components/ui/ConfirmDialog.astro";
import InlayRow from "@components/ui/InlayRow.astro";
import ErrorAlert from "@components/ui/ErrorAlert.astro";
import Button from "@components/forms/Button.astro";
---

{
  description && (
    <div
      x-show="showFinishConfirm"
      x-cloak
    >
      <ConfirmDialog
        titleId="routine-finish-confirm-title"
        title="Finish session?"
        description={description}
        confirmLabel="Finish"
        onCancel="cancelFinish()"
        onConfirm="confirmFinish()"
        dismissible={false}
      >
        <InlayRow
          slot="context"
          rowExpr="stepContextRow()"
        />
      </ConfirmDialog>
    </div>
  )
}
<div
  x-show="finished && completionStatus === 'failed'"
  x-cloak
  class="p-4"
>
  <ErrorAlert
    textExpr="completionError"
    alwaysVisible
  />
  <Button
    class="mt-2"
    @click="uploadAndCompleteSession()"
    title="Retry"
  />
</div>
<div
  x-show="finished && completionStatus !== 'failed'"
  x-cloak
  class="p-4 text-center"
>
  <p class="text-foreground">{savingText}</p>
</div>
```

If `check-astro-conventions.sh` or `check-astro-class-composition.sh` wants the imports above the Props block (compare `OpenRoutineModal.astro` and `ConfirmDialog.astro`), follow the gate and ledger a ruling.

- [ ] **Step 3: Replace the four panel blocks**

In `play/index.astro`, add `import RoutineCompletionStates from "@components/layout/training/routines/RoutineCompletionStates.astro";` after the `RoutineSummaryModal` import.

- **TUOD:** after the `CheckoutConfirm` wrapper `</div>`, replace the finish-confirm `<div>`, the failed `<div>` and the saving `<div>` with:
  ```astro
  <RoutineCompletionStates
    description="This attempt completes the session. Confirm to save and finish, or cancel to reconsider."
    savingText="Saving your finishing session…"
  />
  ```
- **Score Training:** after the `{/* Score Training's own confirm gate … */}` comment, replace the same three `<div>`s with:
  ```astro
  <RoutineCompletionStates
    description="This visit completes the session. Confirm to save and finish, or cancel to reconsider."
    savingText="Saving your scoring session…"
  />
  ```
- **121:** keep the `CheckoutConfirm` wrapper and the `showSessionFinishConfirm` `<div>`. Replace only the failed and saving `<div>`s with:
  ```astro
  <RoutineCompletionStates savingText="Saving your 121 session…" />
  ```
- **Around the Clock:** replace the failed and saving `<div>`s with:
  ```astro
  <RoutineCompletionStates savingText="Saving your Around the Clock session…" />
  ```

If nothing else uses them afterwards, remove the `ErrorAlert`, `Button` and `InlayRow` imports. `ErrorAlert` is still used at the top of the page and `InlayRow` is still used by 121's confirm, so only `Button` might become unused. Check with `grep -c '<Button' app/src/pages/training/routines/play/index.astro`. Keep `ConfirmDialog`, because 121 still uses it.

- [ ] **Step 4: Format and type-check**

Run: `cd app && npx prettier --write src/pages/training/routines/play/index.astro src/components/layout/training/routines/RoutineCompletionStates.astro && npx astro check --minimumFailingSeverity hint > $SCRATCH/check.log 2>&1; tail -4 $SCRATCH/check.log`
Expected: `0 errors`, `0 warnings`, `0 hints`.

- [ ] **Step 5: Diff the rendered page**

Run:

```bash
cd app && npx astro build > $SCRATCH/build-after.log 2>&1; tail -2 $SCRATCH/build-after.log
python3 -I $SCRATCH/htmlnorm.py $SCRATCH/play-before.html dist/client/training/routines/play/index.html
```

Expected: `Complete!`, then `IDENTICAL`. On `DIFF`, read both excerpts. If the difference is in markup (an attribute, an order or a text string), fix the component or the panel and repeat. Never adjust the normalizer to hide a markup difference.

- [ ] **Step 6: Pin the counts and run a mutation probe**

Run: `grep -c 'routine-finish-confirm-title' dist/client/training/routines/play/index.html; grep -c 'routine-session-finish-confirm-title' dist/client/training/routines/play/index.html`
Expected: `2` and the baseline count. Check the baseline with the same grep on `$SCRATCH/play-before.html`.

Mutation probe: add `description="x"` to 121's tag, rebuild, then run the compare script.
Expected: `DIFF` (a third finish confirm appears). Restore 121's tag with Edit, rebuild, and run the compare script.
Expected: `IDENTICAL`.

- [ ] **Step 7: Astro gates and commit**

Run: `bash scripts/check-astro-conventions.sh && bash scripts/check-astro-class-composition.sh && bash scripts/check-style-tokens.sh && bash scripts/check-no-inline-comments.sh` (from the repo root)
Expected: all `OK`.

```bash
git add app/src/components/layout/training/routines/RoutineCompletionStates.astro app/src/pages/training/routines/play/index.astro
git commit -m "refactor(routines): extract RoutineCompletionStates from routine play panels (#916)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012Jy7Bud9eXY6WqP2khUKcW" > $SCRATCH/commit1.log 2>&1; tail -5 $SCRATCH/commit1.log
```

Expected: the commit is created and every pre-commit gate passes.

`task-done` test command: `bash -c "cd app && npx astro build >/dev/null 2>&1 && python3 -I $SCRATCH/htmlnorm.py $SCRATCH/play-before.html dist/client/training/routines/play/index.html"`.

---

### Task 2: Gates, dupes, docs, push + PR

**Files:**
- Modify: `docs/architecture/07-Frontend/08-Component-Inventory.md` (the `components/layout/training/routines/` table)
- Modify: `docs/architecture/00-File-Inventory.md` (new row after the `RoutineReadyGate.astro` row)

**Interfaces:**
- Consumes: `RoutineCompletionStates.astro` from Task 1.

- [ ] **Step 1: Dupes**

Run: `cd app && npx fallow dupes --mode mild --format json > $SCRATCH/dupes-after.json 2>/dev/null` and then:

```bash
python3 -I -c "
import json
d = json.load(open('$SCRATCH/dupes-after.json'))
for g in d['clone_groups']:
    if any('routines/play' in i['file'] or 'RoutineCompletionStates' in i['file'] for i in g['instances']):
        print([(i['file'].split('/')[-1], i['start_line'], i['end_line']) for i in g['instances']])
"
```

Expected: no output. Today the same check prints three groups.

- [ ] **Step 2: Inventories**

In `08-Component-Inventory.md`, add a row to the `components/layout/training/routines/` table after `RoutineReadyGate.astro`:

```
| `RoutineCompletionStates.astro` | A routine game step's completion states inside the panel's `x-data="game"` scope: optional `showFinishConfirm` dialog (`routine-finish-confirm-title`, `stepContextRow()` inlay), failed-upload `ErrorAlert` with Retry, and the saving line (2026-10-21) | `description?` (finish-confirm text; omit for no confirm), `savingText` |
```

In `00-File-Inventory.md`, add after the `RoutineReadyGate.astro` row:

```
| `app/src/components/layout/training/routines/RoutineCompletionStates.astro` | The routine play page's shared per-step completion states — finish confirm, failed upload, saving (2026-10-21) | canonical |
```

Run `bash scripts/check-doc-links.sh && bash scripts/check-context-map.sh`.
Expected: both `OK`.

- [ ] **Step 3: Full gates**

Run: `cd app && npx vitest run > $SCRATCH/suite.log 2>&1; tail -5 $SCRATCH/suite.log`
Expected: all pass, with the same 451 files as on `main`.

Run: `bash scripts/fallow-gate.sh`, then `cd app && npm run format:check`.
Expected: pass; clean.

Run the `run-all-gates` skill and confirm every script passes. `validate:app` stops at `db:status` with no `DATABASE_URL`. Run its non-DB steps (fallow gate, tests, `astro check`) directly and ledger that as a ruling.

- [ ] **Step 4: Discovered work and context maintenance**

File any incidental finding per `capturing-discovered-work` (search first). Run `context-maintenance`. No decision block is needed, because the spec owns the change.

```bash
git add docs/architecture/07-Frontend/08-Component-Inventory.md docs/architecture/00-File-Inventory.md
git commit -m "docs(inventory): register RoutineCompletionStates (#916)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012Jy7Bud9eXY6WqP2khUKcW" > $SCRATCH/commit2.log 2>&1; tail -5 $SCRATCH/commit2.log
```

`task-done` test command: `bash -c "bash scripts/check-doc-links.sh && bash scripts/check-context-map.sh"`.

- [ ] **Step 5: Push + PR**

Run `git push -u origin refactor/916-routine-completion-states`. Open the PR through GitHub MCP with the `.github/pull_request_template.md` sections (Summary, Changes, Architectural decisions, Verification, Architecture checklist, Notes), linking the spec and #916. Verification names the HTML-diff proof and the mutation probe. Notes says the Playwright screenshot check is left open (no `DATABASE_URL` to reach the panel states). Close #916 only if PR D is the last open item of clusters 2, 4 and 5; otherwise use "Refs #916". Subscribe to PR activity and arm a 50-minute `send_later` check-in.
