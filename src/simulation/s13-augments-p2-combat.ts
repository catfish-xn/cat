/** Frozen opening facts. Random choices share Combat's lcg32 stream after existing opening consumers.
 * Sharing reads every donor before writing any recipient, so broadcasts cannot feed each other. */
import type { CombatOrigin, CombatUnit, CombatState } from './combat-types';
import type { AbilityContext } from './combat-s13-abilities';
import { byDistance, enemies, range, type S13Unit } from './combat-s13-state';
import { readCombatStats } from './combat-s13';
import { scaleItemSummonHp } from './g2-4b-summons';
import { hexDistance } from './board';
import { p2Values } from './content/s13-augments-p2';
import { freezeContent } from './content/freeze';
import type { SpellCritAuthorization } from './m8/contracts';
import type { RestoreCombatReplay } from './restore-combat-replay';
import { canonicalContent } from './content';

export interface P2SharedStats { readonly attackDamage: number; readonly abilityPower: number; readonly health: number; readonly armor: number; readonly magicResist: number }
export interface P2Opening {
  readonly selected: readonly string[];
  readonly shared: readonly ({ readonly source: CombatOrigin } & P2SharedStats)[];
}
export const p2HasAnomaly=(u: Pick<CombatUnit,'mechanics'>,id:string)=>u.mechanics?.some(m=>m.mechanic==='s13P2Anomaly'&&m.source.definitionId===id)??false;
type Bonus = 'attackDamageBps'|'attackDamageFlat'|'abilityPower'|'attackSpeedBps'|'health'|'armor'|'magicResist';
export function p2Bonus(u: Pick<CombatUnit,'s13P2Opening'>, stat: Bonus): number {
  const opening=u.s13P2Opening;if(!opening)return 0;
  let amount=0;
  for(const id of opening.selected){const v=p2Values(id);
    if(id==='calculated-enhancement')amount+=stat==='attackDamageBps'?Math.round(v.BonusAD*10000):stat==='abilityPower'?v.BonusAP:0;
    if(id==='trifecta-ii')amount+=stat==='health'?v.Health:stat==='attackSpeedBps'?Math.round(v.AttackSpeed*10000):0;
  }
  if(stat!=='attackDamageBps'&&stat!=='attackSpeedBps')for(const share of opening.shared)amount+=share[stat==='attackDamageFlat'?'attackDamage':stat];
  return amount;
}
function addHealth(ctx: AbilityContext,u:S13Unit,amount:number,source:CombatOrigin):void {
  if(!amount)return;
  const basis=u.maxHpBasis!,beforeMax=u.maxHp,beforeHp=u.hp;
  const updated={...basis,flat:basis.flat+amount};
  u.maxHpBasis=updated;u.maxHp=scaleItemSummonHp(u,Math.floor((updated.base+updated.flat)*(10000+updated.bps+updated.bonusBps)/10000));
  u.hp=Math.min(u.maxHp,beforeHp+u.maxHp-beforeMax);
  ctx.events.push({type:'maxHpChanged',tick:0,unitId:u.id,source:{...source,parentItemInstanceId:source.parentItemInstanceId??null},beforeMax,afterMax:u.maxHp,beforeHp,afterHp:u.hp,countsAsHeal:false});
}
export function startP2Combat(ctx: AbilityContext):void {
  const groups=new Map<string,{source:CombatOrigin;units:S13Unit[]}>();
  for(const unit of ctx.units.filter(u=>u.alive&&u.hp>0))for(const m of unit.mechanics??[])if(m.mechanic==='s13P2Augment'){
    const key=JSON.stringify([unit.team,m.source.definitionId,m.source.instanceId]);
    const group=groups.get(key)??{source:m.source,units:[]};group.units.push(unit);groups.set(key,group);
  }
  for(const [,group] of [...groups].sort(([a],[b])=>a<b?-1:a>b?1:0)){
    const {source}=group,id=source.definitionId,v=p2Values(id),count=id==='calculated-enhancement'?v.NumUnits:v.BuffedNumber;
    const pool=[...group.units].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    for(let i=0,n=Math.min(count,pool.length);i<n;i++){
      const unit=pool.splice(Math.floor(ctx.draw()*pool.length/4294967296),1)[0];
      const before=unit.s13P2Opening??{selected:[],shared:[]};
      unit.s13P2Opening={...before,selected:[...before.selected,id]};
      addHealth(ctx,unit,id==='trifecta-ii'?v.Health:0,{...source,ownerId:unit.id});
    }
  }
  // Freeze all five stat values and all neighbour identities before the first broadcast.
  const snapshots=ctx.units.filter(u=>u.alive&&u.hp>0&&p2HasAnomaly(u,'share-your-energy')).map(u=>{
    const stats=readCombatStats(u,{units:ctx.units,tick:0}),v=p2Values('share-your-energy');
    const fraction=(n:number)=>Math.floor(n*Math.round(v.PercentStatsToShare*10000)/10000);
    return {source:u.mechanics!.find(m=>m.mechanic==='s13P2Anomaly'&&m.source.definitionId==='share-your-energy')!.source,
      stats:{attackDamage:fraction(stats.attackDamage),abilityPower:fraction(stats.abilityPower),health:fraction(u.maxHp),armor:fraction(stats.armor),magicResist:fraction(stats.magicResist)},
      recipients:ctx.units.filter(other=>other.id!==u.id&&other.team===u.team&&other.alive&&other.hp>0&&hexDistance(u.cell,other.cell)===1)};
  });
  for(const snapshot of snapshots)for(const unit of snapshot.recipients){
    const before=unit.s13P2Opening??{selected:[],shared:[]};
    unit.s13P2Opening={...before,shared:[...before.shared,{source:snapshot.source,...snapshot.stats}]};
    addHealth(ctx,unit,snapshot.stats.health,snapshot.source);
  }
  for(const u of ctx.units)if(u.s13P2Opening)freezeContent(u.s13P2Opening);
}
export function p2Stoneskin(u: CombatUnit,tick:number):number {
  const v=p2Values('stoneskin');return p2HasAnomaly(u,'stoneskin')?Math.max(0,v.BonusArmorMR-Math.floor(tick/20)*v.ArmorMRLossPerSecond):0;
}
export function p2Target(u:S13Unit,units:readonly S13Unit[],tick:number):S13Unit|undefined {
  const candidates=enemies(u,units),normal=byDistance(u,candidates)[0];
  if(!p2HasAnomaly(u,'cull-the-weak'))return normal;
  const inRange=candidates.filter(t=>hexDistance(u.cell,t.cell)<=range(u));
  if(tick%(p2Values('cull-the-weak').Period*20)===0)return inRange.sort((a,b)=>a.hp*b.maxHp-b.hp*a.maxHp||(a.id<b.id?-1:a.id>b.id?1:0))[0]??normal;
  return inRange.find(t=>t.id===u.targetId)??normal;
}
export function p2Crit(u:S13Unit|undefined,target:CombatUnit|undefined,base:SpellCritAuthorization):SpellCritAuthorization {
  if(!u||!target||!p2HasAnomaly(u,'cull-the-weak'))return base;
  const bps=Math.floor((target.maxHp-target.hp)*Math.round(p2Values('cull-the-weak').CritPercent*10000)/target.maxHp);
  return {...base,chanceBps:Math.min(10000,base.chanceBps+bps)};
}
/** Avoid a target lookup on every ordinary packet when the attacker has no Cull The Weak. */
export function p2PacketCrit(u:S13Unit|undefined,targetId:string,units:readonly S13Unit[],base:SpellCritAuthorization):SpellCritAuthorization {
  return u&&p2HasAnomaly(u,'cull-the-weak')?p2Crit(u,units.find(t=>t.id===targetId),base):base;
}
/** Authenticate opening facts against an independently reconstructed seeded opening, before numeric consumers. */
export function validateP2Opening(combat:CombatState,replay:RestoreCombatReplay):void {
  const enabled=combat.strategy?.units.some(u=>u.mechanics?.some(m=>m.mechanic==='s13P2Augment'||m.mechanic==='s13P2Anomaly'));
  if(!enabled){if(combat.units.some(u=>u.s13P2Opening!==undefined))throw new RangeError('Unexpected S13 P2 opening');return;}
  const opening=replay.p2Opening();
  for(const unit of combat.units)if(canonicalContent(unit.s13P2Opening??null)!==canonicalContent(opening.find(u=>u.id===unit.id)?.s13P2Opening??null))throw new RangeError('Invalid S13 P2 opening');
}
