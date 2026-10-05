// M4 legacy fixture content only. Never used by M5 acquisition pools.
import type { ItemDefinition } from '../strategy-types';
import { freezeContent } from './freeze';
export const ITEM_DEFINITIONS: Readonly<Record<string, ItemDefinition>> = freezeContent({
  blade: { id: 'blade', name: '刃片', kind: 'component', effects: [{ kind: 'statFlat', stat: 'attackDamage', amount: 10 }] },
  rod: { id: 'rod', name: '晶杆', kind: 'component', effects: [{ kind: 'statFlat', stat: 'abilityAmount', amount: 20 }] },
  vest: { id: 'vest', name: '甲片', kind: 'component', effects: [{ kind: 'statFlat', stat: 'armor', amount: 15 }] },
  tear: { id: 'tear', name: '流滴', kind: 'component', effects: [{ kind: 'statFlat', stat: 'initialMana', amount: 15 }] },
  belt: { id: 'belt', name: '织带', kind: 'component', effects: [{ kind: 'statFlat', stat: 'maxHp', amount: 100 }] },
  'twin-edge': { id: 'twin-edge', name: '双刃', kind: 'completed', recipe: ['blade', 'blade'], effects: [{ kind: 'statFlat', stat: 'attackDamage', amount: 30 }] },
  'spell-edge': { id: 'spell-edge', name: '法刃', kind: 'completed', recipe: ['blade', 'rod'], effects: [
    { kind: 'statFlat', stat: 'attackDamage', amount: 15 }, { kind: 'statFlat', stat: 'abilityAmount', amount: 30 }] },
  'guard-edge': { id: 'guard-edge', name: '护刃', kind: 'completed', recipe: ['blade', 'vest'], effects: [
    { kind: 'statFlat', stat: 'attackDamage', amount: 15 }, { kind: 'statFlat', stat: 'armor', amount: 20 }] },
  'pulse-edge': { id: 'pulse-edge', name: '脉刃', kind: 'completed', recipe: ['blade', 'tear'], effects: [
    { kind: 'statFlat', stat: 'attackDamage', amount: 10 }, { kind: 'trigger', hook: 'onAttack', everyN: 3, action: { kind: 'gainMana', amount: 15 } }] },
  'heavy-edge': { id: 'heavy-edge', name: '重刃', kind: 'completed', recipe: ['blade', 'belt'], effects: [
    { kind: 'statFlat', stat: 'attackDamage', amount: 15 }, { kind: 'statFlat', stat: 'maxHp', amount: 180 }] },
  'focus-rod': { id: 'focus-rod', name: '聚焦杖', kind: 'completed', recipe: ['rod', 'rod'], effects: [{ kind: 'statPercentBps', stat: 'abilityAmount', bps: 6000 }] },
  'ward-rod': { id: 'ward-rod', name: '庇护杖', kind: 'completed', recipe: ['rod', 'vest'], effects: [
    { kind: 'statFlat', stat: 'armor', amount: 20 }, { kind: 'trigger', hook: 'onCast', everyN: 1, action: { kind: 'grantShield', amount: 120, durationTicks: 60 } }] },
  'echo-rod': { id: 'echo-rod', name: '回声杖', kind: 'completed', recipe: ['rod', 'tear'], effects: [
    { kind: 'trigger', hook: 'onCast', everyN: 1, action: { kind: 'dealDamage', amount: 70, damageType: 'magic' } }] },
  'vital-rod': { id: 'vital-rod', name: '生机杖', kind: 'completed', recipe: ['rod', 'belt'], effects: [
    { kind: 'statFlat', stat: 'maxHp', amount: 180 }, { kind: 'statFlat', stat: 'abilityAmount', amount: 30 }] },
  fortress: { id: 'fortress', name: '堡垒', kind: 'completed', recipe: ['vest', 'vest'], effects: [
    { kind: 'statFlat', stat: 'armor', amount: 45 }, { kind: 'statFlat', stat: 'magicResist', amount: 20 }] },
  'dawn-ward': { id: 'dawn-ward', name: '晨曦屏障', kind: 'completed', recipe: ['vest', 'tear'], effects: [
    { kind: 'trigger', hook: 'combatStart', everyN: 1, action: { kind: 'grantShield', amount: 200, durationTicks: 80 } }] },
  'heavy-plate': { id: 'heavy-plate', name: '重甲', kind: 'completed', recipe: ['vest', 'belt'], effects: [
    { kind: 'statFlat', stat: 'maxHp', amount: 240 }, { kind: 'statFlat', stat: 'armor', amount: 25 }] },
  'flowing-tear': { id: 'flowing-tear', name: '流泉', kind: 'completed', recipe: ['tear', 'tear'], effects: [
    { kind: 'statFlat', stat: 'initialMana', amount: 30 }, { kind: 'trigger', hook: 'onHpLoss', everyN: 1, action: { kind: 'gainMana', amount: 3 } }] },
  reservoir: { id: 'reservoir', name: '蓄流池', kind: 'completed', recipe: ['tear', 'belt'], effects: [
    { kind: 'statFlat', stat: 'maxHp', amount: 180 }, { kind: 'trigger', hook: 'onCast', everyN: 1, action: { kind: 'gainMana', amount: 10 } }] },
  'giant-belt': { id: 'giant-belt', name: '巨人腰带', kind: 'completed', recipe: ['belt', 'belt'], effects: [{ kind: 'statFlat', stat: 'maxHp', amount: 500 }] },
});
export const COMPONENT_IDS: readonly string[] = Object.freeze(Object.keys(ITEM_DEFINITIONS).filter(id => ITEM_DEFINITIONS[id].kind === 'component').sort());
