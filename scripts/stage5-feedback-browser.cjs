/** Exact DOM/geometry comparison against the frozen renderer; connect to the supplied Chrome, never launch. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { connect } = require(process.env.CODEX_BROWSER_CLIENT);
const dir = process.env.STAGE5_OUT || 'artifacts/stage5-lag/floating-after';
(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { host: '127.0.0.1', port: 53148, strictPort: true } });
  let browser, context;
  try {
    await server.listen(); browser = await connect();
    context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.route('**/feedback-check.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
    await page.goto('http://127.0.0.1:53148/feedback-check.html');
    const results = [];
    for (const round of ['2-5', '5-1']) {
      const fixture = JSON.parse(fs.readFileSync(`${dir}/fixture-42-${round}.json`));
      const result = await page.evaluate(async ({ fixture, round }) => {
        await import('/src/style.css');
        const { createCombatFeedbackRenderer: before } = await import('/tests/fixtures/stage5-feedback-before.ts');
        const { createCombatFeedbackRenderer: after } = await import('/src/stats/combat-feedback-renderer.ts');
        const { applyCombatReplayTick } = await import('/src/presentation/combat-display.ts');
        const { Scene, PerspectiveCamera, Group, Mesh, BoxGeometry, MeshBasicMaterial, Box3, Vector3 } = await import('/node_modules/three/build/three.module.js');
        const { boardFeedScreenBox, subscribeBoardFeed } = await import('/src/rendering/board-feed.ts');
        const check = (ok, message) => { if (!ok) throw Error(message); };
        const input = JSON.stringify(fixture);
        const host = () => {
          const h = document.createElement('div'); Object.assign(h.style, { position: 'absolute', left: '0px', top: '0px', width: '480px', height: '520px' });
          document.body.append(h); return h;
        };
        const snapshot = h => Array.from(h.querySelectorAll('span'), e => {
          const r = e.getBoundingClientRect(), css = getComputedStyle(e);
          return { text: e.textContent, hidden: e.hidden, style: e.style.cssText,
            rect: [r.x, r.y, r.width, r.height], css: [css.color, css.font, css.opacity, css.transform] };
        });
        let comparisons = 0, visible = 0, maxNodes = 0;
        for (const mode of ['2d', '3d']) {
          const oldHost = host(), newHost = host(), old = before(oldHost), next = after(newHost);
          let state = fixture.stream.initial;
          // Actual Three projection -> board-feed -> the BoardScene radius/head anchor formula, without WebGL.
          const scene = new Scene(), camera = new PerspectiveCamera(45, 480 / 520, 1, 2000);
          camera.position.set(240, 700, 700); camera.lookAt(240, 0, 260); camera.updateMatrixWorld();
          const roots = new Map(), geometry = new BoxGeometry(30, 65, 30), material = new MeshBasicMaterial();
          const off = subscribeBoardFeed({ frame() {}, events() {}, screenBox(id) {
            const root = roots.get(id); if (!root) return;
            const box = new Box3().setFromObject(root), point = new Vector3(); let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
            for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
              point.set(x, y, z).project(camera); const cx = (point.x + 1) * 240, cy = (1 - point.y) * 260;
              left = Math.min(left, cx); right = Math.max(right, cx); top = Math.min(top, cy); bottom = Math.max(bottom, cy);
            }
            return { left, top, right, bottom };
          } });
          try {
            for (const frame of fixture.stream.ticks) {
              state = applyCombatReplayTick(state, frame);
              const now = frame.tick * 50, anchors = new Map();
              if (frame.tick === 180) for (const h of [oldHost, newHost]) { h.style.width = '610px'; h.style.height = '580px'; }
              for (const unit of state.units.filter(u => u.alive)) {
                const x = 45 + unit.cell.col * 58, y = 45 + unit.cell.row * 53;
                if (mode === '2d') anchors.set(unit.id, { x, y, radius: 27 });
                else {
                  let root = roots.get(unit.id);
                  if (!root) { root = new Group(); root.add(new Mesh(geometry, material)); scene.add(root); roots.set(unit.id, root); }
                  root.position.set(x, 32.5, y);
                  const box = boardFeedScreenBox(unit.id), radius = (box.right - box.left) / 2;
                  anchors.set(unit.id, { x: box.left + radius, y: box.top + radius, radius });
                }
              }
              old.push(frame.events, now); next.push(frame.events, now);
              for (const dt of [0, 16.7, 49.9]) {
                old.render(now + dt, anchors); next.render(now + dt, anchors);
                const a = snapshot(oldHost), b = snapshot(newHost);
                check(JSON.stringify(a) === JSON.stringify(b), `${round}/${mode} tick ${frame.tick}+${dt}: ${JSON.stringify({ a, b })}`);
                comparisons++; visible += b.filter(e => !e.hidden).length; maxNodes = Math.max(maxNodes, b.length);
              }
            }
            const end = fixture.stream.terminal.tick * 50;
            for (const dt of [849.999, 850, 851]) {
              old.render(end + dt, new Map()); next.render(end + dt, new Map());
              check(JSON.stringify(snapshot(oldHost)) === JSON.stringify(snapshot(newHost)), 'expiry'); comparisons++;
            }
            // Reset and reuse must produce the same fresh-node attributes, text and geometry.
            old.reset(); next.reset();
            const events = fixture.stream.ticks.flatMap(t => t.events).filter(e => e.type === 'packetDamage').slice(0, 4);
            old.push(events, 0); next.push(events, 0);
            const anchors = new Map(events.map(e => [e.targetId, { x: 180, y: 200, radius: 20 }]));
            old.render(0, anchors); next.render(0, anchors);
            check(JSON.stringify(snapshot(oldHost)) === JSON.stringify(snapshot(newHost)), 'reset/reuse'); comparisons++;
          } finally { off(); old.dispose(); next.dispose(); oldHost.remove(); newHost.remove(); geometry.dispose(); material.dispose(); }
        }
        check(visible > 0, 'No visible text compared'); check(maxNodes <= 24, 'float limit');
        check(JSON.stringify(fixture) === input, 'Input events/state mutated');
        // Exercise the production call sites too: online 2D panel, offline 3D overlay, online 3D quietBoard.
        const { BoardScene } = await import('/src/rendering/BoardScene.ts');
        let callSites = 0;
        for (const mode of ['2d', '3d']) {
          const oldHost = host(), newHost = host(); newHost.id = 'feedback-root';
          const old = before(oldHost), next = after(newHost), event = fixture.stream.ticks.flatMap(t => t.events).find(e => e.type === 'packetDamage');
          const off = mode === '3d' ? subscribeBoardFeed({ frame() {}, events() {}, screenBox: () => ({ left: 145, right: 175, top: 180, bottom: 240 }) }) : () => {};
          let canvasReads = 0;
          const scene = { online: mode === '2d', feedback: next, quietBoard: BoardScene.prototype.quietBoard,
            game: { canvas: { getBoundingClientRect() { canvasReads++; return { left: 0, top: 0, width: 480 }; } } },
            scale: { gameSize: { width: 480 } }, tokens: new Map([[event.targetId, { visible: true, x: 160, y: 195 }]]), fx: { labelRects: () => [] } };
          const timer = Object.getOwnPropertyDescriptor(performance, 'now');
          try {
            Object.defineProperty(performance, 'now', { configurable: true, value: () => 100 });
            old.push([event], 0); next.push([event], 0);
            old.render(100, new Map([[event.targetId, { x: 160, y: 195, radius: mode === '3d' ? 15 : 27 }]]));
            BoardScene.prototype.renderFeedback.call(scene);
            check(JSON.stringify(snapshot(oldHost)) === JSON.stringify(snapshot(newHost)), `BoardScene ${mode}`);
            check(canvasReads === (mode === '3d' ? 0 : 1), 'Unneeded canvas rect read'); callSites++;
            if (mode === '3d') {
              scene.online = true; let rendered = 0; scene.feedback = { render() { rendered++; } };
              BoardScene.prototype.renderFeedback.call(scene); check(rendered === 0, 'Online 3D enabled floats'); callSites++;
            }
          } finally {
            if (timer) Object.defineProperty(performance, 'now', timer); else delete performance.now;
            off(); old.dispose(); next.dispose(); oldHost.remove(); newHost.remove();
          }
        }
        return { round, comparisons, visible, maxNodes, callSites, terminalTick: fixture.stream.terminal.tick, passed: true };
      }, { fixture, round });
      results.push(result);
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(`${dir}/feedback-equivalence.json`, JSON.stringify({ results, errors }, null, 2));
    console.log(JSON.stringify(results));
  } finally { await context?.close(); await browser?.close(); await server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
