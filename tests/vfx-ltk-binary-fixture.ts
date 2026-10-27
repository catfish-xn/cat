/** Handwritten three-vertex geometry, one joint and two keyframes. No game data. */
export function binaryFixture(kind: 'mesh' | 'skeleton' | 'clip', skinned = true, subset = false): ArrayBuffer {
  const bytes: number[] = [];
  const push = (value: number, method: 'setUint32' | 'setInt32' | 'setFloat32' = 'setUint32') => {
    const view = new DataView(new ArrayBuffer(4)); view[method](0, value, true); bytes.push(...new Uint8Array(view.buffer));
  };
  const floats = (values: number[]) => values.forEach(n => push(n, 'setFloat32'));
  const text = (value: string) => { push(value.length); bytes.push(...new TextEncoder().encode(value)); };
  push(kind === 'mesh' ? 0x474b544c : kind === 'skeleton' ? 0x534b544c : 0x414b544c); push(kind === 'mesh' ? 3 : 1);
  if (kind === 'mesh') {
    push(2 | (skinned ? 4 : 0)); push(3); push(subset ? 6 : 3); push(subset ? 2 : 1);
    floats([1, 0, 0, 0, 1, 0, 0, 0, 1]); floats([0, 0, 1, 0, 0, 1]);
    if (skinned) { bytes.push(...Array(12).fill(0)); floats([2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]); }
    (subset ? [0, 1, 2, 2, 1, 0] : [0, 1, 2]).forEach(n => push(n)); text('triangle'); push(0); push(3);
    if (subset) { text('excluded'); push(3); push(3); }
  } else if (kind === 'skeleton') {
    push(1); push(1); text('synthetic-joint'); push(7); push(-1, 'setInt32');
    floats([0, 0, 0, 0, 0, 0, 1, 1, 1, 1, ...[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]]); push(0);
  } else {
    push(1, 'setFloat32'); push(2); push(1); push(7);
    floats([0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 10, 0, 0, 0, 0, 0, 1, 1, 1, 1]);
  }
  return new Uint8Array(bytes).buffer;
}
