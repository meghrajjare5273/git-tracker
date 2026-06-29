# 👁 GitHub Profile Views Tracker

Zero-infrastructure GitHub profile view tracker. Data lives in a SQLite file committed to this private repo. A daily GitHub Actions cron job fetches the Traffic API and commits the result back — no external database, no server, no cost.

---

## Architecture

```
GitHub Actions (cron: daily at 00:00 IST)
  │
  ├─ npm run track
  │     ├─ Calls /repos/{owner}/{owner}/traffic/views
  │     └─ Upserts into data/views.db (SQLite)
  │
  └─ git commit data/views.db && git push
```

> GitHub's Traffic API retains only **14 days** of data. The daily cron ensures zero gaps.

---

## Setup (5 minutes)

### Step 1 — Create a PAT

Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**

- Repository access: **This repo** + **your profile README repo** (`username/username`)
- Permissions: `Contents: Read and write` (write needed to read traffic on the profile repo)

> Classic token alternative: `repo` scope.

### Step 2 — Add the secret

In **this repo**: Settings → Secrets and variables → Actions → **New repository secret**

| Name | Value |
|------|-------|
| `GH_TOKEN` | Paste your PAT |

### Step 3 — Trigger first run

Go to the **Actions** tab → **Track GitHub Profile Views** → **Run workflow**

---

## Local Development

```bash
npm install
cp .env.example .env
# Edit .env with your GH_TOKEN and GH_OWNER

# Load env and run
export $(grep -v '^#' .env | xargs) && npm run track

# View stats
npm run stats
node scripts/stats.js --days 7
node scripts/stats.js --repo meghrajjare5273/meghrajjare5273 --days 14
```

---

## Database Schema

```sql
-- One row per repo per day
profile_views (id, repo TEXT, date TEXT, views INT, uniques INT)
  UNIQUE(repo, date)

-- Audit trail of every sync run
sync_log (id, synced_at TEXT, repos TEXT, entries INT, status TEXT, error TEXT)
```

Query examples:

```bash
# Open DB in SQLite shell
sqlite3 data/views.db

# Total views per repo (all time)
SELECT repo, SUM(views), SUM(uniques) FROM profile_views GROUP BY repo;

# Last 7 days
SELECT date, views, uniques FROM profile_views
WHERE repo = 'meghrajjare5273/meghrajjare5273'
  AND date >= date('now', '-7 days')
ORDER BY date DESC;

# Export to CSV
.mode csv
.output views.csv
SELECT * FROM profile_views ORDER BY repo, date;
```

---

## Extending

- **Multi-repo**: Set `GH_REPOS=repo1,repo2` in the workflow env block
- **Dashboard**: Use `better-sqlite3` in your Next.js API route to query `data/views.db`
- **Alerts**: Add a step to post to Slack/Discord if views spike
