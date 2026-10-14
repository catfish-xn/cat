const { prepareB6Opening } = require('./b6-public-preparation.cjs');
/* Public-input layout gate. No Match commands or state are injected. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const { sourceFingerprint } = require('./m5-evidence.cjs');
const { hash } = require('./m4-evidence.cjs');
const { resizeViewport } = require('./verify-m4-interactions.cjs');
const preview = process.argv.includes('--preview'), mode = preview ? 'preview' : 'dev';
const port = Number(process.env.M6_LAYOUT_PORT ?? (preview ? 5199 : 5198));
const url = `http://127.0.0.1:${port}`, output = `artifacts/m6-layout-${mode}`;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const started = Date.now();
  const report = { mode, kind: 'M6 public input and CSS layout', sha: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    dirty: execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(), sourceFingerprint: sourceFingerprint(), runnerHash: hash(fs.readFileSync(__filename,'utf8')),
    node: process.version, seed: 42, startedAt: new Date().toISOString(), rows: [], rotation: null, passed: false };
  let server, browser, page;
  try {
    try { await fetch(url); throw Error(`Layout gate port ${port} is already in use`); } catch (error) { if (!String(error).includes('fetch failed')) throw error; }
    server = spawn(process.execPath,[path.join(path.dirname(require.resolve('vite/package.json')),'bin/vite.js'),...(preview ? ['preview'] : []),'--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:['ignore','pipe','pipe']});
    for (const stream of [server.stdout,server.stderr]) stream.on('data',data=>fs.appendFileSync(path.join(output,'server.log'),data));
    for (let i=0;i<100;i++) { assert.equal(server.exitCode,null,'Vite exited'); try { if ((await fetch(url)).ok) break; } catch {} if(i===99)throw Error('Vite startup timed out');await delay(100); }
    browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});report.browser=browser.version();
    for (const [width,height] of [[1440,1000],[1440,600],[390,844],[844,390],[360,640]]) {
      console.log(`${mode}: ${width}×${height}`);
      const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:false});
      await context.addInitScript(()=>{window.__M6_LAYOUT_INPUTS__=[];for(const type of ['pointerdown','pointerup','pointercancel','touchstart','touchmove','touchend','touchcancel','click'])window.addEventListener(type,e=>window.__M6_LAYOUT_INPUTS__.push({type,trusted:e.isTrusted,target:e.target?.closest?.('[data-debug]')?.dataset.debug??e.target?.tagName}),true)});
      page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
      await page.goto(url);await page.waitForFunction(()=>window.__CAT_DEBUG__);
      await page.locator('[data-debug="m6-seed-input"]').fill('42');await page.locator('[data-debug="m6-fixed-start"]').tap();
      await page.waitForFunction(()=>window.__CAT_DEBUG__.read().m6.mode==='active');
      await prepareB6Opening(page, '2-1', { resolveChoices: false, redeploy: false });
      await page.waitForFunction(()=>document.querySelector('.choice-overlay:not([hidden])')?.contains(document.activeElement));
      const focusCount=await page.locator('.choice-overlay:not([hidden]) button:not(:disabled)').count();
      for(const key of ['Shift+Tab','Tab',...Array(focusCount+1).fill('Tab')]) {
        await page.keyboard.press(key);
        assert(await page.evaluate(()=>Boolean(document.querySelector('.choice-overlay:not([hidden])')?.contains(document.activeElement))),'visible choice keeps Tab focus out of SaveControls');
      }
      for(let i=0;i<6;i++){const choices=page.locator('.choice-overlay:not([hidden]) button[data-debug^="choice:"]');if(!await choices.count())break;await choices.first().tap();await page.waitForTimeout(450)}
      await page.waitForFunction(()=>window.__CAT_DEBUG__.read().state.phase==='preparation');
      await page.locator('[data-debug="panel:units"]').tap();
      const first=await page.evaluate(()=>window.__CAT_DEBUG__.read().state.preparation.units.find(u=>u.team==='player').id);
      await page.locator(`[data-debug="mobile:unit:${first}"]`).tap();await page.locator('[data-debug="deploy:0,4"]').tap();
      const location=await page.evaluate(id=>window.__CAT_DEBUG__.read().state.preparation.units.find(u=>u.id===id).location,first);
      assert.deepEqual(location,{kind:'board',cell:{col:0,row:4}},'public DOM deployment');
      const result=await page.evaluate(()=>{const snapshot=window.__CAT_DEBUG__.read(),c=document.querySelector('#board-root canvas').getBoundingClientRect();const targets=[...document.querySelectorAll('button,input,select,summary')].filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().height&&!e.closest('[hidden]')&&getComputedStyle(e).visibility!=='hidden').map(e=>({label:e.textContent||e.getAttribute('aria-label'),width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}));return {mode:document.body.dataset.m6Mode,canvas:{width:c.width,height:c.height},pieceDiameterCSS:54*c.width/480,overflow:document.documentElement.scrollWidth-innerWidth,minTargetWidth:Math.min(...targets.map(t=>t.width)),minTargetHeight:Math.min(...targets.map(t=>t.height)),badTargets:targets.filter(t=>t.width<44||t.height<44),seed:snapshot.state.seed,contentDigest:snapshot.state.contentDigest}});
      await page.evaluate(()=>{scrollTo(0,0);document.querySelector('#panels-root').scrollTop=0});await page.screenshot({path:path.join(output,`${width}x${height}.png`),fullPage:true});
      if(width===390){
        const cdp=await context.newCDPSession(page);await resizeViewport(page,{width:844,height:390});
        await page.evaluate(()=>{scrollTo(0,0);document.querySelector('#panels-root').scrollTop=0});
        const read=()=>page.evaluate(()=>window.__CAT_DEBUG__.read());let before=await read();
        const drag=async(cancel)=>{const state=await read(),from=state.tokens.find(t=>t.id===first),to=state.layout.hexes['2,4'];await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.screenX,y:from.screenY}]});await page.waitForTimeout(60);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:to.x,y:to.y}]});await page.waitForTimeout(60);await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});await page.waitForTimeout(100)};
        await drag(true);let after=await read();assert.deepEqual(after.state,before.state,'rotated cancel leaves Match unchanged');assert.equal(after.gesture,null,'cancel releases gesture');
        await drag(false);after=await read();assert.deepEqual(after.state.preparation.units.find(u=>u.id===first).location,{kind:'board',cell:{col:2,row:4}},'rotated native touch drop uses refreshed canvas coordinates');assert.equal(after.gesture,null,'normal release pairs');
        await resizeViewport(page,{width:390,height:844});await page.evaluate(()=>scrollTo(0,0));
        const back=await read();const canvas=await page.locator('#board-root canvas').boundingBox();const token=back.tokens.find(t=>t.id===first);
        assert(Math.abs(token.screenX-(canvas.x+token.x*canvas.width/480))<1,'portrait coordinate mapping');
        report.rotation={from:[390,844],to:[844,390],back:[390,844],cancelPreserved:true,drop:{col:2,row:4},normalReleasePaired:true};
        await page.screenshot({path:path.join(output,'rotation-back.png')});
      }
      const inputs=await page.evaluate(()=>window.__M6_LAYOUT_INPUTS__);assert(inputs.some(e=>e.type==='touchstart'&&e.trusted),'trusted touch recorded');assert(inputs.every(e=>e.trusted),'no synthetic input');
      const row={width,height,...result,choiceFocusTrapped:true,errors,nativeInputs:inputs};report.rows.push(row);
      assert.equal(result.overflow,0,'no horizontal overflow');assert(result.pieceDiameterCSS>=32,'piece visible diameter');assert.equal(result.badTargets.length,0,'44 CSS px targets');assert.equal(result.seed,42);assert.deepEqual(errors,[],'browser errors');await context.close();page=null;
    }
    report.finalSourceFingerprint=sourceFingerprint();assert.equal(report.finalSourceFingerprint,report.sourceFingerprint,'source changed during layout evidence');report.passed=true;
  } catch(error) {report.failure=String(error.stack??error);if(page){report.failureState=await page.evaluate(()=>({mode:document.body.dataset.m6Mode,text:document.body.innerText})).catch(()=>null);await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});}throw error;}
  finally {report.elapsedMs=Date.now()-started;report.endedAt=new Date().toISOString();fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(report,null,2));await browser?.close();if(server&&server.exitCode===null){server.kill('SIGTERM');await Promise.race([new Promise(resolve=>server.once('exit',resolve)),delay(2000)]);if(server.exitCode===null)server.kill('SIGKILL');}}
  console.log(`${mode}: five viewports, DOM deployment, rotation touch cancel/drop passed (${report.elapsedMs} ms)`);
})().catch(error=>{console.error(error);process.exitCode=1});
