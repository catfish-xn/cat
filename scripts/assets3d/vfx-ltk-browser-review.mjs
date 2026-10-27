/** Production 3D renderer, controlled BoardFeed, supplied sandbox Chrome only. */
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
if (!process.env.CODEX_BROWSER_CLIENT) throw Error('Requires codex-browser exec; never launches Chrome.');
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const root = resolve(args.root ?? 'assets3d-local/trial'), out = resolve('assets3d-local/vfx-shots');
await mkdir(out, { recursive: true });
const full = JSON.parse(await readFile(join(root, 'manifest.json')));
const models = Object.fromEntries(['jinx', 'vi', 'sett'].map(id => [id, full.models[id]]));
// Keep production fallback bindings and use the real ground arena when available.
if (full.models['board-default']) models['board-default'] = full.models['board-default'];
const manifest = { ...full, models, actionEffects: Object.fromEntries(['jinx', 'vi'].map(id => [id, full.actionEffects?.[id]])) };
if (args.procedural) delete manifest.boards;
await build({ stdin: { contents: `export { mapConvertedEvents } from './src/rendering/three-mode/vfx-ltk/converted-events';`,
  resolveDir: process.cwd(), loader: 'ts' }, outfile: join(out, 'mapping.mjs'), bundle: true, platform: 'node', format: 'esm' });
const { mapConvertedEvents } = await import(pathToFileURL(join(out, 'mapping.mjs')));
const index = JSON.parse(await readFile(join(root, 'vfx-ltk/index.json')));
if (!index.champions) for (const id of ['jinx', 'vi']) {
  const own = JSON.parse(await readFile(join(root, 'vfx-ltk/tft13_' + id + '/index.json')));
  const metadata = JSON.parse(await readFile(join(root, 'vfx-ltk/tft13_' + id + '/metadata.json')));
  index.skills[id] = mapConvertedEvents(id, metadata, own.systems).cues;
}
const heroCues = {};
for (const id of ['jinx','vi']) heroCues[id] = index.champions
  ? JSON.parse(await readFile(join(root, 'vfx-ltk', index.champions[id]))).skills[id] : index.skills[id];
const server = await createServer({ configFile: false, resolve: { preserveSymlinks: true },
  optimizeDeps: { noDiscovery: true, entries: [], include: [] }, cacheDir: join(out, 'vite-cache'),
  server: { host: '127.0.0.1', port: 5276, strictPort: true, hmr: false, watch: null } });
