import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { AUGMENT_D5 } from '../src/simulation/content/augment-pool-d5';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { AUGMENT_STAGE_BANS } from '../src/simulation/content/augment-stage-bans';
import { augmentApiName, augmentCandidates } from '../src/simulation/augment-offers';
import { augmentNeedsHistory } from '../src/simulation/augment-history-owners';
import { traceBoundUnitIdentity } from '../src/simulation/bound-unit-identity';
import { createMatch, startMatchCombat, startPlaceholderMatchCombat, stepMatch, stepPlaceholderMatchCombat, type MatchState } from '../src/simulation/match';
import { enableMultiplayerSettlement } from '../src/simulation/round-settlement';
import { atRound } from './d01-helpers';
import { applyRestartMission } from '../src/simulation/restart-mission';
import { projectG23Summons } from '../src/simulation/g2-3-summons';
import { augmentCardSections, augmentDisplayName, augmentIconOrBadgeHtml, augmentIconUrl } from '../src/presentation/augment-display';
import { loadAugmentText } from '../src/presentation/augment-text-loader';

const nodes = ['2-1', '3-2', '4-2'] as const;
const cases = [
  ['what-you-really-are', '真心本色', 'prismatic', 'TFT13_Augment_Grant6Cost_Warwick', ['4-2']],
  ['brb', '假装摸鱼', 'gold', 'TFT_Augment_BRB', ['2-1']],
  ['over-encumbered', '运力不足', 'silver', 'TFT11_Augment_OverEncumbered', ['2-1']],
  ['restart-mission', '重启任务', 'silver', 'TFT_Augment_RestartMission', ['3-2']],
] as const;

it.each(cases)('%s registers exactly its archive tier, API and offer stages', (id, name, tier, api, allowed) => {
  expect(AUGMENT_DEFINITIONS[id].name).toBe(name);
  expect(AUGMENT_TIERS[id]).toBe(tier); expect(augmentApiName(id)).toBe(api);
  for (const node of nodes) for (const t of ['silver', 'gold', 'prismatic'] as const)
    expect(augmentCandidates(t, [], [], null, { node, fieldedTraits: [], blocked: [] }).includes(id))
      .toBe(t === tier && (allowed as readonly string[]).includes(node));
  expect(AUGMENT_STAGE_BANS[api]).toEqual(nodes.filter(n => !(allowed as readonly string[]).includes(n)));
});

it.each([
  ['why-not-both', 'TFT13_Augment_Formswapper', ['2-1']],
  ['blood-brothers', 'TFT13_TeamupAugment_BloodBrothers', ['2-1', '4-2']],
  ['academic-research', 'TFT13_Augment_Academy', ['4-2']],
  ['forbidden-magic', 'TFT13_Augment_Cabal', ['2-1', '4-2']],
  ['natural-selection', 'TFT13_Augment_Experiment', ['2-1']],
] as const)('%s enforces the backlog stage bans after all rule spreads', (id, api, bans) => {
  expect(augmentApiName(id)).toBe(api); expect(AUGMENT_STAGE_BANS[api]).toEqual(bans);
  for (const node of nodes)
    expect(augmentCandidates(AUGMENT_TIERS[id], [], [], null, {
      node, fieldedTraits: ['form-swapper', 'family', 'watcher', 'dominator', 'academy', 'black-rose', 'experiment'], blocked: [],
    }).includes(id)).toBe(!(bans as readonly string[]).includes(node));
});

const archive = '/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
it.skipIf(!existsSync(archive))('copies raw tags verbatim and derives the same bans as the read-only research', () => {
  const rows = JSON.parse(readFileSync(archive, 'utf8')) as { apiName: string; tier: number; item_tags_raw: string[] }[];
  for (const row of Object.values(AUGMENT_D5)) {
    const source = rows.find(r => r.apiName === row.apiName)!;
    expect(row.item_tags_raw).toEqual(source.item_tags_raw);
    expect(row.tier).toBe(['silver', 'gold', 'prismatic'][source.tier - 1]);
  }
  for (const api of [...Object.values(AUGMENT_D5).map(r => r.apiName), 'TFT13_Augment_Formswapper',
    'TFT13_TeamupAugment_BloodBrothers', 'TFT13_Augment_Academy', 'TFT13_Augment_Cabal', 'TFT13_Augment_Experiment']) {
    const tags = rows.find(r => r.apiName === api)!.item_tags_raw;
    expect(AUGMENT_STAGE_BANS[api]).toEqual(nodes.filter((_, i) => tags.includes(['{d02ae323}', '{d12ae4b6}', '{d22ae649}'][i])));
  }
});

