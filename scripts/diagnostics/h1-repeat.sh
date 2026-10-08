#!/usr/bin/env bash
# Diagnostic wrapper only. Does not change the original browser probe or gates.
set -euo pipefail
if [[ $# != 5 ]]; then
  echo 'usage: bash h1-repeat.sh CLEAN_REPO NEW_OUTPUT_DIR CHROMIUM_PATH normal|trend COUNT' >&2
  exit 2
fi
repo=$(realpath "$1")
out=$(realpath -m "$2")
browser=$(realpath "$3")
mode=$4
count=$5
[[ "$mode" == normal || "$mode" == trend ]] || exit 2
[[ "$count" =~ ^[1-9][0-9]*$ ]] && (( count <= 30 )) || exit 2
[[ -x "$browser" ]] || { echo 'Browser executable missing' >&2; exit 2; }
case "$out/" in "$repo/"*) echo 'Output must be outside the repository' >&2; exit 2;; esac
[[ ! -e "$out" ]] || { echo 'Use a new output directory; never overwrite samples' >&2; exit 2; }
cd "$repo"
sha=97f38a0e787a4edcb35df4a59823bb1d106def67
[[ $(git rev-parse HEAD) == "$sha" ]] || { echo "Expected source SHA $sha" >&2; exit 2; }
[[ -z $(git status --porcelain) ]] || { echo 'Use a clean source worktree' >&2; exit 2; }
mkdir -p "$out"
{
  printf 'source_sha=%s\nmode=%s\ncount=%s\n' "$sha" "$mode" "$count"
  date -u +%FT%TZ
  node --version
  "$browser" --version
  uname -a
} > "$out/environment.txt"
# Use already installed, lockfile-matching dependencies in the clean source tree.
npm run build > "$out/build.log" 2>&1
printf 'run\tstarted_utc\tended_utc\texit_code\n' > "$out/runs.tsv"
for (( i=1; i<=count; i++ )); do
  run=$(printf '%s-%02d' "$mode" "$i")
  start=$(date -u +%FT%TZ)
  extra=()
  [[ "$mode" != trend ]] || extra+=(M6_WARMUP_EXPERIMENT=1)
  set +e
  env -u M6_HEAP_DIAGNOSTICS -u M6_WARMUP_EXPERIMENT \
    CHROMIUM_PATH="$browser" M5_EVIDENCE_DIR="$out/$run" "${extra[@]}" \
    timeout 5400 node scripts/verify-m5-browser.cjs --preview --m6-journey --build=cannon \
    > "$out/$run.log" 2>&1
  status=$?
  set -e
  printf '%s\t%s\t%s\t%s\n' "$run" "$start" "$(date -u +%FT%TZ)" "$status" | tee -a "$out/runs.tsv"
done
# Nonzero/timeout runs are evidence and must be kept, not silently replaced.
echo "Evidence saved: $out"
