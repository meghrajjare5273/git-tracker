# How to embed in your profile README (meghrajjare5273/meghrajjare5273)

## Option A — Bar Chart (recommended)

Paste this anywhere in your README.md:

```markdown
## 👁 Profile Views

![Profile Views Chart](https://raw.githubusercontent.com/meghrajjare5273/github-views-tracker/main/assets/views-chart.svg)
```

## Option B — Compact Badge

Inline badge next to any text:

```markdown
![Profile Views](https://raw.githubusercontent.com/meghrajjare5273/github-views-tracker/main/assets/views-badge.svg)
```

## Option C — Both together

```markdown
## 📊 Stats

![Views Badge](https://raw.githubusercontent.com/meghrajjare5273/github-views-tracker/main/assets/views-badge.svg)

![Views Chart](https://raw.githubusercontent.com/meghrajjare5273/github-views-tracker/main/assets/views-chart.svg)
```

## Important — Cache Busting

GitHub caches raw SVGs aggressively. Append `?v=DATE` to force refresh:

```markdown
![Chart](https://raw.githubusercontent.com/meghrajjare5273/github-views-tracker/main/assets/views-chart.svg?v=2026)
```

Or use the jsdelivr CDN which is less aggressively cached:

```markdown
![Chart](https://cdn.jsdelivr.net/gh/meghrajjare5273/github-views-tracker@main/assets/views-chart.svg)
```
