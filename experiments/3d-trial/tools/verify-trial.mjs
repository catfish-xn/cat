// Substantive local checks; does not change any existing test timeout.
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright');
const validator = require(process.env.GLTF_VALIDATOR_PATH ?? '../.local/validator/node_modules/gltf-validator');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'public/assets');
const reports = [];
for (const file of ['jinx/rigged.glb', 'vi/rigged.glb', 'arena/arena.glb', ...(await readdir(join(assets, 'vfx/meshes'))).map(f => `vfx/meshes/${f}`)]) {
  const result = await validator.validateBytes(new Uint8Array(await readFile(join(assets, file))), {
    externalResourceFunction: async uri => new Uint8Array(await readFile(join(assets, dirname(file), decodeURIComponent(uri)))),
  });
  reports.push({ file, errors: result.issues.numErrors, warnings: result.issues.numWarnings });
}
if (reports.some(r => r.errors)) throw new Error(`Invalid glTF: ${JSON.stringify(reports)}`);
const server = await createServer({ root, server: { port: 5199, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
try {
  await page.goto('http://localhost:5199/?shot=idle');
  await page.waitForSelector('body[data-ready="1"]', { timeout: 60000 });
  const playback = await page.evaluate(() => {
    const { units, frame } = window.__trial;
    const result = [];
    const bones = u => { const v = []; u.body.traverse(o => { if (o.isBone) v.push(...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray()); }); return v; };
    for (const u of units.slice(0, 2)) {
      for (const name of ['idle', 'move', 'attack', 'cast', 'death']) {
        const action = u.actions[name];
        if (!action) throw new Error(`Missing ${u.id}/${name}`);
        u.play(name, units[2]); frame(0, false);
        const before = bones(u);
        frame(Math.min(0.3, action.getClip().duration * 0.4), false);
        const after = bones(u);
        const delta = Math.max(...after.map((v, i) => Math.abs(v - before[i])));
        if (!Number.isFinite(delta) || delta < 1e-5) throw new Error(`No bone motion: ${u.id}/${name}`);
        result.push({ unit: u.id, name, duration: action.getClip().duration, boneDelta: delta });
        u.reset();
      }
    }
    const findSkinned = u => { let mesh; u.body.traverse(o => { if (o.isSkinnedMesh) mesh = o; }); return mesh; };
    if (findSkinned(units[0]).skeleton.bones[0] === findSkinned(units[3]).skeleton.bones[0]) throw new Error('Jinx clones share bones');
    if (findSkinned(units[1]).skeleton.bones[0] === findSkinned(units[2]).skeleton.bones[0]) throw new Error('Vi clones share bones');
    units[0].play('death'); frame(0.5, false);
    units[0].play('idle'); frame(0, false);
    if (units[0].el.style.opacity !== '1') throw new Error('Death to idle did not restore HUD');
    return { clips: result, emitters: window.__dbg.vfxTar.emitters.length, meshEmitters: window.__dbg.vfxTar.emitters.filter(e => e.geometry).length, skipped: window.__dbg.vfxTar.skipped };
  });
  // Step the real cast through its complete projectile/impact lifecycle.
  await page.evaluate(() => {
    const { units, frame } = window.__trial;
    units[0].play('cast', units[2]);
    for (let i = 0; i < 180; i++) frame(1 / 60);
  });
  await page.evaluate(() => {
    const { units, frame } = window.__trial;
    const before = units[1].hp, other = units[2].hp;
    units[3].play('cast', units[1]);
    for (let i = 0; i < 180; i++) frame(1 / 60);
    if (units[1].hp >= before || units[2].hp !== other) throw new Error('Rocket hit the wrong target');
  });
  if (errors.length) throw new Error(errors.join('\n'));
  await mkdir(join(root, '.local'), { recursive: true });
  const report = { gltf: reports, playback, browserErrors: errors };
  await writeFile(join(root, '.local/verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); await server.close(); }
