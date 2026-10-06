import { describe, it, expect } from "vitest";
import { NAV_TABS, navTabIndex, navTabMatchPrefix } from "@utils/nav-tabs";

describe("NAV_TABS", () => {
  it("lists the five bottom-nav tabs in display order", () => {
    expect(NAV_TABS.map((tab) => tab.href)).toEqual([
      "/",
      "/games",
      "/training",
      "/statistics",
      "/profile",
    ]);
  });
});

describe("navTabMatchPrefix", () => {
  it("has no prefix for the root tab", () => {
    expect(navTabMatchPrefix("/")).toBeUndefined();
  });

  it("matches nested paths for other tabs", () => {
    expect(navTabMatchPrefix("/games")).toBe("/games/");
  });
});

describe("navTabIndex", () => {
  it("maps each tab href to its index", () => {
    NAV_TABS.forEach((tab, index) => {
      expect(navTabIndex(tab.href)).toBe(index);
    });
  });

  it("maps nested paths to their parent tab", () => {
    expect(navTabIndex("/games/501/setup")).toBe(1);
    expect(navTabIndex("/training/routines/detail")).toBe(2);
  });

  it("returns null for paths outside the tabs", () => {
    expect(navTabIndex("/login")).toBeNull();
    expect(navTabIndex("/unknown")).toBeNull();
  });

  it("matches the root tab only on an exact path", () => {
    expect(navTabIndex("/")).toBe(0);
    expect(navTabIndex("/gamesx")).toBeNull();
  });
});
