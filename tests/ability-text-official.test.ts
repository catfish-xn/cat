/** Six-cost heroes and Sevika's three spells show the 14.24 zh_cn client text, every token filled from the rules. */
import { beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { loadTooltipText } from '../src/presentation/tooltip-text-loader';
import { abilityText } from '../src/presentation/ability-text';
import { ABILITY_ZH } from '../src/presentation/ability-zh';
import { abilityDisplayValues } from '../src/simulation/ability-display';
import { createMatch } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents } from '../src/simulation/combat';
import { g23Laboratories } from '../src/simulation/g2-3-experiment';
import { g23ExperimentProgram } from '../src/simulation/g2-3-programs';
import type { MatchState } from '../src/simulation/match-types';
import type { Unit } from '../src/simulation/unit-types';

beforeAll(async () => { await loadTooltipText(); });

it('fills every client token for Mel, Warwick, Viktor and Sevika at each star level, with no project jargon', () => {
  for (const id of ['mel', 'warwick', 'viktor', 'sevika']) {
    expect(Object.hasOwn(ABILITY_ZH, `${id}-ability`)).toBe(true);
    for (const star of [1, 2, 3]) {
      const text = abilityText(id, star)!;
      expect(text.unknown).toEqual([]);
      expect(text.text).not.toMatch(/魔改|PvP|项目约定|执行约定/);
      expect(text.text).not.toMatch(/[A-Za-z]{2}/);
    }
  }
});

it('shows the body of each of Sevika\'s three spells and of the Jackpot, not only their names', () => {
  const lines = abilityText('sevika', 2)!.text.split('\n').filter(Boolean);
  expect(lines).toHaveLength(5);
  for (const line of lines.slice(1)) expect(line).toMatch(/^[^：]+：.*\d+ \(攻击力\)物理伤害|^[^：]+：.*\d+ \(攻击力\)真实伤害/);
  expect(lines[4]).toMatch(/^头奖：/);
});

it('describes project-defined units in plain Chinese, without project jargon', () => {
  for (const id of ['s13-crab', 's13-wolf', 's13-mini', 'training-dummy', 'tower-dummy', 'g23-sion']) {
    const text = abilityText(id, 1)!.text;
    expect(text).not.toMatch(/魔改|项目约定|执行约定/);
    expect(text).not.toMatch(/[A-Za-z]{2}/);
  }
});

it('replaces the client phrases our rules do not follow with what they do', () => {
  expect(abilityText('warwick', 2)!.text).toContain('每秒对邻格的敌人们造成');
  expect(abilityText('warwick', 2)!.text).not.toContain('每秒对目标造成');
  expect(abilityText('sevika', 2)!.text).toContain('目标邻格的敌人们受到物理伤害');
  expect(abilityText('sevika', 2)!.text).not.toContain('锥形');
  expect(abilityText('sevika', 2)!.text).not.toContain('战利品');
});

it('keeps the generated client table current', () => {
  expect(() => execFileSync(process.execPath, ['src/presentation/client-tables/generate.mjs', '--check'], { stdio: 'pipe' })).not.toThrow();
}, 30_000);

const EXPERIMENTS = ['warwick', 'nunu', 'zyra', 'urgot', 'twitch', 'drmundo'];

it('shows each Experiment hero\'s Laboratory bonus instead of a "not enabled" note', () => {
  for (const id of EXPERIMENTS) for (const star of [1, 2, 3]) {
    const text = abilityText(id, star)!;
    expect(text.unknown).toEqual([]);
    expect(text.text).not.toContain('未启用');
    expect(text.text.split('\n')).toContainEqual(expect.stringMatching(/^【试验品】加成：.*\d/));
  }
  expect(abilityText('urgot', 2)!.text).not.toContain('位移');
  expect(abilityText('drmundo', 2)!.text).not.toContain('参与击杀');
});

