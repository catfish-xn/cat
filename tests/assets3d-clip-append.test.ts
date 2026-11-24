import { describe, expect, it } from 'vitest';
// @ts-expect-error Pure Node build utility.
import { makeModel } from '../scripts/assets3d/model.mjs';
// @ts-expect-error Pure Node build utility.
import { readGlb } from '../scripts/assets3d/glb.mjs';
// @ts-expect-error Pure Node build utility.
import { encodePng } from '../scripts/assets3d/texture.mjs';
// @ts-expect-error Offline Node script.
import { appendClips, assertBaseKept, TIMED_FORM_ACTION_KEYS, TIMED_FORM_GRAPH_KEYS } from '../scripts/assets3d/clip-append.mjs';

/** A two-submesh SKN (Body, Prop; one triangle each) on a one-joint rig, in the layout inspectSkn reads. */
function fixtures() {
  const submeshes = ['Body', 'Prop'], header = 12 + submeshes.length * 80, indexOffset = header + 20 + 40, vertices = 6;
  const mesh = Buffer.alloc(indexOffset + 6 * 2 + vertices * 52);
  mesh.writeUInt32LE(0x00112233); mesh.writeUInt16LE(4, 4); mesh.writeUInt32LE(submeshes.length, 8);
  submeshes.forEach((name, i) => {
    const at = 12 + i * 80; mesh.write(name, at);
    mesh.writeUInt32LE(i * 3, at + 64); mesh.writeUInt32LE(3, at + 68); mesh.writeUInt32LE(i * 3, at + 72); mesh.writeUInt32LE(3, at + 76);
  });
  mesh.writeUInt32LE(6, header + 4); mesh.writeUInt32LE(vertices, header + 8); mesh.writeUInt32LE(52, header + 12);
  [0, 1, 2, 3, 4, 5].forEach((n, i) => mesh.writeUInt16LE(n, indexOffset + i * 2));
  [[1, 3, 1], [3, 3, 1], [1, 5, 1], [5, 3, 1], [7, 3, 1], [5, 5, 1]].forEach((p, i) => {
    const o = indexOffset + 12 + i * 52;
    p.forEach((v, k) => mesh.writeFloatLE(v, o + k * 4));
    mesh.writeFloatLE(1, o + 16); mesh.writeFloatLE(1, o + 36);
  });
  const rig = Buffer.alloc(171);
  rig.writeUInt32LE(rig.length); rig.writeUInt32LE(0x22fd4fc3, 4); rig.writeUInt16LE(1, 14); rig.writeUInt32LE(1, 16);
  rig.writeInt32LE(64, 20); rig.writeInt32LE(164, 28); rig.writeInt16LE(-1, 68); rig.writeUInt32LE(123, 72);
  [1, 3, 1, 1, 1, 1, 0, 0, 0, 1, -1, -3, -1, 1, 1, 1, 0, 0, 0, 1].forEach((v, i) => rig.writeFloatLE(v, 80 + i * 4));
  rig.writeInt32LE(6, 160); rig.write('root\0', 166);
  const png = (r: number) => encodePng({ width: 1, height: 1, rgba: Buffer.from([r, 0, 0, 255]) });
  return { mesh, rig, body: png(255), prop: png(128) };
}

/** A two-frame clip on the rig's one joint (same layout as the model conversion tests' fixture). */
function anm() {
  const b = Buffer.alloc(134);
  b.write('r3d2anmd'); b.writeUInt32LE(5, 8); b.writeUInt32LE(1, 28); b.writeUInt32LE(2, 32); b.writeFloatLE(0.5, 36);
  b.writeUInt32LE(106, 40); b.writeUInt32LE(64, 52); b.writeUInt32LE(100, 56); b.writeUInt32LE(110, 60);
  [1, 1, 1, 1, 3, 1, 2, 4, 1].forEach((v, i) => b.writeFloatLE(v, 76 + i * 4));
  b.writeUIntLE(3 * 2 ** 45 + 16383 * 2 ** 30 + 16383 * 2 ** 15 + 16383, 112, 6);
  b.writeUInt32LE(123, 118); b.writeUInt16LE(1, 122); b.writeUInt16LE(2, 128);
  return b;
}

