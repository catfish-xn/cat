import { describe, expect, it } from 'vitest';
import { ROUND_CATALOG } from '../../src/simulation/content/round-catalog';
import { stageTrackRounds } from '../../src/rendering/online/stage-track';

const ordinal = (roundId: string) => ROUND_CATALOG.find(round => round.roundId === roundId)!.ordinal;

describe('online stage tracker', () => {
  it('shows nothing before the first round', () => {
    expect(stageTrackRounds(0)).toEqual([]);
  });
  it('lists the current stage with its round kinds and marks', () => {
    const rounds = stageTrackRounds(ordinal('2-2'));
    expect(rounds.map(round => `${round.roundId}:${round.icon}:${round.state}`)).toEqual([
      '2-1:augment:done', '2-2:pvp:current', '2-3:pvp:next', '2-4:carousel:next', '2-5:pvp:next', '2-6:pvp:next', '2-7:pve:next',
    ]);
    expect(rounds.at(-1)!.title).toBe('2-7 野怪：石甲虫 ×3');
    expect(stageTrackRounds(ordinal('4-6')).find(round => round.roundId === '4-6')!.icon).toBe('anomaly');
  });
  it('names the stage 1 minions and the stage 6 boss', () => {
    expect(stageTrackRounds(1).map(round => round.title)).toEqual(['1-2 野怪：小兵 ×2', '1-3 野怪：小兵 ×3', '1-4 野怪：小兵 ×4']);
    expect(stageTrackRounds(ordinal('6-7')).at(-1)).toMatchObject({ roundId: '6-7', state: 'current', title: '6-7 野怪：峡谷先锋 ×1' });
  });
  it('follows overtime with the current and the next PvP round', () => {
    const rounds = stageTrackRounds(ROUND_CATALOG.at(-1)!.ordinal + 2);
    expect(rounds.map(round => `${round.roundId}:${round.icon}:${round.state}`)).toEqual(['overtime-2:pvp:current', 'overtime-3:pvp:next']);
  });
});
