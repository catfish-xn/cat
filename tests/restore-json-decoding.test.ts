import { expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { restoreMatch } from '../src/simulation/serialization';
import { decodeMatchJson, shareGeneratedJson } from '../src/simulation/immutable-json';

const failure = (run: () => unknown) => {
  try { run(); } catch (e) { if (e instanceof Error) return { name: e.name, message: e.message }; throw e; }
  throw Error('Expected failure');
};
it('decodes only exact constructor bytes and still rejects edits after warming the representation', () => {
  const state = createMatch(42), text = JSON.stringify(state), decoded = decodeMatchJson(text);
  expect(decoded.sharedM8).toBe(state.m8);
  expect(decoded.value).toEqual(JSON.parse(text));
  expect(decoded.value).not.toBe(state);
  expect(restoreMatch(text)).toEqual(state);
  const forged = { ...state, m8: shareGeneratedJson({ ...state.m8, round: { ...state.m8.round, roundId: 'known-but-invalid' } }) };
  const forgedText = JSON.stringify(forged);
  expect(decodeMatchJson(forgedText).sharedM8).toBe(forged.m8);
  expect(failure(() => restoreMatch(forgedText))).toEqual(failure(() => restoreMatch(forged)));
  for (const change of [
    (s: any) => { s.gold = -1; },
    (s: any) => { s.m8.round.roundId = 'forged'; },
    (s: any) => { s.m8.loot.layoutBinding.layout.throughRoundOrdinal++; },
    (s: any) => { s.resourceProvenance.entries[0].source.extra = 1; },
  ]) {
    const raw = JSON.parse(text); change(raw);
    expect(failure(() => restoreMatch(JSON.stringify(raw)))).toEqual(failure(() => restoreMatch(raw)));
  }
});
it('never uses an admitted save as a decoding certificate', () => {
  const raw = JSON.parse(JSON.stringify(createMatch(43)));
  raw.m8.extraDecoderControl = 37;
  const text = JSON.stringify(raw);
  expect(restoreMatch(text)).toEqual(raw);
  expect(decodeMatchJson(text).sharedM8).toBeUndefined();
  expect(restoreMatch(text)).toEqual(raw);
});
it('preserves native syntax errors and falls back for escaped, repeated, nested-only or whitespace keys', () => {
  const text = JSON.stringify(createMatch(42)), base = JSON.parse(text);
  const variants = [
    text.replace('"m8":', '"\\u006d8":'),
    text.replace('"m8":', '"m8" : '),
    text.slice(0, -1) + ',"m8":' + JSON.stringify(base.m8) + '}',
    JSON.stringify(Object.fromEntries(Object.entries({ ...base, nested: { m8: base.m8 } }).filter(([key]) => key !== 'm8'))),
  ];
  for (const source of variants) {
    expect(decodeMatchJson(source).sharedM8).toBeUndefined();
    expect(decodeMatchJson(source).value).toEqual(JSON.parse(source));
  }
  for (const source of [text.slice(0, -1) + ',}', text + '!', text.replace('"gold":0', '"gold":')]) {
    if (source === text) continue;
    expect(failure(() => decodeMatchJson(source))).toEqual(failure(() => JSON.parse(source)));
  }
  const zero = text.slice(0, -1) + ',"decoderZero":-0}';
  expect(decodeMatchJson(zero).sharedM8).toBeUndefined();
  expect(Object.is((decodeMatchJson(zero).value as any).decoderZero, -0)).toBe(true);
  const underflow = text.slice(0, -1) + ',"decoderZero":-1e-400}';
  expect(Object.is((decodeMatchJson(underflow).value as any).decoderZero, -0)).toBe(true);
  expect(Object.is((restoreMatch(underflow) as any).decoderZero, -0)).toBe(true);
});
