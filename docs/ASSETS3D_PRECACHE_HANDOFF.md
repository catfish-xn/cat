# 3D 预下载接口交接

## 合并输出

`merge-manifests.mjs` 在成功合并时额外生成 `precache.json`，格式为
`{ schemaVersion: 1, files: [{ path, bytes, sha256 }] }`。
文件按相对素材根的路径升序排列，路径以 `/` 分隔，大小和 SHA-256 来自实际输入字节。
索引覆盖全部去重后的模型、特效 JSON、贴图、网格和扭曲法线图引用；不列入
`manifest.json`、`action-bindings.json`、`merge-report.json` 或索引自身。
缺失依赖时不发布索引；已有索引内容冲突时在复制前拒绝；相同输入可重复运行。
输入支持原有 `units/<id>/manifest.json` 批次，也支持已有根级 `manifest.json` 的平铺素材目录。

## 前端 #278 接法

以下是供前端修改的代码示意，本次没有修改 `src/rendering/`。
`createAssetReader(renderer, read)` 已持有从完整 URL 读取预下载 Blob 的 `read` 回调，
可在 `AssetReader` 增加 `readJson(url): Promise<unknown>`，实现为：

```ts
async readJson(url) {
  return JSON.parse(await (await read(url)).text());
}
```

然后给 `loadParticleEffect` 传入：

```ts
import { readParticleMesh } from '../../rendering3d';

const fx = await loadParticleEffect(manifest, effectId, {
  root: assetBase,
  readJson: url => reader.readJson(url),
  readMesh: url => readParticleMesh(url, input => reader.readModel(input)),
  readTexture: url => reader.readTexture(url),
});
```

这里三个钩子都收到完整的素材 URL。沿用 #278 的
`url => preloader.read(url.slice(assetBase.length))`，不要把 URL 直接当作相对路径传给 preloader。
JSON 仍由粒子文档解析器校验，校验失败不会加载依赖。
网格经现有 `readModel` 解码，因此继承它的缓存和 meshopt 支持。

新增导出 `readParticleMesh(url: string, readModel: ReadModel = readGlb): Promise<BufferGeometry>`：
默认使用原有 GLB 读取器；前端应注入缓存读取器。只接受单个静态 Mesh，
复制其几何并烘焙节点世界变换，然后释放原模板的几何、材质和贴图；返回几何由特效释放。
因此传入的 `readModel` 必须返回本次独占的新模板，不能传 ModelCache 中仍在使用的共享模板。
空场景、多 Mesh 和 SkinnedMesh 拒绝为 `particle-mesh-requires-single-static-mesh`；读取错误原样传播。
不传 `readJson` 时保留原 fetch/HTTP 错误行为；不传 `readMesh` 时仍跳过网格发射器。

## 本次验证

`tsc --noEmit` 通过；指定 7 个测试文件共 209 项通过。
合并测试使用合成临时目录，并独立重算输出哈希、字节数，核对完整路径集合、排序、去重、
元数据排除、重复执行、冲突预检和缺失依赖不发布索引。
读取测试覆盖钩子无网络调用、资源释放、JSON 失败、默认读取与未传网格钩子的兼容行为。

真实本地试跑输入 `assets3d-local/all-anim`，输出 `assets3d-local/precache-trial/`，
60 模型、60 个载荷文件、107,984,972 字节；源目录没有覆盖。
该输入没有特效，真实试跑验证范围仅为模型；特效完整覆盖由合成测试验证。
