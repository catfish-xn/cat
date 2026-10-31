import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { compactEntryStrings } from '../scripts/vite-production-size';

describe('v26 entry string dictionary', () => {
  it('round-trips Unicode, escaped text, property reads and method receivers', () => {
    const source = `
      const object = { equipment: '已没收！', nested: { equipment: '已没收！' },
        describe() { return this.equipment; } };
      globalThis.result = JSON.stringify([object.equipment, object.nested.equipment,
        object?.equipment, object.describe(), '已没收！', '引号"与换行\\n', '引号"与换行\\n', '引号"与换行\\n']);
    `;
    const context: { result?: string } = {};
    runInNewContext(source, context);
    const compacted: { result?: string } = {};
    const transformed = compactEntryStrings(source);
    expect(transformed).not.toBe(source); // Exercise a real dictionary, not a no-op pass.
    runInNewContext(transformed, compacted);
    expect(compacted.result).toBe(context.result);
  });

  it('keeps pipe and NUL containing values exact, including property keys and JSON output', () => {
    const values = ['before|after', 'before\0after', '普通文本', 'back\\slash', 'line\nbreak'];
    const source = `
      const values = ${JSON.stringify(values.flatMap(value => [value, value, value]))};
      const object = { 'before|after': 1, 'before\\0after': 2 };
      globalThis.result = JSON.stringify([values, object['before|after'], object['before|after'], object['before|after'],
        object['before\\0after'], object['before\\0after'], object['before\\0after']]);
    `;
    const expected: { result?: string } = {}, actual: { result?: string } = {};
    runInNewContext(source, expected);
    runInNewContext(compactEntryStrings(source), actual);
    expect(actual.result).toBe(expected.result);
    expect(JSON.parse(actual.result!)[0]).toEqual(values.flatMap(value => [value, value, value]));
  });
});
