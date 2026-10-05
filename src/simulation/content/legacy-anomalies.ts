// M4 legacy fixture content only. Never used by M5 acquisition pools.
import type { ChoiceDefinition } from '../strategy-types';
import { freezeContent } from './freeze';
export const ANOMALY_DEFINITIONS: Readonly<Record<string, ChoiceDefinition>> = freezeContent({
  'colossal-form': { id: 'colossal-form', name: '巨化', description: '最大生命 +40%', effects: [{ kind: 'statPercentBps', stat: 'maxHp', bps: 4000 }] },
  'tempered-core': { id: 'tempered-core', name: '淬芯', description: '护甲和魔抗各 +35', effects: [
    { kind: 'statFlat', stat: 'armor', amount: 35 }, { kind: 'statFlat', stat: 'magicResist', amount: 35 }] },
  'rapid-form': { id: 'rapid-form', name: '迅变', description: '攻击速度 +40%', effects: [{ kind: 'attackSpeedBps', bps: 4000 }] },
  'arcane-form': { id: 'arcane-form', name: '灵变', description: '技能数值 +50%', effects: [{ kind: 'statPercentBps', stat: 'abilityAmount', bps: 5000 }] },
  'crushing-form': { id: 'crushing-form', name: '猛变', description: '攻击力 +35%', effects: [{ kind: 'statPercentBps', stat: 'attackDamage', bps: 3500 }] },
  'echo-core': { id: 'echo-core', name: '回响核心', description: '施法对主目标额外造成 100 魔法伤害', effects: [
    { kind: 'trigger', hook: 'onCast', everyN: 1, action: { kind: 'dealDamage', amount: 100, damageType: 'magic' } }] },
  'guarded-form': { id: 'guarded-form', name: '护壳', description: '施法获得 200 护盾，持续 60 ticks', effects: [
    { kind: 'trigger', hook: 'onCast', everyN: 1, action: { kind: 'grantShield', amount: 200, durationTicks: 60 } }] },
  'cycling-core': { id: 'cycling-core', name: '循环核心', description: '每 2 次普攻额外获得 15 法力', effects: [
    { kind: 'trigger', hook: 'onAttack', everyN: 2, action: { kind: 'gainMana', amount: 15 } }] },
});
