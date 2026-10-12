import { describe, expect, it } from 'vitest';
import { createMatch } from '../../../src/simulation/match';
import { emptyCombat } from '../helpers';
import { COMBAT_SPLIT, canonicalJson, commandContent, encodeCombat, parseClientMessage, validateClientCommand, NET_PROTOCOL_VERSION, type ClientMessage } from '../../../src/server/net/messages';

const envelope = (body: Record<string, unknown>, extra: Record<string, unknown> = {}) => JSON.stringify({ protocolVersion: NET_PROTOCOL_VERSION, commandId: 7, ...body, ...extra });
const command = (command: unknown, extra: Record<string, unknown> = {}) => envelope({ type: 'command', roomId: 'r', round: 1, seatRevision: 0, command }, extra);

describe('net/messages: validation', () => {
  it('accepts every client message shape and rebuilds it field by field', () => {
    const buy = parseClientMessage(command({ type: 'buy', slot: 2, generation: 3 }));
    expect(buy).toEqual({ ok: true, message: { type: 'command', protocolVersion: 1, commandId: 7, roomId: 'r', round: 1, seatRevision: 0, command: { type: 'buy', slot: 2, generation: 3 } } });
    expect(parseClientMessage(envelope({ type: 'join', name: '甲' })).ok).toBe(true);
    expect(parseClientMessage(envelope({ type: 'leaveQueue' })).ok).toBe(true);
    expect(parseClientMessage(envelope({ type: 'start' })).ok).toBe(true);
    expect(parseClientMessage(envelope({ type: 'resume', token: 'abc' })).ok).toBe(true);
    const deploy = parseClientMessage(command({ type: 'deploy', unitId: 'u1', target: { kind: 'board', cell: { col: 1, row: 2 } } }));
    expect(deploy.ok).toBe(true);
  });
  it('refuses fields a client must not supply: seatId, gold, hp, anything unknown', () => {
    const forgedSeat = parseClientMessage(command({ type: 'reroll' }, { seatId: 'seat-2' }));
    expect(forgedSeat).toMatchObject({ ok: false, code: 'invalid-message', commandId: 7 });
    expect(parseClientMessage(command({ type: 'buy', slot: 0, generation: 1, gold: 999 }))).toMatchObject({ ok: false, code: 'invalid-message' });
    expect(parseClientMessage(command({ type: 'setGold', gold: 999 }))).toMatchObject({ ok: false, code: 'invalid-message' });
    expect(parseClientMessage(command({ type: 'reroll' }, { hp: 100 }))).toMatchObject({ ok: false, code: 'invalid-message' });
  });
  it('refuses wrong field types and ranges', () => {
    expect(parseClientMessage(command({ type: 'buy', slot: '0', generation: 1 }))).toMatchObject({ ok: false, code: 'invalid-message' });
    expect(parseClientMessage(command({ type: 'buy', slot: -1, generation: 1 }))).toMatchObject({ ok: false, code: 'invalid-message' });
    expect(parseClientMessage(command({ type: 'buy', slot: 1.5, generation: 1 }))).toMatchObject({ ok: false, code: 'invalid-message' });
    expect(parseClientMessage(command({ type: 'shopLock', locked: 'yes', generation: 1 }))).toMatchObject({ ok: false, code: 'invalid-message' });
    expect(parseClientMessage(command({ type: 'deploy', unitId: 'u1', target: { kind: 'board', cell: { col: 1 } } }))).toMatchObject({ ok: false, code: 'invalid-message' });
    expect(parseClientMessage(command({ type: 'deploy', unitId: '', target: { kind: 'bench', slot: 0 } }))).toMatchObject({ ok: false, code: 'invalid-message' });
    expect(parseClientMessage(envelope({ type: 'join', name: 'x'.repeat(25) }))).toMatchObject({ ok: false, code: 'invalid-message' });
    expect(parseClientMessage(command({ type: 'sell', unitId: 'u'.repeat(257) }))).toMatchObject({ ok: false, code: 'invalid-message' });
    expect(parseClientMessage(command({ type: 'choose', choiceId: 'c'.repeat(120), generation: 0, definitionId: 'sword' })).ok).toBe(true);
    expect(parseClientMessage(envelope({ type: 'command', roomId: 'r', round: 1, seatRevision: 0 }))).toMatchObject({ ok: false, code: 'invalid-message' });
  });
  it('refuses the wrong protocol version, bad ids and non-JSON, keeping the commandId when usable', () => {
    expect(parseClientMessage(JSON.stringify({ protocolVersion: 2, commandId: 9, type: 'start' }))).toEqual({ ok: false, code: 'unsupported-protocol', detail: 'protocolVersion must be 1', commandId: 9 });
    expect(parseClientMessage(JSON.stringify({ protocolVersion: 1, commandId: 0, type: 'start' }))).toMatchObject({ ok: false, code: 'invalid-message', commandId: null });
    expect(parseClientMessage(JSON.stringify({ protocolVersion: 1, commandId: '1', type: 'start' }))).toMatchObject({ ok: false, code: 'invalid-message', commandId: null });
    expect(parseClientMessage('{not json')).toEqual({ ok: false, code: 'invalid-json', detail: 'message is not valid JSON', commandId: null });
    expect(parseClientMessage('[1,2]')).toMatchObject({ ok: false, code: 'invalid-message', commandId: null });
    expect(parseClientMessage(JSON.stringify({ protocolVersion: 1, commandId: 3, type: 'nope' }))).toMatchObject({ ok: false, code: 'invalid-message', commandId: 3 });
  });
  it('validateClientCommand throws on anything outside the union', () => {
    expect(() => validateClientCommand({ type: 'buy', slot: 0, generation: 0, extra: 1 })).toThrow(/unexpected field "extra"/);
    expect(() => validateClientCommand(null)).toThrow();
    expect(validateClientCommand({ type: 'anomalyTarget', choiceId: 'c', generation: 1, unitId: '' })).toEqual({ type: 'anomalyTarget', choiceId: 'c', generation: 1, unitId: '' });
  });
});

