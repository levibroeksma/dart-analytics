# Shanghai V2 Guest/DartBot Admission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Shanghai's Hard-mode difficulty toggle actually apply to a 1v1 session (DartBot or human guest), fixing issue #237, instead of silently creating a `SHANGHAI_V1` session with no `difficulty` field at all.

**Architecture:** `SHANGHAI_V2`'s engine already folds Hard-mode halving per seat for any seat count — the only gap is two app-level admission maps (`SEAT_CAPS`, `RULESET_DARTBOT`) that never got a `SHANGHAI_V2` entry, and a setup-controller workaround that routed around that gap instead of fixing it. This plan wires the two maps, deletes the workaround, and syncs the decision ledger/docs that the workaround's own history touched.

**Tech Stack:** TypeScript, Astro, Alpine.js, Vitest.

## Global Constraints

- Every `app/src/**/*.ts` edit needs a covering test touched in the same task (D224, `scripts/check-test-coverage.sh`).
- No `//`/`/* */` comments inside function/method bodies under `app/src/**/*.ts` (`app/CLAUDE.md`).
- Run `cd app && npm run format` before any commit that touches `.astro`/`.ts` files; confirm `npx prettier --check <file>` clean.
- `bash scripts/check-game-engines.sh`, `check-astro-conventions.sh`, `check-style-tokens.sh`, `check-findings-log.sh` must pass on every commit (husky pre-commit runs all 14 structural gates automatically).
- Decisions are append-only: never edit an existing block in `decisions/**`; a new decision gets a freshly derived id, never a guessed one.
- `docs/architecture/00-File-Inventory.md`'s `~Nk` token estimates must stay within `scripts/check-context-budget.sh`'s tolerance after any row's underlying file changes size.
- Full done-bar: `npm run validate:app` exits zero with the type gate at **0 errors, 0 warnings, 0 hints**. `db:status`/`db:migrate`/`db:introspect` and the graphify CLI refresh require a live Neon DB / installed CLI not available in this sandbox — run them if available, otherwise note their skip explicitly rather than skipping silently.

---

### Task 1: `RULESET_DARTBOT` admits `SHANGHAI_V2`

**Files:**
- Modify: `app/src/lib/game/rulesets/capabilities.ts:100-130`
- Test: `app/tests/lib/game/rulesets/capabilities.test.ts:151-219`

**Interfaces:**
- Consumes: nothing new.
- Produces: `supportsDartbot("SHANGHAI_V2")` now returns `true`. `ShanghaiSetupForm.astro` (Task 3) reads this to decide whether to show the DartBot opponent option.

- [ ] **Step 1: Write the failing tests**

In `app/tests/lib/game/rulesets/capabilities.test.ts`, replace the `RULESET_DARTBOT` describe block (lines 151-169):

```ts
describe("RULESET_DARTBOT", () => {
  it("admits the ten rulesets whose bot strategy exists today", () => {
    expect(
      (Object.keys(RULESET_DARTBOT) as (keyof typeof RULESET_DARTBOT)[])
        .filter((key) => RULESET_DARTBOT[key])
        .sort(),
    ).toEqual([
      "121_V1",
      "501_V1",
      "AROUND_THE_CLOCK_V1",
      "BOBS27_V1",
      "DOUBLES_TRAINING_V1",
      "SCORE_TRAINING_V1",
      "SHANGHAI_V1",
      "SHANGHAI_V2",
      "SINGLES_V1",
      "TUOD_V1",
    ]);
  });
});
```

Then replace the combined rejection test (lines 208-211) inside `describe("supportsDartbot", ...)`:

```ts
  it("accepts Shanghai V2, now that its 2-seat admission is wired (D259)", () => {
    expect(supportsDartbot("SHANGHAI_V2")).toBe(true);
  });

  it("rejects Singles V2 (F69 — 1v1 seating is still broken there)", () => {
    expect(supportsDartbot("SINGLES_V2")).toBe(false);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/rulesets/capabilities.test.ts`
Expected: FAIL — `admits the ten rulesets...` shows 9 actual entries (no `SHANGHAI_V2`); `accepts Shanghai V2...` gets `false`, not `true`.

- [ ] **Step 3: Update `RULESET_DARTBOT` and its doc comment**

