import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { listRecords } from "./lib.mjs";

const CITE = new RegExp(`\\[${"pend"}ing:([a-z0-9][a-z0-9/-]*)\\]`, "g");

function pad(n) {
  return `D${String(n).padStart(4, "0")}`;
}

export function numberPending({ root, mainMaxId, changedFiles }) {
  const records = listRecords(root);
  let max = mainMaxId;
  const pending = [];
  for (const { path, record } of records) {
    const m = /^D(\d{4})$/.exec(String(record.fm.id));
    if (m) max = Math.max(max, Number(m[1]));
    else if (/^pending-[a-z0-9-]+\.md$/.test(basename(path))) {
      pending.push({
        path,
        domain: dirname(relative(root, path)),
        slug: basename(path).slice("pending-".length, -".md".length),
      });
    }
  }
  pending.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const bySlug = new Map();
  const byQualified = new Map();
  const plan = pending.map((p, i) => {
    const id = pad(max + 1 + i);
    const to = join(dirname(p.path), `${id}-${p.slug}.md`);
    byQualified.set(`${p.domain}/${p.slug}`, id);
    bySlug.set(p.slug, [...(bySlug.get(p.slug) ?? []), id]);
    return { ...p, id, to };
  });

  const errors = [];
  const resolve = (ref, file) => {
    if (byQualified.has(ref)) return byQualified.get(ref);
    if (ref.includes("/")) {
      errors.push(`${file}: unresolved citation for "${ref}"`);
      return null;
    }
    const ids = bySlug.get(ref) ?? [];
    if (ids.length === 1) return ids[0];
    errors.push(
      ids.length === 0
        ? `${file}: unresolved citation for "${ref}"`
        : `${file}: ambiguous citation for "${ref}"; qualify it as <domain>/${ref}`,
    );
    return null;
  };

  const edits = [];
  for (const file of changedFiles) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    const next = text.replace(CITE, (whole, ref) => {
      const id = resolve(ref, file);
      return id ?? whole;
    });
    if (next !== text) edits.push([file, next]);
  }
  if (errors.length) throw new Error(errors.join("\n"));

  const rewrites = [];
  for (const [file, next] of edits) {
    writeFileSync(file, next);
    rewrites.push(file);
  }
  const renames = [];
  for (const p of plan) {
    const text = readFileSync(p.path, "utf8");
    writeFileSync(p.path, text.replace(/^id:.*$/m, `id: ${p.id}`));
    renameSync(p.path, p.to);
    renames.push([p.path, p.to]);
  }
  return { renames, rewrites };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const val = (n) => args[args.indexOf(n) + 1];
  const ci = args.indexOf("--changed");
  try {
    const out = numberPending({
      root: val("--root"),
      mainMaxId: Number(val("--main-max")),
      changedFiles: ci >= 0 ? args.slice(ci + 1) : [],
    });
    for (const [a, b] of out.renames) console.log(`renamed ${a} -> ${b}`);
    for (const f of out.rewrites) console.log(`rewrote ${f}`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
