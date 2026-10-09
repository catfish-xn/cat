import type { MatchState } from './match-types';
import type { EncounterPreview } from './m8/ui-contracts';
import { buildStrategySnapshot } from './strategy-snapshot';
import { UNIT_DEFINITIONS } from './units';
import { NEUTRAL_DEFINITIONS, type NeutralMechanism } from './content/neutrals';
import { freezeContent } from './content/freeze';

/** Runtime behavior summaries from M8_RULES §14, not unimplemented archival tooltip text. */
const HERO_RULES: Readonly<Record<string,string>> = {
  irelia:'衰减护盾；耗尽或到期后近身魔法爆发。',maddie:'引导射击最远目标，路径首敌拦截；控制或死亡取消后续射击。',
  darius:'近身物理伤害、自疗及持续流血。',lux:'保护当前生命最低的友军，并强化下一次普攻。',zyra:'主目标魔伤与眩晕，另攻击两个最近敌人。',
  tristana:'物理攻击；击杀时溢出弹射并积累永久攻击成长。',urgot:'主目标及邻近敌人物理伤害与减甲。',rell:'自身护盾、路径魔伤与双抗转移。',
  leona:'暂时减伤，随后近身爆发。',vander:'引导获得双抗，并按低费友军数强化下一次攻击。',kogmaw:'普攻附加魔伤；施法累计攻速，并逐步增加射程。',
  scar:'最近三个敌人魔伤与眩晕，并自疗。',ezreal:'目标周围物理伤害，主目标另受追加伤害。',loris:'护盾与邻近友军伤害分担，持续结束后范围爆发。',
  nami:'魔法伤害在邻近敌人之间跳跃，不重复命中。',corki:'引导轰击当前目标附近，物理伤害并减甲。',
  garen:'自身护盾，对主目标及其周围敌人造成物理伤害。',zoe:'主目标魔伤，在附近未命中的最远敌人间反弹，每次返回主目标。',caitlyn:'引导多轮随机敌军中心范围物理伤害，中心另受爆头伤害。',
};
function neutralDescription(m: NeutralMechanism): string {
  switch(m.kind) {
    case 'none': return '仅普攻；无蓝、无主动技能。';
    case 'companion-heal': return `同族同伴死亡后，下一tick回复当时缺失生命的${m.missingHpBps/100}%，受重伤影响。`;
    case 'backline-jump': return '开场一次跳向敌方后排邻近空格；无空位则不跳，无伤害。';
    case 'companion-speed': return `每个同族同伴死亡后，下一tick增加${m.attackSpeedBps/100}%攻速，最多${m.maxReactions}层。`;
    case 'attack-cone': return `普攻窄锥形溅射至多两个副目标，各受${m.secondaryDamageBps/100}%攻击力的物理伤害；副包不暴击。`;
    case 'path-charge': return `开场一次最多四格冲锋；tick1对路径目标造成最大生命${m.targetMaxHpBps/100}%魔伤，封顶${m.damageCap}；存活且不免控者下一tick眩晕${m.stunTicks}tick。`;
  }
}
/** Public enemy-only view. No hidden plans, drops, RNG or state mutation. */
export function readEncounterPreview(state: Readonly<MatchState>): EncounterPreview | null {
  if(state.m8.round.kind==='supply') return null;
  const snapshot=buildStrategySnapshot(state);
  return freezeContent({
    // B6 has no PvP encounter ID: this read-only namespace identifies its fixed public opponent.
    encounterId:state.m8.round.encounterId ?? `pvp:${state.m8.round.roundId}`,
    units:state.m8.preparation.enemies.map(u=>{
      const stats=snapshot.units.find(s=>s.unitId===u.id)!.stats, d=UNIT_DEFINITIONS[u.definitionId];
      if(u.location.kind!=='board') throw new RangeError('Enemy preview requires board deployment');
      return {unitId:u.id,definitionId:u.definitionId,name:d.name,starLevel:u.starLevel,cell:{...u.location.cell},
        stats:{maxHp:stats.health,attackDamage:stats.attack,armor:stats.armor,magicResist:stats.magicResist},
        abilityDescription:d.unitKind==='neutral'?neutralDescription(NEUTRAL_DEFINITIONS[u.definitionId].mechanism):HERO_RULES[u.definitionId]};
    }),
    rulesNote:state.m8.round.kind==='pve'?'固定普通PvE；项目首版参数，25%基础普攻暴击、1.4倍伤害；无装备、无羁绊、不可购买或出售。特殊奇遇池未启用。'
      :'固定PvP模板；公开星级、装备与羁绊参与开战属性计算，不从中立遭遇池抽取。',
  });
}
