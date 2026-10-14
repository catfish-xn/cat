import type { RoundDefinition } from '../m8/contracts';
import { freezeContent } from './freeze';

/** Authoritative M8B schedule, installed in Match and the content digest.
 * B6-Q1/Q2/Q3 are approved project conventions; see docs/M8_B6_HANDOFF.md.
 * Encounter IDs are from M8B_ENCOUNTERS §2, without importing B7 monster content.
 */
export const ROUND_CATALOG: readonly RoundDefinition[] = freezeContent<RoundDefinition[]>([
  {roundId:'1-2',ordinal:1,stage:1,subround:2,kind:'pve',isFinal:false,encounterId:'minions-a-v1',displayName:'1-2'},
  {roundId:'1-3',ordinal:2,stage:1,subround:3,kind:'pve',isFinal:false,encounterId:'minions-b-v1',displayName:'1-3'},
  {roundId:'1-4',ordinal:3,stage:1,subround:4,kind:'pve',isFinal:false,encounterId:'minions-c-v1',displayName:'1-4'},
  {roundId:'2-1',ordinal:4,stage:2,subround:1,kind:'pvp',isFinal:false,encounterId:null,displayName:'2-1'},
  {roundId:'2-2',ordinal:5,stage:2,subround:2,kind:'pvp',isFinal:false,encounterId:null,displayName:'2-2'},
  {roundId:'2-3',ordinal:6,stage:2,subround:3,kind:'pvp',isFinal:false,encounterId:null,displayName:'2-3'},
  {roundId:'2-4',ordinal:7,stage:2,subround:4,kind:'supply',isFinal:false,encounterId:null,displayName:'2-4'},
  {roundId:'2-5',ordinal:8,stage:2,subround:5,kind:'pvp',isFinal:false,encounterId:null,displayName:'2-5'},
  {roundId:'2-6',ordinal:9,stage:2,subround:6,kind:'pvp',isFinal:false,encounterId:null,displayName:'2-6'},
  {roundId:'2-7',ordinal:10,stage:2,subround:7,kind:'pve',isFinal:false,encounterId:'krugs-v1',displayName:'2-7'},
  {roundId:'3-1',ordinal:11,stage:3,subround:1,kind:'pvp',isFinal:false,encounterId:null,displayName:'3-1'},
  {roundId:'3-2',ordinal:12,stage:3,subround:2,kind:'pvp',isFinal:false,encounterId:null,displayName:'3-2'},
  {roundId:'3-3',ordinal:13,stage:3,subround:3,kind:'pvp',isFinal:false,encounterId:null,displayName:'3-3'},
  {roundId:'3-4',ordinal:14,stage:3,subround:4,kind:'supply',isFinal:false,encounterId:null,displayName:'3-4'},
  {roundId:'3-5',ordinal:15,stage:3,subround:5,kind:'pvp',isFinal:false,encounterId:null,displayName:'3-5'},
  {roundId:'3-6',ordinal:16,stage:3,subround:6,kind:'pvp',isFinal:false,encounterId:null,displayName:'3-6'},
  {roundId:'3-7',ordinal:17,stage:3,subround:7,kind:'pve',isFinal:false,encounterId:'wolves-v1',displayName:'3-7'},
  {roundId:'4-1',ordinal:18,stage:4,subround:1,kind:'pvp',isFinal:false,encounterId:null,displayName:'4-1'},
  {roundId:'4-2',ordinal:19,stage:4,subround:2,kind:'pvp',isFinal:false,encounterId:null,displayName:'4-2'},
  {roundId:'4-3',ordinal:20,stage:4,subround:3,kind:'pvp',isFinal:false,encounterId:null,displayName:'4-3'},
  {roundId:'4-4',ordinal:21,stage:4,subround:4,kind:'supply',isFinal:false,encounterId:null,displayName:'4-4'},
  {roundId:'4-5',ordinal:22,stage:4,subround:5,kind:'pvp',isFinal:false,encounterId:null,displayName:'4-5'},
  {roundId:'4-6',ordinal:23,stage:4,subround:6,kind:'pvp',isFinal:false,encounterId:null,displayName:'4-6'},
  {roundId:'4-7',ordinal:24,stage:4,subround:7,kind:'pve',isFinal:false,encounterId:'razorbeaks-v1',displayName:'4-7'},
  {roundId:'5-1',ordinal:25,stage:5,subround:1,kind:'pvp',isFinal:false,encounterId:null,displayName:'5-1'},
  {roundId:'5-2',ordinal:26,stage:5,subround:2,kind:'pvp',isFinal:false,encounterId:null,displayName:'5-2'},
  {roundId:'5-3',ordinal:27,stage:5,subround:3,kind:'pvp',isFinal:false,encounterId:null,displayName:'5-3'},
  {roundId:'5-4',ordinal:28,stage:5,subround:4,kind:'supply',isFinal:false,encounterId:null,displayName:'5-4'},
  {roundId:'5-5',ordinal:29,stage:5,subround:5,kind:'pvp',isFinal:false,encounterId:null,displayName:'5-5'},
  {roundId:'5-6',ordinal:30,stage:5,subround:6,kind:'pvp',isFinal:false,encounterId:null,displayName:'5-6'},
  {roundId:'5-7',ordinal:31,stage:5,subround:7,kind:'pve',isFinal:false,encounterId:'elder-dragon-v1',displayName:'5-7'},
  {roundId:'6-1',ordinal:32,stage:6,subround:1,kind:'pvp',isFinal:false,encounterId:null,displayName:'6-1'},
  {roundId:'6-2',ordinal:33,stage:6,subround:2,kind:'pvp',isFinal:false,encounterId:null,displayName:'6-2'},
  {roundId:'6-3',ordinal:34,stage:6,subround:3,kind:'pvp',isFinal:false,encounterId:null,displayName:'6-3'},
  {roundId:'6-4',ordinal:35,stage:6,subround:4,kind:'supply',isFinal:false,encounterId:null,displayName:'6-4'},
  {roundId:'6-5',ordinal:36,stage:6,subround:5,kind:'pvp',isFinal:false,encounterId:null,displayName:'6-5'},
  {roundId:'6-6',ordinal:37,stage:6,subround:6,kind:'pvp',isFinal:false,encounterId:null,displayName:'6-6'},
  {roundId:'6-7',ordinal:38,stage:6,subround:7,kind:'pve',isFinal:true,encounterId:'rift-herald-v1',displayName:'6-7'},
]);

export type RoundSemanticNode = 'augment' | 'anomaly' | 'supply';

/** Round-ID anchors only, not executable ScheduleEvents or grant receipts.
 * No old opening component package. Old x-7 reward/component events belong to B8.
 */
export const ROUND_SEMANTIC_NODES = freezeContent<Readonly<Partial<Record<string, readonly RoundSemanticNode[]>>>>({
  '2-1':['augment'],
  '2-4':['supply'],
  '3-2':['augment'],
  '3-4':['supply'],
  '4-2':['augment'],
  '4-4':['supply'],
  '4-6':['anomaly'],
  '5-4':['supply'],
  '6-4':['supply'],
});
