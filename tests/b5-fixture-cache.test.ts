import { afterEach, expect, it } from 'vitest';
import { fieldedRoute, resetFieldedRouteCache } from './augment-stage-helpers';
import { reachRoundFielded } from './match-helpers';
import { withB1Offers } from './fixtures/b1-scripted-offers';
import { publicEquipmentPreparation } from './fixtures/b8-public-equipment';
import { CompletedBattleHistory } from './fixtures/completed-battle-history';

afterEach(resetFieldedRouteCache);

it('fielded route keys include scripted draws across scopes in the same worker', () => {
  resetFieldedRouteCache();
  const natural = fieldedRoute(42, '2-1');
  expect(natural.pendingChoice?.offers).not.toContain('fractured-crystals');
  withB1Offers(['fractured-crystals'], () => {
    const cached = fieldedRoute(42, '2-1');
    resetFieldedRouteCache();
    const rebuilt = fieldedRoute(42, '2-1');
    const fresh = reachRoundFielded('2-1', 42);
    // Scripted-offer fixture self-check, not a claim about a natural draw.
    expect(fresh.pendingChoice?.offers).toContain('fractured-crystals');
    expect(rebuilt).toEqual(fresh);
    expect(cached).toEqual(rebuilt);
  });
  expect(fieldedRoute(42, '2-1')).toEqual(natural);
  resetFieldedRouteCache();
});

it('B8 preparation separates draw policies and agrees with uncached recorded construction', () => {
  const components = ['gloves'], options = { earliestRound: 4, augmentPriorities: ['fractured-crystals'] };
  const natural = publicEquipmentPreparation(components, options);
  withB1Offers(options.augmentPriorities, () => {
    const scripted = publicEquipmentPreparation(components, options);
    // Scripted acquisition self-check, not a natural-RNG assertion.
    expect(scripted.augments[0].definitionId).toBe('fractured-crystals');
    expect(scripted).not.toEqual(natural);
    const recorded = publicEquipmentPreparation(components, { ...options, history: new CompletedBattleHistory('b5-cache') });
    expect(recorded).toEqual(scripted);
    expect(publicEquipmentPreparation(components, options)).toEqual(scripted);
  });
  expect(publicEquipmentPreparation(components, options)).toEqual(natural);
});
