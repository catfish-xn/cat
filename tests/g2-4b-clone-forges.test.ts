import {expect,it} from 'vitest';
import {createG23Forge,reviveG23Forge} from '../src/simulation/combat-g2-3-summons';
import {DEFAULT_BOARD} from '../src/simulation/board';
import {resolveAbility} from '../src/simulation/combat-abilities';
import type {AbilityContext} from '../src/simulation/combat-s13-abilities';
import {EMPTY_RUNTIME,type S13Unit} from '../src/simulation/combat-s13-state';
import {unit,freeze} from './combat-helpers';

it.each(['melee','ranged'] as const)('copied %s Jayce gets an independent native forge, without inheriting owner buffs',form=>{
 const owner=unit('mirror-jayce','player',2,form==='melee'?4:6,{
  definitionId:'jayce',form,starLevel:3,hp:10000,maxHp:10000,
  ability:resolveAbility(form==='melee'?'jayce-ability':'jayce-ranged-ability',3),
  runtime:{...EMPTY_RUNTIME,castCount:9},shield:800,armor:200,
 });
 const input=freeze(owner),saved=JSON.stringify(input);
 const forge=createG23Forge(input,[input],DEFAULT_BOARD)! as S13Unit;
 expect(forge.id).toBe('mirror-jayce:g23-forge');expect(forge.maxHp).toBe(1000);
 expect(forge.starLevel).toBe(1);expect(forge.armor).toBe(0);expect(forge.shield).toBe(0);
 expect(forge.runtime).toEqual(EMPTY_RUNTIME);expect(forge.runtime).not.toBe(owner.runtime);
 expect(forge.cell).toEqual({col:2,row:form==='melee'?5:7});
 expect(forge.itemSummon).toBeUndefined();expect(forge.sources).toEqual([]);
 expect(JSON.stringify(input)).toBe(saved);
 expect(createG23Forge(input,[input,forge],DEFAULT_BOARD)).toBeUndefined();
});
it('copied forge placement mirrors teams, skips occupied cells, and refuses a full zone',()=>{
 for(const team of ['player','enemy'] as const){
  const row=(r:number)=>team==='player'?r:7-r;
  const owner=unit('copy',team,2,row(4),{definitionId:'jayce'});
  const blocker=unit('blocker',team,2,row(5));
  const forge=createG23Forge(owner,[owner,blocker],DEFAULT_BOARD)!;
  expect(forge.cell).toEqual({col:0,row:row(4)});
  const occupied=Array.from({length:4},(_,r)=>Array.from({length:7},(_,col)=>unit(`b-${col}-${r}`,team,col,row(4+r)))).flat();
  expect(createG23Forge(owner,occupied,DEFAULT_BOARD)).toBeUndefined();
 }
 expect(createG23Forge(unit('not-jayce','player',0,4),[],DEFAULT_BOARD)).toBeUndefined();
});
it('copied Jayce revives only its own forge while the original forge stays dead',()=>{
 const owner=unit('original','player',1,4,{definitionId:'jayce'}) as S13Unit;
 const copy=unit('copy','player',3,4,{definitionId:'jayce'}) as S13Unit;
 const originalForge=createG23Forge(owner,[owner,copy],DEFAULT_BOARD)! as S13Unit;
 const copyForge=createG23Forge(copy,[owner,copy,originalForge],DEFAULT_BOARD)! as S13Unit;
 originalForge.alive=false;originalForge.hp=0;copyForge.alive=false;copyForge.hp=0;
 const ctx:AbilityContext={tick:20,board:DEFAULT_BOARD,units:[owner,copy,originalForge,copyForge],events:[],packets:[],heals:[],draw:()=>{throw Error('No RNG');}};
 expect(reviveG23Forge(ctx,copy)).toBe(copyForge);expect(copyForge.hp).toBe(1000);
 expect(originalForge.alive).toBe(false);expect(originalForge.hp).toBe(0);
 expect(ctx.events).toMatchObject([{type:'unitRevived',unitId:'copy:g23-forge',source:{ownerId:'copy'}}]);
});
