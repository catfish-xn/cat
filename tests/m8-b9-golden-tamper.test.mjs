/** N2-P2-1 negative controls: the golden migration audit binds every packet fact, so a single tampered raw, source
 * instance, parent item, actionSeq or packetId in the replay2 ledger is rejected; the untampered ledger passes. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { spellCrit } from '../src/simulation/combat-s13-state';
const require = createRequire(import.meta.url);
const { ledgerAudit } = require('../scripts/update-m8-b9-golden.cjs');
const load = kind => JSON.parse(gunzipSync(readFileSync(`docs/evidence/m8-b9/golden/${kind}-cannon.json.gz`)).toString());
const previous = load('old'), current = load('new');

function audit(round, tamper) {
  const index = current.rounds.findIndex(r => r.round === round), next = current.rounds[index];
  const events = structuredClone(next.events);
  tamper?.(events);
  const units = next.after.combat.units;
  return () => ledgerAudit(previous.rounds[index].events, events, `cannon round ${round}`,
    { combatId: next.after.combat.combatId, multiplierOf: id => spellCrit(units.find(u => u.id === id)).multiplierBps });
}
const packets = events => events.filter(e => e.type === 'packetDamage');

describe('N2-P2-1 golden migration fact binding', () => {
  it('accepts the untampered round-1 and round-5 ledgers (positive control)', () => {
    expect(audit(1)).not.toThrow();
    expect(audit(5)).not.toThrow();
  });
  it.each([
    ['raw of a non-critical packet', e => { packets(e)[0].outcome.raw += 1; }, /raw/],
    ['raw of a critical packet', e => { packets(e)[1].outcome.raw += 1; }, /raw/],
    ['source instance', e => { packets(e)[0].outcome.context.source.instanceId = 'forged-instance'; }, /full source/],
    ['parent item', e => { packets(e)[0].outcome.context.source.parentItemInstanceId = 'item-forged'; }, /full source/],
    ['actionSeq', e => { packets(e)[0].outcome.context.actionSeq += 1; }, /actionSeq/],
    ['packetId', e => { const c = packets(e)[0].outcome.context; c.packetId = c.packetId.replace('round-1', 'round-x'); }, /packetId/],
  ])('rejects a tampered %s', (_, tamper, message) => {
    expect(packets(current.rounds[0].events)[1].outcome.critical).toBe(true);
    expect(audit(1, tamper)).toThrow(message);
  });
  it('rejects a tampered heal source instance (HealOutcome bound whole)', () => {
    expect(audit(5, e => { e.find(x => x.type === 'heal').outcome.shares[0].source.instanceId = 'forged'; })).toThrow(/HealOutcome/);
  });
});
