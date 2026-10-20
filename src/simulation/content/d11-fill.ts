import type { ChoiceDefinition } from '../strategy-types';
import { freezeContent } from './freeze';
import { D11_FILL_SOURCE } from './d11-fill-source';

/** Registered by the production catalogs; execution lives in d11-fill and strategy-snapshot. */
export const D11_FILL_ACTIVATION = 'wired-v15' as const;
/** Executable conventions are digested with the retained source coefficients. */
export const D11_EXECUTION_POLICY = freezeContent({
  revision:'d11-wired-v15', openingStream:'g23-seed-xor-0x6431316f-xor-round-fnv-choiceId',
  openingSampling:'unit-id-codepoint-partial-fisher-yates-modulo',
  giftStream:'match-seed-xor-fnv-json-d11-fill-seat-choice-definition-lcg32-scaled-index',
  gifts:'two-source-bound-receipts-solo-deferred-online-reward-orb',
  spiritLink:'combat-start-player-hp-full-ten-missing-hp-groups',
  avarice:'live-bank-before-next-tick-plus-pending-combat-income-private-sample-replay',
  headhunter:'holder-enemy-champion-kill-eventSeq-exclude-assists-neutrals-summons-mirrors',
  growth:'unique-combat-holder-eventSeq-victim-receipt-trusted-battle-history',
} as const);
export type D11ChoiceId = keyof typeof D11_FILL_SOURCE;
export type D11AugmentId = 'all-for-one-i' | 'trifecta-i' | 'spirit-link';
export type D11PendingDefinition = Omit<ChoiceDefinition, 'effects'> & { readonly execution: 'requires-d11-compiler' };
export const D11_FILL_DEFINITIONS: Readonly<Record<D11ChoiceId, D11PendingDefinition>> = freezeContent({
  'all-for-one-i': { id:'all-for-one-i', name:'一费奉献 I', description:'获得2个1费弈子。场上每个独特1费英雄使全队获得2%最大生命和1.5%伤害增幅。', execution:'requires-d11-compiler' },
  'trifecta-i': { id:'trifecta-i', name:'三项赛 I', description:'获得2个3费英雄。开战随机至多3个3费英雄获得250生命和18%攻速。', execution:'requires-d11-compiler' },
  'spirit-link': { id:'spirit-link', name:'灵魂连接', description:'全队每5秒治疗自身5%最大生命；每失去10玩家生命，治疗增加0.5个百分点。', execution:'requires-d11-compiler' },
  'avarice-incarnate': { id:'avarice-incarnate', name:'贪财化身', description:'获得5金币。获得15%伤害增幅，每拥有2金币增加1个百分点，总计至多40%。', execution:'requires-d11-compiler' },
  headhunter: { id:'headhunter', name:'猎头者', description:'获得15%攻速，每击杀一个敌方弈子永久增加1个百分点。', execution:'requires-d11-compiler' },
});
export const D11_FILL_TIERS = freezeContent({ 'all-for-one-i':'silver', 'trifecta-i':'gold', 'spirit-link':'gold' } as const);
export function d11Definition(id:D11ChoiceId):ChoiceDefinition {
  const {execution:_execution,...definition}=D11_FILL_DEFINITIONS[id];
  return {...definition,effects:[{kind:'mechanic',mechanic:'d11Fill',values:{enabled:1}}]};
}
export const D11_AUGMENTS = freezeContent(Object.fromEntries(
  (['all-for-one-i','trifecta-i','spirit-link'] as const).map(id=>[id,d11Definition(id)])));
export const D11_ANOMALIES = freezeContent(Object.fromEntries(
  (['avarice-incarnate','headhunter'] as const).map(id=>[id,d11Definition(id)])));