In `app/src/lib/game/rulesets/capabilities.ts`, replace lines 100-130 (the doc comment plus the `RULESET_DARTBOT` object) with:

```ts
/**
 * Which ruleset versions currently admit a DartBot opponent seat. `08-DartBot.md`
 * §Delivery Phases names the five rulesets `DictatedStrategy` (phase 3) plays:
 * Around the Clock, Bob's 27, Doubles Training, Shanghai, Singles Training —
 * all five are listed here. `501_V1`, `121_V1` and `TUOD_V1` are on
 * `X01Strategy` (`x01.strategy.module.ts`, reused unchanged — both are
 * checkout-ladder games with 501's identical `{ remaining, checkoutPath }`
 * decision shape). `SCORE_TRAINING_V1` is on `ScoringStrategy`
 * (`scoring.strategy.module.ts`, D-G) — no checkout to route on, so it
 * always aims treble 20. Singles Training V2 can never create *any* 2-seat
 * session today (`FINDINGS.md` F69: its setup screen hardcodes its V2
 * ruleset key with no seat-count branch, so a guest add already 422s at
 * `createSession`), and that gap is explicitly deferred, not this map's to
 * route around. Shanghai V2 had the identical gap until D259, which wired
 * both this map and `SEAT_CAPS` for it. `121_V2` is solo-only by the same
 * reasoning `SINGLES_V2` is — it never gains a bot seat, only `121_V1` does.
 * Absent keys read as unsupported, exactly like `SEAT_CAPS`'s own "no entry"
 * default in `session-seats.service.ts`.
 */
export const RULESET_DARTBOT: Readonly<
  Partial<Record<RulesetVersionKey, boolean>>
> = {
  AROUND_THE_CLOCK_V1: true,
  BOBS27_V1: true,
  DOUBLES_TRAINING_V1: true,
  SHANGHAI_V1: true,
  SHANGHAI_V2: true,
  SINGLES_V1: true,
  "501_V1": true,
  "121_V1": true,
  TUOD_V1: true,
  SCORE_TRAINING_V1: true,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/rulesets/capabilities.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Format and commit**

```bash
cd app && npx prettier --check src/lib/game/rulesets/capabilities.ts
cd /home/user/dart-analytics
git add app/src/lib/game/rulesets/capabilities.ts app/tests/lib/game/rulesets/capabilities.test.ts
git commit -m "$(cat <<'EOF'
Admit SHANGHAI_V2 into RULESET_DARTBOT

Part of fixing issue #237: Shanghai V2 never had a DartBot capability
entry, which is why the setup controller routed guest/bot sessions
back to SHANGHAI_V1 (no difficulty field) instead of ever offering
Hard mode against a bot.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013RANtzg6V9eVPpPpfWcWoX
EOF
)"
```

---

### Task 2: `SEAT_CAPS` admits `SHANGHAI_V2` at 2 seats

**Files:**
- Modify: `app/src/services/session-seats.service.ts:11-29`
- Test: `app/tests/services/session-seats.service.test.ts:99-192`

**Interfaces:**
- Consumes: nothing new.
- Produces: `rejectSeatRequest([player, bot-or-guest], "SHANGHAI_V2")` now returns `null` (accepted) for exactly 2 seats, and the usual "supports at most 2 seats" message for a 3rd.

- [ ] **Step 1: Write the failing tests**

In `app/tests/services/session-seats.service.test.ts`, add `"SHANGHAI_V2"` to both `it.each` arrays in the `describe("rejectSeatRequest with the seven new rulesets", ...)` block (lines 117-128 and 130-139), so both read:

```ts
  it.each([
    "BOBS27_V1",
    "121_V1",
    "AROUND_THE_CLOCK_V1",
    "TUOD_V1",
    "SHANGHAI_V1",
    "SHANGHAI_V2",
    "SCORE_TRAINING_V1",
    "SINGLES_V1",
    "DOUBLES_TRAINING_V1",
  ])("accepts exactly 2 seats for %s", (rulesetVersionKey) => {
    expect(rejectSeatRequest(twoPlayers, rulesetVersionKey)).toBeNull();
  });

  it.each([
    "BOBS27_V1",
    "121_V1",
    "AROUND_THE_CLOCK_V1",
    "TUOD_V1",
    "SHANGHAI_V1",
    "SHANGHAI_V2",
    "SCORE_TRAINING_V1",
    "SINGLES_V1",
    "DOUBLES_TRAINING_V1",
  ])("rejects a 3rd seat for %s", (rulesetVersionKey) => {
    expect(rejectSeatRequest(threePlayers, rulesetVersionKey)).toContain(
      "supports at most 2 seat",
    );
  });
