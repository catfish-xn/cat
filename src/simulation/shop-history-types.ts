import type { Shop } from './match-types';

/** Conditional evidence, not a new outer save/replay envelope. Never emitted without a shop augment. */
export const SHOP_HISTORY_VERSION = 'shop-history-v1';
export type ShopDrawCause = 'reroll' | 'dual-purpose' | 'natural' | 'subscription' | 'shop-glitch';
export interface ShopHistoryPoint {
 readonly round:number; readonly level:number; readonly xp:number; readonly resourcePrefix:number;
 readonly owners:readonly string[];
 readonly gold:number; readonly mechanicPrefix:number; readonly lootPrefix:number; readonly schedulePrefix:number; readonly economyPrefix:number;
}
export interface ShopCredit { readonly choiceId:string; readonly ordinal:number }
export type ShopHistoryEntry =
 | {readonly kind:'acquire';readonly point:ShopHistoryPoint;readonly choiceId:string}
 | {readonly kind:'round';readonly point:ShopHistoryPoint}
 | {readonly kind:'xp';readonly point:ShopHistoryPoint;readonly goldCost:number}
 | {readonly kind:'release';readonly point:ShopHistoryPoint}
 | {readonly kind:'anomaly-reroll';readonly point:ShopHistoryPoint;readonly choiceId:string}
 | {readonly kind:'lock';readonly point:ShopHistoryPoint;readonly locked:boolean}
 | {readonly kind:'draw';readonly point:ShopHistoryPoint;readonly cause:ShopDrawCause;readonly shop:Shop;readonly rngState:number;
    readonly credit:ShopCredit|null;readonly goldCost:number;readonly starry:readonly boolean[];readonly stock?:Readonly<Record<string,number>>}
 | {readonly kind:'buy';readonly point:ShopHistoryPoint;readonly slot:number;readonly starLevel:1|2;readonly goldCost:number}
 | {readonly kind:'firesale';readonly point:ShopHistoryPoint;readonly slot:number;readonly receiptId:string};
export interface ShopHistory {
 readonly version:typeof SHOP_HISTORY_VERSION;
 readonly initial:ShopHistoryPoint & {readonly shop:Shop;readonly rngState:number};
 readonly entries:readonly ShopHistoryEntry[];
}
