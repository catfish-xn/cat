# CI158 diagnosis

Run: https://github.com/catfish-xn/cat/actions/runs/37966560354
Exact SHA:06912ce8966bb3430e7d82c2b91d4c5ce7f77486
Failed unit job: https://github.com/catfish-xn/cat/actions/runs/37966560354/job/113942265617
Read-only diagnosis; no reruns, code modifications or commits.

## Sole observed failure: late-round restore timeout

tests/m8-b6-match-wiring.test.ts:115:3
Scenario: "restores 36-38 preparation/combat/settlement and ends only at 6-7 with no regeneration"
Error: Test timed out in5000ms.
Reported test duration:5364ms.
First visible failure:2026-10-09T17:29:15.8367134Z.
Final failure summary:2026-10-09T17:38:09.4168859Z.
No assertion mismatch is reported for this scenario; the elapsed-time test gate fails.

Unit totals:1 failed,1421 passed,10 skipped (1432 total);1 test file failed,110 passed (111 total).
The unit job's subsequent build,dedicated headless and performance steps were skipped.

## Comparison against prior checkpoint

CI157 ff60a798 run37965537295 had five failures: four M6 initial-prefix assertions plus this same late-round restore timeout at6149ms.
CI15806912ce has only the same timeout, now5364ms against the unchanged5000ms limit.
All four M6 integration scenarios pass explicitly:
- cannon97947ms
- sniper81675ms
- mage77485ms
- sniper-caitlyn78532ms
Their file reports4 passed with5 existing dependency skips,335641ms total.
Thus the corrected public-start initial-prefix expectation is validated by this CI unit execution; no new later M6 assertion failure appears. This does not make the full workflow green.

No CI156 golden-content-digest mismatch appears.

## Snapshot and remaining work

As of2026-10-09T17:50:50Z, the run remains in_progress:
10 jobs successful,1 failed(unit),1 running(input-preview),2 optional jobs skipped.
All six browser dev/preview cannon/sniper/mage jobs, input-dev,m6-retention,m7-presentation and m8-u3-dynamic are successful in this snapshot.
No successful final compare is present. Full job/step snapshot retained in jobs.json.
The parent owns ongoing monitoring; this deliverable is the completed unit-failure diagnosis and does not claim the remaining input-preview job finished.

Repeated timeout evidence means this scenario still needs an authorized efficiency fix or further diagnosis under the existing budget. Two elapsed-time samples do not establish a specific bottleneck or prove environmental flakiness. Do not silently relax timeout/coverage.

## Sanitization and handling

The sanitized log retains complete npm-test step output, first visible failure, stack and final summary.
Setup/checkout,shell/environment configuration,uploads and cleanup were omitted; ANSI formatting and runner workspace prefixes removed. No credentials or environment configuration retained.
Parent and implementation worker received the sole-failure result immediately.

