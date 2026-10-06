// M4 legacy fixture content only. Never used by M5 acquisition pools.
import type { ChoiceDefinition } from '../strategy-types';
import { freezeContent } from './freeze';
export const AUGMENT_DEFINITIONS: Readonly<Record<string, ChoiceDefinition>> = freezeContent({
  'iron-line': { id: 'iron-line', name: '钢阵', description: '全队护甲和魔抗各 +15', effects: [
    { kind: 'statFlat', stat: 'armor', amount: 15 }, { kind: 'statFlat', stat: 'magicResist', amount: 15 }] },
  vitality: { id: 'vitality', name: '生机', description: '全队最大生命 +150', effects: [{ kind: 'statFlat', stat: 'maxHp', amount: 150 }] },
  'heavy-hands': { id: 'heavy-hands', name: '重拳', description: '全队攻击力 +12', effects: [{ kind: 'statFlat', stat: 'attackDamage', amount: 12 }] },
  'quick-drill': { id: 'quick-drill', name: '速训', description: '全队攻击速度 +15%', effects: [{ kind: 'attackSpeedBps', bps: 1500 }] },
  'study-circle': { id: 'study-circle', name: '研讨', description: '全队技能数值 +20%', effects: [{ kind: 'statPercentBps', stat: 'abilityAmount', bps: 2000 }] },
  'charged-start': { id: 'charged-start', name: '充能', description: '全队初始法力 +20', effects: [{ kind: 'statFlat', stat: 'initialMana', amount: 20 }] },
  'opening-guard': { id: 'opening-guard', name: '开场屏障', description: '开战全队获得 120 护盾，持续 60 ticks', effects: [
    { kind: 'trigger', hook: 'combatStart', everyN: 1, action: { kind: 'grantShield', amount: 120, durationTicks: 60 } }] },
  'cast-echo': { id: 'cast-echo', name: '施法余响', description: '每 2 次施法对主目标额外造成 60 魔法伤害', effects: [
    { kind: 'trigger', hook: 'onCast', everyN: 2, action: { kind: 'dealDamage', amount: 60, damageType: 'magic' } }] },
});