describe('net/messages: content identity', () => {
  it('canonicalJson sorts keys at every depth', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null } })).toBe('{"a":{"c":null,"d":[3,{"y":2,"z":1}]},"b":1}');
  });
  it('commandContent ignores commandId and protocolVersion but sees every other field', () => {
    const base: ClientMessage = { type: 'command', protocolVersion: 1, commandId: 1, roomId: 'r', round: 1, seatRevision: 0, command: { type: 'buy', slot: 1, generation: 2 } };
    expect(commandContent(base)).toBe(commandContent({ ...base, commandId: 99 }));
    expect(commandContent(base)).not.toBe(commandContent({ ...base, command: { type: 'buy', slot: 2, generation: 2 } }));
    expect(commandContent(base)).not.toBe(commandContent({ ...base, seatRevision: 1 }));
  });
});

describe('net/messages: combat encoding (B8)', () => {
  const byteLength = (text: string) => Buffer.byteLength(text);
  const combat = (count: number) => ({ type: 'combat' as const, roomId: '房间"1', round: 7, battleId: 'room:r7:seat-1', frames: Array.from({ length: count }, (_, index) => ({
    state: { ...emptyCombat(createMatch(1)), tick: index }, events: [],
  })) });
  it('sends a small battle as exactly JSON.stringify of the whole message', () => {
    const message = combat(3);
    expect(encodeCombat(message, byteLength)).toEqual([JSON.stringify(message)]);
  });
  it('splits a large battle into parts that are exactly JSON.stringify of each part message', () => {
    const frameBytes = byteLength(JSON.stringify(combat(1).frames[0]));
    const message = combat(Math.ceil(COMBAT_SPLIT.maxBytes / frameBytes) + COMBAT_SPLIT.framesPerPart + 3);
    const texts = encodeCombat(message, byteLength);
    const total = Math.ceil(message.frames.length / COMBAT_SPLIT.framesPerPart);
    expect(texts).toHaveLength(total);
    texts.forEach((text, index) => {
      const frames = message.frames.slice(index * COMBAT_SPLIT.framesPerPart, (index + 1) * COMBAT_SPLIT.framesPerPart);
      expect(text).toBe(JSON.stringify({ ...message, frames, part: index + 1, total }));
    });
  }, 30_000);
});
