import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * `todayCard()` sets `error` only on the path where `getActiveSchedule()`
 * throws, and that path leaves `schedule` null. So an `ErrorAlert` nested
 * inside the card's `x-show="schedule"` wrapper can never render: a failed
 * load showed the player an empty page rather than the message the store
 * had already produced. The alert has to sit outside that gate.
 */
const source = readFileSync(
  fileURLToPath(
    new URL(
      "../../../../../src/components/layout/training/schedules/TodayCard.astro",
      import.meta.url,
    ),
  ),
  "utf8",
);

/**
 * The markup from the `x-show="schedule"` wrapper's open tag to the end of
 * the file. The frontmatter is dropped first: its docstring names the same
 * gate, and matching that comment would hand back an empty subtree that
 * trivially satisfies every assertion below.
 */
function scheduleGatedSubtree(source: string): string {
  const markup = source.slice(source.lastIndexOf("---") + 3);
  const gate = markup.indexOf('x-show="schedule"');
  expect(gate).toBeGreaterThan(-1);
  const open = markup.lastIndexOf("<div", gate);
  expect(open).toBeGreaterThan(-1);
  return markup.slice(open);
}

describe("TodayCard.astro", () => {
  it("renders the error alert outside the schedule gate", () => {
    expect(source).toContain("<ErrorAlert");
    expect(scheduleGatedSubtree(source)).not.toContain("<ErrorAlert");
  });

  it("still gates the card itself on an active schedule", () => {
    expect(scheduleGatedSubtree(source)).toContain("<CardWrapper");
  });
});
