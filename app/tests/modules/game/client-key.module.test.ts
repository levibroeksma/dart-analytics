import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { newClientKey } from "@modules/game/client-key.module";
import { generateId } from "@lib/id";

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-([0-9a-f])[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newClientKey", () => {
  it("mints a well-formed UUID", () => {
    expect(newClientKey()).toMatch(UUID_SHAPE);
  });

  it("mints a distinct value each call", () => {
    const keys = new Set(Array.from({ length: 100 }, () => newClientKey()));
    expect(keys.size).toBe(100);
  });
});

describe("generateId", () => {
  it("mints UUIDv7, the version every persisted id must carry", () => {
    const match = UUID_SHAPE.exec(generateId());
    expect(match).not.toBeNull();
    expect(match![1]).toBe("7");
  });

  /**
   * The sortability D12 buys is timestamp-ordered at millisecond granularity.
   * This implementation carries no intra-millisecond counter, so two ids minted
   * inside the same millisecond share a timestamp and order by their random
   * tail — permitted by RFC 9562, which makes the counter method optional.
   * Nothing in this codebase orders by id (replay and stats order by
   * `sequence_number` and `created_at`), so that is a caveat, not a defect.
   */
  it("mints ids that sort in creation order across a millisecond", async () => {
    const first = generateId();
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = generateId();

    expect([second, first].sort()).toEqual([first, second]);
  });

  it("stamps the current time into the leading 48 bits", () => {
    const before = Date.now();
    const timestamp = Number.parseInt(
      generateId().replace(/-/g, "").slice(0, 12),
      16,
    );

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(Date.now());
  });
});

/**
 * The persistence layer must mint every entity id through `generateId()`
 * (UUIDv7), per the repo's Hard Invariants. `crypto.randomUUID()` is v4 and is
 * legitimate only for transient tokens that never reach a column — see
 * `client-key.module.ts`. This guard fails if the persistence layer starts
 * minting raw UUIDs, which is how a v4 would reach `turns.id` or `darts.id`.
 */
describe("persistence layer never mints a raw UUID", () => {
  const roots = ["src/services", "src/repositories"];

  it.each(roots)("%s uses generateId, never crypto.randomUUID", (root) => {
    const dir = fileURLToPath(new URL(`../../../${root}`, import.meta.url));
    const files = globSync("**/*.ts", { cwd: dir }).map((rel) =>
      readFileSync(`${dir}/${rel}`, "utf8"),
    );

    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((text) => text.includes("crypto.randomUUID"))).toEqual(
      [],
    );
  });
});