```

Then replace the test at lines 180-184 (inside `describe("rejectSeatRequest with a DARTBOT seat", ...)`):

```ts
  it("accepts a DARTBOT seat for Shanghai V2, now that it's wired (D259)", () => {
    expect(rejectSeatRequest([player, bot], "SHANGHAI_V2")).toBeNull();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/services/session-seats.service.test.ts`
Expected: FAIL — the two `it.each` rows for `SHANGHAI_V2` and the DARTBOT-seat test all fail, since `SHANGHAI_V2` currently has no `SEAT_CAPS` entry (defaults to cap 1) and no `RULESET_DARTBOT` entry (Task 1's change alone doesn't help here without this task's `SEAT_CAPS` entry too — two players already exceeds a cap-1 default).

- [ ] **Step 3: Add the `SEAT_CAPS` entry**

In `app/src/services/session-seats.service.ts`, replace lines 11-29 (the doc comment plus the `SEAT_CAPS` object):

```ts
/**
 * The most seats a session may request, keyed by ruleset version. A ruleset
 * with no entry defaults to 1 — the same "reject any 2nd seat" behavior
 * every non-501 ruleset had before this map existed. 501 alone keeps room
 * for a future 2v2 (D-something, X01 guest-player design); the other nine
 * are wired for exactly one opponent (1v1) and never more, per
 * `2026-08-22-single-opponent-seat-remaining-engines-design.md`.
 */
const SEAT_CAPS: Record<string, number> = {
  "501_V1": 4,
  BOBS27_V1: 2,
  "121_V1": 2,
  AROUND_THE_CLOCK_V1: 2,
  TUOD_V1: 2,
  SHANGHAI_V1: 2,
  SHANGHAI_V2: 2,
  SCORE_TRAINING_V1: 2,
  SINGLES_V1: 2,
  DOUBLES_TRAINING_V1: 2,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/services/session-seats.service.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
cd /home/user/dart-analytics
git add app/src/services/session-seats.service.ts app/tests/services/session-seats.service.test.ts
git commit -m "$(cat <<'EOF'
Admit SHANGHAI_V2 into SEAT_CAPS at 2 seats

Second half of the seat-admission gap behind issue #237: a 2-seat
SHANGHAI_V2 session previously 422'd at createSession (no SEAT_CAPS
entry defaults to a 1-seat cap). Paired with Task 1's RULESET_DARTBOT
entry, SHANGHAI_V2 now accepts a guest or DartBot 2nd seat.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013RANtzg6V9eVPpPpfWcWoX
EOF
)"
```

---

### Task 3: `shanghai-setup.data.ts` always creates `SHANGHAI_V2`; Hard mode survives a guest/bot add

**Files:**
- Modify: `app/src/lib/game/shanghai-setup.data.ts` (full rewrite, currently 36 lines)
- Modify: `app/src/components/layout/games/setup/ShanghaiSetupForm.astro:28-49`
- Test: `app/tests/lib/game/shanghai-setup.data.test.ts:282-358`

**Interfaces:**
- Consumes: `createPresetSetupController` (`@lib/game/setup-controller`, unchanged), `supportsDartbot` (Task 1's updated map).
- Produces: `shanghaiSetup()` returns a context whose `start()` always creates a `SHANGHAI_V2` session with `overrides: { difficulty: ctx.difficulty }`, for solo, guest, or DartBot sessions alike.

- [ ] **Step 1: Write the failing tests**

In `app/tests/lib/game/shanghai-setup.data.test.ts`, delete the two tests at lines 282-358 ("resolves SHANGHAI_V1 and forces difficulty back to NORMAL once a guest is added" and "...once a DartBot is seated" — the guarantee they assert is being intentionally removed this task, not repointed). Replace them with:

```ts
    it("keeps HARD difficulty and creates SHANGHAI_V2 once a guest is added", async () => {
      const setup = createSetup({
        presets: [STANDARD_PRESET],
        difficulty: "HARD",
      });
      setup.newGuestName = "Friend";
      setup.addGuest();
      expect(setup.difficulty).toBe("HARD");

      vi.mocked(sessionsApi.createSession).mockResolvedValue({
        sessionId: "new-session-id",
        participants: [
          {
            ref: "participant-1",
            displayName: "Player",
            participantTypeKey: "PLAYER",
          },
          {
            ref: "participant-2",
            displayName: "Friend",
            participantTypeKey: "GUEST",
          },
        ],
      } as any);
      vi.stubGlobal("location", { href: "" });

      await setup.start();

      expect(sessionsApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          rulesetVersionKey: "SHANGHAI_V2",
          config: expect.objectContaining({
            overrides: { difficulty: "HARD" },
          }),
        }),
      );
      expect(store.game.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          rulesetVersionKey: "SHANGHAI_V2",
          configSnapshot: expect.objectContaining({ difficulty: "HARD" }),
        }),
      );
    });

    it("keeps HARD difficulty and creates SHANGHAI_V2 once a DartBot is seated", async () => {
      const setup = createSetup({
        presets: [STANDARD_PRESET],
        difficulty: "HARD",
      });
      setup.addBot();
      expect(setup.bot).toEqual({ level: 8 });
      expect(setup.difficulty).toBe("HARD");

      vi.mocked(sessionsApi.createSession).mockResolvedValue({
        sessionId: "new-session-id",
        participants: [
          {
            ref: "participant-1",
            displayName: "Player",
            participantTypeKey: "PLAYER",
          },
          {
            ref: "bot-1",
            displayName: "DartBot",
            participantTypeKey: "DARTBOT",
            dartbot: { level: 8, seed: 1, levelSource: "MANUAL" },
          },
        ],
      } as any);
      vi.stubGlobal("location", { href: "" });

      await setup.start();

      expect(sessionsApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          rulesetVersionKey: "SHANGHAI_V2",
          config: expect.objectContaining({
            overrides: { difficulty: "HARD" },
          }),
        }),
      );
      expect(store.game.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          rulesetVersionKey: "SHANGHAI_V2",
          configSnapshot: expect.objectContaining({ difficulty: "HARD" }),
        }),
      );
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/shanghai-setup.data.test.ts`
Expected: FAIL — both new tests see `setup.difficulty` reset to `"NORMAL"` after `addGuest()`/`addBot()`, and `createSession` called with `rulesetVersionKey: "SHANGHAI_V1"`.

- [ ] **Step 3: Rewrite `shanghai-setup.data.ts`**

Replace the entire file (`app/src/lib/game/shanghai-setup.data.ts`) with:

```ts
import { createPresetSetupController } from "@lib/game/setup-controller";
import type { ShanghaiSetupContext } from "./types";

