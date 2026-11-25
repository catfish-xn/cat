/** Ability text of form swappers' back-row forms, Nunu's client name whitespace and the Experiment note's own line. */
import { beforeAll, expect, it } from 'vitest';
import { loadTooltipText } from '../src/presentation/tooltip-text-loader';
import { abilityFormIds, abilityNameOf, abilityText, formDefinitionId } from '../src/presentation/ability-text';

beforeAll(async () => { await loadTooltipText(); });

const SWAPPERS = ['elise', 'jayce', 'gangplank', 'swain'];

it('shows the back-row ability of every form swapper from the client table, with every token filled', () => {
  for (const id of SWAPPERS) {
    expect(abilityFormIds(id)).toEqual([id, `${id}-ranged`]);
    expect(formDefinitionId(id, 'ranged')).toBe(`${id}-ranged`);
    expect(formDefinitionId(id, 'melee')).toBe(id);
    expect(formDefinitionId(id, null)).toBe(id);
    for (const star of [1, 2, 3]) {
      const front = abilityText(id, star)!, back = abilityText(`${id}-ranged`, star)!;
      expect(back.unknown).toEqual([]);
      expect(back.name).not.toBe(front.name);
      expect(back.text).not.toBe(front.text);
      expect(back.text).not.toMatch(/[A-Za-z]{3}/);
    }
  }
});

it('keeps every other hero on its own ability', () => {
  expect(abilityFormIds('irelia')).toEqual(['irelia']);
  expect(formDefinitionId('irelia', 'ranged')).toBe('irelia');
  expect(abilityText('irelia-ranged', 2)).toBeNull();
});

it('drops the whitespace around client ability names (Nunu)', () => {
  const nunu = abilityText('nunu', 2)!;
  expect(nunu.name).toBe(nunu.name.trim());
  expect(nunu.name.length).toBeGreaterThan(0);
  expect(abilityNameOf('nunu')).toBe(nunu.name);
});

it('puts the Experiment line on a line of its own', () => {
  for (const id of ['nunu', 'urgot', 'zyra', 'twitch', 'drmundo']) {
    const text = abilityText(id, 2)!.text;
    expect(text.split('\n')).toContainEqual(expect.stringMatching(/^【试验品】加成：/));
  }
});
