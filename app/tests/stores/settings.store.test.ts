import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchSettings = vi.fn();
const saveSettings = vi.fn();

vi.mock("@client/api/settings", () => ({
  fetchSettings: () => fetchSettings(),
  saveSettings: (next: unknown) => saveSettings(next),
}));

const { settingsStore } = await import("@stores/settings.store");

beforeEach(() => {
  fetchSettings.mockReset();
  saveSettings.mockReset();
});

describe("settingsStore", () => {
  it("loads the stored modes", async () => {
    fetchSettings.mockResolvedValue({
      defaultCaptureModeKey: "ANALYTICS",
      defaultInputModeKey: "VISUAL_BOARD",
    });

    const store = settingsStore();
    await store.load();

    expect(store.captureModeKey).toBe("ANALYTICS");
    expect(store.inputModeKey).toBe("VISUAL_BOARD");
    expect(store.loading).toBe(false);
  });

  it("loads on init so a registered store hydrates without x-init", async () => {
    fetchSettings.mockResolvedValue({
      defaultCaptureModeKey: "ANALYTICS",
      defaultInputModeKey: "VISUAL_BOARD",
    });

    const store = settingsStore();
    await store.init();

    expect(fetchSettings).toHaveBeenCalledTimes(1);
    expect(store.captureModeKey).toBe("ANALYTICS");
    expect(store.inputModeKey).toBe("VISUAL_BOARD");
  });

  it("keeps quick score when the load fails", async () => {
    fetchSettings.mockRejectedValue(new Error("offline"));

    const store = settingsStore();
    await store.load();

    expect(store.captureModeKey).toBe("RECREATIONAL");
    expect(store.inputModeKey).toBe("QUICK_SCORE");
    expect(store.error).not.toBeNull();
  });

  it("saves a new pair and adopts it", async () => {
    saveSettings.mockResolvedValue({
      defaultCaptureModeKey: "ANALYTICS",
      defaultInputModeKey: "VISUAL_BOARD",
    });

    const store = settingsStore();
    await store.save("ANALYTICS", "VISUAL_BOARD");

    expect(saveSettings).toHaveBeenCalledWith({
      defaultCaptureModeKey: "ANALYTICS",
      defaultInputModeKey: "VISUAL_BOARD",
    });
    expect(store.captureModeKey).toBe("ANALYTICS");
    expect(store.inputModeKey).toBe("VISUAL_BOARD");
  });

  it("leaves the previous pair in place when the save fails", async () => {
    saveSettings.mockRejectedValue(new Error("rejected"));

    const store = settingsStore();
    await store.save("ANALYTICS", "VISUAL_BOARD");

    expect(store.captureModeKey).toBe("RECREATIONAL");
    expect(store.inputModeKey).toBe("QUICK_SCORE");
    expect(store.error).not.toBeNull();
  });
});
