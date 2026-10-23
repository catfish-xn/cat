import { describe, expect, it } from 'vitest';
import { melProgressText, openingRewardText } from '../src/presentation/opening-encounter-text';
import { subscriptionGold } from '../src/simulation/opening-batch-rewards';

describe('batch A reward texts', () => {
  it('Mel progress follows rewardStatus', () => {
    const base = { thresholdHp: 40, thresholdReached: false, rewardStatus: 'waiting-threshold' as const };
    expect(melProgressText(base)).toBe('梅尔的赐福 · 生命值首次降到 40 及以下（仍存活）时获得一次');
    expect(melProgressText({ ...base, thresholdReached: true, rewardStatus: 'granted' })).toBe('梅尔的赐福 · 已获得（奖励在法球里领取）');
  });
  it('names Mel branches, gold buckets with the rules amount, and loot categories', () => {
    expect(openingRewardText({ encounterId: 'mels-blessing', outcome: 'Blessing_High_12' })).toBe('梅尔的赐福 · 获得 2 个金铲铲冠冕（在法球里领取）');
    expect(openingRewardText({ encounterId: 'gold-subscription', outcome: 'gold-subscription/stage/3/3' }, subscriptionGold))
      .toBe('金币订阅 · 第 3 阶段 · 大档 · 所有玩家 +15 金币');
    expect(openingRewardText({ encounterId: 'gold-subscription', outcome: 'gold-subscription/stage/5/0' }, subscriptionGold))
      .toBe('金币订阅 · 第 5 阶段 · 极小档 · 所有玩家 +2 金币');
    expect(openingRewardText({ encounterId: 'loot-subscription', outcome: 'loot-subscription/stage/2/0' })).toBe('战利品订阅 · 第 2 阶段 · 一只靴子砸了下来，什么也没有');
    expect(openingRewardText({ encounterId: 'loot-subscription', outcome: 'loot-subscription/stage/4/8' })).toBe('战利品订阅 · 第 4 阶段 · 所有玩家获得金铲铲冠冕（在法球里领取）');
  });
  it('ignores unknown or mismatched outcomes', () => {
    for (const event of [{ encounterId: 'mels-blessing', outcome: 'Blessing_High_3' }, { encounterId: 'gold-subscription', outcome: 'loot-subscription/stage/2/1' },
      { encounterId: 'loot-subscription', outcome: 'loot-subscription/stage/2/9' }]) expect(openingRewardText(event)).toBeNull();
  });
});
