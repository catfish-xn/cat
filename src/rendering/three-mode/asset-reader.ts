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

export type ReadBlob = (url: string) => Promise<Blob>;
/** One model read: milliseconds getting its bytes (local store or network) and parsing them (meshopt, KTX2, glTF). */
export type ModelTiming = (url: string, readMs: number, parseMs: number) => void;

export interface AssetReader {
  readModel(url: string): Promise<ModelTemplate>;
  readTexture(url: string): Promise<Texture>;
  readJson(url: string): Promise<unknown>;
  dispose(): void;
}

export function createAssetReader(renderer: WebGLRenderer, read: ReadBlob, onModel?: ModelTiming): AssetReader {
  // KTX2Loader asks for `<path>basis_transcoder.{js,wasm}`; Vite fingerprints both, so map the bare names.
  const manager = new LoadingManager();
  manager.setURLModifier(url => url === 'basis_transcoder.js' ? transcoderJs : url === 'basis_transcoder.wasm' ? transcoderWasm : url);
  const ktx2 = new KTX2Loader(manager);
  // Reads WebGL extensions, so deferred to the first decode; a context that cannot answer just fails KTX2 files.
  let detected = false;
  const detect = () => { if (detected) return; detected = true; try { ktx2.detectSupport(renderer); } catch { /* KTX2 unavailable */ } };
  const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(ktx2);
  return {
    async readModel(url) {
      const started = performance.now();
      const blob = await read(url);
      const bytes = await blob.arrayBuffer(), readAt = performance.now();
      detect();
      const parsed = await gltf.parseAsync(bytes, url.slice(0, url.lastIndexOf('/') + 1));
      onModel?.(url, readAt - started, performance.now() - readAt);
      return { scene: parsed.scene, animations: parsed.animations };
    },
    async readTexture(url) {
      const blob = await read(url);
      if (/\.ktx2$/i.test(url)) {
        detect();
        const buffer = await blob.arrayBuffer();
        return new Promise<Texture>((resolve, reject) => ktx2.parse(buffer, resolve, reject));
      }
      const objectUrl = URL.createObjectURL(blob);
      try { return await new TextureLoader().loadAsync(objectUrl); } finally { URL.revokeObjectURL(objectUrl); }
    },
    async readJson(url) { return JSON.parse(await (await read(url)).text()); },
    dispose() { ktx2.dispose(); },
  };
}
