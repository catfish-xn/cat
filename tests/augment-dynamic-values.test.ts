import { beforeAll, expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { augmentDynamicValues } from '../src/simulation/augment-dynamic-values';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { toSeatPrivateView, toPublicBoard } from '../src/server/room/projection';
import { toDisplayMatch } from '../src/rendering/online/seat-view-adapter';
import { augmentCardSections, augmentPlayerDescription } from '../src/presentation/augment-display';
import { loadAugmentText } from '../src/presentation/augment-text-loader';
import { readG23Progress, writeG23Progress } from '../src/simulation/g2-3-state';
import { advanceG23Economy, type G23BattleFacts } from '../src/simulation/g2-3-economy';
import { callToChaosOutcome } from '../src/simulation/content/augment-pool-batch3';
import { outcomeReward } from '../src/simulation/augment-pool-batch3-progress';

beforeAll(() => loadAugmentText());
const own = (id:string, round=4) => ({definitionId:id,choiceId:'owned',acquiredRound:round});
const board = (definitionId:string, col:number) => ({id:`hero-${col}`,definitionId,team:'player' as const,starLevel:1 as const,location:{kind:'board' as const,cell:{col,row:6}}});

it.each([['pumping-up-i',750],['pumping-up-ii',1100],['pumping-up-iii',1800]] as const)('%s display matches the existing combat compiler even with an empty board', (id, expected) => {
 const base=createMatch(42), state={...base,round:8,augments:[own(id)],augmentProgress:{pumpingRounds:3,investmentHp:0},preparation:{...base.preparation,units:[]}};
 expect(augmentDynamicValues(state)[id].attackSpeedBps).toBe(expected);
 const fielded={...state,preparation:{...state.preparation,units:[board('lux',0)]}};
 expect(buildStrategySnapshot(fielded).units.find(u=>u.unitId==='hero-0')!.stats.attackSpeedBonusBps).toBe(expected);
});
it.each([['starry-night',1,18],['starry-night',2,18],['starry-night-plus',1,18],['starry-night-plus',2,18],['starry-night',6,25],['starry-night-plus',8,50]] as const)('%s follows current level and reaches the private display projection', (id,level,chance) => {
 const base=createMatch(42), state={...base,level,augments:[own(id)]};
 const view=toSeatPrivateView(state);
 expect(view.augmentDynamicValues[id].values).toEqual([chance]);
 expect(augmentPlayerDescription(id,view.augmentDynamicValues[id])).toContain(`当前几率：${chance}%`);
 expect((toDisplayMatch(JSON.parse(JSON.stringify(view))) as any).augmentDynamicValues).toEqual(view.augmentDynamicValues);
 expect(JSON.stringify(toPublicBoard(state))).not.toContain('augmentDynamicValues');
});
it.each([['bronze-for-life-i',300,0],['bronze-for-life-ii',350,150]] as const)('%s updates when the board changes and uses combat trait tiers', (id,amp,durability) => {
 const base=createMatch(42), state={...base,augments:[own(id,1)],preparation:{...base.preparation,units:[board('lux',0),board('vladimir',2)]}};
 expect(augmentDynamicValues(state)[id]).toEqual({damageAmpBps:amp,durabilityBps:durability});
 expect(augmentDynamicValues({...state,preparation:{...state.preparation,units:[board('lux',0)]}})[id]).toEqual({damageAmpBps:0,durabilityBps:0});
 const text=augmentPlayerDescription(id,augmentDynamicValues(state)[id]);
 expect(text).toContain(`当前伤害增幅：${amp/100}%`);
 if (durability) expect(text).toContain(`当前坚韧：${durability/100}%`);
});
it('choice cards use live values, unknown outcomes never expose future random results', () => {
 const base=createMatch(42), state={...base,augments:[own('superstars-i')],preparation:{...base.preparation,units:[{...board('lux',0),starLevel:3 as const}]}};
 const values=augmentDynamicValues(state);
 expect(augmentCardSections('superstars-i',values['superstars-i']).body).toContain('加成：7%');
 expect(augmentPlayerDescription('worth-the-wait',{values:[null]})).toContain('弈子：未确定');
 expect(augmentPlayerDescription('starry-night')).not.toContain('〔对局动态值〕');
});
it('settled counters refresh in private snapshots and survive a JSON reconnect projection', () => {
 const base=createMatch(42), ids=['scrap-recycling','wealthy-rehab-i','eye-for-an-eye','what-doesnt-kill-you','warpath'];
 const initial={...base,augments:ids.map(id=>own(id,1))};
 const fact:G23BattleFacts={battleId:'battle-1',round:1,roundKind:'pvp',result:'loss',conquerorTier:0,conquestTakedowns:[],chemBaronTier:0,alliedDeaths:8,rumbleStar:0,highRollerGold:0,batch2:[{definitionId:'scrap-recycling',count:5}],batch3Healing:1200};
 const next=writeG23Progress(initial,advanceG23Economy(readG23Progress(initial)!,fact).progress);
 const before=toSeatPrivateView(initial), after=toSeatPrivateView(next);
 expect(before.augmentDynamicValues['scrap-recycling'].values).toEqual([0]);
 expect(after.augmentDynamicValues['scrap-recycling'].values).toEqual([5]);
 expect(after.augmentDynamicValues['wealthy-rehab-i'].values).toEqual([1200]);
 expect(after.augmentDynamicValues['eye-for-an-eye'].values).toEqual([7]);
 expect(after.augmentDynamicValues['what-doesnt-kill-you'].values).toEqual([3]);
 expect(after.augmentDynamicValues['warpath'].values).toEqual([0]);
 expect((toDisplayMatch(JSON.parse(JSON.stringify(toSeatPrivateView(next)))) as any).augmentDynamicValues).toEqual(after.augmentDynamicValues);
 expect(JSON.stringify(toPublicBoard(next))).not.toContain('augmentDynamicValues');
});
it('shows the selected chaos reward amount without exposing a future offer', () => {
 const owner=own('call-to-chaos',1);
 let seed=0; while (seed<100 && callToChaosOutcome({seed},owner)!=='gold') seed++;
 const base=createMatch(seed);
 expect(base).toBeDefined();
 const state={...base,augments:[owner]}, amount=outcomeReward(state,owner).gold;
 const dynamic=augmentDynamicValues(state)['call-to-chaos'];
 expect(amount).toBeGreaterThan(0);
 expect(augmentPlayerDescription('call-to-chaos',dynamic)).toContain(`${amount}金币`);
});
