/* User-approved B6-only dependency boundary. Keep each original assertion body
 * visible; this helper NEVER executes it or reports it as passed. B8/B9 must
 * remove the matching deferral and rerun the original gate after integration. */
function skipB6Dependency(report, owner, id, reason, assertion) {
  if (!['B8', 'B9'].includes(owner) || !id || !reason || typeof assertion !== 'function')
    throw new Error('B6 deferral requires an explicit B8/B9 owner, ID, reason and preserved assertion body');
  const entry = { status: 'skipped', owner, id, reason };
  (report.skipped ??= []).push(entry);
  console.log(`SKIPPED [${owner}] ${id}: ${reason}`);
}
module.exports = { skipB6Dependency };
