import { freezeContent } from './freeze';

/** Approved project content; candidate S13 records do not establish these encounters. */
export type MonsterFamily = 'minion' | 'krug' | 'wolf' | 'razorbeak' | 'elder-dragon' | 'rift-herald';
export type NeutralMechanism =
  | { readonly kind: 'none' }
  | { readonly kind: 'companion-heal'; readonly id: string; readonly missingHpBps: number; readonly maxReactions: number }
  | { readonly kind: 'backline-jump'; readonly id: string }
  | { readonly kind: 'companion-speed'; readonly id: string; readonly attackSpeedBps: number; readonly maxReactions: number }
  | { readonly kind: 'attack-cone'; readonly id: string; readonly secondaryDamageBps: number }
  | { readonly kind: 'path-charge'; readonly id: string; readonly targetMaxHpBps: number; readonly damageCap: number; readonly stunTicks: number };

/** Separate from champion acquisition/traits and presentation fields; no placeholder cost. */
export interface NeutralDefinition {
  readonly id: string;
  readonly name: string;
  readonly unitKind: 'neutral';
  readonly monsterFamily: MonsterFamily;
  readonly starLevel: 1;
  readonly health: number;
  readonly attack: number;
  readonly baseAttackSpeedBps: number;
  readonly armor: number;
  readonly magicResist: number;
  readonly attackRange: number;
  readonly abilityPower: 100;
  readonly initialMana: 0;
  readonly maxMana: 0;
  readonly baseCritChanceBps: 2500;
  readonly baseCritMultiplierBps: 14000;
  readonly traits: readonly [];
  readonly equipment: readonly [];
  readonly mechanism: NeutralMechanism;
}

function neutral(id: string, name: string, monsterFamily: MonsterFamily, health: number, attack: number,
  baseAttackSpeedBps: number, armor: number, magicResist: number, attackRange: number,
  mechanism: NeutralMechanism = { kind: 'none' }): NeutralDefinition {
  return { id, name, unitKind: 'neutral', monsterFamily, starLevel: 1, health, attack, baseAttackSpeedBps,
    armor, magicResist, attackRange, abilityPower: 100, initialMana: 0, maxMana: 0,
    baseCritChanceBps: 2500, baseCritMultiplierBps: 14000, traits: [], equipment: [], mechanism };
}

export function neutralAbilityId(definition: NeutralDefinition): string {
  return definition.mechanism.kind === 'none' ? 'neutral-attack' : definition.mechanism.id;
}

/** M8B_ENCOUNTERS §3–4 / POLICY P-N01–13, P-M01–05. */
export const NEUTRAL_DEFINITIONS: Readonly<Record<string, NeutralDefinition>> = freezeContent({
  'pve-minion-melee-a': neutral('pve-minion-melee-a', '近战小兵 A', 'minion', 110, 8, 5000, 0, 0, 1),
  'pve-minion-melee-b': neutral('pve-minion-melee-b', '近战小兵 B', 'minion', 160, 10, 6000, 0, 0, 1),
  'pve-minion-ranged-b': neutral('pve-minion-ranged-b', '远程小兵 B', 'minion', 120, 9, 6000, 0, 0, 3),
  'pve-minion-melee-c': neutral('pve-minion-melee-c', '近战小兵 C', 'minion', 220, 12, 6000, 0, 0, 1),
  'pve-minion-ranged-c': neutral('pve-minion-ranged-c', '远程小兵 C', 'minion', 160, 10, 6000, 0, 0, 3),
  'pve-krug': neutral('pve-krug', '石甲虫', 'krug', 400, 30, 8000, 20, 20, 1,
    { kind: 'companion-heal', id: 'stone-salvage-project-v1', missingHpBps: 10000, maxReactions: 2 }),
  'pve-wolf-large': neutral('pve-wolf-large', '大狼', 'wolf', 900, 50, 8000, 15, 15, 1,
    { kind: 'backline-jump', id: 'pack-leap-project-v1' }),
  'pve-wolf-small': neutral('pve-wolf-small', '小狼', 'wolf', 450, 22, 8000, 15, 15, 1,
    { kind: 'backline-jump', id: 'pack-leap-project-v1' }),
  'pve-razorbeak-large': neutral('pve-razorbeak-large', '大鸟', 'razorbeak', 1400, 65, 8000, 25, 25, 1,
    { kind: 'companion-speed', id: 'furious-flock-project-v1', attackSpeedBps: 1500, maxReactions: 5 }),
  'pve-razorbeak-small': neutral('pve-razorbeak-small', '小鸟', 'razorbeak', 680, 32, 8000, 25, 25, 1,
    { kind: 'companion-speed', id: 'furious-flock-project-v1', attackSpeedBps: 1500, maxReactions: 5 }),
  'pve-elder-dragon': neutral('pve-elder-dragon', '远古龙', 'elder-dragon', 6000, 85, 10000, 50, 50, 2,
    { kind: 'attack-cone', id: 'primordial-breath-project-v1', secondaryDamageBps: 3500 }),
  'pve-rift-herald': neutral('pve-rift-herald', '峡谷先锋', 'rift-herald', 9000, 120, 10000, 60, 60, 2,
    { kind: 'path-charge', id: 'void-charge-project-v1', targetMaxHpBps: 1500, damageCap: 300, stunTicks: 10 }),
});
