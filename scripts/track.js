#!/usr/bin/env node
/**
 * track.js — Fetches GitHub profile/repo traffic and upserts into SQLite.
 *
 * Env vars:
 *   GH_TOKEN  (required) — GitHub PAT with `repo` scope
 *   GH_OWNER  (required) — Your GitHub username
 *   GH_REPOS  (optional) — Comma-separated extra repos beyond profile README
 */

import Database from "better-sqlite3";
import { Octokit } from "@octokit/rest";
import { mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../data");
const DB_PATH = join(DATA_DIR, "views.db");

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

// ─── Database Setup ──────────────────────────────────────────────────────────
const db = new Database(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS profile_views (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    repo     TEXT    NOT NULL,
    date     TEXT    NOT NULL,
    views    INTEGER NOT NULL DEFAULT 0,
    uniques  INTEGER NOT NULL DEFAULT 0,
    UNIQUE(repo, date)
  );

  CREATE TABLE IF NOT EXISTS sync_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    synced_at  TEXT    NOT NULL,
    repos      TEXT    NOT NULL,
    entries    INTEGER NOT NULL DEFAULT 0,
    status     TEXT    NOT NULL DEFAULT 'ok',
    error      TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_views_repo_date ON profile_views(repo, date);
`);

// ─── Prepared Statements ─────────────────────────────────────────────────────
const upsertView = db.prepare(`
  INSERT INTO profile_views (repo, date, views, uniques)
  VALUES (@repo, @date, @views, @uniques)
  ON CONFLICT(repo, date) DO UPDATE SET
    views   = MAX(excluded.views,   profile_views.views),
    uniques = MAX(excluded.uniques, profile_views.uniques)
`);

const insertLog = db.prepare(`
  INSERT INTO sync_log (synced_at, repos, entries, status, error)
  VALUES (@synced_at, @repos, @entries, @status, @error)
`);

// Wrap all upserts in a single transaction for performance
const syncTransaction = db.transaction((entries) => {
  for (const e of entries) upsertView.run(e);
  return entries.length;
});

// ─── Config ───────────────────────────────────────────────────────────────────
const GH_TOKEN = process.env.GH_TOKEN;
const GH_OWNER = process.env.GH_OWNER;

if (!GH_TOKEN || !GH_OWNER) {
  console.error("❌  Set GH_TOKEN and GH_OWNER env vars.");
  process.exit(1);
}

const extraRepos = (process.env.GH_REPOS ?? "")
  .split(",")
  .map((r) => r.trim())
  .filter(Boolean);

// Profile README repo is always included (repo name = owner name)
const repos = [GH_OWNER, ...extraRepos];

const octokit = new Octokit({ auth: GH_TOKEN });

// ─── Fetch & Sync ─────────────────────────────────────────────────────────────
let totalEntries = 0;
const syncedAt = new Date().toISOString();

try {
  for (const repo of repos) {
    process.stdout.write(`📡  ${GH_OWNER}/${repo} ... `);

    let views;
    try {
      const { data } = await octokit.repos.getViews({
        owner: GH_OWNER,
        repo,
        per: "day",
      });
      views = data.views;
    } catch (err) {
      // 403 means no traffic access (not owner) — skip gracefully
      if (err.status === 403) {
        console.log(`⚠️  No traffic access (403) — skipped.`);
        continue;
      }
      throw err;
    }

    const entries = views.map((v) => ({
      repo: `${GH_OWNER}/${repo}`,
      date: v.timestamp.slice(0, 10),
      views: v.count,
      uniques: v.uniques,
    }));

    const count = syncTransaction(entries);
    totalEntries += count;
    console.log(`✅  ${count} entries`);
  }

  insertLog.run({
    synced_at: syncedAt,
    repos: repos.join(","),
    entries: totalEntries,
    status: "ok",
    error: null,
  });
  console.log(`\n🎉  Synced ${totalEntries} total entries.`);
} catch (err) {
  insertLog.run({
    synced_at: syncedAt,
    repos: repos.join(","),
    entries: totalEntries,
    status: "error",
    error: err.message,
  });
  console.error("\n❌  Fatal error:", err.message);
  process.exit(1);
} finally {
  db.close();
}
