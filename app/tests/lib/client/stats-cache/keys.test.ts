import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { paramsKey } from "@client/stats-cache/keys";

describe("paramsKey", () => {
  const base = {
    bucket: "month" as const,
    tz: "Europe/Amsterdam",
    status: "completed",
    context: "all" as const,
    inputMode: "VISUAL_BOARD",
  };

  it("is stable for equal params", () => {
    expect(paramsKey(base)).toBe(paramsKey({ ...base }));
  });

  it("excludes from/to", () => {
    const a = paramsKey({
      ...base,
      from: "2026-01-01",
      to: "2026-02-01",
    } as never);
    const b = paramsKey({
      ...base,
      from: "2020-01-01",
      to: "2099-02-01",
    } as never);
    expect(a).toBe(b);
  });

  it("differs when a param differs", () => {
    expect(paramsKey(base)).not.toBe(
      paramsKey({ ...base, context: "routine" }),
    );
  });

  it("differs for a different target", () => {
    expect(paramsKey({ ...base, target: "DOUBLE:16" })).not.toBe(
      paramsKey({ ...base, target: "DOUBLE:8" }),
    );
  });

  it("matches phase 1's key when target is absent, so existing cache entries survive", () => {
    expect(paramsKey(base)).toBe(paramsKey({ ...base, target: undefined }));
  });
});
