#!/bin/bash
cd $SCRATCH/h1 || exit 1
npm run build > $SCRATCH/h1-build.log 2>&1; echo "build exit $?" >> $SCRATCH/h1.done
for run in normal-1 normal-2 snapshot-1; do
  extra=""; [ "$run" = snapshot-1 ] && export M6_HEAP_DIAGNOSTICS=1 || unset M6_HEAP_DIAGNOSTICS
  start=$(date -u +%FT%TZ)
  CHROMIUM_PATH=/opt/pw-browsers/chromium M5_EVIDENCE_DIR=$SCRATCH/h1-out/$run timeout 2400 node scripts/verify-m5-browser.cjs --preview --m6-journey --build=cannon > $SCRATCH/h1-$run.log 2>&1
  echo "$run exit $? start $start end $(date -u +%FT%TZ)" >> $SCRATCH/h1.done
done
