import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { listRecords } from "./lib.mjs";

const CITE = /\[pending:([a-z0-9][a-z0-9/-]*)\]/g;
const asList = (v) =>
  (Array.isArray(v) ? v : [v]).filter((x) => typeof x === "string" && x !== "");
const ID = /\bD0*(\d+)\b/g;
const EXCLUSIONS_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  "pending-exclusions.txt",
);

export function loadExclusions(file = EXCLUSIONS_FILE) {
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l !== "" && !l.startsWith("#"));
}

function isExcluded(file, exclusions) {
  return exclusions.some((e) =>
    e.endsWith("/") ? file.startsWith(e) : file === e,
  );
}

function pad(n) {
  return `D${String(n).padStart(4, "0")}`;
}

export function numberPending({
  root,
  mainMaxId,
  changedFiles,
  mainFiles,
  exclusions = loadExclusions(),
}) {
  const records = listRecords(root);
  const mainSet = new Set(mainFiles ?? []);
  let max = mainMaxId;
  const pending = [];
  const byId = new Map();
  const clashes = [];
  for (const { path, record } of records) {
    const m = /^D(\d{4})$/.exec(String(record.fm.id));
    if (m) {
      max = Math.max(max, Number(m[1]));
      byId.set(m[1], [...(byId.get(m[1]) ?? []), path]);
    } else if (/^pending-[a-z0-9-]+\.md$/.test(basename(path))) {
      pending.push({
        path,
        domain: dirname(relative(root, path)),
        slug: basename(path).slice("pending-".length, -".md".length),
      });
    }
  }
  if (mainFiles) {
    for (const [id, paths] of byId) {
      if (paths.length < 2) continue;
      const fresh = paths.filter((p) => !mainSet.has(relative(root, p))).sort();
      const keep = fresh.length === paths.length ? 1 : 0;
      for (const path of fresh.slice(keep)) {
        clashes.push({ path, from: Number(id) });
      }
    }
  }
  const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  pending.sort(byPath);
  clashes.sort(byPath);

  let next = max + 1;
  const idMap = new Map();
  const plan = [];
  for (const c of clashes) {
    if (idMap.has(c.from)) {
      throw new Error(
        `${c.path}: id ${pad(c.from)} is held by several branch files`,
      );
    }
    const id = pad(next++);
    idMap.set(c.from, id);
    const slug = basename(c.path).slice(6, -".md".length);
    plan.push({
      path: c.path,
      id,
      to: join(dirname(c.path), `${id}-${slug}.md`),
    });
  }
  const bySlug = new Map();
  const byQualified = new Map();
  for (const p of pending) {
    const id = pad(next++);
    byQualified.set(`${p.domain}/${p.slug}`, id);
    bySlug.set(p.slug, [...(bySlug.get(p.slug) ?? []), id]);
    plan.push({
      path: p.path,
      id,
      to: join(dirname(p.path), `${id}-${p.slug}.md`),
    });
  }

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
    if (isExcluded(file, exclusions) || !existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    let next2 = text;
    if (idMap.size) {
      next2 = next2.replace(ID, (whole, n) => idMap.get(Number(n)) ?? whole);
    }
    next2 = next2.replace(CITE, (whole, ref) => resolve(ref, file) ?? whole);
    if (next2 !== text) edits.push([file, next2]);
  }
  if (errors.length) throw new Error(errors.join("\n"));

  const rewrites = [];
  for (const [file, body] of edits) {
    writeFileSync(file, body);
    rewrites.push(file);
  }
  const byRecordId = new Map(
    records.map(({ path, record }) => [String(record.fm.id), path]),
  );
  const supersededBy = new Map();
  for (const p of plan) {
    const rec = records.find((r) => r.path === p.path).record;
    for (const target of asList(rec.fm.supersedes)) {
      const tpath = byRecordId.get(target);
      if (!tpath) continue;
      const cur = supersededBy.get(tpath) ?? { ids: [], date: "" };
      cur.ids.push(p.id);
      if (rec.fm.date) cur.date = rec.fm.date;
      supersededBy.set(tpath, cur);
    }
  }
  for (const [tpath, { ids, date }] of supersededBy) {
    let text = readFileSync(tpath, "utf8");
    const old = text.match(/^superseded-by:(.*)$/m);
    const prior = old
      ? asList(
          old[1]
            .replace(/\s+#.*$/, "")
            .trim()
            .replace(/^\[|\]$/g, "")
            .split(",")
            .map((x) => x.trim()),
        )
      : [];
    const all = [...new Set([...prior, ...ids])];
    const value = all.length === 1 ? all[0] : `[${all.join(", ")}]`;
    text = text.replace(/^superseded-by:.*$/m, `superseded-by: ${value}`);
    text = text.replace(/^status:.*$/m, "status: superseded");
    if (date) text = text.replace(/^date:.*$/m, `date: ${date}`);
    writeFileSync(tpath, text);
    rewrites.push(tpath);
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
  const mf = args.indexOf("--main-files");
  try {
    const out = numberPending({
      root: val("--root"),
      mainMaxId: Number(val("--main-max")),
      mainFiles:
        mf >= 0
          ? readFileSync(args[mf + 1], "utf8")
              .split("\n")
              .filter(Boolean)
          : undefined,
      changedFiles: ci >= 0 ? args.slice(ci + 1) : [],
    });
    for (const [a, b] of out.renames) console.log(`renamed ${a} -> ${b}`);
    for (const f of out.rewrites) console.log(`rewrote ${f}`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
