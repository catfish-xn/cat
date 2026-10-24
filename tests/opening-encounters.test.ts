import { describe, expect, it } from 'vitest';
import { OPENING_ENCOUNTERS, OPENING_ENCOUNTER_CONFIG, createOpeningEncounter, selectOpeningEncounterFromWord,
  validateOpeningEncounterConfig, validateOpeningEncounterContext, planOpeningRound } from '../src/simulation/opening-encounter';
import { RULES_GAP_MANIFEST } from '../src/simulation/content/rules-manifest';
import { CONTENT_DIGEST, LOOT_REPLAY_DIGEST } from '../src/simulation/content/identity-constants';
import { recomputeContentDigest } from '../scripts/content-digest';
import { recomputeLootReplayDigest } from '../scripts/loot-replay-digest';

// Independent BigInt specification: no production hash/LCG/selection helper calls.
function oracle(seed: number) {
  let h = 2166136261n;
  for (const ch of 'opening-encounter-v1/select') h = ((h ^ BigInt(ch.charCodeAt(0))) * 16777619n) & 0xffffffffn;
  const word = (((BigInt(seed) ^ h) * 1664525n) + 1013904223n) & 0xffffffffn;
  return {word: Number(word), ticket: Number(word * 10000n / 4294967296n)};
}
const weights = [1000,750,250,1000,500,600,400,400,400,400,500,1000,800,800,800,400];

