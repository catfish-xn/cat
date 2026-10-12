/**
 * Shared card pool feedback (B5, contract §12.3/§12.5). Pure display: the server decides every refusal and every empty
 * slot; the UI only words them. An explicitly empty shop slot is `{status:'purchased', empty:true}` and is drawn as an
 * out-of-stock slot, never as a hero.
 */
import type { ShopSlot } from '../../simulation/match-types';

/** Refusal codes the shared pool adds on top of MatchFailure (online only). */
export const POOL_REFUSAL_TEXT: Readonly<Record<string, string>> = {
  'pool-empty': '共享卡池已空 · 本次刷新未扣金币',
  'empty-slot': '该格缺货 · 共享卡池里已没有这张卡',
  'stale-seat': '画面已更新 · 请重新操作',
  'seat-eliminated': '你已被淘汰，只能观看',
  'multiplayer-required': '服务器席位状态异常 · 请刷新页面',
  'invalid-pool': '服务器卡池状态异常 · 请刷新页面',
  'invalid-seat-state': '服务器席位状态异常 · 请刷新页面',
  'invalid-command': '客户端发送了无效命令（请刷新页面）',
};

export const isEmptyShopSlot = (slot: ShopSlot): boolean => slot.status === 'purchased' && slot.empty === true;
