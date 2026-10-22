// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { searchParamFromLocation } from "@lib/location";

afterEach(() => vi.unstubAllGlobals());

describe("searchParamFromLocation", () => {
  it("reads a present param", () => {
    history.replaceState(null, "", "/games/around-the-clock/setup?lives=3");
    expect(searchParamFromLocation("lives")).toBe("3");
  });

  it("is null when absent", () => {
    history.replaceState(null, "", "/games/around-the-clock/setup");
    expect(searchParamFromLocation("lives")).toBeNull();
  });

  it("is null when blank", () => {
    history.replaceState(null, "", "/games/around-the-clock/setup?lives=%20");
    expect(searchParamFromLocation("lives")).toBeNull();
  });

  it("is null outside a browser", () => {
    vi.stubGlobal("window", undefined);
    expect(searchParamFromLocation("lives")).toBeNull();
  });
});
