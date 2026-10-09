#!/usr/bin/env bash
# Appends today's repo stats to metrics/history.csv. GitHub keeps traffic for only 14 days,
# so run this at least every two weeks (e.g. weekly) to keep the trend.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="petrovicistefan/mcp-dealfinder"
OUT="metrics/history.csv"
mkdir -p metrics
[ -f "$OUT" ] || echo "date,stars,forks,clones_14d,clones_unique_14d,views_14d,npm_downloads_week" > "$OUT"
read -r stars forks < <(gh api "repos/$REPO" --jq '"\(.stargazers_count) \(.forks_count)"')
read -r clones cu < <(gh api "repos/$REPO/traffic/clones" --jq '"\(.count) \(.uniques)"')
views=$(gh api "repos/$REPO/traffic/views" --jq '.count')
npm=$(curl -fsS "https://api.npmjs.org/downloads/point/last-week/mcp-dealfinder" 2>/dev/null | sed -n 's/.*"downloads":\([0-9]*\).*/\1/p' || true)
echo "$(date +%F),$stars,$forks,$clones,$cu,$views,${npm:-0}" >> "$OUT"
tail -n 3 "$OUT"
