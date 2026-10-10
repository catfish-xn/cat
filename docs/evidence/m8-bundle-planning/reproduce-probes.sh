#!/usr/bin/env bash
# Read-only source extraction; all changes are confined to newly created throwaway directories.
set -euo pipefail
: "${REPO:?Set REPO to the local cat repository}"
: "${NODE_BIN:?Set NODE_BIN to the directory containing Node 22.23.3}"
export PATH="$NODE_BIN:$PATH"
[ "$(node --version)" = 'v22.23.3' ]
EVIDENCE=$(cd "$(dirname "$0")" && pwd)
OUT=${OUT:-$(mktemp -d /tmp/m8-budget-reproduction.XXXXXX)}
mkdir -p "$OUT"
for probe in baseline encounter names44 names89; do
 DIR=$(mktemp -d /tmp/m8-budget-source.XXXXXX)
 git -C "$REPO" archive 87782695f864ba5d493d7a40c9c3652b48aacc86 | tar -x -C "$DIR"
 ln -s "$REPO/node_modules" "$DIR/node_modules"
 if [ "$probe" != baseline ]; then
  cp "$EVIDENCE/$probe-probe.ts.txt" "$DIR/src/budget-probe.ts"
  sed -i 's#</body>#<script type="module" src="/src/budget-probe.ts"></script></body>#' "$DIR/index.html"
 fi
 (cd "$DIR"; npm run build) > "$OUT/$probe-build.log" 2>&1
 node "$EVIDENCE/measure.cjs" "$DIR" "$probe" "$OUT/$probe.json"
done
printf 'Evidence: %s\n' "$OUT"
