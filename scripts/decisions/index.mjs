import { dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { listRecords } from "./lib.mjs";

export function buildIndex(root, { domain, tag, status } = {}) {
  const rows = [];
  for (const { path, record } of listRecords(root)) {
    const d = dirname(relative(root, path));
    const tags = Array.isArray(record.fm.tags) ? record.fm.tags : [];
    if (domain && d !== domain) continue;
    if (tag && !tags.includes(tag)) continue;
    if (status && record.fm.status !== status) continue;
    rows.push({
      id: record.fm.id,
      line: `${record.fm.id} | ${record.fm.status} | ${d} | ${record.title} | ${path}`,
    });
  }
  rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return rows.map((r) => r.line);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (n) => {
    const i = args.indexOf(n);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const lines = buildIndex(opt("--root") ?? "decisions", {
    domain: opt("--domain"),
    tag: opt("--tag"),
    status: opt("--status"),
  });
  if (lines.length) console.log(lines.join("\n"));
}
