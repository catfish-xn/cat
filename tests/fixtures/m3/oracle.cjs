/* Independent acceptance ledger. No imports from product rules or helpers. */
const assert = require('node:assert/strict');
const CATALOG = [[], ['sentinel', 'ranger', 'mystic'], ['bulwark', 'archer'], ['arcanist', 'duelist'], ['warden', 'tempest'], ['colossus', 'oracle']];
const ODDS = [[], [100,0,0,0,0], [100,0,0,0,0], [75,25,0,0,0], [55,30,15,0,0], [45,33,20,2,0], [30,40,25,5,0], [19,30,40,10,1], [18,25,32,22,3], [10,20,25,35,10]];
const XP = [0,2,2,6,10,20,36,56,80];
const COST = Object.fromEntries(CATALOG.flatMap((ids, tier) => ids.map(id => [id, tier])));
const clone = value => structuredClone(value);
const compareId = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
function word(state) { return Number((BigInt(state) * 1664525n + 1013904223n) % 4294967296n); }
function expectedShop(rngState, generation, level) {
  const slots = [];
  for (let i = 0; i < 5; i++) {
    rngState = word(rngState);
    const roll = Number(BigInt(rngState) * 100n / 4294967296n);
    let threshold = 0, cost;
    for (let tier = 1; tier <= 5; tier++) { threshold += ODDS[level][tier - 1]; if (roll < threshold) { cost = tier; break; } }
    assert(cost);
    rngState = word(rngState);
    slots.push({ status: 'available', definitionId: CATALOG[cost][Number(BigInt(rngState) * BigInt(CATALOG[cost].length) / 4294967296n)] });
  }
  return { shop: { generation, slots }, rngState };
}
function progression(level, xp, amount) {
  const originalLevel = level;
  const available = level === 9 ? 0 : XP.slice(level).reduce((sum, value) => sum + value, 0) - xp;
  const xpApplied = Math.min(amount, available);
  xp += xpApplied;
  while (level < 9 && xp >= XP[level]) { xp -= XP[level]; level++; }
  return { level, xp: level === 9 ? 0 : xp, xpRequested: amount, xpApplied, levelsGained: level - originalLevel };
}
function priority(unit) {
  if (!unit.location) return [2, 0, 0];
  return unit.location.kind === 'board' ? [0, unit.location.cell.row, unit.location.cell.col] : [1, unit.location.slot, 0];
}
function compareSurvivor(a, b) {
  const x = priority(a), y = priority(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return compareId(a, b);
}
function purchased(preparation, definitionId, candidateId) {
  let units = [...clone(preparation.units), { id: candidateId, team: 'player', definitionId, starLevel: 1, location: null }];
  const events = [];
  for (let starLevel = 1; starLevel < 3; starLevel++) {
    let group = units.filter(u => u.team === 'player' && u.definitionId === definitionId && u.starLevel === starLevel).sort(compareSurvivor);
    while (group.length >= 3) {
      const [survivor, ...removed] = group.slice(0, 3);
      const consumedIds = removed.map(u => u.id).sort();
      const upgraded = { ...survivor, starLevel: starLevel + 1 };
      assert(upgraded.location, 'A purchase cannot become the retained ID ahead of two positioned copies');
      units = units.filter(u => !consumedIds.includes(u.id)).map(u => u.id === survivor.id ? upgraded : u);
      events.push({ type: 'unitUpgraded', survivorId: survivor.id, consumedIds, definitionId, fromStar: starLevel, toStar: starLevel + 1, location: clone(upgraded.location) });
      group = units.filter(u => u.team === 'player' && u.definitionId === definitionId && u.starLevel === starLevel).sort(compareSurvivor);
    }
  }
  const candidate = units.find(u => u.id === candidateId);
  if (candidate) {
    const used = new Set(units.filter(u => u.location?.kind === 'bench').map(u => u.location.slot));
    const slot = Array.from({ length: preparation.benchSize }, (_, i) => i).find(i => !used.has(i));
    if (slot === undefined) return { ok: false, reason: 'bench-full' };
    candidate.location = { kind: 'bench', slot };
  }
  return { ok: true, preparation: { ...clone(preparation), units: units.sort(compareId) }, events };
}
function expectedCommand(before, command) {
  const reject = reason => ({ ok: false, state: before, reason });
  if (before.phase !== 'preparation') return reject('wrong-phase');
  const state = clone(before), events = [];
  if (command.type === 'reroll') {
    if (state.gold < 2) return reject('insufficient-gold');
    state.gold -= 2;
    Object.assign(state, expectedShop(state.rngState, state.shop.generation + 1, state.level));
  } else if (command.type === 'buyXp') {
    if (state.level === 9) return reject('max-level');
    if (state.gold < 4) return reject('insufficient-gold');
    const xp = progression(state.level, state.xp, 4);
    state.gold -= 4; state.level = xp.level; state.xp = xp.xp;
  } else if (command.type === 'buy') {
    if (!Number.isInteger(command.slot) || command.slot < 0 || command.slot >= 5) return reject('invalid-slot');
    if (command.generation !== state.shop.generation) return reject('stale-shop');
    const offer = state.shop.slots[command.slot];
    if (offer.status !== 'available') return reject('purchased-slot');
    const cost = COST[offer.definitionId]; assert(cost);
    if (state.gold < cost) return reject('insufficient-gold');
    const purchase = purchased(state.preparation, offer.definitionId, `unit-${state.nextUnitSerial}`);
    if (!purchase.ok) return reject(purchase.reason);
    state.gold -= cost; state.nextUnitSerial++;
    state.preparation = purchase.preparation; events.push(...purchase.events);
    state.shop.slots[command.slot] = { status: 'purchased' };
  } else if (command.type === 'sell') {
    const unit = state.preparation.units.find(u => u.id === command.id);
    if (!unit) return reject('unknown-unit');
    if (unit.team !== 'player') return reject('enemy-unit');
    state.gold += COST[unit.definitionId] * 3 ** (unit.starLevel - 1);
    state.preparation.units = state.preparation.units.filter(u => u.id !== command.id);
  } else if (command.type === 'deploy') {
    const unit = state.preparation.units.find(u => u.id === command.id), target = command.target;
    if (!unit) return reject('unknown-unit');
    if (unit.team !== 'player') return reject('enemy-unit');
    if (target.kind === 'board') {
      if (![target.cell.col, target.cell.row].every(Number.isInteger) || target.cell.col < 0 || target.cell.col >= 7 || target.cell.row < 0 || target.cell.row >= 8) return reject('invalid-location');
      if (target.cell.row < 4) return reject('outside-deployment-zone');
    } else if (!Number.isInteger(target.slot) || target.slot < 0 || target.slot >= 7) return reject('invalid-location');
    const occupied = state.preparation.units.some(u => u.id !== unit.id && JSON.stringify(u.location) === JSON.stringify(target));
    if (occupied) return reject('occupied');
    if (target.kind === 'board' && unit.location.kind === 'bench' && state.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board').length >= state.level) return reject('population-cap');
    unit.location = clone(target);
  } else if (command.type === 'reject') return { ok: false, state: before, reason: command.reason };
  else throw new Error(`Unknown oracle command ${command.type}`);
  return { ok: true, state, events };
}
function expectedRound(before, combat) {
  const xp = progression(before.level, before.xp, 2), baseDamage = 2 + 2 * Math.floor((before.round - 1) / 3);
  const survivingEnemyCount = combat.units.filter(u => u.team === 'enemy' && u.alive).length;
  const playerDamage = combat.result === 'playerWin' ? 0 : baseDamage + (combat.result === 'enemyWin' ? 2 * survivingEnemyCount : 0);
  return { round: before.round, result: combat.result, combatTicks: combat.tick, income: 5, goldBefore: before.gold, goldAfter: before.gold + 5,
    xpAwarded: xp.xpApplied, levelBefore: before.level, levelAfter: xp.level, xpBefore: before.xp, xpAfter: xp.xp,
    hpBefore: before.playerHp, hpAfter: Math.max(0, before.playerHp - playerDamage), baseDamage, survivingEnemyCount,
    playerDamage, hpLost: Math.min(before.playerHp, playerDamage) };
}
function cardValue(units) { return units.filter(u => u.team === 'player').reduce((sum, u) => sum + COST[u.definitionId] * 3 ** (u.starLevel - 1), 0); }
function validateReplayHeader(header) {
  for (const [field, expected] of Object.entries({ schemaVersion: 3, rulesVersion: 'm3-v1', contentVersion: 'm3-content-v1' })) {
    if (header[field] !== expected) throw new Error(`Unsupported replay ${field}: ${header[field]}`);
  }
}
module.exports = { CATALOG, ODDS, XP, COST, expectedShop, progression, purchased, expectedCommand, expectedRound, cardValue, validateReplayHeader };
