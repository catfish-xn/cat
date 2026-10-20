import type {ChoiceDefinition} from '../strategy-types';
import {freezeContent} from './freeze';
export const S13_P1_ANOMALIES:Readonly<Record<string,ChoiceDefinition>>=freezeContent<Record<string,ChoiceDefinition>>({
 'avarice-incarnate':{id:'avarice-incarnate',name:'贪财化身',description:'获得5金币。获得15%伤害增幅，每拥有2金币再获得1%，最多40%。',effects:[
 {kind:'mechanic',mechanic:'acquisitionGold',values:{amount:5}},
 {kind:'mechanic',mechanic:'avarice',values:{baseBps:1500,perStepBps:100,goldStep:2,capBps:4000}},
 ]},
});
