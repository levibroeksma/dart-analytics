import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The routine's Finishing step mounts the whole TUOD play store
 * (`game-step.data.ts`'s `gameStep()` wraps `tuodPlay()`), so it inherits
 * that store's confirm gates: `recordDart`/`submitVisit` refuse to record
 * and raise `showFinishConfirm` / `showDoubleConfirm` instead, and only the
 * dialog those flags render can call `confirmFinish()` / `confirmDouble()`
 * back.
 *
 * `games/tuod/play` renders both dialogs; the routine page once rendered
 * neither, so the session-ending dart raised `showFinishConfirm` against
 * nothing: `finished` never turned true, the darts were never uploaded, the
 * step never completed, and the routine hung on a live header clock with
 * abandon as the only exit. This suite pins the two pages to the same gate
 * list — a gate TUOD can enter must be answerable from inside the routine
 * too.
 */

function read(relativePath: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

const standalonePage = read("../../../src/pages/games/tuod/play/index.astro");
const routinePage = read(
  "../../../src/pages/training/routines/play/index.astro",
);

/**
 * Every `x-data="game"` subtree in the routine page — one per routine-
 * eligible game (TUOD, Score Training, 121) — since only markup inside one
 * of those subtrees can reach that game's own store methods.
 */
function gameScopes(source: string): string[] {
  const marker = 'x-data="game"';
  const scopes: string[] = [];
  let searchFrom = 0;
  for (;;) {
    const start = source.indexOf(marker, searchFrom);
    if (start === -1) return scopes;
    const openTag = source.lastIndexOf("<div", start);
    const tagPattern = /<div\b|<\/div>/g;
    tagPattern.lastIndex = openTag;
    let depth = 0;
    let match: RegExpExecArray | null;
    let closed = false;
    while ((match = tagPattern.exec(source))) {
      depth += match[0] === "</div>" ? -1 : 1;
      if (depth === 0) {
        scopes.push(source.slice(openTag, tagPattern.lastIndex));
        searchFrom = tagPattern.lastIndex;
        closed = true;
        break;
      }
    }
    if (!closed) throw new Error('unterminated x-data="game" element');
  }
}

/** The one `x-data="game"` subtree that mounts TUOD's own interface. */
function tuodScope(source: string): string {
  const scope = gameScopes(source).find((candidate) =>
    candidate.includes("<TenUpOneDown"),
  );
  if (!scope) {
    throw new Error('x-data="game" scope containing TenUpOneDown not found');
  }
  return scope;
}

/**
 * Each TUOD gate flag, with the dialog that answers it. The confirm handler
 * itself lives in `CheckoutConfirm` (`confirmDouble()`); `ConfirmDialog` is
 * generic, so its page passes `confirmFinish()` in — asserted separately
 * below.
 */
const GATES = [
  { flag: "showFinishConfirm", dialog: "<ConfirmDialog" },
  { flag: "showDoubleConfirm", dialog: "<CheckoutConfirm" },
];

describe("Balanced Training's Finishing step", () => {
  it.each(GATES)(
    "answers the $flag gate the standalone TUOD page answers",
    ({ flag, dialog }) => {
      expect(standalonePage).toContain(flag);
      expect(standalonePage).toContain(dialog);

      const scope = tuodScope(routinePage);
      expect(scope).toContain(flag);
      expect(scope).toContain(dialog);
    },
  );

  it("hands its finish dialog the store's own confirm and cancel", () => {
    const scope = tuodScope(routinePage);

    expect(scope).toContain('onConfirm="confirmFinish()"');
    expect(scope).toContain('onCancel="cancelFinish()"');
  });
});
