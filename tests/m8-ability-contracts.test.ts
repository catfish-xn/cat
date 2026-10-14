import { describe, expect, it } from 'vitest';
import { S13_ABILITY_DATA } from '../src/simulation/content/abilities';
import { abilityPlans, type Champion } from './fixtures/m8-ability-plans';
import type { AbilityPlan, ActionTask } from '../src/simulation/m8/contracts';
const tasks = (p: AbilityPlan): readonly ActionTask[] => p.operations.flatMap(op => op.kind === 'schedule' ? op.tasks : []);
const encoded = (name: Champion) => JSON.stringify(abilityPlans[name]);

describe('all existing champion mechanisms remain representable (data contracts only)', () => {
  it('covers the actual nineteen-entry content roster exactly', () => {
    expect(Object.keys(abilityPlans).map(id => `${id}-ability`).sort()).toEqual(Object.keys(S13_ABILITY_DATA).sort());
  });
  const checks: Record<Champion, () => void> = {
    irelia: () => {
      expect(abilityPlans.irelia.operations[0]).toMatchObject({ effects: [{ durationTicks: 60, decay: { kind: 'linear-initial-grant' }, endTiming: 'next-action-planning', endTargeting: { kind: 'select', selector: { radius: 1 } }, endEffects: [{ amount: { shieldAbsorbedBps: 3000 } }] }] });
    },
    maddie: () => {
      expect(tasks(abilityPlans.maddie).map(t => t.executeAtTick - t.committedAtTick)).toEqual([0, 4, 9, 13, 18, 23]);
      expect(tasks(abilityPlans.maddie)[0]).toMatchObject({ onControl: 'cancel', targeting: { kind: 'path', aimId: 'A', intercept: 'first-enemy', fallback: 'farthest-enemy' } });
    },
    darius: () => {
      const ticks = tasks(abilityPlans.darius);
      expect(ticks.map(t => t.executeAtTick)).toEqual([30, 50, 70, 90]);
      expect(ticks.every(t => t.onSourceDeath === 'persist' && t.onControl === 'continue')).toBe(true);
      expect(new Set(ticks.map(t => t.replaceGroup)).size).toBe(1);
      expect(encoded('darius')).toContain('ability-periodic');
      expect(encoded('darius')).toContain('"flat":26'); // exact total101 distributed26+25+25+25
    },
    lux: () => {
      expect(abilityPlans.lux.operations[0]).toMatchObject({ targeting: { selector: { relation: 'ally', excludeSelf: false, order: 'hp-absolute-distance-id' } } });
      expect(abilityPlans.lux.operations[1]).toMatchObject({ armed: { mode: 'append-ability-packet', consume: 'next-completed-attack', usesBasicCrit: false } });
    },
    zyra: () => {
      expect(abilityPlans.zyra.cast.targetIds).toEqual(['A', 'B', 'C']);
      expect(abilityPlans.zyra.operations[1]).toMatchObject({ targeting: { selector: { anchor: 'holder', maxTargets: 2, excludePrimary: true } } });
      expect(encoded('zyra')).toContain('"ticks":20');
    },
    tristana: () => expect(abilityPlans.tristana.operations[1]).toMatchObject({ kind: 'overkill-next-tick', inherit: 'after-mitigation', oncePerAction: true, freezeTargetOnCommit: true, recursive: false, growthOnCommitBps: 125 }),
    urgot: () => {
      expect(abilityPlans.urgot.operations[0]).toMatchObject({ targeting: { selector: { anchor: 'primary-target', radius: 1 } }, primaryEffects: [{ damageType: 'physical' }, { status: { kind: 'sunder', magnitudeBps: 2000, activation: 'next-tick', duration: { ticks: 120 } } }] });
    },
    rell: () => expect(abilityPlans.rell.operations[1]).toMatchObject({ targeting: { kind: 'path', intercept: 'all-enemies' }, effects: [{}, { kind: 'transfer-stat', activation: 'next-tick', stats: ['armor', 'magicResist'], applicationIdentity: 'action-target', persistAfterTargetDeath: true, duration: { ticks: 1200 } }] }),
    leona: () => {
      expect(abilityPlans.leona.operations[0]).toMatchObject({ effects: [{ status: { activation: 'immediate', duration: { ticks: 60 } } }] });
      expect(tasks(abilityPlans.leona)[0]).toMatchObject({ executeAtTick: 70, onSourceDeath: 'cancel', onControl: 'continue' });
    },
    vander: () => {
      expect(abilityPlans.vander.operations[0]).toMatchObject({ kind: 'channel', endsAtTick: 60 });
      expect(abilityPlans.vander.operations[2]).toMatchObject({ armed: { mode: 'replace-basic', usesBasicCrit: true, blocksRecast: true } });
      expect(abilityPlans.vander.snapshots.lowCostAllyCount).toBe(2);
    },
    kogmaw: () => {
      expect(abilityPlans.kogmaw.triggers[0]).toMatchObject({ gate: { kind: 'every-n', everyN: 3 }, effects: [{ modifier: { stat: 'range', unit: 'hexes' } }] });
      expect(abilityPlans.kogmaw.triggers[1]).toMatchObject({ event: 'attack-completed', selector: { candidates: 'event-target' }, effects: [{ damageType: 'magic', delivery: 'ability-direct' }] });
    },
    scar: () => expect(abilityPlans.scar.operations[0]).toMatchObject({ targeting: { selector: { maxTargets: 3, order: 'distance-id' } }, effects: [{}, { status: { kind: 'stun', duration: { ticks: 30 } } }] }),
    ezreal: () => {
      expect(abilityPlans.ezreal.cast.targetIds).toEqual(['A', 'B', 'A']);
      expect(abilityPlans.ezreal.operations).toHaveLength(2);
    },
    loris: () => {
      expect(abilityPlans.loris.operations[1]).toMatchObject({ kind: 'redirect', shareBps: 5000, allyRadius: 1, choose: 'lowest-id', repeatMitigation: false, recursive: false });
      expect(tasks(abilityPlans.loris)[0]).toMatchObject({ executeAtTick: 90, targeting: { kind: 'area-around-selected', radius: 1 } });
    },
    nami: () => expect(abilityPlans.nami.operations[0]).toMatchObject({ targeting: { kind: 'chain', radius: 3, additionalTargets: 3, order: 'nearest-previous', distinctSecondary: true } }),
    corki: () => {
      expect(tasks(abilityPlans.corki)).toHaveLength(21);
      expect(tasks(abilityPlans.corki)[6]).toMatchObject({ executeAtTick: 16, targeting: { kind: 'round-robin', radius: 2, ordinal: 6 }, payload: { operations: [{ targeting: { kind: 'bound-selection' }, effects: [{ amount: { flat: 700 } }, { activation: 'next-tick', modifier: { stat: 'armor', value: { amount: -7 } } }] }] } });
    },
    garen: () => expect(abilityPlans.garen.triggers[0]).toMatchObject({ event: 'damage-dealt', aggregation: 'action-damage-total', condition: { kind: 'positive-hp-damage' }, maxPerAction: 1 }),
    zoe: () => {
      expect(abilityPlans.zoe.cast.targetIds).toEqual(['A', 'B', 'A', 'C', 'A']);
      expect(abilityPlans.zoe.operations[0]).toMatchObject({ targeting: { kind: 'chain', radius: 4, order: 'farthest-from-primary-return-primary', distinctSecondary: true } });
    },
    caitlyn: () => {
      expect(tasks(abilityPlans.caitlyn).map(t => t.executeAtTick - 10)).toEqual([0, 25, 50, 75]);
      expect(tasks(abilityPlans.caitlyn)[0]).toMatchObject({ targeting: { kind: 'random-enemy-center', draws: 1, mapping: 'word-modulo-id-sorted-count' }, payload: { operations: [{ kind: 'center-and-area', center: { kind: 'bound-selection' }, centerEffects: [{ amount: { attackDamageBps: 20000, sample: 'packet' } }, { modifier: { stat: 'armor' } }, { modifier: { stat: 'magicResist' } }] }] } });
    },
  };
  it.each(Object.keys(checks) as Champion[])('%s has a serializable plan preserving its distinctive mechanisms', name => {
    expect(JSON.parse(encoded(name))).toEqual(abilityPlans[name]);
    checks[name]();
  });
  it('supports higher-star finite counts without a new targeting or task kind', () => {
    const base = tasks(abilityPlans.caitlyn)[0];
    const thirdStar: readonly ActionTask[] = Array.from({ length: 20 }, (_, i) => ({ ...base, key: `caitlyn:3:${i}`, ordinal: i, executeAtTick: 10 + Math.floor(i * 100 / 20) }));
    expect(thirdStar.map(t => t.executeAtTick - 10)).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95]);
    expect(S13_ABILITY_DATA['caitlyn-ability'].variables.TotalShots[2]).toBe(thirdStar.length);
    expect(S13_ABILITY_DATA['corki-ability'].variables.BaseMissiles[2]).toBe(35);
  });
});
