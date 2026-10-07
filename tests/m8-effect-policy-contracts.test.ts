import { describe, expect, it } from 'vitest';
import { abilityPlans, type Champion } from './fixtures/m8-ability-plans';
import { shiv, titan, nashor } from './fixtures/m8-audit-definitions';
import type { Effect } from '../src/simulation/m8/contracts';

// Walk finite fixture data only; this does not execute an effect or infer a policy.
function policies(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(policies);
  if (!value || typeof value !== 'object') return [];
  const o = value as Record<string, unknown>;
  let own: string[] = [];
  if (o.kind === 'modify-stat') {
    const effect = o as unknown as Extract<Effect, { kind: 'modify-stat' }>;
    own = [`${effect.modifier.stat}:${effect.activation}:${effect.stackPolicy.kind}`];
  }
  if (o.kind === 'apply-status') {
    const { status } = o as unknown as Extract<Effect, { kind: 'apply-status' }>;
    own = [`${status.kind}:${status.activation}:${status.stackPolicy.kind}`];
  }
  if (o.kind === 'transfer-stat') own = [`transfer-stat:${o.activation}:action-target`];
  return [...own, ...Object.values(o).flatMap(policies)];
}
// One expectation per champion; every explicit activation in the complete nested plan is covered.
const expected: Record<Champion, readonly string[]> = {
  irelia: [], maddie: [], darius: [], lux: [], zyra: ['stun:next-tick:refresh-same-instance'], tristana: [],
  urgot: ['sunder:next-tick:strongest-category', 'sunder:next-tick:strongest-category'],
  rell: ['transfer-stat:next-tick:action-target'], leona: ['damage-reduction:immediate:strongest-category'],
  vander: ['armor:immediate:refresh-same-instance', 'magicResist:immediate:refresh-same-instance'],
  kogmaw: ['attackSpeed:immediate:add-stacks', 'range:immediate:add-stacks'], scar: ['stun:next-tick:refresh-same-instance'],
  ezreal: [], loris: [], nami: [], corki: Array(21).fill('armor:next-tick:independent-instances'), garen: [], zoe: [],
  caitlyn: Array.from({ length: 4 }, () => ['armor:next-tick:independent-instances', 'magicResist:next-tick:independent-instances']).flat(),
};
describe('R4 exhaustive explicit activation/stack declarations in the19 plans', () => {
  it.each(Object.keys(expected) as Champion[])('%s matches old behavior and the main timing exceptions', name => {
    expect(policies(abilityPlans[name])).toEqual(expected[name]);
  });
  it('equipment declarations use the same explicitly reviewed timing and stack policies', () => {
    expect(policies(shiv)).toEqual(['shred:immediate:strongest-category']);
    expect(policies(titan)).toEqual(['armor:next-tick:independent-instances', 'magicResist:next-tick:independent-instances']);
    expect(policies(nashor)).toEqual(['attackSpeed:next-tick:refresh-same-instance']);
  });
});
