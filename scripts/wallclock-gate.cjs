// Wall-clock budgets (docs/WORKFLOW_RULES_2026-10-19.md §4). The pull-request gate sets
// CI_WALLCLOCK_GATES=report: every measured budget is still computed and recorded, but only
// .github/workflows/wallclock.yml (nightly and after each merge) fails on it. Any other value,
// including unset, enforces the unchanged frozen budgets exactly as before.
const fs = require('node:fs');
const path = require('node:path');

const enforced = process.env.CI_WALLCLOCK_GATES !== 'report';

/** Append measured budgets ({name, actual, limit, comparison, passed}) to WALLCLOCK_REPORT_DIR. */
function recordWallClock(source, gates) {
  const rows = gates.map(gate => ({ source, enforced, ...gate }));
  for (const row of rows) if (!row.passed && !enforced) console.warn(`::warning title=wall-clock (report only)::${source} ${row.name}: ${row.actual} vs ${row.comparison} ${row.limit}`);
  const dir = process.env.WALLCLOCK_REPORT_DIR;
  if (!dir) return rows;
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, `${source}.jsonl`), rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  return rows;
}

module.exports = { wallClockEnforced: enforced, recordWallClock };
