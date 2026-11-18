import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Object3D, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { createPowderMonkeys, dropShare, handMonkeyPose, handMonkeyShown, MONKEY_DROP_SECONDS } from '../src/rendering/three-mode/powder-monkey';

// Powder's monkey (Fable 11-17): the hand one and the ground one swap in one frame, the ground one where and as big as the
// hand one was; it then runs to its cell and is there on the arrival tick.
const bone = (name: string, at: [number, number, number], parent: Object3D) => { const b = new Object3D(); b.name = name; b.position.set(...at); parent.add(b); return b; };
// Her cast clip scales the hand monkey's root (here 2x); the standalone monkey's root is at 1x.
const powderBody = () => { const body = new Group(); const root = bone('Monkey_Root', [5, 3, 0], body); root.scale.setScalar(2); bone('Monkey_Head', [0, 2, 0], root); return body; };
const monkeyLease = () => { const scene = new Group(); const root = bone('Root', [0, 1, 0], scene); bone('Head', [0, 1, 0], root);
  return { scene, animations: [], animationNames: {}, release: () => undefined, released: false }; };
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('3D: Powder\'s monkey', () => {
  it('reads the hand monkey off her bones: its root bone\'s point and world scale', () => {
    const pose = handMonkeyPose(powderBody())!;
    expect(pose.root.toArray()).toEqual([5, 3, 0]);
    expect(pose.size).toBeCloseTo(2);
    expect(handMonkeyPose(new Group())).toBeNull();
  });

  it('swaps in when her clip hides the hand one, its root bone on the hand one\'s and as big; runs to the cell by the arrival', async () => {
    const scene = new Group(), lease = monkeyLease(), body = powderBody();
    const monkeys = createPowderMonkeys(scene, async () => lease);
    monkeys.send('pw', new Vector3(40, 0, 0), 0.1, 1.0);
    await flush();
    const group = scene.getObjectByName('powder-monkey')!;
    monkeys.update(0.05, () => body);
    expect(group.visible).toBe(false); // before the swap: only the hand one shows
    monkeys.update(0.05, () => body);
    expect(group.visible).toBe(true);
    expect(group.scale.x).toBeCloseTo(2); // the hand root's world scale 2 over its own 1
    group.updateMatrixWorld(true);
    const rootAt = lease.scene.getObjectByName('Root')!.getWorldPosition(new Vector3());
    expect(rootAt.x).toBeCloseTo(5); expect(rootAt.y).toBeCloseTo(3); expect(rootAt.z).toBeCloseTo(0);
    // Down to the floor over the drop, at the cell by the arrival (0.9 s of run).
    monkeys.update(MONKEY_DROP_SECONDS, () => body);
    expect(group.position.y).toBeCloseTo(0);
    for (let t = 0; t < 0.7 + 1e-9; t += 0.05) monkeys.update(0.05, () => body);
    expect(group.position.x).toBeCloseTo(40); expect(group.position.z).toBeCloseTo(0);
    expect(monkeys.arrive('pw')!.toArray()).toEqual([40, 0, 0]);
    expect(scene.getObjectByName('powder-monkey')).toBeUndefined();
    expect(monkeys.arrive('pw')).toBeNull();
  });

  it('without her body (dead before the swap) it starts on the floor at the cell\'s side; a clear removes every monkey', async () => {
    const scene = new Group(), monkeys = createPowderMonkeys(scene, async () => monkeyLease());
    monkeys.send('pw', new Vector3(10, 0, 0), 0, 0.5); await flush();
    monkeys.update(0.01, () => null);
    expect(scene.getObjectByName('powder-monkey')!.visible).toBe(true);
    monkeys.clear();
    expect(monkeys.size).toBe(0);
    expect(scene.children).toHaveLength(0);
  });

  it('the drop eases out and is done in MONKEY_DROP_SECONDS', () => {
    expect(dropShare(0)).toBe(0); expect(dropShare(MONKEY_DROP_SECONDS)).toBe(1);
    expect(dropShare(MONKEY_DROP_SECONDS / 2)).toBeGreaterThan(0.5);
  });

  it('a monkey prepared on her cast is the one sent: the swap does not wait on a load', async () => {
    const scene = new Group(), lease = monkeyLease(); let loads = 0;
    const monkeys = createPowderMonkeys(scene, async () => { loads++; return lease; });
    monkeys.prepare('pw'); await flush();
    monkeys.send('pw', new Vector3(10, 0, 0), 0, 0.5);
    await flush();
    monkeys.update(0.01, () => powderBody());
    expect(loads).toBe(1);
    expect(scene.getObjectByName('powder-monkey')!.visible).toBe(true);
  });

  it('swaps on the frame her clip hides the hand monkey (its submesh), whatever the predicted time says', async () => {
    const scene = new Group(), lease = monkeyLease(), body = powderBody();
    const material = new MeshBasicMaterial(); material.name = 'Monkey';
    const hand = new Mesh(new BoxGeometry(), material); body.add(hand);
    expect(handMonkeyShown(body)).toBe(true);
    expect(handMonkeyShown(powderBody())).toBeUndefined();
    const monkeys = createPowderMonkeys(scene, async () => lease);
    monkeys.prepare('pw'); await flush();
    // The predicted swap is long past, but the hand one still shows: no swap, no second monkey.
    monkeys.send('pw', new Vector3(40, 0, 0), 0, 1); await flush();
    monkeys.update(0.05, () => body);
    const group = scene.getObjectByName('powder-monkey')!;
    expect(group.visible).toBe(false);
    // Her clip hides it: the ground one shows in that same update.
    hand.visible = false;
    monkeys.update(0.05, () => body);
    expect(group.visible).toBe(true);
    expect(group.scale.x).toBeCloseTo(2);
  });
});
