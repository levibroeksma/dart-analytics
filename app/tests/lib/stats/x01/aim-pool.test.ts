import { describe, expect, it } from "vitest";
import { poolRows } from "@lib/stats/x01/aim-pool";

describe("poolRows", () => {
  it("pools matching rows", () => {
    expect(
      poolRows({ "A|1": { n: 1 }, "A|2": { n: 2 }, "B|1": { n: 9 } }, (k) =>
        k.startsWith("A|"),
      ),
    ).toEqual({ n: 3 });
  });

  it("pools nothing when nothing matches", () => {
    expect(poolRows({ "A|1": { n: 1 } }, () => false)).toEqual({});
  });
});
