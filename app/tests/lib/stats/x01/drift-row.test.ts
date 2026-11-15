import { describe, expect, it } from "vitest";
import { dartRow, keyOf } from "@lib/stats/x01/drift-row";

const f = {
  n: 40,
  sumDx: -160,
  sumDy: 80,
  sumDxDx: 1000,
  sumDyDy: 400,
  sumDxDy: 0,
};

describe("drift rows", () => {
  it("splits a key into basis and dart", () => {
    expect(keyOf("FINISH|DOUBLE:16|2|SOLE")).toEqual({
      basis: "FINISH",
      dart: "2",
    });
  });

  it("pools one dart number, optionally for one basis", () => {
    const rows = { "FINISH|D|1|SOLE": f, "SETUP|T|1|SOLE": f };
    expect(dartRow(rows, 1).n).toBe(80);
    expect(dartRow(rows, 1, "SETUP").n).toBe(40);
    expect(dartRow(rows, 2).meanDx).toBeNull();
  });
});