export function shanghaiSetup() {
  return {
    difficulty: "NORMAL" as ShanghaiSetupContext["difficulty"],
    ...createPresetSetupController<ShanghaiSetupContext>({
      gameTypeKey: "SHANGHAI",
      rulesetVersionKey: "SHANGHAI_V2",
      playHref: "/games/shanghai/play",
      label: "Shanghai",
      configOverrides: (ctx) => ({ difficulty: ctx.difficulty }),
    }),
  };
}
```

This drops the `guested()` helper, the `addBotOpponent`/`addTypedGuest` imports (no longer called directly — `createPresetSetupController`'s own unmodified `addGuest`/`addBot` cover seating), and both difficulty-reset overrides.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/shanghai-setup.data.test.ts`
Expected: PASS (all tests in the file, including the untouched "creates a SHANGHAI_V2 session on NORMAL difficulty by default" and "applies HARD difficulty when chosen" solo-path tests).

- [ ] **Step 5: Update `ShanghaiSetupForm.astro`**

In `app/src/components/layout/games/setup/ShanghaiSetupForm.astro`, change line 31 from:

```astro
    allowDartbot={supportsDartbot("SHANGHAI_V1")}
```

to:

```astro
    allowDartbot={supportsDartbot("SHANGHAI_V2")}
```

