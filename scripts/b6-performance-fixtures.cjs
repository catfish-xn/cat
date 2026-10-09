/* Capture a real completed-battle state, never truncate a later Match's history. */
function boundedImportEnvelope(match, battles, maxBattles, runId) {
  if (!Number.isSafeInteger(maxBattles) || maxBattles < 1 || battles.length > maxBattles)
    throw Error('Invalid bounded import capacity');
  const results = match.roundResults.filter(result => result.result !== 'supply');
  if (results.length !== battles.length || match.combat?.status !== 'finished'
    || results.at(-1)?.round !== match.round || battles.at(-1)?.context.round !== match.round)
    throw Error('Bounded import requires the complete history at the actual battle-end state');
  return { kind:'hex-autobattler-save',saveFormatVersion:1,replayFormatVersion:1,runId,
    createdAt:'2026-10-06T00:00:00.000Z',match,battles,currentBattle:null };
}
module.exports = { boundedImportEnvelope };
