#!/usr/bin/env node
/**
 * stats.js — Print a human-readable summary of tracked views.
 *
 * Usage:
 *   node scripts/stats.js
 *   node scripts/stats.js --days 7
 *   node scripts/stats.js --repo meghrajjare5273/meghrajjare5273
 */

import Database from "better-sqlite3";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "../data/views.db");

const db = new Database(DB_PATH, { readonly: true });

// Parse CLI flags
const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};
const days = parseInt(get("--days") ?? "30", 10);
const repo = get("--repo");
const since = new Date(Date.now() - days * 86_400_000)
  .toISOString()
  .slice(0, 10);

const rows = db
  .prepare(
    `
  SELECT repo, date, views, uniques
  FROM   profile_views
  WHERE  date >= ?
  ${repo ? "AND repo = ?" : ""}
  ORDER  BY repo, date DESC
`,
  )
  .all(...(repo ? [since, repo] : [since]));

if (!rows.length) {
  console.log("No data found for the given filters. Run: npm run track");
  db.close();
  process.exit(0);
}

// Group by repo
const grouped = Object.groupBy(rows, (r) => r.repo);

for (const [name, data] of Object.entries(grouped)) {
  const totalViews = data.reduce((s, r) => s + r.views, 0);
  const totalUniques = data.reduce((s, r) => s + r.uniques, 0);
  const peak = data.reduce((m, r) => (r.views > m.views ? r : m), data[0]);

  console.log(`\n┌─ ${name}`);
  console.log(`│  Period    : last ${days} days (since ${since})`);
  console.log(`│  Views     : ${totalViews}`);
  console.log(`│  Uniques   : ${totalUniques}`);
  console.log(
    `│  Peak day  : ${peak.date} → ${peak.views} views, ${peak.uniques} uniques`,
  );
  console.log(`│`);
  console.log(`│  Date          Views  Uniques`);
  data
    .slice(0, 10)
    .forEach((r) =>
      console.log(
        `│  ${r.date}    ${String(r.views).padStart(5)}  ${String(r.uniques).padStart(7)}`,
      ),
    );
  console.log(`└${"─".repeat(40)}`);
}

// Last sync logs
const logs = db
  .prepare(`SELECT * FROM sync_log ORDER BY synced_at DESC LIMIT 5`)
  .all();
console.log("\n🔄  Recent syncs:");
logs.forEach((l) =>
  console.log(
    `   ${l.synced_at.slice(0, 19)}Z  [${l.status.padEnd(5)}]  ${String(l.entries).padStart(3)} entries  — ${l.repos}`,
  ),
);

db.close();