Then replace lines 37-40 (the `SettingSectionShell` opening tag, currently carrying the `x-show`/`x-cloak` guard added by the prior, superseded fix for this same issue):

```astro
  <SettingSectionShell
    x-show="guests.length < 1 && !bot"
    x-cloak
  >
```

with:

```astro
  <SettingSectionShell>
```

The difficulty toggle is now unconditionally visible — it always reflects what will actually apply, for solo, guest, and DartBot sessions alike.

- [ ] **Step 6: Manually verify the Astro markup**

`.astro` markup has no component-level test runner in this project (`app/CLAUDE.md`) — verify by reading the file back and confirming: (a) `allowDartbot` now reads `"SHANGHAI_V2"`, (b) `<SettingSectionShell>` carries no `x-show`/`x-cloak`, matching every other setup form's always-visible settings section (e.g. `SinglesTrainingSetupForm.astro`).

- [ ] **Step 7: Format, run the full app test suite, and astro-check**

```bash
cd app
npx prettier --write src/lib/game/shanghai-setup.data.ts src/components/layout/games/setup/ShanghaiSetupForm.astro
npx vitest run
npm run check
```

Expected: prettier reports the files unchanged or fixed; vitest reports all files passing (no regression elsewhere — nothing else imports the deleted `guested()` helper); `astro check` reports 0 errors, 0 warnings, 0 hints.

- [ ] **Step 8: Commit**

```bash
cd /home/user/dart-analytics
git add app/src/lib/game/shanghai-setup.data.ts app/src/components/layout/games/setup/ShanghaiSetupForm.astro app/tests/lib/game/shanghai-setup.data.test.ts
git commit -m "$(cat <<'EOF'
Always create SHANGHAI_V2; Hard mode survives a guest/bot add

Closes issue #237's follow-up request: rather than hiding the Hard
toggle when a guest/bot is present (the prior fix on this branch),
Shanghai now creates SHANGHAI_V2 unconditionally — every seat count —
so Hard mode's halving actually applies 1v1. addGuest/addBot no
longer reset difficulty back to NORMAL, and the setup form's toggle
is unconditionally visible again since it now always reflects what
will apply.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013RANtzg6V9eVPpPpfWcWoX
EOF
)"
```

---

### Task 4: Decision ledger and doc sync

**Files:**
- Modify: `decisions/game-engine.md` (append)
- Modify: `docs/architecture/08-DartBot.md:10` (version header)
- Modify: `docs/architecture/00-File-Inventory.md` (two rows: `decisions/game-engine.md`, `08-DartBot.md`)

**Interfaces:** none (docs-only task; no code, no test-coverage gate applies).

- [ ] **Step 1: Derive the next decision id**

```bash
git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' decisions/**.md | grep -oE 'D[0-9]+' | sed 's/D0*//' | sort -n | tail -1
```

Expected output: `258` (as of this plan being written — if Tasks 1-3 or other work landed a new decision in the meantime, re-derive; the next id is always this number plus one). This plan assumes the result is `258`, so the new id is `D259`; substitute the actual next id throughout this task if the derived number differs.

- [ ] **Step 2: Append the decision to `decisions/game-engine.md`**

Append at the end of the file (after the last existing block):

