import { describe, expect, it } from 'vitest';
import { authorizeSpellCrit, rollCrit } from '../src/simulation/m8/crit';
import { source } from './fixtures/m8-contract-cases';
describe('G03 hand-calculated execution vectors', () => {
  const ie = source('ie', 'i1'), jg = source('jg', 'i2'), trait = { ...source('trait'), sourceKind: 'trait' as const };
  it('counts redundant equipment authorizations independently of slot and prior nonitem sources', () => {
    expect(authorizeSpellCrit([], [], 2500, 14000)).toMatchObject({ enabled: false, redundantItemBonusBps: 0 });
    expect(authorizeSpellCrit([], [ie], 6000, 14000)).toMatchObject({ enabled: true, multiplierBps: 14000 });
    expect(authorizeSpellCrit([], [ie, jg], 9500, 14000)).toEqual(authorizeSpellCrit([], [jg, ie], 9500, 14000));
    expect(authorizeSpellCrit([], [ie, jg], 9500, 14000).multiplierBps).toBe(15000);
    expect(authorizeSpellCrit([trait], [ie], 6000, 14000).multiplierBps).toBe(15000);
    expect(authorizeSpellCrit([trait, { ...trait, instanceId: 't2' }], [ie, jg], 9500, 14000).multiplierBps).toBe(16000);
  });
  it('uses an exact word threshold and draws for basic at both 0% and 100%', () => {
    let draws = 0; const draw = (word: number) => () => { draws++; return word; };
    const auth = authorizeSpellCrit([], [], 2500, 14000);
    expect(rollCrit('basic', auth, draw(1073741823))).toBe(true);
    expect(rollCrit('basic', auth, draw(1073741824))).toBe(false); // 2^32*.25 exactly
    expect(rollCrit('basic', { ...auth, chanceBps: 0 }, draw(0))).toBe(false);
    expect(rollCrit('basic', { ...auth, chanceBps: 10000 }, draw(4294967295))).toBe(true);
    expect(draws).toBe(4);
  });
  it('draws only for authorized noninherited skill damage; equipment never inherits authorization', () => {
    let draws = 0; const draw = () => { draws++; return 0; };
    const plain = authorizeSpellCrit([], [], 2500, 14000), auth = authorizeSpellCrit([], [ie], 2500, 14000);
    expect(rollCrit('requires-spell-authorization', plain, draw)).toBe(false);
    expect(rollCrit('never', auth, draw)).toBe(false);
    expect(draws).toBe(0);
    expect(rollCrit('requires-spell-authorization', auth, draw)).toBe(true);
    expect(draws).toBe(1);
  });
  it('rejects forged authorization before consuming a random word', () => {
    let draws = 0;
    const auth = authorizeSpellCrit([], [], 2500, 14000);
    expect(() => rollCrit('basic', { ...auth, enabled: true }, () => { draws++; return 0; })).toThrow();
    expect(draws).toBe(0);
  });
});
