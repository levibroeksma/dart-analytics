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
  put(design, "components/Button/Button.jsx", "J");
  put(design, "components/Button/Button.d.ts", "D");
  put(design, "components/Button/README.md", "P");
  put(design, "components/Button/preview.html", "<!-- @dsCard -->");
  put(design, "components/Skeleton/Skeleton.jsx", "S");
  put(design, "components/Skeleton/Skeleton.d.ts", "SD");
  put(design, "components/Cover/preview.html", "<!-- @dsCard -->");
  put(design, "components/lib/react.js", "R");
  put(design, "components/buttons/Legacy.jsx", "L");
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
        design: "components/Button/Button",
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
      path: "components/Button/Button",
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

  it("ignores preview.html changes", () => {
    const { design, repo } = setup();
    const before = componentItems(design, repo, []).find(
      (i) => i.id === "component:Button",
    );
    put(design, "components/Button/preview.html", "<!-- changed -->");
    const after = componentItems(design, repo, []).find(
      (i) => i.id === "component:Button",
    );
    expect(after?.design).toEqual(before?.design);
  });

  it("hashes the design files that exist when README.md is missing", () => {
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
        design: "components/Gone/Gone",
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
