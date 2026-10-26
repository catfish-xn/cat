/// <reference types="vite/client" />
/**
 * Decoders for the 3D chunk: GLB (plain, EXT_meshopt_compression, KHR_texture_basisu) and particle textures
 * (PNG/JPEG/WebP, or .ktx2). Bytes come from the preloader, so a cached file never touches the network.
 * The Basis transcoder (≈ 0.5 MB wasm) is fetched only when the first KTX2 texture is decoded.
 */
import { LoadingManager, Texture, TextureLoader, type WebGLRenderer } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import transcoderJs from 'three/addons/libs/basis/basis_transcoder.js?url';
import transcoderWasm from 'three/addons/libs/basis/basis_transcoder.wasm?url';
import type { ModelTemplate } from '../../rendering3d';

/** Transcoder workers at once (three's default is 4), and how long an idle set lives. */
export const KTX2_WORKERS = 2, KTX2_IDLE_MS = 20_000;

export type ReadBlob = (url: string) => Promise<Blob>;
/** One model read: milliseconds getting its bytes (local store or network) and parsing them (meshopt, KTX2, glTF). */
export type ModelTiming = (url: string, readMs: number, parseMs: number) => void;

export interface AssetReader {
  readModel(url: string): Promise<ModelTemplate>;
  readTexture(url: string): Promise<Texture>;
  readJson(url: string): Promise<unknown>;
  readBinary?(url: string): Promise<ArrayBuffer>;
  /** Ends the KTX2 transcoder workers when nothing was decoded for KTX2_IDLE_MS; true when it did. */
  trim(): boolean;
  dispose(): void;
}

export function createAssetReader(renderer: WebGLRenderer, read: ReadBlob, onModel?: ModelTiming): AssetReader {
  // KTX2Loader asks for `<path>basis_transcoder.{js,wasm}`; Vite fingerprints both, so map the bare names.
  const manager = new LoadingManager();
  manager.setURLModifier(url => url === 'basis_transcoder.js' ? transcoderJs : url === 'basis_transcoder.wasm' ? transcoderWasm : url);
  // The Basis transcoder runs in workers, each keeping its own wasm heap (tens of MB once a large texture went through):
  // at most KTX2_WORKERS of them, and trim() ends them all once KTX2_IDLE_MS passed with nothing to decode. The next
  // decode starts a fresh loader (the transcoder files come from the HTTP cache). Built on first use, as it reads WebGL
  // extensions; a context that cannot answer just fails KTX2 files.
  let ktx2: KTX2Loader | null = null, decoding = 0, closed = false, idleSince = 0;
  const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const take = (): KTX2Loader => {
    if (closed) throw new Error('asset-reader-disposed');
    if (!ktx2) {
      ktx2 = new KTX2Loader(manager).setWorkerLimit(KTX2_WORKERS);
      try { ktx2.detectSupport(renderer); } catch { /* KTX2 unavailable */ }
      gltf.setKTX2Loader(ktx2);
    }
    decoding++;
    return ktx2;
  };
  const give = () => { if (--decoding === 0) idleSince = performance.now(); };
  return {
    async readModel(url) {
      const started = performance.now();
      const blob = await read(url);
      const bytes = await blob.arrayBuffer(), readAt = performance.now();
      take();
      try {
        const parsed = await gltf.parseAsync(bytes, url.slice(0, url.lastIndexOf('/') + 1));
        onModel?.(url, readAt - started, performance.now() - readAt);
        return { scene: parsed.scene, animations: parsed.animations };
      } finally { give(); }
    },
    async readTexture(url) {
      const blob = await read(url);
      if (/\.ktx2$/i.test(url)) {
        const buffer = await blob.arrayBuffer(), loader = take();
        try { return await new Promise<Texture>((resolve, reject) => loader.parse(buffer, resolve, reject)); } finally { give(); }
      }
      const objectUrl = URL.createObjectURL(blob);
      try { return await new TextureLoader().loadAsync(objectUrl); } finally { URL.revokeObjectURL(objectUrl); }
    },
    async readJson(url) { return JSON.parse(await (await read(url)).text()); },
    async readBinary(url) { return (await read(url)).arrayBuffer(); },
    trim() {
      if (!ktx2 || decoding > 0 || performance.now() - idleSince < KTX2_IDLE_MS) return false;
      ktx2.dispose(); ktx2 = null;
      return true;
    },
    dispose() { closed = true; ktx2?.dispose(); ktx2 = null; },
  };
}
