import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchProfile = vi.fn();
const saveProfile = vi.fn();

vi.mock("@client/api/profile", () => ({
  fetchProfile: () => fetchProfile(),
  saveProfile: (next: unknown) => saveProfile(next),
}));

const { profileStore } = await import("@stores/profile.store");

beforeEach(() => {
  fetchProfile.mockReset();
  saveProfile.mockReset();
});

describe("profileStore", () => {
  it("loads the stored profile", async () => {
    fetchProfile.mockResolvedValue({
      displayName: "The Power",
      dartsDescription: "Winmau Pro-Series 23g",
      dartsWeightGrams: 23,
    });

    const store = profileStore();
    await store.load();

    expect(store.displayName).toBe("The Power");
    expect(store.dartsDescription).toBe("Winmau Pro-Series 23g");
    expect(store.dartsWeightGrams).toBe(23);
    expect(store.loading).toBe(false);
  });

  it("loads on init so a registered store hydrates without x-init", async () => {
    fetchProfile.mockResolvedValue({
      displayName: "The Power",
      dartsDescription: null,
      dartsWeightGrams: null,
    });

    const store = profileStore();
    await store.init();

    expect(fetchProfile).toHaveBeenCalledTimes(1);
    expect(store.displayName).toBe("The Power");
  });

  it("keeps the previous values when the load fails", async () => {
    fetchProfile.mockRejectedValue(new Error("offline"));

    const store = profileStore();
    await store.load();

    expect(store.displayName).toBe("");
    expect(store.error).not.toBeNull();
  });

  it("saves the current fields and adopts the stored result", async () => {
    saveProfile.mockResolvedValue({
      displayName: "Levi",
      dartsDescription: "Target Agora 23g",
      dartsWeightGrams: 23,
    });

    const store = profileStore();
    store.displayName = "Levi";
    store.dartsDescription = "Target Agora 23g";
    store.dartsWeightGrams = 23;
    await store.save();

    expect(saveProfile).toHaveBeenCalledWith({
      displayName: "Levi",
      dartsDescription: "Target Agora 23g",
      dartsWeightGrams: 23,
    });
    expect(store.displayName).toBe("Levi");
  });

  it("leaves the previous values in place when the save fails", async () => {
    saveProfile.mockRejectedValue(new Error("rejected"));

    const store = profileStore();
    store.displayName = "Levi";
    await store.save();

    expect(store.displayName).toBe("Levi");
    expect(store.error).not.toBeNull();
  });
});
