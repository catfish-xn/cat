#!/usr/bin/env bash
# Playwright Chromium for CI. The browser comes from the actions/cache that .github/actions/playwright-cache restores
# (keyed by the locked Playwright version), so `install` only downloads on a cache miss. System libraries are
# installed only when a cached or downloaded browser binary cannot resolve them; the runner image usually has them.
# `--with-deps` on every job occasionally took ~20 minutes (apt and the browser CDN), exhausting browser job limits.
set -euo pipefail
npx playwright install chromium
binaries=$(find "${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}" -type f \( -name chrome -o -name chrome-headless-shell \))
[ -n "$binaries" ] || { echo 'install-playwright: no Chromium binary after install' >&2; exit 1; }
missing=$(echo "$binaries" | xargs -r ldd 2>/dev/null | grep 'not found' || true)
if [ -n "$missing" ]; then
  echo "install-playwright: missing system libraries, installing them:"; echo "$missing" | sort -u
  npx playwright install-deps chromium
else
  echo 'install-playwright: system libraries already present; skipped install-deps'
fi
