// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { onTabReveal } from "@utils/tab-transition";

function memoryStorage(initial?: string) {
  const store = new Map<string, string>();
  if (initial != null) store.set("da:tab", initial);
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    store,
  };
}

function transition() {
  return { types: { add: vi.fn() }, skipTransition: vi.fn() };
}

function setTab(tab: string | null) {
  if (tab == null) delete document.documentElement.dataset.tab;
  else document.documentElement.dataset.tab = tab;
}

describe("onTabReveal", () => {
  beforeEach(() => setTab(null));

  it("adds forward when moving to a higher tab", () => {
    setTab("3");
    const vt = transition();
    const storage = memoryStorage("0");
    onTabReveal({ viewTransition: vt }, storage);
    expect(vt.types.add).toHaveBeenCalledWith("forward");
    expect(vt.skipTransition).not.toHaveBeenCalled();
    expect(storage.store.get("da:tab")).toBe("3");
  });

  it("adds back when moving to a lower tab", () => {
    setTab("1");
    const vt = transition();
    onTabReveal({ viewTransition: vt }, memoryStorage("3"));
    expect(vt.types.add).toHaveBeenCalledWith("back");
  });

  it("skips when the tab is unchanged", () => {
    setTab("2");
    const vt = transition();
    onTabReveal({ viewTransition: vt }, memoryStorage("2"));
    expect(vt.skipTransition).toHaveBeenCalled();
    expect(vt.types.add).not.toHaveBeenCalled();
  });

  it("skips when no previous tab is stored", () => {
    setTab("2");
    const vt = transition();
    const storage = memoryStorage();
    onTabReveal({ viewTransition: vt }, storage);
    expect(vt.skipTransition).toHaveBeenCalled();
    expect(storage.store.get("da:tab")).toBe("2");
  });

  it("skips and stores nothing when the page has no tab", () => {
    const vt = transition();
    const storage = memoryStorage("1");
    onTabReveal({ viewTransition: vt }, storage);
    expect(vt.skipTransition).toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("records the tab when there is no transition", () => {
    setTab("4");
    const storage = memoryStorage("1");
    onTabReveal({ viewTransition: null }, storage);
    expect(storage.store.get("da:tab")).toBe("4");
  });

  it("skips without throwing when storage is unavailable", () => {
    setTab("3");
    const vt = transition();
    const storage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(() => onTabReveal({ viewTransition: vt }, storage)).not.toThrow();
    expect(vt.skipTransition).toHaveBeenCalled();
  });

  it("works when stringified and evaluated with no module scope", () => {
    setTab("3");
    const vt = transition();
    const storage = memoryStorage("0");
    const inlined = new Function(`return ${onTabReveal.toString()}`)();
    inlined({ viewTransition: vt }, storage);
    expect(vt.types.add).toHaveBeenCalledWith("forward");
    expect(storage.store.get("da:tab")).toBe("3");
  });
});
