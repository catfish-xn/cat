/** G2-4b support items (user 2026-10-17). Parameters come from g2-4-support-item-source.ts (en_us 14.24 archive).
 * Combat-start buffs to the holder and nearby allies are compiled at the strategy boundary as auras (g2-4-support.ts);
 * everything that acts during combat is the holder's own declarative item program. Conventions are listed in
 * docs/evidence/g2-4/SUPPORT_ITEMS.md (G24-SUPPORT-01…03, G24-CHEST-01…04). Shroud of Stillness, Zephyr and Zz'Rot Portal
 * need new combat mechanisms and belong to the final new-mechanism batch; they are absent from the registry. */
import type { Effect, ItemDefinition } from '../strategy-types';
import type { ItemProgram } from '../m8/item-program';
import type { Effect as ProgramEffect } from '../m8/contracts';
import { G24_SUPPORT_ITEM_SOURCE } from './g2-4-support-item-source';
import { amount, enemies, modifier, periodic, selector, shield, stat, status, trigger, vamp } from './item-programs';
import { freezeContent } from './freeze';

/** same-row: same hex row within radius; adjacent: within radius; row-and-behind: G24-SUPPORT-01; team: every ally. */
export type G24AuraArea = 'same-row' | 'adjacent' | 'row-and-behind' | 'team';
export interface G24SupportAura { readonly area: G24AuraArea; readonly radius: number; readonly effects: readonly Effect[]; readonly program?: ItemProgram }
/** Stage-scaled periodic shield (Moonstone Renewer): amount = byStage[stage - 1], last entry for later stages. */
export interface G24StageShield { readonly periodTicks: number; readonly durationTicks: number; readonly targets: number; readonly byStage: readonly number[] }
export interface G24SupportDeclaration { readonly holder: ItemProgram; readonly auras: readonly G24SupportAura[]; readonly stageShield?: G24StageShield }

type Source = { readonly values: Readonly<Record<string, number | null>> };
const SOURCE: Readonly<Record<string, Source & { readonly name: string; readonly unique: boolean }>> = G24_SUPPORT_ITEM_SOURCE;
const team = (sample: 'each-pulse' | 'action-completion' = 'each-pulse') => selector({ relation: 'ally', maxTargets: 100, order: 'id', sample });
const everyEnemy = (sample: 'each-pulse' | 'action-completion' = 'action-completion') => enemies({ maxTargets: 100, order: 'id', sample });
const combatStart = (id: string, s: ReturnType<typeof selector>, effects: readonly ProgramEffect[]) => trigger({ id, event: 'combat-start', selector: s, effects });
const onDeath = (id: string, s: ReturnType<typeof selector>, effects: readonly ProgramEffect[]) => trigger({ id, event: 'holder-death', selector: s, effects });

