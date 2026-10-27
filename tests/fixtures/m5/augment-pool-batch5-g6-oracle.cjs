/* Independent literal 14.24 TFT_BlueGolem + P-B5-83 (2026-10-27).
 * Does not import production content or use reward payloads to derive expectations. */
const assert = require('node:assert/strict');
const ID = 'im-the-carry-now', UNIT = 'carry-golem', SOURCE = 'augment-pool-batch5-g6';
const ITEMS = ['crownguard', 'bloodthirster', 'titans-resolve'];
function panel(stage, acquisitionStage = 2) {
  const growth = Math.max(0, stage - acquisitionStage), star = Math.min(4, 1 + growth), rank = BigInt(star - 1);
  const health = Number(600n * 18n ** rank / 10n ** rank), attackCenti = 5500n * 15n ** rank / 10n ** rank;
  return { star, health,
    attackCenti: Number(attackCenti), damage: [300, 480, 750, 1125][star - 1],
    healthFlat: growth * 475, attackDamageBps: growth * 2000,
    // Literal equipment totals: Crownguard 100 HP; Bloodthirster 15% AD; Titan starts at zero stacks.
    equippedHealth: health + growth * 475 + 100,
    equippedAttack: Number(attackCenti * BigInt(11500 + growth * 2000) / 1000000n) };
}
function validateState(state, strategy) {
  const owner = state.augments.find(a => a.definitionId === ID);
  const units = state.preparation.units.filter(u => u.definitionId === UNIT);
  const receipts = (state.seatMechanics?.receipts ?? []).filter(r => r.source === SOURCE);
  if (!owner) { assert.equal(units.length, 0); assert.equal(receipts.length, 0); return; }
  const p = panel(state.roundDefinitionId.startsWith('overtime-') ? 6 : Number(state.roundDefinitionId.split('-')[0]), Number(owner.choiceId.split(':')[1].split('-')[0]));
  assert.equal(units.length, 1); const unit = units[0];
  assert.equal(unit.starLevel, p.star); assert.equal(unit.team, 'player'); assert.equal(unit.location.kind, 'board');
  const items = state.items.filter(i => i.location.kind === 'unit' && i.location.unitId === unit.id).sort((a,b) => a.location.slot - b.location.slot);
  assert.deepEqual(items.map(i => [i.definitionId, i.location.slot]), ITEMS.map((id,slot) => [id,slot]));
  if (strategy) {
    const resolved = strategy.units.find(u => u.unitId === unit.id); assert(resolved, 'golem compiled into the actual battle');
    const effects = resolved.sources.filter(s => s.source.sourceKind === 'augment' && s.source.sourceDefinitionId === ID).map(s => s.effect);
    assert.deepEqual(effects, [{kind:'statFlat',stat:'maxHp',amount:p.healthFlat}, {kind:'statPercentBps',stat:'attackDamage',bps:p.attackDamageBps}]);
    assert.equal(resolved.ability.variables.Damage, p.damage * 10000);
    assert.equal(resolved.stats.armor >= 80, true); assert.equal(resolved.stats.magicResist >= 60, true);
  }
}
function validateTransition(before, after, command, events) {
  const selected = command?.type === 'select' && before.pendingChoice?.kind === 'augment' && command.definitionId === ID;
  const appended = (after.seatMechanics?.receipts ?? []).slice(before.seatMechanics?.receipts.length ?? 0).filter(r => r.source === SOURCE);
  const expected = [];
  if (selected) {
    assert(before.pendingChoice.offers.includes(ID), 'real public offer');
    const choiceId = before.pendingChoice.choiceId, unitId = `unit-${before.nextUnitSerial}`;
    const receiptId = part => JSON.stringify([SOURCE, choiceId, part]);
    const identity = part => ({ receiptId:receiptId(part), source:SOURCE, round:before.round, roundId:before.roundDefinitionId });
    expected.push({...identity('unit'),kind:'unit',definitionId:UNIT,resolution:'held',unitId,gold:0});
    ITEMS.forEach((definitionId,slot) => expected.push({...identity(`item:${slot}`),kind:'item',definitionId,itemId:`item-${before.nextItemSerial+slot}`}));
    assert.equal(after.nextUnitSerial, before.nextUnitSerial + 1);
    assert.equal(after.nextItemSerial, before.nextItemSerial + 3);
    assert.equal(after.preparation.units.find(u => u.id === unitId)?.definitionId, UNIT);
    for (const r of expected) assert(events.some(e => e.type === 'mechanicGranted' && require('node:util').isDeepStrictEqual(e.receipt,r)), 'actual domain grant event');
  }
  assert.deepEqual(appended, expected, 'independent fixed golem reward set, including missing receipts');
  validateState(after);
  return selected;
}
module.exports = { panel, validateState, validateTransition };
