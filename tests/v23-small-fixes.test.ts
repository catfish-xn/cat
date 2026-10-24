import { describe, expect, it } from 'vitest';
import { projectG23Summons } from '../src/simulation/g2-3-summons';
import { claimGeneratedJson, isImmutableJson, shareGeneratedJson } from '../src/simulation/immutable-json';
import { createOpeningEncounter, OPENING_ENCOUNTER_CONFIG, validateOpeningEncounterContext } from '../src/simulation/opening-encounter';
import type { GameState } from '../src/simulation/game';
import type { TraitSnapshot } from '../src/simulation/strategy-types';

describe('v23 small fixes', () => {
  it('Sion belongs to the lowest numeric Black Rose serial: unit-9 before unit-10', () => {
    const rose = (id: string, col: number) => ({ id, definitionId: 'morgana', team: 'player' as const, starLevel: 1 as const, location: { kind: 'board' as const, cell: { col, row: 7 } } });
    const preparation = { units: [rose('unit-10', 0), rose('unit-9', 1), rose('unit-100', 2)] } as unknown as GameState;
    const traits: TraitSnapshot[] = [{ team: 'player', traitId: 'black-rose', count: 3, tier: 3, memberDefinitionIds: ['morgana'], memberUnitIds: ['unit-10', 'unit-9', 'unit-100'], targetUnitIds: [] }];
    const sion = projectG23Summons(preparation, traits).units.filter(u => u.definitionId === 'g23-sion');
    expect(sion.map(u => u.id)).toEqual(['unit-9:g23-sion']);
  });
  it('opening selection words of neighbouring small seeds are no longer one LCG step apart', () => {
    const encounters = new Set(Array.from({ length: 32 }, (_, seed) => createOpeningEncounter(seed).selection.encounterId));
    // v22's single LCG step drew crab-rave for every seed 0..31.
    expect(encounters.size).toBeGreaterThan(8);
    expect(OPENING_ENCOUNTER_CONFIG.version).toBe('opening-encounters-14.24b-batch-a-v2');
    expect(OPENING_ENCOUNTER_CONFIG.selection).toMatch(/^murmur3-fmix32-word\//);
    // A v1 context (old version string) is rejected outright, never re-derived into another encounter.
    const current = createOpeningEncounter(7);
    const v1 = { ...current, selection: { ...current.selection, configVersion: 'opening-encounters-14.24b-batch-a-v1' } };
    expect(() => validateOpeningEncounterContext(v1, 7)).toThrow('opening-context-mismatch');
  });
  it('claimGeneratedJson keeps the caller object and its shared children over a JSON-equal cache hit', () => {
    const child = shareGeneratedJson({ ledger: [1, 2, 3] });
    const older = shareGeneratedJson({ loot: { frozen: structuredClone(child) } });
    const fresh = claimGeneratedJson({ loot: { frozen: child } });
    expect(fresh).not.toBe(older);
    expect(fresh.loot.frozen).toBe(child);
    expect(Object.isFrozen(fresh.loot)).toBe(true);
    expect(isImmutableJson(fresh)).toBe(true);
    // The shared path still interns the earlier JSON-equal object.
    expect(shareGeneratedJson({ loot: { frozen: { ledger: [1, 2, 3] } } })).toBe(older);
  });
});