function declare(id: string, v: Readonly<Record<string, number | null>>): G24SupportDeclaration | null {
  const n = (key: string) => v[key] ?? 0, pct = (key: string) => Math.round(n(key) * 100), ratio = (key: string) => Math.round(n(key) * 10000), ticks = (key: string) => Math.round(n(key) * 20);
  switch (id) {
    case 'TFT_Item_ZekesHerald':
      return { holder: {}, auras: [{ area: 'same-row', radius: n('HexRange'), effects: [{ kind: 'attackSpeedBps', bps: pct('AttackSpeed') }] }] };
    case 'TFT_Item_Chalice':
      return { holder: {}, auras: [{ area: 'same-row', radius: n('HexRange'), effects: [{ kind: 'statFlat', stat: 'abilityPower', amount: n('ChaliceAP') }, { kind: 'statFlat', stat: 'initialMana', amount: n('BonusInitialMana') }] }] };
    case 'TFT4_Item_OrnnRanduinsSanctum':
      return { holder: {}, auras: [{ area: 'adjacent', radius: 1, effects: [{ kind: 'statFlat', stat: 'armor', amount: n('BonusDefense') }, { kind: 'statFlat', stat: 'magicResist', amount: n('BonusDefense') }] }] };
    case 'TFT_Item_LocketOfTheIronSolari': {
      const t = ticks('ShieldDuration');
      return { holder: {}, auras: [{ area: 'same-row', radius: n('HexRange'), effects: [], program: { effects: [{ ...shield(0, t), amount: amount({ flat: n('ShieldValue') }) },
        stat(modifier('armor', n('BonusResists')), t), stat(modifier('magicResist', n('BonusResists')), t)] } }] };
    }
    case 'TFT4_Item_OrnnObsidianCleaver': {
      const t = ticks('Duration'), hit = enemies({ candidates: 'event-target' });
      return { holder: { triggers: [trigger({ id: 'cleaver', event: 'damage-dealt', selector: hit, effects: [status('shred', pct('Shred'), t, { activation: 'immediate' }), status('sunder', pct('Shred'), t, { activation: 'immediate' })] })] },
        auras: [{ area: 'team', radius: 0, effects: [{ kind: 'statPercentBps', stat: 'attackDamage', bps: ratio('TeamAD') }, { kind: 'statFlat', stat: 'abilityPower', amount: n('TeamAP') }] }] };
    }
    case 'TFT_Item_AegisOfTheLegion': {
      const t = ticks('BuffDuration');
      return { holder: {}, auras: [{ area: 'row-and-behind', radius: 1, effects: [], program: { effects: [stat(modifier('attackSpeed', pct('ASBuff'), 'bps'), t),
        stat(modifier('armor', n('BonusResists')), t), stat(modifier('magicResist', n('BonusResists')), t)] } }] };
    }
    case 'TFT_Item_RadiantVirtue': {
      const period = ticks('HealTickRate'), heal = (key: string): ProgramEffect => ({ kind: 'heal', amount: amount({ maxHpBps: pct(key), hpBasis: 'target', sample: 'each-pulse', cap: n('MaxHeal') }) });
      // G24-SUPPORT-02: each post-death heal rides a carrier whose expiry pays it, one and two periods after the death.
      const carrier = (index: number): ProgramEffect => ({ kind: 'apply-status', status: { kind: 'stat-buff', modifier: modifier('damageAmp', 0, 'bps'), magnitudeBps: 0,
        duration: { kind: 'ticks', ticks: (index + 1) * period }, activation: 'immediate', stackPolicy: { kind: 'refresh-same-instance', magnitude: 'replace', phase: 'preserve' },
        polarity: 'beneficial', removable: false, damageFilter: null, onEnd: { reasons: ['expired'], timing: 'expiry-before-actions', effects: [heal('TOOLTIPEmpoweredHeal')] } } });
      return { holder: { periodic: [periodic(period, [heal('MaxHealthHeal')], team())],
        triggers: [onDeath('virtue-death', team('action-completion'), Array.from({ length: n('NumBonusHeals') }, (_, i) => carrier(i)))] }, auras: [] };
    }
    case 'TFT7_Item_ShimmerscaleHeartOfGold': {
      const steps = Math.round((ratio('MaxDamageAmp') - ratio('BaseBonusDamage')) / ratio('AmpPerSec'));
      return { holder: { periodic: [periodic(20, [{ ...stat(modifier('damageAmp', ratio('AmpPerSec'), 'bps')), stackPolicy: { kind: 'independent-instances' } }], team(), { endsAtTick: steps * 20 + 1 })] },
        auras: [{ area: 'team', radius: 0, effects: [{ kind: 'mechanic', mechanic: 'damageAmp', values: { bps: ratio('BaseBonusDamage') } }] }] };
    }
    case 'TFT_Item_BansheesVeil': {
      const t = ticks('Duration');
      return { holder: {}, auras: [{ area: 'same-row', radius: n('HexRange'), effects: [], program: { effects: [status('control-immunity', 10000, t, { activation: 'immediate' }),
        stat(modifier('attackSpeed', ratio('BuffAttackSpeed'), 'bps'), t)] } }] };
    }
    case 'TFT_Item_EternalFlame': {
      const t = ticks('WoundDuration'), wound = status('wound', pct('TOOLTIPWoundAmount'), t, { activation: 'immediate' }), amp = stat(modifier('damageAmp', ratio('DamageAmp'), 'bps'), t);
      return { holder: { triggers: [combatStart('flame-wound', everyEnemy(), [wound]), combatStart('flame-amp', team('action-completion'), [amp])],
        periodic: [periodic(t, [wound], everyEnemy('each-pulse')), periodic(t, [amp], team())] }, auras: [] };
    }
    case 'TFT_Item_SupportKnightsVow':
      return { holder: {}, auras: [{ area: 'same-row', radius: n('HexRange'), effects: [{ kind: 'statFlat', stat: 'maxHp', amount: n('AllyHealth') }], program: { vamp: [vamp(ratio('Omnivamp'))] } }] };
    case 'TFT_Item_Moonstone': {
      // 约定值 G24-SUPPORT-03: min(Base + ShieldPerStage×(stage−1), Max); {f4f7ff53} decoded as ShieldPerStage.
      const byStage = Array.from({ length: Math.round((n('MaxShield') - n('BaseShieldAmount')) / n('{f4f7ff53}')) + 1 }, (_, i) => n('BaseShieldAmount') + n('{f4f7ff53}') * i);
      return { holder: {}, auras: [], stageShield: { periodTicks: ticks('ShieldRate'), durationTicks: ticks('ShieldDuration'), targets: n('ShieldTargets'), byStage } };
    }
    case 'TFT_Item_Spite':
      return { holder: { triggers: [onDeath('spite-death', enemies({ radius: 2, maxTargets: 100, order: 'id' }), [status('stun', 0, ticks('Duration'), { activation: 'immediate' })])] },
        auras: [{ area: 'adjacent', radius: 1, effects: [{ kind: 'statPercentBps', stat: 'attackDamage', bps: ratio('ADIncrease') }, { kind: 'statFlat', stat: 'abilityPower', amount: n('APIncrease') }] }] };
    case 'TFT_Item_UnstableTreasureChest':
      // G24-CHEST-02: on death, the ItemsGranted highest-percent-health living allies each gain one random pool item (G24-CHEST-01).
      return { holder: { triggers: [{ ...onDeath('chest-death', selector({ relation: 'ally', excludeSelf: true, maxTargets: n('ItemsGranted'), order: 'hp-ratio-desc-id' }),
        [{ kind: 'grant-combat-item', policyId: 'G24-CHEST-01', lifetime: 'combat' }]), maxPerCombat: 1 }] }, auras: [] };
    default: return null;
  }
}