describe('clip append', () => {
  it('names each timed form\'s entry and exit clip by graph key hash', () => {
    expect(TIMED_FORM_GRAPH_KEYS).toEqual({ swain: { enter: '0x70eb0dad', exit: '0xe1ad931b' } });
    expect(TIMED_FORM_ACTION_KEYS).toEqual({ swain: { idle: '0x9dd9dc06', move: '0x2acd4eca', attack: '0x56b1e924', attackAlt: '0x59b1eddd' } });
    for (const keys of [...Object.values(TIMED_FORM_GRAPH_KEYS), ...Object.values(TIMED_FORM_ACTION_KEYS)])
      for (const key of Object.values(keys as Record<string, string>)) expect(key).toMatch(/^0x[0-9a-f]{8}$/);
  });
  it('appends the donor\'s clips after the base, keeps every base entry and byte, and retargets channels by node name', async () => {
    const f = fixtures();
    const base = makeModel(f.mesh, f.rig, [{ name: 'x_idle', bytes: anm() }], { Body: f.body, Prop: f.prop }).glb;
    const donor = makeModel(f.mesh, f.rig, [{ name: 'x_enter', bytes: anm() }, { name: 'x_exit', bytes: anm() }], { Body: f.body, Prop: f.prop }).glb;
    const out: Buffer = await appendClips(base, donor, ['x_enter', 'x_exit']);
    const a = readGlb(base), b = readGlb(out);
    expect(b.binary.subarray(0, a.binary.length).equals(a.binary)).toBe(true);
    expect(b.document.animations.map((c: { name: string }) => c.name)).toEqual(['x_idle', 'x_enter', 'x_exit']);
    expect(b.document.accessors.slice(0, a.document.accessors.length)).toEqual(a.document.accessors);
    // Same keys as the donor's own clip, on the base's node of the same name.
    const donorDoc = readGlb(donor).document, added = b.document.animations[1], from = donorDoc.animations[0];
    expect(added.channels.map((c: { target: { node: number; path: string } }) => [b.document.nodes[c.target.node].name, c.target.path]))
      .toEqual(from.channels.map((c: { target: { node: number; path: string } }) => [donorDoc.nodes[c.target.node].name, c.target.path]));
    await expect(appendClips(out, donor, ['x_enter'])).rejects.toThrow('clip-append-already-present:x_enter');
    await expect(appendClips(base, donor, ['nope'])).rejects.toThrow('clip-append-missing-donor-clip:nope');
  });
  it('the base check refuses a changed JSON entry or a changed base byte, and appendClips runs it on its output', async () => {
    const f = fixtures();
    const base = makeModel(f.mesh, f.rig, [{ name: 'x_idle', bytes: anm() }], { Body: f.body, Prop: f.prop }).glb;
    const donor = makeModel(f.mesh, f.rig, [{ name: 'x_enter', bytes: anm() }], { Body: f.body, Prop: f.prop }).glb;
    const out: Buffer = await appendClips(base, donor, ['x_enter']);
    expect(() => assertBaseKept(base, out)).not.toThrow();
    // One prior BIN byte changed.
    const jl = out.readUInt32LE(12), binAt = 20 + jl + 8, byte = Buffer.from(out); byte[binAt] ^= 0xff;
    expect(() => assertBaseKept(base, byte)).toThrow('clip-append-base-bin-changed');
    // One prior JSON entry changed (same length, so the chunk layout stays valid).
    const text = out.subarray(20, 20 + jl).toString('utf8'), edited = text.replace('"x_idle"', '"y_idle"');
    expect(edited).not.toBe(text);
    const entry = Buffer.from(out); entry.write(edited, 20, 'utf8');
    expect(() => assertBaseKept(base, entry)).toThrow('clip-append-base-changed:animations');
    // appendClips hands its output to the check: a check that refuses makes the append fail.
    const seen: Buffer[] = [];
    await expect(appendClips(base, donor, ['x_enter'], { verify: (b: Buffer, o: Buffer) => { seen.push(b, o); throw new Error('refused'); } })).rejects.toThrow('refused');
    expect(seen[0]).toBe(base); expect(seen[1]!.equals(out)).toBe(true);
  });
});