```markdown
### D259 — Shanghai V2 admits a 2nd seat (guest or DartBot), completing D245's unconditional-V2 intent
Status: Accepted · Date: 2026-09-07
Decision: `SEAT_CAPS` (`session-seats.service.ts`) gains `SHANGHAI_V2: 2`; `RULESET_DARTBOT` (`capabilities.ts`) gains `SHANGHAI_V2: true`. `shanghai-setup.data.ts` drops its `guested()` helper and the `SHANGHAI_V1`/`SHANGHAI_V2` ruleset-version branch entirely — every new Shanghai session is `SHANGHAI_V2`, and `configOverrides` unconditionally supplies `difficulty`; `addGuest`/`addBot` no longer reset `difficulty` back to `NORMAL`. `ShanghaiSetupForm.astro`'s difficulty toggle is unconditionally visible (no guest/bot guard) and its `allowDartbot` reads `supportsDartbot("SHANGHAI_V2")`.
Reason: Issue #237 reported that Hard mode silently never applied against a DartBot opponent — the toggle stayed selectable and visibly "HARD" after a bot was seated, but the session actually created was `SHANGHAI_V1` (no `difficulty` field at all), because a 2-seat `SHANGHAI_V2` session had never been wired into `SEAT_CAPS`/`RULESET_DARTBOT` and 422s at `createSession`. A prior task closing `FINDINGS.md` F45 worked around that gap by routing any guested session back to `SHANGHAI_V1`, silently narrowing D245's own stated intent ("creates `SHANGHAI_V2` sessions rather than `SHANGHAI_V1`" — unconditionally) without its own decision entry. This decision fixes the seat-admission gap directly rather than routing around it again, for both DartBot and human-guest 1v1 — the gap was never opponent-specific, and a human 1v1 hit the identical silent-drop bug.
Consequences: `ShanghaiEngine`/`foldShanghaiState`/`applyShanghaiDart` are unchanged — Hard-mode halving already folded per seat for any seat count. `shanghai-play.data.ts` is unchanged — its `RESUMABLE_RULESET_VERSIONS` set and DartBot-turn wiring already treat both ruleset versions and any active seat's `participantTypeKey` generically. `capabilities.ts`'s `RULESET_DARTBOT` doc comment is corrected to no longer claim Shanghai V2 can never seat a 2nd player (Singles Training V2 still can't — logged as `FINDINGS.md` F69, out of scope here). Test updates: `capabilities.test.ts` (`supportsDartbot("SHANGHAI_V2")` flips to `true`), `session-seats.service.test.ts` (`SHANGHAI_V2` + a `DARTBOT` seat now accepted, plus 2-seat-cap coverage), `shanghai-setup.data.test.ts` (the two tests asserting the old "forces NORMAL" contract are deleted — not repointed, since the guarantee itself is being intentionally removed — and replaced with tests proving `HARD` survives a guest/bot add). No migration or seed change: `SHANGHAI_V2`'s `ruleset_versions` row and capability rows already exist; seat-count admission is an app-level map, not a DB constraint. Full design: `docs/superpowers/specs/2026-09-07-shanghai-v2-guest-dartbot-design.md`, implementation plan: `docs/superpowers/plans/2026-09-07-shanghai-v2-guest-dartbot.md`.
```

- [ ] **Step 3: Run the decision-ids gate**

```bash
bash scripts/check-decision-ids.sh
```

Expected: `OK` — no duplicate ids, no regression against the baseline, `DECISIONS.md` still a router.

- [ ] **Step 4: Add a version-header entry to `08-DartBot.md`**

In `docs/architecture/08-DartBot.md`, line 10 currently starts `> **Version:** 0.8.5 (2026-09-04 — ...`. Insert a new entry immediately after `**Version:** ` and before `0.8.5`, so the line begins:

```
> **Version:** 0.8.6 (2026-09-07 — `RULESET_DARTBOT` gains `SHANGHAI_V2`, closing the seat-admission gap that forced any guested Shanghai session onto `SHANGHAI_V1` regardless of the player's chosen difficulty (issue #237). `shanghai-setup.data.ts` no longer branches to `SHANGHAI_V1` for a guest/bot seat — every new session is `SHANGHAI_V2`, and Hard mode now survives a guest/bot being added instead of resetting to Normal. `SEAT_CAPS` gains a matching `SHANGHAI_V2: 2` entry. D259.) 0.8.5 (2026-09-04 — ...
```

(Leave the entire rest of the existing line — `0.8.5` onward — byte-for-byte unchanged; only the new `0.8.6 (...)` segment is inserted before it.)

- [ ] **Step 5: Recompute and update the two `00-File-Inventory.md` token estimates**

```bash
python3 -c "print(len(open('decisions/game-engine.md').read())/4/1000)"
python3 -c "print(len(open('docs/architecture/08-DartBot.md').read())/4/1000)"
```

In `docs/architecture/00-File-Inventory.md`:
- Find the `decisions/game-engine.md` row (decision ledger section). Change `46 decisions` to `47 decisions`, append `; D259 Shanghai V2 2-seat admission, 2026-09-07` inside its trailing parenthetical, and replace its `~21.9k` with the value the first command above printed (rounded per `fmt_k` — one decimal place, e.g. `~22.4k`).
- Find the `08-DartBot.md` row (architecture docs section). Append `; SHANGHAI_V2 seat admission closes issue #237 (2026-09-07)` inside its trailing parenthetical (before the final closing `)`), and replace its `~26.6k` with the value the second command above printed.

