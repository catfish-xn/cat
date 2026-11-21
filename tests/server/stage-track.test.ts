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
    expect(rounds.at(-1)!.title).toBe('2-7\n对抗：石甲虫 ×3');
    expect(stageTrackRounds(ordinal('4-6')).find(round => round.roundId === '4-6')!.icon).toBe('anomaly');
  });
  it('names the stage 1 minions and the stage 6 boss', () => {
    expect(stageTrackRounds(1).map(round => round.title)).toEqual(['1-2\n对抗：小兵 ×2', '1-3\n对抗：小兵 ×3', '1-4\n对抗：小兵 ×4']);
    expect(stageTrackRounds(ordinal('6-7')).at(-1)).toMatchObject({ roundId: '6-7', state: 'current', title: '6-7\n对抗：远古巨龙 ×1' });
  });
  it('follows overtime with the current and the next PvP round', () => {
    const rounds = stageTrackRounds(ROUND_CATALOG.at(-1)!.ordinal + 2);
    expect(rounds.map(round => `${round.roundId}:${round.icon}:${round.state}`)).toEqual(['overtime-2:pvp:current', 'overtime-3:pvp:next']);
  });
  it('colours finished rounds by my result and names the opponent in the 14.24 hover wording', () => {
    const at = (id: string) => ordinal(id);
    const results = new Map([[at('2-1'), 'playerWin'], [at('2-2'), 'enemyWin'], [at('2-3'), 'draw'], [at('2-4'), 'supply']] as const);
    const opponents = new Map([[at('2-1'), '机器人 3 机'], [at('2-5'), '机器人 5 机']]);
    const rounds = stageTrackRounds(at('2-5'), { results, opponents });
    expect(rounds.map(round => `${round.roundId}:${round.state}:${round.outcome}`)).toEqual([
      '2-1:done:win', '2-2:done:loss', '2-3:done:draw', '2-4:done:null', '2-5:current:null', '2-6:next:null', '2-7:next:null',
    ]);
    expect(rounds.map(round => round.title)).toEqual([
      '2-1\n曾经获胜：机器人 3 机', '2-2\n曾经失利', '2-3\n曾经打平', '2-4\n选秀', '2-5\n当前对手：机器人 5 机', '2-6\n对抗：未知', '2-7\n对抗：石甲虫 ×3',
    ]);
    // A result of the current round (it may arrive while the battle still plays back) is not shown yet.
    expect(stageTrackRounds(at('2-2'), { results }).find(round => round.roundId === '2-2')!.outcome).toBeNull();
  });
});
