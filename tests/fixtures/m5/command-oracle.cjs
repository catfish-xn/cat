/* Independent command model retained from the M4 test oracle; M5 R3/R4 parameters only.
 * No product imports. Fixtures here deliberately contain no equipped items or persistent growth.
 */
const assert = require('node:assert/strict');
const { COST, SELL, shop: expectedShop, xp: progression } = require('./oracle.cjs');
const clone = value => structuredClone(value);
const compareId = (a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
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
    Object.assign(state, expectedShop(state.rngState, state.shop.generation + 1, state.level, state.shop.locked));
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
    state.gold += SELL[COST[unit.definitionId]][unit.starLevel - 1];
    state.preparation.units = state.preparation.units.filter(u => u.id !== command.id);
  } else if (command.type === 'deploy') {
    const unit = state.preparation.units.find(u => u.id === command.id), target = command.target;
    if (!unit) return reject('unknown-unit');
    if (unit.team !== 'player') return reject('enemy-unit');
    if (target.kind === 'board') {
      if (![target.cell.col, target.cell.row].every(Number.isInteger) || target.cell.col < 0 || target.cell.col >= 7 || target.cell.row < 0 || target.cell.row >= 8) return reject('invalid-location');
      if (target.cell.row < 4) return reject('outside-deployment-zone');
    } else if (!Number.isInteger(target.slot) || target.slot < 0 || target.slot >= 9) return reject('invalid-location');
    const occupied = state.preparation.units.some(u => u.id !== unit.id && JSON.stringify(u.location) === JSON.stringify(target));
    if (occupied) return reject('occupied');
    if (target.kind === 'board' && unit.location.kind === 'bench' && state.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board').length >= state.level) return reject('population-cap');
    unit.location = clone(target);
  } else if (command.type === 'reject') return { ok: false, state: before, reason: command.reason };
  else throw new Error(`Unknown oracle command ${command.type}`);
  const stamped = events.map(event => ({ ...event, domain: 'match', eventSeq: state.nextMatchEventSeq++ }));
  return { ok: true, state, events: stamped };
}

function cardValue(units) { return units.filter(u=>u.team==='player').reduce((sum,u)=>sum+COST[u.definitionId]*3**(u.starLevel-1),0); }
module.exports={expectedCommand,cardValue};
