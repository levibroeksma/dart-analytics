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

  it("mints ids that sort in creation order", () => {
    const first = generateId();
    const second = generateId();
    expect([second, first].sort()).toEqual([first, second]);
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
