import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { componentItems } from "../../../scripts/design-sync/components";
import { sha256 } from "../../../scripts/design-sync/lock";

const put = (root: string, rel: string, text: string): void => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
};

const setup = () => {
  const design = mkdtempSync(join(tmpdir(), "ds-design-"));
  const repo = mkdtempSync(join(tmpdir(), "ds-repo-"));
  put(design, "components/buttons/Button.jsx", "J");
  put(design, "components/buttons/Button.d.ts", "D");
  put(design, "components/buttons/Button.prompt.md", "P");
  put(design, "components/buttons/buttons.card.html", "<!-- @dsCard -->");
  put(design, "components/feedback/Skeleton.jsx", "S");
  put(design, "components/feedback/Skeleton.d.ts", "SD");
  put(repo, "app/src/components/ui/Button.astro", "A");
  put(repo, "app/src/components/ui/ButtonGroup.astro", "B");
  put(repo, "app/src/components/forms/Toggle.astro", "T");
  return { design, repo };
};

describe("design-sync components", () => {
  it("hashes both sides of a pair; unpaired files become one-sided items", () => {
    const { design, repo } = setup();
    const items = componentItems(design, repo, [
      {
        design: "components/buttons/Button",
        code: [
          "app/src/components/ui/Button.astro",
          "app/src/components/ui/ButtonGroup.astro",
        ],
      },
    ]);
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));

    expect(Object.keys(byId).sort()).toEqual([
      "component:Button",
      "component:Skeleton",
      "component:Toggle",
    ]);
    expect(items.every((i) => !i.comparable && i.area === "components")).toBe(
      true,
    );
    expect(byId["component:Button"].design).toEqual({
      path: "components/buttons/Button",
      hash: sha256("JDP"),
    });
    expect(byId["component:Button"].code).toEqual({
      path: "app/src/components/ui/Button.astro",
      hash: sha256("AB"),
    });
    expect(byId["component:Skeleton"].code).toBeNull();
    expect(byId["component:Toggle"].design).toBeNull();
    expect(byId["component:Toggle"].code?.path).toBe(
      "app/src/components/forms/Toggle.astro",
    );
  });

  it("hashes the design files that exist when .prompt.md is missing", () => {
    const { design, repo } = setup();
    const skeleton = componentItems(design, repo, []).find(
      (i) => i.id === "component:Skeleton",
    );
    expect(skeleton?.design?.hash).toBe(sha256("SSD"));
  });

  it("treats a paired side whose files are all gone as missing", () => {
    const { design, repo } = setup();
    const items = componentItems(design, repo, [
      {
        design: "components/buttons/Gone",
        code: ["app/src/components/ui/Renamed.astro"],
      },
    ]);
    const gone = items.find((i) => i.id === "component:Gone");
    expect(gone?.design).toBeNull();
    expect(gone?.code).toBeNull();
  });

  it("keeps a code-only pair (design null) as a code-only item", () => {
    const { design, repo } = setup();
    const items = componentItems(design, repo, [
      { design: null, code: ["app/src/components/forms/Toggle.astro"] },
    ]);
    const toggle = items.find((i) => i.id === "component:Toggle");
    expect(toggle?.design).toBeNull();
    expect(toggle?.code?.hash).toBe(sha256("T"));
  });
});
