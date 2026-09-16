import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The routine's Finishing step mounts the whole TUOD play store
 * (`finishing-step.data.ts` wraps `tuodPlay()`), so it inherits that store's
 * confirm gates: `recordDart`/`submitVisit` refuse to record and raise
 * `showFinishConfirm` / `showDoubleConfirm` instead, and only the dialog
 * those flags render can call `confirmFinish()` / `confirmDouble()` back.
 *
 * `games/tuod/play` renders both dialogs; the routine page rendered neither,
 * so the session-ending dart raised `showFinishConfirm` against nothing:
 * `finished` never turned true, the darts were never uploaded, the step never
 * completed, and the routine hung on a live header clock with abandon as the
 * only exit. This suite pins the two pages to the same gate list — a gate
 * TUOD can enter must be answerable from inside the routine too.
 */

function read(relativePath: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

const standalonePage = read("../../../src/pages/games/tuod/play/index.astro");
const routinePage = read(
  "../../../src/pages/training/balanced-training/play/index.astro",
);

/**
 * The markup under `x-data="finishing"`. Only that subtree sees the TUOD
 * store, so a dialog placed anywhere else on the routine page cannot reach
 * `confirmFinish()` — hence the scoped extraction rather than a whole-file
 * match.
 */
function finishingScope(source: string): string {
  const start = source.indexOf('x-data="finishing"');
  if (start === -1) throw new Error('x-data="finishing" not found');
  const openTag = source.lastIndexOf("<div", start);
  const tagPattern = /<div\b|<\/div>/g;
  tagPattern.lastIndex = openTag;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(source))) {
    depth += match[0] === "</div>" ? -1 : 1;
    if (depth === 0) return source.slice(openTag, tagPattern.lastIndex);
  }
  throw new Error('unterminated x-data="finishing" element');
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

      const scope = finishingScope(routinePage);
      expect(scope).toContain(flag);
      expect(scope).toContain(dialog);
    },
  );

  it("hands its finish dialog the store's own confirm and cancel", () => {
    const scope = finishingScope(routinePage);

    expect(scope).toContain('onConfirm="confirmFinish()"');
    expect(scope).toContain('onCancel="cancelFinish()"');
  });
});
