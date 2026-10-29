import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { augmentApiName } from '../src/simulation/augment-offers';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { augmentCardSections, augmentPlayerDescription } from '../src/presentation/augment-display';
import { AUGMENT_AUDITED_DESCRIPTIONS } from '../src/presentation/augment-pool-text';
import { loadAugmentText } from '../src/presentation/augment-text-loader';
import { loadTooltipText } from '../src/presentation/tooltip-text-loader';

const RESEARCH_FILE = '/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
// The 73 missing descriptions observed at 2dc80444. Keep the regression set independent of the UI map.
const formerlyMissing = [
  'anger-issues', 'another-anomaly', 'firesale', 'rigged-shop-plus',
  'reinfourcement', 'subscription-service', 'shop-glitch', 'two-much-value',
  'lucky-gloves', 'lucky-gloves-plus', 'no-scout-no-pivot', 'cooking-pot',
  'recombobulator', 'pandoras-bench', 'survivor', 'diversified-portfolio-plus',
  'diversified-portfolio', 'table-scraps', 'young-and-wild-and-free', 'scoreboard-scrapper',
  'contested', 'all-that-shimmers', 'all-that-shimmers-plus', 'roll-the-dice',
  'beggars-can-be-choosers', 'power-up', 'reroll-transfer', 'at-what-cost',
  'component-buffet', 'pandoras-items', 'fine-vintage', 'salvage-bin',
  'pandoras-items-ii', 'replication', 'quality-over-quantity', 'tiniest-titan',
  'tiniest-titan-plus', 'pilfer', 'glorious-evolution', 'hard-commit',
  'moonlight', 'greater-moonlight', 'titanic-titan', 'lunch-money',
  'good-for-something', 'dhampyr', 'mirrored-monetization', 'forward-thinking',
  'trait-tracker', 'sponging', 'scavenger', 'max-cap',
  'head-start', 'salvage-bin-plus', 'artifactory', 'pandoras-items-iii',
  'a-golden-find', 'tomb-raider-1', 'tomb-raider-2', 'cloning-facility',
  'hall-of-mirrors', 'ghost-of-friends-past', 'voidcaller', 'void-swarm',
  'expected-unexpectedness', 'prismatic-pipeline', 'im-the-carry-now', 'bulky-buddies-ii',
  'bulky-buddies-iii', 'placebo-plus', 'find-your-center', 'built-different',
  'inspiring-epitaph',
] as const;

beforeAll(() => Promise.all([loadAugmentText(), loadTooltipText()]));

it('gives every enabled augment player text without source tokens or internal identifiers', () => {
  const enabled = Object.keys(AUGMENT_DEFINITIONS).filter(id => AUGMENT_TIERS[id]);
  expect(enabled.length).toBeGreaterThan(0);
  const internalNames = [...new Set(Object.keys(AUGMENT_DEFINITIONS).flatMap(id => [id, augmentApiName(id)]))];
  for (const id of enabled) {
    const description = augmentPlayerDescription(id);
    expect(description, id).not.toBeNull();
    expect(description?.trim().length, id).toBeGreaterThan(0);
    expect(description, id).not.toMatch(/@|〔对局动态值〕|TFT\w*_|s13P\d|说明加载/);
    for (const internal of internalNames) expect(description, `${id}: ${internal}`).not.toContain(internal);
  }
});

it.each(formerlyMissing)('restores %s through both lazy player and card paths', id => {
  expect(formerlyMissing).toHaveLength(73);
  expect(AUGMENT_TIERS[id], id).toBeDefined();
  const template = AUGMENT_AUDITED_DESCRIPTIONS[id];
  expect(template, id).toBeTypeOf('string');
  const expected = template.replace(/〔对局动态值〕/g, '未确定');
  expect(augmentPlayerDescription(id), id).toBe(expected);
  expect(augmentCardSections(id).body, id).toBe(expected);
});

it.skipIf(!existsSync(RESEARCH_FILE))('matches all audited templates verbatim to the independent 14.24 archive', () => {
  const archive = JSON.parse(readFileSync(RESEARCH_FILE, 'utf8')) as { apiName: string; description_zh_cn: string }[];
  const byApi = new Map(archive.map(row => [row.apiName, row.description_zh_cn]));
  for (const id of formerlyMissing) expect(Object.hasOwn(AUGMENT_AUDITED_DESCRIPTIONS, id), id).toBe(true);
  for (const [id, template] of Object.entries(AUGMENT_AUDITED_DESCRIPTIONS)) {
    const official = byApi.get(augmentApiName(id));
    expect(official, `${id}: missing archive row`).toBeTypeOf('string');
    expect(template, `${id}: official template`).toBe(official);
    expect(augmentPlayerDescription(id), `${id}: official display`).toBe(official!.replace(/〔对局动态值〕/g, '未确定'));
  }
});

it('fills each newly exposed dynamic slot in archive order, including zero and missing values', () => {
  const dynamicIds = formerlyMissing.filter(id => AUGMENT_AUDITED_DESCRIPTIONS[id]?.includes('〔对局动态值〕'));
  expect(dynamicIds).toEqual(['diversified-portfolio-plus', 'diversified-portfolio', 'glorious-evolution', 'lunch-money', 'forward-thinking', 'ghost-of-friends-past']);
  for (const id of dynamicIds) {
    const template = AUGMENT_AUDITED_DESCRIPTIONS[id];
    const values = [...template.matchAll(/〔对局动态值〕/g)].map((_, index) => index === 0 ? 0 : index + 0.8);
    let index = 0;
    const expected = template.replace(/〔对局动态值〕/g, () => String(values[index++]));
    expect(augmentPlayerDescription(id, { values }), id).toBe(expected);
    expect(augmentCardSections(id, { values }).body, id).toBe(expected);
    expect(augmentPlayerDescription(id, { values: [null] }), id).toBe(template.replace(/〔对局动态值〕/g, '未确定'));
  }
});
