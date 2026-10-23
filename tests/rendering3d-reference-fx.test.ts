import { describe, expect, it, vi } from 'vitest';
import { Group, Mesh, ShaderMaterial } from 'three';
import { createReferenceBurst, createRenataShield, melSaveEnvelope, renataRadius, renataShieldTarget } from '../src/rendering/three-mode/reference-fx';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';

describe('reference visual plans (no combat mutation)', () => {
  it('reads only positive Renata shield grants, including the wire event, without finding allies geometrically', () => {
    const event = { type: 'shieldLayerChanged', tick: 3, eventSeq: 1, reason: 'granted', remaining: 100,
      targetId: 'ally', key: JSON.stringify(['combat', 'renata-owner', 'ability', 'renata-ability', 'renata-owner', 0, null, 'ally', 'source']) } as const;
    const frozen = Object.freeze(event);
    expect(renataShieldTarget(frozen)).toBe('ally');
    for (const changed of [{ reason: 'absorbed' }, { remaining: 0 }, { key: 'malformed' }, { targetId: 'unrelated' },
      { key: event.key.replace('renata-ability', 'mel-ability') }, { key: event.key.replace('ability', 'item') }])
      expect(renataShieldTarget({ ...event, ...changed } as DisplayCombatEvent)).toBeNull();
    expect(renataShieldTarget({ type: 'death', tick: 3, eventSeq: 2, unitId: 'ally' })).toBeNull();
  });
  it('stages board-wide violet before gold and ends at 2s, including a dropped-frame jump', () => {
    expect(melSaveEnvelope(.3).violet).toBeGreaterThan(.6);
    expect(melSaveEnvelope(.3).gold).toBe(0);
    expect(melSaveEnvelope(.6).radius).toBe(1);
    expect(melSaveEnvelope(1.2).gold).toBe(1);
    for (const t of [2, 10]) expect(melSaveEnvelope(t)).toMatchObject({ violet: 0, gold: 0 });
    expect(melSaveEnvelope(.1, true)).toEqual(melSaveEnvelope(1.8, true));
    expect(melSaveEnvelope(.1, true)).toEqual({ radius: 1, violet: .12, gold: .12 });
  });
  it('sizes Renata at 1.75 cell spacings, keeps a ground circle for 1s and disposes GPU resources once', () => {
    expect(renataRadius(34) / (Math.sqrt(3) * 34)).toBe(1.75);
    const root = new Group(), fx = createReferenceBurst('renata', renataRadius(34), false); root.add(fx.object);
    const mesh = fx.object.children[0] as Mesh<import('three').PlaneGeometry, ShaderMaterial>;
    const geometry = vi.spyOn(mesh.geometry, 'dispose'), material = vi.spyOn(mesh.material, 'dispose');
    fx.update(.25); expect(mesh.scale.x).toBeCloseTo(renataRadius(34));
    expect(mesh.material.uniforms.alpha!.value).toBe(1);
    fx.update(.74); expect(fx.finished).toBe(false);
    fx.update(.01); expect(fx.finished).toBe(true); expect(mesh.material.uniforms.alpha!.value).toBe(0);
    fx.dispose(); fx.dispose(); expect(root.children).toHaveLength(0);
    expect(geometry).toHaveBeenCalledTimes(1); expect(material).toHaveBeenCalledTimes(1);
  });
  it('uses a static low-opacity circle in reduced motion and cleans up the brief recipient shell', () => {
    const fx = createReferenceBurst('renata', 100, true), shield = createRenataShield(34, true);
    fx.update(.1); const mesh = fx.object.children[0] as Mesh<import('three').PlaneGeometry, ShaderMaterial>;
    expect(mesh.scale.x).toBe(100); expect(mesh.material.uniforms.age!.value).toBe(0);
    expect(mesh.material.uniforms.alpha!.value).toBe(.3);
    shield.update(.6); expect(shield.finished).toBe(true); shield.dispose(); fx.dispose();
  });
});
