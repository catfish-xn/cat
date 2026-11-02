import { expect, it } from 'vitest';
import { augmentCardSections, augmentEffectText } from '../../src/presentation/augment-display';
import { loadAugmentText } from '../../src/presentation/augment-text-loader';
import { AUGMENT_BATCH3, CALL_TO_CHAOS_OUTCOMES } from '../../src/simulation/content/augment-pool-batch3';

// 混沌召唤's card lists the ten rewards this build draws from, with the counts the rules row pays.
it('lists every Call to Chaos reward with the rule counts on the choice card', async () => {
  await loadAugmentText();
  const v = AUGMENT_BATCH3['call-to-chaos'].source.values, note = augmentEffectText('call-to-chaos');
  const entries = note.replace(/^可能的奖励（每项10%）：/, '').split('；');
  expect(entries).toEqual([`${v.Gold}金币`, `1个3星3费弈子和${v['{5edfa63d}']}金币`, `${v['{8c58ac06}']}个碎舰者和1个装备拆卸器`,
    `${v['{8f15cad2}']}个狙击手的专注和1个装备拆卸器`, `${v.numtg}个窃贼手套和1个装备拆卸器`, '1个携带2个钢铁烈阳之匣的训练假人',
    '1个携带2个基克的先驱的训练假人', `${v.NumEmblems}个随机纹章`, `${v.XP}经验`, `${v.Rerolls}次免费刷新`]);
  expect(entries).toHaveLength(CALL_TO_CHAOS_OUTCOMES.length);
  expect(note).toContain(`每项${100 / CALL_TO_CHAOS_OUTCOMES.length}%`);
  expect(augmentCardSections('call-to-chaos').extra).toContain(note);
});