describe('opening encounter PR1 content and independent selection', () => {
  it('preserves all sixteen official 14.24b intervals and explicit disabled identities', () => {
    expect(OPENING_ENCOUNTERS).toHaveLength(16);
    expect(OPENING_ENCOUNTERS.map(e => e.weightBps)).toEqual(weights);
    expect(weights.reduce((a,b) => a+b,0)).toBe(10000);
    expect(new Set(OPENING_ENCOUNTERS.map(e => e.id)).size).toBe(16);
    // Opening batches A/B (v22) enable every entry.
    expect(OPENING_ENCOUNTERS.filter(e => e.enabled).map(e => e.id)).toEqual(OPENING_ENCOUNTERS.map(e => e.id));
    expect(OPENING_ENCOUNTERS.map(e => e.nameEn)).toEqual(['No encounter','Scuttle Puddle','Crab Rave','Golden Gala',
      'Prismatic Party','Prismatic Prelude','Prismatic Finale','Gold Subscription','Loot Subscription','Trainer Golems',
      'Wind-up Monkey','Component Anvils',"Viktor's Vision","Mel's Blessing","Warwick's Hunger",'Artifact Anvil']);
    for (const [i,e] of OPENING_ENCOUNTERS.entries()) {
      expect(e.sourcePath).toBe(`encounters[${i}]`);
      expect(e.nameZh.length).toBeGreaterThan(0);
      expect(e.encounterId).toMatch(/^TFT/); expect(e.portalId).toMatch(/^TFT/);
      expect(Object.isFrozen(e)).toBe(true);
      // Both batches now enable every entry; retain this check for future blocked content.
      const readiness: string = e.readiness;
      if (readiness === 'blocked-evidence') expect(e.missingEvidence.length).toBeGreaterThan(0);
    }
    expect(OPENING_ENCOUNTERS[0].champion).toBeNull();
    expect(OPENING_ENCOUNTERS[7].researchParameters).toMatchObject({amount_by_stage_and_bucket:null});
  });
  it('covers every Bps ticket, both sides of every boundary, word zero and uint32 max', () => {
    const counts = new Map<string, number>();
    for (let ticket=0;ticket<10000;ticket++) {
      const word = Number((BigInt(ticket)*4294967296n+9999n)/10000n);
      const id = selectOpeningEncounterFromWord(word);
      counts.set(id,(counts.get(id)??0)+1);
    }
    expect(OPENING_ENCOUNTERS.map(e => counts.get(e.id))).toEqual(weights);
    let end=0;
    for (const [i,e] of OPENING_ENCOUNTERS.entries()) {
      end+=e.weightBps;
      const boundary = Number((BigInt(end)*4294967296n+9999n)/10000n);
      expect(selectOpeningEncounterFromWord(boundary-1)).toBe(e.id);
      if (i<15) expect(selectOpeningEncounterFromWord(boundary)).toBe(OPENING_ENCOUNTERS[i+1].id);
    }
    expect(selectOpeningEncounterFromWord(0)).toBe('none');
    expect(selectOpeningEncounterFromWord(0xffffffff)).toBe('artifact-anvil');
  });
  it('matches independent uint32 derivation and deterministic stratified distribution', () => {
    const counts = new Map<string,number>();
    for (let i=0;i<65536;i++) {
      const seed = Math.imul(i,2654435761)>>>0;
      const expected=oracle(seed), actual=createOpeningEncounter(seed);
      expect(actual.selectionRng).toEqual({state:expected.word,draws:1});
      let index=0, end=weights[0]; while(expected.ticket>=end) end+=weights[++index];
      expect(actual.selection.encounterId).toBe(OPENING_ENCOUNTERS[index].id);
      counts.set(actual.selection.encounterId,(counts.get(actual.selection.encounterId)??0)+1);
    }
    for (const e of OPENING_ENCOUNTERS) expect(Math.abs(counts.get(e.id)!/65536-e.weightBps/10000)).toBeLessThan(0.002);
    for (const seed of [0,42,0xffffffff]) expect(createOpeningEncounter(seed)).toEqual(createOpeningEncounter(seed));
  });
  it('rejects incomplete/reordered/enabled configs without altering the supplied input', () => {
    for (const mutate of [
      (c:any) => c.entries.pop(), (c:any) => c.entries.reverse(), (c:any) => c.entries[1].enabled=false,
      (c:any) => c.entries[0].weightBps=1001, (c:any) => c.version='unknown',
    ]) {
      const config:any=structuredClone(OPENING_ENCOUNTER_CONFIG); mutate(config);
      const before=JSON.stringify(config);
      expect(() => createOpeningEncounter(42,config)).toThrow('opening-config-incomplete');
      expect(JSON.stringify(config)).toBe(before);
    }
    expect(() => validateOpeningEncounterConfig(structuredClone(OPENING_ENCOUNTER_CONFIG))).not.toThrow();
    for (const seed of [-1,0.5,4294967296,NaN]) expect(() => createOpeningEncounter(seed)).toThrow(RangeError);
  });
  it('rejects forged selection, RNG, facts and invalid round nodes', () => {
    const context=createOpeningEncounter(42);
    for (const patch of [{selectionRng:{state:0,draws:1}}, {facts:[{factId:'fake'}]}, {seed:1},
      {selection:{...context.selection,encounterId:'unknown'}}, {selectionRng:{...context.selectionRng,draws:2}}])
      expect(() => validateOpeningEncounterContext({...context,...patch},42)).toThrow('opening-context-mismatch');
    expect(planOpeningRound(context,'1-2')).toEqual({context,facts:[]});
    expect(planOpeningRound(context,'1-2').context).toBe(context);
    expect(() => planOpeningRound(context,'1-1')).toThrow('invalid-opening-effect');
  });
  it('keeps context authentication tied to the seed and rechecks mutable or shallow-frozen inputs', () => {
    const context = createOpeningEncounter(42);
    validateOpeningEncounterContext(context, 42);
    validateOpeningEncounterContext(context, 42);
    expect(() => validateOpeningEncounterContext(context, 43)).toThrow('opening-context-mismatch');
    expect(() => validateOpeningEncounterContext(context, undefined as unknown as number)).toThrow(RangeError);
    for (const shallow of [false, true]) {
      const copy = structuredClone(context);
      if (shallow) Object.freeze(copy);
      validateOpeningEncounterContext(copy, 42);
      (copy.selectionRng as {state:number}).state ^= 1;
      expect(() => validateOpeningEncounterContext(copy, 42)).toThrow('opening-context-mismatch');
    }
  });
  it('includes the full table and conventions in both freshly recomputed digests', () => {
    expect(RULES_GAP_MANIFEST.openingEncounters).toBe(OPENING_ENCOUNTER_CONFIG);
    expect(recomputeContentDigest()).toBe(CONTENT_DIGEST);
    expect(recomputeLootReplayDigest()).toBe(LOOT_REPLAY_DIGEST);
  });
});