let browser, context, absent = false;
const errors = [], consoleErrors = [], failed = [], samples = [], cleanup = [];
if (args.label && !/^[a-z0-9-]+$/.test(args.label)) throw Error('invalid report label');
const prefix = args.label ? args.label+'-' : args.smoke ? (args.procedural ? 'catalog-procedural-' : 'catalog-') : '';
const advance = async (page, ms) => {
  if (args.smoke && ms >= 4000) return page.evaluate(() => { window.__render3d.ltk.update(4, window.__render3d.camera); });
  return page.clock.runFor(ms);
};
try {
  await server.listen(); browser = await require(process.env.CODEX_BROWSER_CLIENT).connect();
  context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const page = await context.newPage();
  page.on('pageerror', e => { errors.push(e.message); console.log('PAGE', e.message); });
  page.on('console', m => { if (m.type() === 'error') { consoleErrors.push(m.text()); console.log('CONSOLE', m.text().slice(0, 600)); } });
  page.on('requestfailed', r => failed.push({ url: r.url(), error: r.failure()?.errorText }));
  await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  await page.route('**/local-assets/**', async r => {
    const path = new URL(r.request().url()).pathname.slice('/local-assets/'.length);
    if (path === 'manifest.json') return r.fulfill({ json: manifest });
    if (path === 'precache.json') return r.fulfill({ json: { schemaVersion: 1, files: [] } });
    if (path === 'packs.json') return r.fulfill({ json: { schemaVersion: 1, packs: [] } });
    if (path === 'vfx-ltk/index.json') return absent ? r.fulfill({ status: 404, json: {} }) : r.fulfill({ json: index });
    if (path.split('/').some(p => p === '..' || p.includes('%'))) return r.fulfill({ status: 403 });
    try { return r.fulfill({ body: await readFile(join(root, path)) }); } catch { return r.fulfill({ status: 404 }); }
  });
  await page.route('**/vfx-review?debug3d', r => r.fulfill({ contentType: 'text/html', body: `<!doctype html><link rel="icon" href="data:,"><link rel="stylesheet" href="/src/style.css">
    <script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script>
    <style>body{margin:0;background:#101923}#board{position:absolute;inset:0}.render3d-fps{display:none}#stamp{position:absolute;top:15px;left:20px;z-index:20;color:white;font:18px sans-serif;background:#101923df;padding:10px}</style>
    <body data-m6-mode="active"><div id="board" class="render3d-layer"></div><div id="stamp"></div></body>` }));
  await page.goto('http://127.0.0.1:5276/vfx-review?debug3d');
  await page.evaluate(async ({ shared }) => {
    const module = await import('/src/rendering/three-mode/placeholder-renderer.ts');
    const { Vector3 } = await import('/node_modules/three/build/three.module.js');
    module.useReducedMotion(() => false);
    let listener;
    let bridge;
    if (shared) {
      bridge = await import('/src/rendering/board-feed.ts'); module.useBoardFeed(bridge.boardFeed);
      listener = { frame: f => bridge.publishBoardFrame(() => f), events: e => bridge.publishCombatEvents(() => e) };
    } else module.useBoardFeed({ subscribe(next) { listener = next; return () => {}; }, controls: () => null });
    const piece = (id, definitionId, team, col, row) => ({ id, definitionId, team, starLevel: 1, alive: true, visible: true,
      x: (col + (row % 2) / 2) * Math.sqrt(3) * 34, y: row * 51 });
    const frame = { rows: 8, columns: 7, hexRadius: 34, origin: { x: 0, y: 0 }, bench: [], fighting: false, dragging: null,
      pieces: [piece('jinx', 'jinx', 'player', 2, 5), piece('vi', 'vi', 'player', 4, 5), piece('target', 'sett', 'enemy', 3, 2)] };
    window.review = { module, feedActive: () => bridge?.boardFeedActive() ?? false, listener: () => listener, frame, async mount() {
      this.mounted = await module.mountRenderer3d(document.querySelector('#board'), { assetBase: location.origin + '/local-assets/' });
      if (this.mounted.status !== 'assets') throw Error(this.mounted.detail);
      listener.frame(frame);
    }, begin(id, action, phase) {
      listener.frame({ ...frame, fighting: false }); listener.frame({ ...frame, fighting: true });
      const casts = [];
      for (let i = 0; i < phase; i++) casts.push({ type: 'cast', tick: i, eventSeq: i, sourceId: id, targetIds: ['target'], actionSeq: i + 1, completed: true });
      casts.push(action === 'cast' ? { type: 'cast', tick: 100, eventSeq: 100, sourceId: id, targetIds: ['target'], actionSeq: phase + 1, completed: true }
        : { type: 'attack', tick: 100, eventSeq: 100, attackerId: id, targetId: 'target', actionSeq: 1 });
      listener.events(casts);
    }, state() {
      const d = window.__render3d;
      const meshes = []; d.scene.traverse(o => { if (o.isMesh && o.material?.isShaderMaterial) meshes.push({ order: o.renderOrder, layers: o.layers.mask, visible: o.visible }); });
      return { active: d.ltk.active, queued: d.ltk.queued, fallbackLive: d.live.size,
        fallbackFeel: d.scene.getObjectByName('skill-feel')?.children.filter(o=>o.visible).length ?? 0,
        ltkGroups: d.scene.children.filter(o=>o.name === 'ltk-vfx').length,
        fxScales: d.scene.children.filter(o=>o.name === 'ltk-vfx').map(o=>o.scale.toArray()), meshes, gpu: { ...d.renderer.info.memory },
        bones: [...d.pieces].map(([id,v]) => { const bones = []; v.body?.traverse(o => { if (o.isBone && /pistol|rocket_launcher|r_buffbone_glb_hand_loc|glb_ground_loc|glb_chest_loc|weapon_1|l_hand/i.test(o.name)) {
          bones.push({ name:o.name, world:o.getWorldPosition(new Vector3()).toArray() }); } }); return { id, modelScale:v.modelScale, bones }; }) };
    } };
    await window.review.mount();
  }, { shared: !!args.shared });
  const loaded = () => page.waitForFunction(() => window.__render3d?.pieces.size === 3 && [...window.__render3d.pieces.values()].every(v => v.lease && !v.lease.placeholder), null, { timeout: 60000 });
  await loaded(); console.log('Models ready');
  await page.evaluate(async () => { await Promise.all(['jinx','vi'].map(id => window.__render3d.ltk.warm(id))); });
  console.log('VFX warm ready');
  const missingBones = await page.evaluate(heroCues => {
    const missing = [], pieces = window.__render3d.pieces;
    const has = (id,bone) => { let found = false; pieces.get(id).body.traverse(o=>{found ||= o.name.toLowerCase()===bone.toLowerCase();}); return found; };
    for (const [id,cues] of Object.entries(heroCues)) for (const cue of cues) {
      if (cue.bone && !has(cue.event==='hit'?'target':id,cue.bone)) missing.push({id,system:cue.system,bone:cue.bone});
      if (cue.targetBone && !has('target',cue.targetBone)) missing.push({id,system:cue.system,targetBone:cue.targetBone});
    }
    return missing;
  }, heroCues);
  if (missingBones.length) throw Error('missing attachment bones:'+JSON.stringify(missingBones));
  const clockTime = Date.now(); await page.clock.install({ time: clockTime }); await page.clock.pauseAt(clockTime + 1000);
  for (const mode of (args.smoke ? ['converted'] : ['converted', 'absent'])) {
    if (mode === 'absent') {
      absent = true; await page.clock.resume(); await page.evaluate(async () => { await window.review.mount(); });
      // Frozen rAF does not prevent model fetch/decode; resume exact frames after decode.
      await loaded(); await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
      await page.evaluate(async () => { await window.__render3d.ltk.warm('jinx'); await window.__render3d.ltk.warm('vi'); });
    }
    const cases = [['jinx','cast',0,[.25,.55,.9]],['jinx','cast',1,[.3,.7,1.05]],
      ['jinx','cast',2,[.25,.85,1.45]],['vi','cast',0,[.2,.65,1]],['jinx','attack',0,[.3,.55]],['vi','attack',0,[.3,.55]]];
    for (const [id, action, phase, times] of (args.vi ? cases.filter(([id])=>id==='vi') : args.ground ? cases.filter(([id,action,phase])=>action==='cast' && (id==='vi'||phase===2)) : cases)) {
      await page.evaluate(({id,action,phase}) => window.review.begin(id,action,phase), {id,action,phase});
      const owns = await page.evaluate(() => window.__render3d.ltk.queued > 0);
      if (mode === 'converted' && !owns) throw Error(`converted timeline fell back: ${id}/${action}/${phase}`);
      if (mode === 'absent' && owns) throw Error('absent data suppressed fallback');
      let at = 0;
      for (const time of (args.smoke && !args.frames ? times.slice(-1) : times)) {
        await advance(page, Math.round((time-at)*1000)); at = time;
        await page.evaluate(label => document.querySelector('#stamp').textContent = label, `${mode} · ${id} ${action} ${phase} · ${time.toFixed(2)}s · 14.24 / FX_SCALE=0.44`);
        const state = await page.evaluate(() => window.review.state());
        if (state.fxScales.some(scale=>scale.some(v=>Math.abs(v-.44)>1e-9))) throw Error('incorrect FX_SCALE');
        const screenshot = join(out, `${prefix}${mode}-${id}-${action}-${phase}-${Math.round(time*1000)}.png`);
        await page.screenshot({ path: screenshot }); samples.push({mode,id,action,phase,time,screenshot,...state});
      }
      await advance(page, 4000);
      const ended = await page.evaluate(() => window.review.state());
      if (ended.active || ended.queued || ended.ltkGroups) throw Error('timeline lifetime leak');
      console.log(`${mode}/${id}/${action}/${phase}: owned=${owns}, cleaned`);
    }
    await page.evaluate(() => window.review.begin('vi','cast',0)); await page.clock.runFor(200);
    await page.evaluate(() => {
      const r = window.review; r.listener().events([{type:'death',tick:101,eventSeq:101,unitId:'vi'}]);
      r.listener().frame({...r.frame,fighting:true,pieces:r.frame.pieces.map(p=>p.id==='vi'?{...p,alive:false}:p)});
    });
    await advance(page, 4000);
    const death = await page.evaluate(() => window.review.state());
    if (death.active || death.queued || death.ltkGroups) throw Error('death leaked effects');
    const teardown = await page.evaluate(async () => {
      const d = window.__render3d; window.review.mounted.dispose();
      // Library caches release settled shared resources through promise handlers.
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
      return { active:d.ltk.active,queued:d.ltk.queued,pieces:d.pieces.size,live:d.live.size,gpu:{...d.renderer.info.memory},feedActive:window.review.feedActive(),debugRemoved:!window.__render3d,canvas:document.querySelectorAll('canvas').length };
    });
    cleanup.push({mode,death,teardown});
    if (teardown.active || teardown.queued || teardown.pieces || teardown.live || !teardown.debugRemoved || teardown.canvas || teardown.feedActive) throw Error('scene teardown leak');
    if (args.smoke && (teardown.gpu.geometries || teardown.gpu.textures)) throw Error('GPU resource teardown leak:'+JSON.stringify(teardown.gpu));
    if (mode === 'converted') { // the next mode mounts its own renderer
      console.log('Converted teardown passed');
    }
  }
  const result = {browser:browser.version(),root,sharedFeed:!!args.shared,procedural:!!args.procedural,missingBones,samples,cleanup,errors,consoleErrors,failed};
  await writeFile(join(out, prefix + 'review-report.json'), JSON.stringify(result,null,2));
  if (errors.length || consoleErrors.some(e => /shader|webgl|invalid_operation|GL_INVALID/i.test(e))) throw Error('GPU/browser error');
  console.log(JSON.stringify({shots:samples.length,errors:errors.length,consoleErrors:consoleErrors.length,cleanup:cleanup.map(({mode,death,teardown})=>({mode,afterDeath:{active:death.active,queued:death.queued,ltkGroups:death.ltkGroups},teardown}))}));
} catch (error) {
  await writeFile(join(out, prefix + 'review-failure.json'), JSON.stringify({error:String(error),errors,consoleErrors,failed,samples,cleanup},null,2)); throw error;
} finally { await context?.close(); await browser?.close(); await server.close(); }
