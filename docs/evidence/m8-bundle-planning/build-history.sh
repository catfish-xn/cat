#!/usr/bin/env bash
set -euo pipefail
REPO=/workspace/scratch/2d61d723fa5a/cat-b7-integration
OUT=/workspace/scratch/2d61d723fa5a/b7-budget-planning/evidence
export PATH=/tmp/b7-npm-cache/_npx/d18f28baf1132559/node_modules/node/bin:$PATH
for pair in '10a8367bead882c91e28769b400ad1b819b79980 before-u3-static' 'e896cc0aafa8e4c8a77620c2a33a287f40bab378 after-u3-static' 'f90e438933f341938c238980e1249d8904468c53 before-u3-dynamic' 'adf24b4ef6f5ec65b3abd59adc050ad2b6b82880 after-u3-dynamic'; do
 read -r sha label <<< "$pair"
 dir=/tmp/b7-budget-history/$label; mkdir -p "$dir"; git -C "$REPO" archive "$sha" | tar -x -C "$dir"
 ln -s "$REPO/node_modules" "$dir/node_modules"
 (cd "$dir"; npm run build) > "$OUT/$label-build.log" 2>&1
 node "$OUT/measure.cjs" "$dir" "$sha" "$OUT/$label.json"
done
