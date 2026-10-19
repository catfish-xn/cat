// Summarise every recorded wall-clock budget (scripts/wallclock-gate.cjs, tests/fixtures/wallclock.ts)
// under the given artifact folder into a Markdown report, printed and written to <folder>/REPORT.md.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(process.argv[2] ?? 'artifacts');
const files = [];
const walk = dir => { for (const entry of fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []) {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) walk(full); else if (entry.name.endsWith('.jsonl') && full.split(path.sep).includes('wallclock')) files.push(full);
} };
walk(root);
const rows = files.flatMap(file => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)));
const jobs = JSON.parse(process.env.JOB_RESULTS ?? '{}');
const format = value => typeof value === 'number' ? String(Math.round(value * 1000) / 1000) : String(value);
const lines = [
  '# Wall-clock budgets',
  '',
  `Ref: \`${process.env.WALLCLOCK_REF ?? 'local'}\` · run ${process.env.GITHUB_RUN_ID ?? 'local'} · ${new Date().toISOString()}`,
  '',
  '| Job | Result |', '|---|---|',
  ...Object.entries(jobs).map(([name, job]) => `| ${name} | ${job.result} |`),
  '',
  '| Source | Budget | Measured | Limit | Result |', '|---|---|---:|---:|---|',
  ...rows.map(row => `| ${row.source} | ${row.name}${row.metric ? ` (${row.metric})` : ''} | ${format(row.actual)} | ${row.comparison} ${format(row.limit)} | ${row.passed ? 'pass' : '**over budget**'} |`),
  '',
];
const failed = rows.filter(row => !row.passed);
lines.push(rows.length === 0 ? 'No wall-clock measurement was recorded (a job failed before measuring; see the job logs).'
  : failed.length === 0 ? `All ${rows.length} recorded budgets passed.` : `${failed.length} of ${rows.length} budgets over: ${failed.map(row => `${row.source} ${row.name}`).join(', ')}.`);
const report = lines.join('\n') + '\n';
fs.mkdirSync(root, { recursive: true });
fs.writeFileSync(path.join(root, 'REPORT.md'), report);
process.stdout.write(report);