const CONVENTIONS: Readonly<Record<string, readonly string[]>> = { TFT_Item_AegisOfTheLegion: ['G24-SUPPORT-01'], TFT_Item_RadiantVirtue: ['G24-SUPPORT-02'], TFT_Item_Moonstone: ['G24-SUPPORT-03'],
  TFT_Item_UnstableTreasureChest: ['G24-CHEST-01', 'G24-CHEST-02', 'G24-CHEST-03', 'G24-CHEST-04'] };
const DECLARATIONS = Object.entries(SOURCE).flatMap(([id, s]) => { const d = declare(id, s.values); return d ? [[id, d] as const] : []; });
export const G24_SUPPORT_DECLARATIONS: Readonly<Record<string, G24SupportDeclaration>> = freezeContent(Object.fromEntries(DECLARATIONS));
export const G24_SUPPORT_ITEMS: Readonly<Record<string, ItemDefinition>> = freezeContent(Object.fromEntries(DECLARATIONS.map(([id, d]) => {
  const s = SOURCE[id], program = d.holder;
  return [id, { id, apiName: id, name: s.name, kind: 'completed', evidenceStatus: 'approved-provisional', unique: s.unique, slotCost: 1,
    effects: [{ kind: 'statFlat', stat: 'maxHp', amount: Math.round(s.values.Health ?? 0) }],
    ...(Object.keys(program).length ? { combatProgram: program } : {}), conventionIds: CONVENTIONS[id] ?? [],
    effectDescriptions: ['辅助装：开战光环按备战站位结算，战中效果由持有者执行；数值与约定见 docs/evidence/g2-4/SUPPORT_ITEMS.md。'] } satisfies ItemDefinition];
})));
