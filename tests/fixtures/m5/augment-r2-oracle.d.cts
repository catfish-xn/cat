import type { ItemInstance } from '../../../src/simulation/strategy-types';
export function angerItems(items:readonly ItemInstance[]):readonly ItemInstance[];
export function angerDefinition(definitionId:string,augments:readonly {definitionId:string}[]):string;
export function angerNumbers(attacks:number,copies?:number):{armor:number;magicResist:number;abilityPower:number;attackDamageBps:number;attackSpeedBps:number};
export const excluded:readonly string[];
export function portableGrant(before:unknown,command:unknown):{receiptId:string;source:string;kind:'item';definitionId:string;itemId:string;round:number;roundId:string}|null;
export function validateAngerChoice(before:unknown,after:unknown,command:unknown):void;
export function validateAngerTransitions(before:unknown,after:unknown,command:unknown,rewards:unknown,lootReceipts?:readonly unknown[]):void;
