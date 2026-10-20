import { describe, expect, it } from 'vitest';
import { canonicalJson, commandContent, parseClientMessage, validateClientCommand, NET_PROTOCOL_VERSION, type ClientMessage } from '../../../src/server/net/messages';

const envelope = (body: Record<string, unknown>, extra: Record<string, unknown> = {}) => JSON.stringify({ protocolVersion: NET_PROTOCOL_VERSION, commandId: 7, ...body, ...extra });
const command = (command: unknown, extra: Record<string, unknown> = {}) => envelope({ type: 'command', roomId: 'r', round: 1, seatRevision: 0, command }, extra);

describe('net/messages: validation', () => {
  it('accepts every client message shape and rebuilds it field by field', () => {
    const buy = parseClientMessage(command({ type: 'buy', slot: 2, generation: 3 }));
    expect(buy).toEqual({ ok: true, message: { type: 'command', protocolVersion: NET_PROTOCOL_VERSION, commandId: 7, roomId: 'r', round: 1, seatRevision: 0, command: { type: 'buy', slot: 2, generation: 3 } } });
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
    // T13-B (contract §18.7): protocol 2; a protocol 1 client is refused.
    expect(parseClientMessage(JSON.stringify({ protocolVersion: 1, commandId: 9, type: 'start' }))).toEqual({ ok: false, code: 'unsupported-protocol', detail: `protocolVersion must be ${NET_PROTOCOL_VERSION} (got 1): client and server versions differ, reload the page`, commandId: 9 });
    expect(parseClientMessage(JSON.stringify({ protocolVersion: NET_PROTOCOL_VERSION, commandId: 0, type: 'start' }))).toMatchObject({ ok: false, code: 'invalid-message', commandId: null });
    expect(parseClientMessage(JSON.stringify({ protocolVersion: NET_PROTOCOL_VERSION, commandId: '1', type: 'start' }))).toMatchObject({ ok: false, code: 'invalid-message', commandId: null });
    expect(parseClientMessage('{not json')).toEqual({ ok: false, code: 'invalid-json', detail: 'message is not valid JSON', commandId: null });
    expect(parseClientMessage('[1,2]')).toMatchObject({ ok: false, code: 'invalid-message', commandId: null });
    expect(parseClientMessage(JSON.stringify({ protocolVersion: NET_PROTOCOL_VERSION, commandId: 3, type: 'nope' }))).toMatchObject({ ok: false, code: 'invalid-message', commandId: 3 });
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
    const base: ClientMessage = { type: 'command', protocolVersion: NET_PROTOCOL_VERSION, commandId: 1, roomId: 'r', round: 1, seatRevision: 0, command: { type: 'buy', slot: 1, generation: 2 } };
    expect(commandContent(base)).toBe(commandContent({ ...base, commandId: 99 }));
    expect(commandContent(base)).not.toBe(commandContent({ ...base, command: { type: 'buy', slot: 2, generation: 2 } }));
    expect(commandContent(base)).not.toBe(commandContent({ ...base, seatRevision: 1 }));
  });
});

