/**
 * v15 UI send path and wording (docs/UI_REQUESTS.md 法球领取 / 按卡刷新): the client sends the contract's commands as they
 * are, also during my battle for claimOrb, and words the rules' claim receipts without pricing anything itself.
 */
import { describe, expect, it } from 'vitest';
import type { CombatReplay } from '../../src/server-entry';
import { createMatch } from '../../src/server-entry';
import type { LootReceipt } from '../../src/simulation/m8/contracts';
import { RemoteSession } from '../../src/rendering/online/remote-session';
import type { GameClient, WireCommand } from '../../src/rendering/online/protocol';
import { orbPayloadName, orbReceiptText, orbVariant, readOrbClaimReceipts, readPublicOrbs, readUnclaimedOrbs } from '../../src/rendering/online/orb-dock';

function recordingClient() {
  const sent: unknown[] = [];
  const client: GameClient = { transport: 'websocket', listen: () => () => {}, joinQueue: () => {}, leaveQueue: () => {}, startMatch: () => {},
    send: (command: WireCommand) => { sent.push(command); return { ok: 'pending', commandId: sent.length }; }, reset: () => {}, dispose: () => {} };
  return { client, sent };
}
const receipt = (fields: Partial<LootReceipt> & Pick<LootReceipt, 'payload'>): LootReceipt =>
  ({ receiptId: 'r', dropId: 'd', grantedItemIds: [], grantedUnitIds: [], ...fields });

describe('v15 orb and per-card reroll commands', () => {
  it('claimOrb carries the shown round and the orb id, and is sent while my battle plays', () => {
    const { client, sent } = recordingClient();
    const session = new RemoteSession(client, undefined, () => 0), round = session.state.round;
    expect(session.claimOrb('orb:1-2:0')).toMatchObject({ ok: false });
    expect(session.takeNotice()).toEqual({ kind: 'pending', commandId: 1 });
    const view = { combatId: 'c', tick: 0, maxTicks: 1200, status: 'running', result: null, board: session.state.preparation.board, units: [] };
    session.receiveReplay({ initial: view, terminal: { ...view, tick: 1, status: 'finished' }, ticks: [{ tick: 1, events: [] }] } as unknown as CombatReplay);
    expect(session.inBattle).toBe(true);
    session.claimOrb('orb:1-3:0');
    expect(sent).toEqual([{ type: 'claimOrb', round, orbId: 'orb:1-2:0' }, { type: 'claimOrb', round, orbId: 'orb:1-3:0' }]);
  });
  it('rerollAugment names the card', () => {
    const { client, sent } = recordingClient();
    new RemoteSession(client, undefined, () => 0).augmentReroll('round:2-1:augment', 0, 2);
    expect(sent).toEqual([{ type: 'rerollAugment', choiceId: 'round:2-1:augment', generation: 0, optionIndex: 2 }]);
  });
});

describe('v15 orb display fields', () => {
  it('reads a trait orb skin only from a unique unit receipt of this seat; anything else keeps the generic tier', () => {
    const base = createMatch(1);
    const unit = (orbId: string, source: string) => ({ receiptId: `r:${orbId}:${source}`, round: 3, roundId: '2-1', source,
      kind: 'unit', definitionId: 'jinx', resolution: 'orb', unitId: null, gold: 0, orbId });
    const shown = (receipts: unknown[]) => ({ ...base, seatMechanics: { receipts } }) as unknown as typeof base;
    expect(orbVariant(shown([unit('a', 'conqueror')]), 'a')).toBe('warband');
    expect(orbVariant(shown([unit('b', 'black-market')]), 'b')).toBe('crime');
    expect(orbVariant(shown([unit('c', 'armory')]), 'c')).toBeUndefined();
    expect(orbVariant(shown([unit('d', 'conqueror'), unit('d', 'black-market')]), 'd')).toBeUndefined();
    expect(orbVariant(shown([{ ...unit('e', 'conqueror'), resolution: 'held' }]), 'e')).toBeUndefined();
    expect(orbVariant(base, 'a')).toBeUndefined();
  });
  it('names epic rewards by their own names, never the unit fallback, and says a forge opens a choice', () => {
    const forge = { kind: 'forge', definitionId: 'TFT_ArmoryKeyCompleted', quantity: 1 } as const;
    const artifact = { kind: 'forge', definitionId: 'TFT_ArmoryKeyOrnn', quantity: 1 } as const;
    const crown = { kind: 'item', definitionId: 'TFT_Item_ForceOfNature', quantity: 1 } as const;
    expect(orbPayloadName(forge)).toBe('成装锻造器');
    expect(orbPayloadName(artifact)).toBe('神器装备锻造器');
    for (const payload of [forge, artifact, crown]) expect(orbPayloadName(payload)).not.toMatch(/未知/);
    expect(orbReceiptText(receipt({ payload: forge, resolution: 'held' }))).toBe('成装锻造器 · 进入四选一');
    expect(orbReceiptText(receipt({ payload: artifact, resolution: 'held' }))).toBe('神器装备锻造器 · 进入四选一');
    expect(orbReceiptText(receipt({ payload: crown, resolution: 'held' }))).toMatch(/已放入物品栏$/);
  });
  it('reads unclaimedOrbs and orbClaimReceipts off the display state; none offline', () => {
    const offline = createMatch(1);
    expect(readUnclaimedOrbs(offline)).toEqual([]);
    expect(readOrbClaimReceipts(offline)).toEqual([]);
    const orb = { orbId: 'o', roundId: '1-2', tier: 'blue', entries: [{ kind: 'gold', quantity: 3 }], source: 'pve', queued: true };
    const shown = { ...offline, unclaimedOrbs: [orb], orbClaimReceipts: [] } as unknown as typeof offline;
    expect(readUnclaimedOrbs(shown)).toEqual([orb]);
  });
  it('words each receipt resolution with the receipt amount', () => {
    const unit = { kind: 'unit', definitionId: 'jinx', quantity: 1, starLevel: 2 } as const;
    expect(orbReceiptText(receipt({ payload: unit, resolution: 'capacity-sold', gold: 5 }))).toMatch(/^备战席已满，.+★★ 自动出售 \+5 金币$/);
    expect(orbReceiptText(receipt({ payload: unit, resolution: 'gold', gold: 2 }))).toMatch(/卡池缺货，补偿 \+2 金币$/);
    expect(orbReceiptText(receipt({ payload: unit, resolution: 'held' }))).toMatch(/★★ 已进入备战席$/);
    expect(orbReceiptText(receipt({ payload: { kind: 'gold', quantity: 3 }, resolution: 'held' }))).toBe('+3 金币');
    expect(orbReceiptText(receipt({ payload: unit, resolution: 'forfeited', gold: 0 }))).toBeNull();
  });
  it('reads another seat\'s public orbs (count and tiers only); absent or malformed is none', () => {
    expect(readPublicOrbs({ seatId: 's1', orbs: { count: 2, tiers: ['gray', 'gold'] } })).toEqual({ count: 2, tiers: ['gray', 'gold'] });
    expect(readPublicOrbs({ seatId: 's1' })).toBeNull();
    expect(readPublicOrbs({ seatId: 's1', orbs: { count: '2' } })).toBeNull();
  });
});
