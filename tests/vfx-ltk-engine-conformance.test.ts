/*! @license GPL-3.0-or-later
 * Synthetic conformance cases adapted from ltk-manager (GPL-3.0-or-later).
 * Sources: src/modules/workshop/bin/vfx/engine/simulation/__tests__/{forceFields,driver}.test.ts
 *          src/modules/workshop/bin/vfx/engine/drivers/__tests__/operators.test.ts
 * Port/adaptation: catfish-xn/cat, 2026-10-26. No converted game assets.
 * See src/rendering/three-mode/vfx-ltk/NOTICE.md and LICENSE.
 */
import { describe, expect, it } from 'vitest';
import type { SystemModel, ValueCurve } from '../src/rendering/three-mode/vfx-ltk/engine/model/model';
import { compileDriver } from '../src/rendering/three-mode/vfx-ltk/engine/drivers/compileDriver';
import { readDriver } from '../src/rendering/three-mode/vfx-ltk/engine/drivers/readDriver';
import { readVfxSystem } from '../src/rendering/three-mode/vfx-ltk/engine/parsing/readVfxSystem';
import { createDriver } from '../src/rendering/three-mode/vfx-ltk/engine/simulation/driver';
import { accelerateInto, applyFields, attractInto, prepareFields } from '../src/rendering/three-mode/vfx-ltk/engine/simulation/forceFields';
import { copyRows } from '../src/rendering/three-mode/vfx-ltk/engine/simulation/pool';
import { constant, num, struct, syntheticSystem, vec } from './vfx-ltk-synthetic';

const flat = (...values: number[]): ValueCurve => ({ constant: values, keys: [], tables: [] });
function driverFor(model: SystemModel) {
  const driver = createDriver(3, { capacity: 150, seekable: false, childBudget: 100, maxChildren: 8 });
  driver.swap(model); return driver;
}

describe('upstream force/driver/death-child samples under board budgets', () => {
  it('matches the upstream vector driver product, constant folding and output offset samples', () => {
    const graph = struct('VfxMultiplyVector2Driver', { params: { type: 'container', items: [
      struct('VfxVector2ConstantDriver', { Vector2: vec(2, 3) }),
      struct('VfxVector2ConstantDriver', { Vector2: vec(4, 5) }),
    ] } });
    const read = readDriver(graph, 'vec2', 'synthetic');
    const driver = compileDriver(read.node, { scope: 'emitter' });
    expect(driver.variability).toBe('constant'); expect([...driver.constant!]).toEqual([8, 15]);
    const output = new Float32Array([9, 9, 9, 9]);
    driver.evaluate({ now: 0, emitterAge: 0, emitterPhase: 0.5, emitterRandoms: new Float32Array(0), particle: null }, output, 1);
    expect([...output]).toEqual([9, 8, 15, 9]);
  });

  it('matches upstream acceleration, attraction radius and noise-before-drag samples', () => {
    const velocity = new Float32Array([1, 2, 3]); accelerateInto(velocity, [10, 0, -20], 0.5);
    expect([...velocity]).toEqual([6, 2, -7]);
    const inside = new Float32Array(3), outside = new Float32Array([1, 1, 1]);
    attractInto(inside, [10, 0, 0], [0, 0, 0], 100, 200, 0.5);
    attractInto(outside, [300, 0, 0], [0, 0, 0], 100, 200, 0.5);
    expect([...inside]).toEqual([-50, 0, 0]); expect([...outside]).toEqual([1, 1, 1]);
    const fields = prepareFields({ acceleration: [], attraction: [], orbital: [],
      noise: [{ position: flat(0, 0, 0), radius: flat(100), velocityDelta: flat(30), frequency: flat(0), axisFraction: [1, 1, 1] }],
      drag: [{ position: flat(0, 0, 0), radius: flat(100), strength: flat(100) }],
    }, 0, 0, { origin: [0, 0, 0], orientation: null }, []);
    const kicked = new Float32Array(3); applyFields(fields, kicked, [0, 0, 0], 7, 1 / 30);
    expect([...kicked].map(value => value || 0)).toEqual([0, 0, 0]);
  });

  it('reproduces upstream seek/frame equivalence through a parsed noise field, with a nonzero force control', () => {
    const model = readVfxSystem(syntheticSystem({ lifetime: num(5), particleLifetime: constant(num(1)),
      fieldCollectionDefinition: struct('VfxFieldCollectionDefinitionData', {
        fieldNoiseDefinitions: { type: 'container', items: [struct('VfxFieldNoiseDefinitionData', {
          Position: constant(vec(0, 0, 0)), radius: constant(num(10000)), frequency: constant(num(10)),
          velocityDelta: constant(num(20)), axisFraction: vec(1, 1, 1),
        })] },
      }),
    }));
    expect(model.emitters[0].fields!.noise).toHaveLength(1);
    const sought = driverFor(model), frames = driverFor(model);
    const plain = driverFor({ ...model, emitters: model.emitters.map(e => ({ ...e, fields: null })) });
    sought.seek(0.5);
    for (let frame = 0; frame < 30; frame++) { frames.advance(1 / 60); plain.advance(1 / 60); }
    expect(sought.pool.count).toBeGreaterThan(0);
    expect(copyRows(sought.pool)).toEqual(copyRows(frames.pool));
    expect([...frames.pool.velocity]).not.toEqual([...plain.pool.velocity]);
    frames.restart(); for (let frame = 0; frame < 30; frame++) frames.advance(1 / 60);
    expect(copyRows(frames.pool)).toEqual(copyRows(sought.pool));
  });

  it('spawns a death child at the dying particle position, then holds it there as in the upstream sample', () => {
    const child = readVfxSystem(syntheticSystem({ lifetime: num(5), birthVelocity: constant(vec(0, 0, 0)), particleLinger: num(0.5) }));
    const parsed = readVfxSystem(syntheticSystem());
    const model: SystemModel = { ...parsed, emitters: parsed.emitters.map(e => ({ ...e,
      rate: flat(1), lifetime: 0.1, particleLifetime: flat(1), birthVelocity: flat(0, 100, 0), acceleration: flat(0, 0, 0),
      childSet: { children: [child], bones: [], probability: flat(0), onDeath: true, inheritance: null },
    })) };
    const driver = driverFor(model);
    for (let frame = 0; frame < 30; frame++) driver.advance(1 / 60);
    expect(driver.pool.count).toBe(1); expect(driver.sources('0.0')).toHaveLength(0);
    for (let frame = 0; frame < 36; frame++) driver.advance(1 / 60);
    expect(driver.pool.count).toBe(0); expect(driver.births()).toHaveLength(1);
    const [spawned] = driver.sources('0.0'); expect(spawned).toBeDefined(); expect(spawned.origin[1]).toBeGreaterThan(90);
    const where = [...spawned.origin];
    for (let frame = 0; frame < 12; frame++) driver.advance(1 / 60);
    expect([...spawned.origin]).toEqual(where); expect(spawned.pool.count).toBeGreaterThan(0);
    expect(driver.liveChildren()).toBe(1); expect(spawned.pool.capacity).toBeLessThanOrEqual(100);
  });
});
