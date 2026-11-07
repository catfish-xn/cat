import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUiImages, readUiManifest, type UiImageDecoder } from '../src/rendering/three-mode/ui-original-assets';

const bytes = new Blob(['synthetic image']);
const texture = { path: 'textures/test.png', width: 40, height: 20, bytes: bytes.size, sha256: createHash('sha256').update('synthetic image').digest('hex') };
const sidecar = () => ({ schemaVersion: 1, sourceVersion: '14.24.6442327', textures: { test: { ...texture } },
  shopArt: { synthetic: { texture: 'test' } }, sprites: { 'shop.card.1': { texture: 'test', rect: [0, 0, 20, 20], states: { hover: 'highlight' } },
    highlight: { texture: 'test', rect: [20, 0, 20, 20] } } });
function decoder(): UiImageDecoder {
  return { decode: vi.fn(async () => ({ url: 'blob:texture', width: 40, height: 20 })),
    crop: vi.fn(async (_, rect) => ({ url: `blob:crop-${rect[0]}`, width: rect[2], height: rect[3] })), revoke: vi.fn() };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('optional original UI sidecar contract', () => {
  it('requires the pinned schema and source version', () => {
    expect(() => readUiManifest(null)).toThrow('ui-version-mismatch');
    expect(() => readUiManifest({ ...sidecar(), sourceVersion: 'later' })).toThrow();
    expect(() => readUiManifest({ ...sidecar(), schemaVersion: 2 })).toThrow();
  });
  it.each(['../escape.png', '/escape.png', 'https://outside.test/a.png', '%2e%2e/a.png', 'a?x.png', 'a#x.png', 'a\\b.png', './a.png', 'a//b.png', 'a".png'])('rejects unsafe texture path %s per element', path => {
    const raw = sidecar(); raw.textures.test.path = path;
    const result = readUiManifest(raw);
    expect(result.textures.size).toBe(0); expect(result.shopArt.size).toBe(0); expect(result.sprites.size).toBe(0);
  });
  it('ignores invalid rectangles and missing textures without dropping valid art', () => {
    const raw = sidecar(); raw.sprites['shop.card.1'].rect = [30, 0, 20, 20];
    expect(readUiManifest(raw).sprites.has('shop.card.1')).toBe(false);
    expect(readUiManifest(raw).shopArt.get('synthetic')).toBe('test');
    for (const rect of [[0, 0, 0, 20], [-1, 0, 20, 20], [0, 0, 20.5, 20], [0, 0, 20]]) {
      raw.sprites['shop.card.1'].rect = rect; expect(readUiManifest(raw).sprites.has('shop.card.1')).toBe(false);
    }
  });
});

describe('UI image reads, validation and ownership', () => {
  it('only reads on demand, deduplicates an atlas read and releases all generated URLs once', async () => {
    const read = vi.fn(async () => bytes), decode = decoder(), images = createUiImages(readUiManifest(sidecar()), read, decode);
    expect(read).not.toHaveBeenCalled();
    const [art, normal, hover] = await Promise.all([images.art('synthetic'), images.sprite('shop.card.1'), images.sprite('highlight')]);
    expect(art?.url).toBe('blob:texture'); expect(normal?.url).toBe('blob:crop-0'); expect(hover?.url).toBe('blob:crop-20');
    expect(read).toHaveBeenCalledExactlyOnceWith('ui/textures/test.png'); expect(decode.decode).toHaveBeenCalledTimes(1);
    await images.sprite('shop.card.1'); expect(decode.crop).toHaveBeenCalledTimes(2);
    expect(await images.art('absent')).toBeNull(); expect(await images.sprite('shop.card.6')).toBeNull();
    images.dispose(); images.dispose(); expect(decode.revoke).toHaveBeenCalledTimes(3);
    expect(await images.art('synthetic')).toBeNull();
  });
  it.each(['network', 'length', 'hash', 'decode'])('leaves art unavailable after %s failure', async failure => {
    const raw = sidecar(), decode = decoder();
    if (failure === 'hash') raw.textures.test.sha256 = '0'.repeat(64);
    if (failure === 'decode') vi.mocked(decode.decode).mockRejectedValue(new Error('decode'));
    const images = createUiImages(readUiManifest(raw), async () => {
      if (failure === 'network') throw new Error('http-404');
      return failure === 'length' ? new Blob(['bad']) : bytes;
    }, decode);
    expect(await images.art('synthetic')).toBeNull(); images.dispose();
    expect(decode.revoke).not.toHaveBeenCalled();
  });
  it.each(['decode', 'crop'] as const)('revokes a late %s result after dispose and never returns it', async stage => {
    let resolve!: (image: { url: string; width: number; height: number }) => void;
    let signal!: () => void; const begun = new Promise<void>(done => { signal = done; });
    const decode = decoder();
    vi.mocked(decode[stage]).mockImplementation(async () => { signal(); return new Promise(done => { resolve = done; }); });
    const images = createUiImages(readUiManifest(sidecar()), async () => bytes, decode);
    const pending = stage === 'decode' ? images.art('synthetic') : images.sprite('shop.card.1');
    await begun; images.dispose(); resolve({ url: 'blob:late', width: 20, height: 20 });
    expect(await pending).toBeNull(); expect(decode.revoke).toHaveBeenCalledWith('blob:late');
  });
});
