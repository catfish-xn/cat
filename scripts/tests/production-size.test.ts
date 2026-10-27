import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { build, transform } from 'esbuild';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { assertNoPhaserFxUse, compactEntryStrings, trimPhaserRuntime } from '../vite-production-size';

const require = createRequire(import.meta.url);
const phaser = join(dirname(require.resolve('phaser/package.json')), 'src');
const source = (name: string) => readFileSync(join(phaser, name), 'utf8');
const execute = (code: string) => {
  const module = { exports: {} as { probe: () => string } };
  // Use the native structuredClone in the same realm as the generated module;
  // an injected clone in a vm would return objects with the wrong prototype.
  new Function('module', 'exports', code)(module, module.exports);
  return module.exports.probe();
};

describe('production representation preserves runtime semantics', () => {
  it('preserves keys, JSON, descriptors, inferred names, this, optional chains, getters and __proto__', async () => {
    const code = `
      module.exports.probe = () => {
        let reads = 0;
        const prototype = { inherited: true };
        const object = { __proto__: prototype, longProperty: 'longProperty',
          anotherProperty: function () { return this.longProperty; },
          get getterProperty() { reads++; return this.longProperty; } };
        const { 'longProperty': destructured } = object;
        const absent = null;
        const value = [object.longProperty, object['longProperty'], destructured,
          object.anotherProperty(), object.anotherProperty.name, object.anotherProperty?.(),
          object.getterProperty, object?.getterProperty, object['getterProperty'],
          absent?.longProperty, absent?.anotherProperty?.(), reads, Object.keys(object),
          Object.getPrototypeOf(object) === prototype, Object.getOwnPropertyDescriptor(object,'longProperty'),
          'nul\\0value', 'nul\\0value', 'nul\\0value', '中文🙂', '中文🙂', '中文🙂'];
        delete object.longProperty;
        value.push(Object.hasOwn(object, 'longProperty'), 'longProperty' in object);
        return JSON.stringify(value);
      };`;
    const compact = compactEntryStrings(code);
    expect(compact).not.toBe(code);
    expect(execute(compact)).toBe(execute(code));
    expect(execute((await transform(compact, { minify: true, target: 'es2022' })).code)).toBe(execute(code));
  });

  it('keeps import/export names, directives, prototype setters and destructuring keys literal', () => {
    const code = `"use strict";
      import { "longName" as local } from 'longName';
      export { local as "longName" }; export * from 'longName';
      const { 'longName': renamed } = { longName: 'longName' };
      const object = { '__proto__': null, '__long': 'longName' };
      const f = () => import('longName');
      console.log('longName', 'longName', 'longName', renamed, object, f);`;
    const compact = compactEntryStrings(code);
    for (const text of ['"use strict"', '"longName" as local', 'local as "longName"',
      "from 'longName'", "'longName': renamed", "'__proto__': null", "import('longName')"])
      expect(compact).toContain(text);
    const result = ts.transpileModule(compact, { reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
    expect(result.diagnostics).toEqual([]);
  });

  it('avoids name collisions, leaves small inputs alone and rejects direct eval', () => {
    expect(compactEntryStrings('const answer = 42;')).toBe('const answer = 42;');
    const code = `const __sharedText0 = 4; module.exports.probe = () => JSON.stringify([
      __sharedText0, 'repeated-value', 'repeated-value', 'repeated-value']);`;
    expect(execute(compactEntryStrings(code))).toBe(execute(code));
    expect(() => compactEntryStrings("eval('source')")).toThrow('scope audit');
  });

  it('preserves complete content/loot digests, seeded matches, events, RNG and restore in a minified domain bundle', async () => {
    const result = await build({ stdin: { resolveDir: process.cwd(), contents: `
      import * as api from './src/simulation/match';
      import { serializeMatch, restoreMatch } from './src/simulation/serialization';
      import { canonicalContent, CONTENT_DIGEST } from './src/simulation/content';
      import { LOOT_REPLAY_DIGEST } from './src/simulation/loot-freeze';
      import { recomputeContentDigest } from './scripts/content-digest';
      import { recomputeLootReplayDigest } from './scripts/loot-replay-digest';
      export function probe() {
        const routes = [42, 554, 1, 2].map(seed => {
          let state = api.createMatch(seed); const events = [];
          for (let i = 0; i < 4; i++) {
            let result;
            if (state.phase === 'choice') {
              const c = state.pendingChoice;
              result = api.selectChoice(state, c.choiceId, c.generation, c.offers[0]);
            } else if (state.phase === 'preparation') result = api.startMatchCombat(state);
            else if (state.phase === 'settlement') result = api.nextRound(state, state.round);
            else if (state.phase === 'combat') result = api.stepMatch(state);
            else break;
            if ('ok' in result && !result.ok) throw Error(result.reason);
            state = result.state; events.push(...result.events);
          }
          const text = serializeMatch(state);
          return {state, events, serialized: text, restored: serializeMatch(restoreMatch(text))};
        });
        return canonicalContent({ CONTENT_DIGEST, LOOT_REPLAY_DIGEST,
          content: recomputeContentDigest(), loot: recomputeLootReplayDigest(), routes });
      }` }, bundle: true, write: false, platform: 'node', format: 'cjs' });
    const original = result.outputFiles[0].text;
    const compact = (await transform(compactEntryStrings(original), { minify: true, target: 'es2022' })).code;
    const before = execute(original), after = execute(compact);
    expect(after).toBe(before);
    const parsed = JSON.parse(after);
    // Current content identities (src/simulation/content/identity-constants.ts; P 2026-10-25 Lesser Shimmer Duplicator consumable, merged with the augment XP / batch-3 / stage-ban / batch-4 levels, B4XP, B4reroll, B4Combat and v24 shop / batch-5 integration (P 2026-10-27)).
    expect(parsed.content).toBe('fnv1a32-utf16:d3b003fc');
    expect(parsed.loot).toBe('fnv1a32-utf16:788a8746');
    for (const route of parsed.routes) expect(route.restored).toBe(route.serialized);
  }, 120_000);
});

describe('Phaser specialization is bounded by the used APIs', () => {
  it('keeps the same seeded Math singleton and GetAdvancedValue results', () => {
    const mathFile = join(phaser, 'math/index.js'), mathRequire = createRequire(mathFile);
    const original = mathRequire(mathFile), previous = original.RND;
    const module = { exports: {} as typeof original };
    runInNewContext(trimPhaserRuntime(source('math/index.js'), 'math/index.js'), { module, require: mathRequire });
    const compact = module.exports;
    expect(compact.RandomDataGenerator).toBe(original.RandomDataGenerator);
    expect(Object.keys(compact).sort()).toEqual(['RandomDataGenerator', ...Object.keys(mathRequire('./const'))].sort());
    const get = (math: typeof original) => {
      const module = { exports: null as unknown as (o: object, key: string, fallback: unknown) => unknown };
      const localRequire = createRequire(join(phaser, 'utils/object/GetAdvancedValue.js'));
      runInNewContext(source('utils/object/GetAdvancedValue.js'), { module,
        require: (name: string) => name === '../../math' ? math : localRequire(name) });
      return module.exports;
    };
    try {
      original.RND = new original.RandomDataGenerator(['fixed-seed']);
      compact.RND = new compact.RandomDataGenerator(['fixed-seed']);
      for (const value of [[1, 2, 3], { randInt: [2, 20] }, { randFloat: [1, 2] }, 'literal', null])
        expect(get(compact)({ value }, 'value', 99)).toBe(get(original)({ value }, 'value', 99));
      expect(compact.RND.state()).toBe(original.RND.state());
    } finally { original.RND = previous; }
  });

  it('keeps empty FX component lifecycle and rejects engine drift or future game FX use', () => {
    const file = 'gameobjects/components/FX.js', localRequire = createRequire(join(phaser, file));
    const module = { exports: null as any };
    runInNewContext(trimPhaserRuntime(source(file), file), { module, require: localRequire });
    for (const isPost of [true, false]) {
      const object = { resetPostPipeline() {} }, fx = new module.exports(object, isPost);
      expect(fx.enabled).toBe(false); expect(fx.list).toEqual([]);
      fx.clear(); fx.destroy(); expect(fx.gameObject).toBeNull();
    }
    expect(() => trimPhaserRuntime(source('math/index.js') + '// changed', 'math/index.js')).toThrow('re-audit');
    for (const use of ['unit.preFX.addBloom()', 'unit["postFX"].addGlow()', 'unit.setPipeline("custom")', 'const {preFX} = unit'])
      expect(() => assertNoPhaserFxUse(use, 'fixture.ts')).toThrow('restore the full engine');
  });
});
