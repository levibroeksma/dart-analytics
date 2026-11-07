import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Follow the Leader's tap pad stacks the ring row, the number grid and the
 * BULL/MISS row in one column. `.astro` carries no render test (D101), so
 * this pins the source (#1160).
 */
const source = readFileSync(
  new URL(
    "../../../../src/components/layout/games/FollowTheLeaderRecreationalInput.astro",
    import.meta.url,
  ),
  "utf8",
);

describe("FollowTheLeaderRecreationalInput", () => {
  it("spaces the pad rows with the shared 8px gap", () =>
    expect(source).toMatch(/class="flex min-h-0 flex-1 flex-col gap-2"/));
});