it('uses D0 authority for True Colors without retaining unrelated incoming-damage history', () => {
  expect(augmentNeedsHistory('what-you-really-are')).toBe(false);
  expect(augmentNeedsHistory('brb')).toBe(true);
});

it('retires bound identities after direct removal and after an upgrade survivor is removed', () => {
  const removed = { sequence: 1, roundId: '3-2', kind: 'unit-removed' as const, unitId: 'unit-2', receiptId: 'restart' };
  expect(traceBoundUnitIdentity('unit-2', [removed])).toBeNull();
  expect(traceBoundUnitIdentity('unit-1', [removed])).toBe('unit-1');
  expect(traceBoundUnitIdentity('unit-1', [{ sequence: 0, roundId: '3-2', kind: 'unit-upgraded', acquisitionSequence: 0,
    event: { type: 'unitUpgraded', definitionId: 'amumu', fromStar: 1, toStar: 2, location: { kind: 'bench', slot: 0 }, consumedIds: ['unit-1'], survivorId: 'unit-2' } }, removed])).toBeNull();
});

it('explicitly rejects a restart transaction during combat', () => {
  expect(() => applyRestartMission({ ...createMatch(42), phase: 'combat' } as MatchState)).toThrow('cannot clear a combat roster');
});

it('keeps ordinary multiplayer PvP start forbidden and scopes the placeholder entry to unlocked multiplayer PvP', () => {
  const solo = createMatch(42), multiplayer = enableMultiplayerSettlement(solo, 'placeholder-test').state;
  const pvp = atRound(multiplayer, '2-1');
  expect(startMatchCombat(pvp)).toEqual({ ok: false, state: pvp, reason: 'wrong-phase' });
  const started = startPlaceholderMatchCombat(pvp); expect(started.ok).toBe(true);
  expect(stepMatch(started.state)).toEqual({ state: started.state, events: [] });
  const stepped = stepPlaceholderMatchCombat(started.state); expect(stepped.ok).toBe(true);
  expect(stepped.state).not.toBe(started.state);
  for (const state of [solo, multiplayer, { ...pvp, multiplayer: { ...pvp.multiplayer!, combatRosterLocked: true as const } }])
    {
      expect(startPlaceholderMatchCombat(state)).toEqual({ ok: false, state, reason: 'wrong-phase' });
      expect(stepPlaceholderMatchCombat(state)).toEqual({ ok: false, state, reason: 'wrong-phase' });
    }
});

it('explicitly rejects an active Black Rose trait without any fielded member', () => {
  const state = createMatch(42);
  expect(() => projectG23Summons({ ...state.preparation, units: [] }, [
    { team: 'player', traitId: 'black-rose', count: 3, tier: 3, memberDefinitionIds: ['morgana'], targetUnitIds: [] },
  ])).toThrow('Black Rose summon requires a fielded member');
});

it.each(['player', 'enemy'] as const)('requires an actual %s board member at every active Black Rose tier', team => {
  const state = createMatch(42);
  const preparation = { ...state.preparation, units: [
    { id: 'bench-rose', definitionId: 'morgana', team, starLevel: 1 as const, location: { kind: 'bench' as const, slot: 0 } },
  ] };
  for (const tier of [3, 4, 5, 7]) {
    const trait = { team, traitId: 'black-rose', count: tier, tier, memberDefinitionIds: ['morgana'], memberUnitIds: ['bench-rose'], targetUnitIds: [] };
    expect(() => projectG23Summons(preparation, [trait])).toThrow(RangeError);
    expect(() => projectG23Summons(preparation, [trait])).toThrow('Black Rose summon requires a fielded member');
  }
  expect(projectG23Summons(preparation, [])).toBe(preparation);
});

it('supplies shared 2D/3D Chinese card text and the existing missing-icon fallback', async () => {
  await loadAugmentText();
  for (const [id, name] of cases) {
    expect(augmentDisplayName(id)).toBe(name);
    const body = augmentCardSections(id, { values: [12] }).body;
    expect(body.length).toBeGreaterThan(20); expect(body).not.toContain('acquisitionBundle');
    const icon = augmentIconUrl(id), html = augmentIconOrBadgeHtml(id, 24);
    expect(html).toContain(icon ? '<img' : name[0]);
  }
  expect(augmentCardSections('what-you-really-are', { values: [12] }).body).toContain('12/35');
  expect(augmentCardSections('brb').body).toContain('自动解锁');
});