it('shows the Laboratory bonus values the rules grant (base tier)', () => {
  // Every Experiment stands on a Laboratory of a 6-Experiment board, so each donates its bonus (rules: g2-3-experiment.ts).
  const lab = (onLab: readonly string[]) => {
    const state = createMatch(42), labs = g23Laboratories(42, 'player', 6);
    const taken = new Set(labs.map(cell => `${cell.col}:${cell.row}`));
    const free = Array.from({ length: 28 }, (_, i) => ({ col: i % 7, row: 4 + Math.floor(i / 7) })).filter(cell => !taken.has(`${cell.col}:${cell.row}`));
    const rest = EXPERIMENTS.filter(id => !onLab.includes(id));
    const units: Unit[] = [...onLab.map((id, i) => ({ id, definitionId: id, team: 'player' as const, starLevel: 1 as const, location: { kind: 'board' as const, cell: labs[i] } })),
      ...rest.map((id, i) => ({ id, definitionId: id, team: 'player' as const, starLevel: 1 as const, location: { kind: 'board' as const, cell: free[i] } })),
      { id: 'enemy', definitionId: 'garen', team: 'enemy', starLevel: 1, location: { kind: 'board', cell: { col: 6, row: 0 } } }];
    const match = { ...state, preparation: { ...state.preparation, units } } as MatchState;
    const combat = createCombatWithEvents(match.preparation, buildStrategySnapshot(match), 'lab', 42).state;
    return combat.units.find(unit => unit.id === onLab[0])!.mechanics!.find(m => m.mechanic === 'g23Experiment')!.values;
  };
  // Two boards cover the six (three Laboratories each); a hero not on a Laboratory donates 0, so take the larger value.
  const first = lab(['warwick', 'nunu', 'zyra']), second = lab(['urgot', 'twitch', 'drmundo']);
  const granted = Object.fromEntries([...new Set([...Object.keys(first), ...Object.keys(second)])]
    .map(key => [key, Math.max(first[key] ?? 0, second[key] ?? 0)])) as Record<string, number>;
  for (const key of ['warwick', 'nunu', 'zyra', 'urgot', 'twitch', 'mundo']) expect(granted[key]).toBeGreaterThan(0);
  const program = g23ExperimentProgram({ nunu: granted.nunu, urgot: granted.urgot, twitch: granted.twitch }).triggers!;
  const trigger = (id: string) => program.find(t => t.id === id)!;
  const urgot = trigger('lab-urgot').effects, nunu = trigger('lab-nunu'), twitch = trigger('lab-twitch');
  const value = (id: string, key: string) => abilityDisplayValues(id, 2)[key];
  expect(value('warwick', 'TFTUnitProperty.:TFT13_WarwickCurrentExperimentBonus')).toBe(granted.warwick / 20);
  expect(value('nunu', 'TFTUnitProperty.:TFT13_NunuCurrentExperimentBonus')).toBe((nunu.effects[0] as any).amount.maxHpBps / 100);
  expect(value('nunu', 'ExperimentICD')).toBe(nunu.internalCooldownTicks / 20);
  expect(value('zyra', 'TFTUnitProperty.:TFT13_ZyraCurrentExperimentBonus')).toBe(granted.zyra / 100);
  expect(value('urgot', 'TFTUnitProperty.:TFT13_UrgotCurrentExperimentBonusShield')).toBe((urgot[0] as any).amount.maxHpBps / 100);
  expect(value('urgot', 'TFTUnitProperty.:TFT13_UrgotCurrentExperimentBonusAS')).toBe(granted.urgot / 100);
  expect(value('urgot', 'ExperimentDuration')).toBe((urgot[0] as any).durationTicks / 20);
  expect(value('twitch', 'TFTUnitProperty.:TFT13_TwitchCurrentExperimentBonus')).toBe((twitch.effects[0] as any).amount.maxHpBps / 100);
  expect(value('twitch', 'ExperimentDamageTicks')).toBe((twitch.gate as any).everyN);
  expect(value('drmundo', 'TFTUnitProperty.:TFT13_DrMundoCurrentExperimentBonus')).toBe(granted.mundo);
});
