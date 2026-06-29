#!/usr/bin/env node
/**
 * generate-svg.js
 * Reads views.db and generates two SVGs:
 *   assets/views-chart.svg  — 14-day bar chart
 *   assets/views-badge.svg  — "Total views" badge
 *
 * Run after track.js: node scripts/generate-svg.js
 */

import Database from "better-sqlite3";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH   = join(__dirname, "../data/views.db");
const OUT_DIR   = join(__dirname, "../assets");

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// ─── Query ────────────────────────────────────────────────────────────────────
const db = new Database(DB_PATH, { readonly: true });

const GH_OWNER = process.env.GH_OWNER ?? "meghrajjare5273";

const rows = db.prepare(`
  SELECT date, SUM(views) as views, SUM(uniques) as uniques
  FROM   profile_views
  WHERE  repo   = ?
    AND  date  >= date('now', '-14 days')
  GROUP  BY date
  ORDER  BY date ASC
`).all(`${GH_OWNER}/${GH_OWNER}`);

const allTime = db.prepare(`
  SELECT SUM(views) as total, SUM(uniques) as uniques
  FROM   profile_views
  WHERE  repo = ?
`).get(`${GH_OWNER}/${GH_OWNER}`);

db.close();

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Fill missing days in the last 14 days
function fillDays(data, n = 14) {
  const map = Object.fromEntries(data.map((r) => [r.date, r]));
  const result = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    result.push(map[key] ?? { date: key, views: 0, uniques: 0 });
  }
  return result;
}

function shortDate(iso) {
  const [, m, d] = iso.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}

function fmtNum(n) {
  if (!n) return "0";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

// ─── BAR CHART SVG ────────────────────────────────────────────────────────────
function generateChart(data) {
  const W = 740, H = 200;
  const PAD = { top: 28, right: 20, bottom: 36, left: 44 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxV = Math.max(...data.map((r) => r.views), 1);
  const barW  = Math.floor(chartW / data.length) - 4;

  const barColor      = "#4f98a3"; // --color-primary dark
  const barColorLight = "#cedcd8";
  const gridColor     = "#393836";
  const textColor     = "#cdccca";
  const mutedColor    = "#797876";
  const bgColor       = "#1c1b19";
  const cardBg        = "#201f1d";

  // Grid lines (4 horizontal)
  const gridLines = [0, 0.33, 0.66, 1].map((frac) => {
    const y = PAD.top + chartH - frac * chartH;
    const val = Math.round(frac * maxV);
    return `
      <line x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}"
            stroke="${gridColor}" stroke-width="1" stroke-dasharray="3,4"/>
      <text x="${PAD.left - 6}" y="${y + 4}" text-anchor="end"
            fill="${mutedColor}" font-size="10" font-family="system-ui,sans-serif">${fmtNum(val)}</text>`;
  }).join("");

  // Bars
  const bars = data.map((row, i) => {
    const barH = Math.max((row.views / maxV) * chartH, row.views > 0 ? 2 : 0);
    const x = PAD.left + i * (chartW / data.length) + 2;
    const y = PAD.top + chartH - barH;
    const isToday = row.date === new Date().toISOString().slice(0, 10);

    return `
      <rect x="${x}" y="${y}" width="${barW}" height="${barH}"
            fill="${isToday ? barColor : barColorLight}" rx="2" opacity="${isToday ? '1' : '0.7'}">
        <title>${row.date}: ${row.views} views, ${row.uniques} unique</title>
      </rect>
      ${row.views > 0 ? `<text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle"
            fill="${textColor}" font-size="9" font-family="system-ui,sans-serif">${row.views}</text>` : ''}`;
  }).join("");

  // X-axis labels (every other day to avoid crowding)
  const labels = data.map((row, i) => {
    if (i % 2 !== 0) return "";
    const x = PAD.left + i * (chartW / data.length) + barW / 2 + 2;
    return `<text x="${x}" y="${H - 8}" text-anchor="middle"
            fill="${mutedColor}" font-size="10" font-family="system-ui,sans-serif">${shortDate(row.date)}</text>`;
  }).join("");

  const totalViews   = data.reduce((s, r) => s + r.views, 0);
  const totalUniques = data.reduce((s, r) => s + r.uniques, 0);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + 50}"
     viewBox="0 0 ${W} ${H + 50}" role="img" aria-label="GitHub profile views chart">

  <defs>
    <style>
      .title { font: 600 13px system-ui,sans-serif; fill: ${textColor}; }
      .stat  { font: 400 11px system-ui,sans-serif; fill: ${mutedColor}; }
      .stat-val { font: 700 13px system-ui,sans-serif; fill: ${textColor}; }
    </style>
  </defs>

  <!-- Card background -->
  <rect width="${W}" height="${H + 50}" rx="10" fill="${cardBg}" />
  <rect width="${W}" height="${H + 50}" rx="10" fill="none"
        stroke="#393836" stroke-width="1"/>

  <!-- Title -->
  <text x="${PAD.left}" y="18" class="title">👁  Profile Views — Last 14 Days</text>

  <!-- Stats row -->
  <text x="${W - 180}" y="18" class="stat">14-day views</text>
  <text x="${W - 180}" y="32" class="stat-val">${fmtNum(totalViews)}</text>
  <text x="${W - 90}" y="18" class="stat">14-day unique</text>
  <text x="${W - 90}" y="32" class="stat-val">${fmtNum(totalUniques)}</text>

  <!-- Chart area -->
  <g>${gridLines}</g>
  <line x1="${PAD.left}" y1="${PAD.top + chartH}" x2="${W - PAD.right}" y2="${PAD.top + chartH}"
        stroke="${gridColor}" stroke-width="1"/>
  <g>${bars}</g>
  <g>${labels}</g>

  <!-- Footer -->
  <text x="${PAD.left}" y="${H + 44}" class="stat">
    Updated ${new Date().toISOString().slice(0, 10)} · All-time: ${fmtNum(allTime?.total ?? 0)} views, ${fmtNum(allTime?.uniques ?? 0)} unique visitors
  </text>
</svg>`;
}

// ─── BADGE SVG ────────────────────────────────────────────────────────────────
function generateBadge(total) {
  const label = "profile views";
  const value = fmtNum(total);
  const lw = label.length * 6.5 + 10;
  const vw = value.length * 8 + 10;
  const W  = lw + vw;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="20" viewBox="0 0 ${W} 20"
     role="img" aria-label="Profile views: ${value}">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${W}" height="20" rx="3"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${lw}" height="20" fill="#555"/>
    <rect x="${lw}" width="${vw}" height="20" fill="#4f98a3"/>
    <rect width="${W}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="${lw / 2}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${lw / 2}" y="14">${label}</text>
    <text x="${lw + vw / 2}" y="15" fill="#010101" fill-opacity=".3">${value}</text>
    <text x="${lw + vw / 2}" y="14">${value}</text>
  </g>
</svg>`;
}

// ─── Write files ──────────────────────────────────────────────────────────────
const filled = fillDays(rows, 14);

const chartSVG = generateChart(filled);
const badgeSVG = generateBadge(allTime?.total ?? 0);

writeFileSync(join(OUT_DIR, "views-chart.svg"), chartSVG);
writeFileSync(join(OUT_DIR, "views-badge.svg"), badgeSVG);

console.log(`✅  assets/views-chart.svg  (${filled.length} days)`);
console.log(`✅  assets/views-badge.svg  (total: ${fmtNum(allTime?.total ?? 0)})`);