- [ ] **Step 6: Run the context-map and budget gates**

```bash
bash scripts/check-context-map.sh
bash scripts/check-context-budget.sh
bash scripts/check-doc-links.sh
```

Expected: all three `OK`. If budget still fails, re-read the exact drift it reports and nudge the `~Nk` value to match — the script's own arithmetic is authoritative, not the estimate above.

- [ ] **Step 7: Commit**

```bash
git add decisions/game-engine.md docs/architecture/08-DartBot.md docs/architecture/00-File-Inventory.md
git commit -m "$(cat <<'EOF'
Record D259: Shanghai V2 admits a 2nd seat

Decision-ledger and context-map sync for the SHANGHAI_V2 seat-cap /
RULESET_DARTBOT fix (issue #237): new decision in
decisions/game-engine.md, a version-header entry on 08-DartBot.md,
and updated File-Inventory token estimates for both.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013RANtzg6V9eVPpPpfWcWoX
EOF
)"
```

---

### Task 5: Full validation and push

**Files:** none (verification only).

- [ ] **Step 1: Run the full Vitest suite**

```bash
cd app && npx vitest run
```

Expected: every test file passes, including all files touched by Tasks 1-3.

- [ ] **Step 2: Run `astro check`**

```bash
cd app && npm run check
```

Expected: `0 errors, 0 warnings, 0 hints`.

- [ ] **Step 3: Run `npx fallow`**

```bash
cd app && npx fallow
```

Expected: exit code 0 (`0 above threshold`).

- [ ] **Step 4: Run every structural gate script**

```bash
cd /home/user/dart-analytics
for s in check-context-map check-doc-links check-context-budget check-agent-mirrors \
         check-file-locations check-findings-log check-test-coverage \
         check-astro-class-composition check-astro-conventions check-game-engines \
         check-refinement-coverage check-type-barrels check-alias-sync \
         check-constraint-mirror check-no-inline-comments check-style-tokens \
         check-game-wiring check-decision-ids; do
  echo "=== $s ==="
  bash scripts/$s.sh
done
```

Expected: every script prints `OK`.

- [ ] **Step 5: Attempt DB steps and graph refresh; note environment limits explicitly if unavailable**

```bash
cd app && npm run db:status
```

If this fails with "invalid url ... DATABASE_URL" (no live Neon database reachable in this sandbox), record that `db:status`/`db:migrate`/`db:introspect` were skipped for that reason — do not claim they passed. Otherwise run them and `bash ../scripts/refresh-graph.sh` per `npm run validate:app`'s full chain.

- [ ] **Step 6: Push the branch**

```bash
git push origin claude/issue-237-mg32nc
```

- [ ] **Step 7: Report**

Confirm in the completion report: which of Step 5's DB/graph steps ran vs. were environment-skipped, that Steps 1-4 all passed, and that `FINDINGS.md` F69 (Singles Training's identical, still-unfixed gap) remains open and named, unchanged by this task.

---

## Self-Review Notes

- **Spec coverage:** every "Changes" bullet in the design spec (`capabilities.ts`, `session-seats.service.ts`, `shanghai-setup.data.ts`, `ShanghaiSetupForm.astro`, test files, decision ledger) has a task. The spec's "Out of scope" section (migrations/seeds, engine, play-data, game-rules docs) is deliberately untouched by every task above.
- **Placeholder scan:** no TBD/TODO; Task 4's decision id is derived by a real command with the expected output stated, and the plan says explicitly to re-derive and substitute if the count has moved.
- **Type consistency:** `ShanghaiSetupContext["difficulty"]` (`"NORMAL" | "HARD"`), `rulesetVersionKey: "SHANGHAI_V2"` (a plain string, matching `createPresetSetupController`'s existing constant-vs-function union — see `bobs27-setup.data.ts`'s own constant usage), and `configOverrides: (ctx) => ({ difficulty: ctx.difficulty })` are used identically across Task 3's implementation and test code.
