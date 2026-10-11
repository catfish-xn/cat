/* UR-U4-07: U4 status / source / statistics display, desktop Chromium 1440×1000 component verification.
 *
 * Domain data comes only from the domain: real S13 combat steps (stepCombat) over units built like
 * tests/combat-helpers.ts, statuses seeded with applyStatusContribution, heals resolved by the S13 heal
 * path (resolveHeal), shields granted/decayed/absorbed/ended by the S13 shield path (grantShieldState /
 * maintainShield via real champion abilities and item programs). Step events are stamped exactly as
 * stampCombatStep does and checked by the replay2 ledger boundary (toLedgerEvents). No event object is
 * written by hand. R2a's fixed groupless input is no longer a representable LedgerCombatEvent (B9
 * replay2 made statusChanged.group mandatory), so that scenario asserts the current formal behaviour and
 * records the deviation in the manifest.
 *
 * The page mounts the real display components the same way tests/m6-stats-browser.cjs does (Vite dev
 * server, blank route, modules imported from /src): StrategyPanel (combat detail + event log tab),
 * createStatsPanel, createCombatFeedbackRenderer and statusBadges (the board strip's single data source).
 * Every render, filter change and selection is followed by a JSON.stringify comparison of the events,
 * combat snapshots, BattleStats and Match state the UI was given.
 *
 * Run: node scripts/verify-m8-u4-status.cjs   (CHROMIUM_PATH optional; M8_U4_STATUS_EVIDENCE_DIR overrides
 * the output directory, default artifacts/m8-u4-status). Writes manifest.json; exit 1 on any failure.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.M8_U4_STATUS_EVIDENCE_DIR || path.join(root, 'artifacts/m8-u4-status'));
const VIEWPORT = { width: 1440, height: 1000 };
/** UI number formatting uses ASCII '-'; the spec text writes U+2212. Compared after this normalisation. */
const norm = text => String(text).replace(/−/g, '-');

(async () => {
  const started = Date.now();
  fs.mkdirSync(output, { recursive: true });
  const manifest = {
    spec: 'docs/UI_REQUESTS.md UR-U4-07', sha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    viewport: VIEWPORT, browser: null, startedAt: new Date(started).toISOString(), runtimeMs: null,
    scenarios: [], deviations: [], observations: [], errors: [], passed: false,
  };
  const scenarios = new Map();
  const scenario = (id, title) => { const entry = { id, title, passed: true, checks: [] }; scenarios.set(id, entry); manifest.scenarios.push(entry); return entry; };
  const check = (entry, name, pass, observed) => {
    entry.checks.push({ name, passed: Boolean(pass), observed });
    if (!pass) entry.passed = false;
  };
  const { createServer } = await import('vite');
  const server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen();
    const load = file => server.ssrLoadModule(file);
    const { stepCombat } = await load('/src/simulation/combat.ts');
    const { resolveAbility } = await load('/src/simulation/combat-abilities.ts');
    const { EMPTY_RUNTIME } = await load('/src/simulation/combat-s13-state.ts');
    const { EMPTY_MECHANISMS } = await load('/src/simulation/m8/runtime-types.ts');
    const { applyStatusContribution } = await load('/src/simulation/m8/status.ts');
    const { effectIdentity } = await load('/src/simulation/m8/identity.ts');
    const { toLedgerEvents } = await load('/src/simulation/combat-ledger.ts');
    const { ITEM_DEFINITIONS } = await load('/src/simulation/content/items.ts');
    const { battle, unit } = await load('/tests/combat-helpers.ts');

    /* ---------- domain fixtures (same shapes as tests/m8-b3-second-integration.test.ts) ---------- */
    const dummy = (id, team, cell, patch = {}) => unit(id, team, cell.col, cell.row, { definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1),
      hp: 10000, maxHp: 10000, armor: 0, magicResist: 0, mana: 0, maxMana: 1, cooldownTicks: 1000, moveCooldownTicks: 1000, attackRange: 6, attackDamage: 0,
      statuses: [], shieldLayers: [], tasks: [], runtime: { ...EMPTY_RUNTIME }, ...patch });
    const hero = (name, id, team, cell, patch = {}) => dummy(id, team, cell, { definitionId: name, ability: resolveAbility(`${name}-ability`, 1), hp: 1000, maxHp: 1000,
      mana: 100, maxMana: 100, abilityPower: 100, attackDamage: 100, baseAttackSpeedBps: 10000, baseCritChanceBps: 0, mechanics: [], ...patch });
    const itemSource = (definitionId, instanceId, ownerId) => ({ ownerId, sourceKind: 'item', definitionId, instanceId, effectIndex: 0, parentItemInstanceId: null });
    /** Same binding as strategy-snapshot bindItem() for a catalogue item program (optionally a temporary child). */
    const bindItem = (ownerId, definitionId, instanceId, parentItemInstanceId = null) => ({ source: { ownerId, sourceKind: 'item', definitionId, instanceId,
      effectIndex: (ITEM_DEFINITIONS[definitionId].effects.length + 1) * 1024, parentItemInstanceId }, program: structuredClone(ITEM_DEFINITIONS[definitionId].combatProgram) });
    const statusApp = (kind, magnitudeBps, ticks, patch = {}) => ({ kind, magnitudeBps, activation: 'immediate', duration: { kind: 'ticks', ticks },
      stackPolicy: { kind: 'strongest-category', category: kind, retainSuppressed: true }, polarity: 'harmful', removable: true, damageFilter: null, onEnd: null, ...patch });
    const seed = (groups, targetId, source, app) => applyStatusContribution(groups, effectIdentity('standalone', source, targetId), app, 0).groups;
    /** Real S13 steps; keeps every snapshot so displays can be read at exact ticks. */
    function simulate(combatId, initial, ticks) {
      let state = initial; const raw = [], states = new Map([[state.tick, state]]);
      for (let i = 0; i < ticks && state.status === 'running'; i++) { const step = stepCombat(state); state = step.state; raw.push(...step.events); states.set(state.tick, state); }
      // stampCombatStep's stamping (these fixtures carry no strategy), then the replay2 ledger boundary.
      const events = toLedgerEvents(raw.map((event, eventSeq) => ({ ...event, domain: 'combat', combatId, eventSeq })));
      return { combatId, events, states, final: state, at: tick => { if (!states.has(tick)) throw new Error(`${combatId}: no snapshot at tick ${tick}`); return states.get(tick); } };
    }
    const unitOf = (combat, id) => combat.units.find(u => u.id === id);

    /* ---------- browser page: the real display components ---------- */
    const launch = { args: ['--no-sandbox', '--enable-unsafe-swiftshader'], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) };
    browser = await chromium.launch(launch);
    manifest.browser = browser.version();
    const page = await browser.newPage({ viewport: VIEWPORT });
    page.on('pageerror', error => manifest.errors.push(`pageerror: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') manifest.errors.push(`console: ${message.text()}`); });
    await page.route('**/m8-u4-status-check', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"></head><body style="margin:0;background:#0b1419;color:#e8f1f5"></body></html>' }));
    await page.goto(`${server.resolvedUrls.local[0]}m8-u4-status-check`);
    await page.evaluate(async () => {
      const [{ StrategyPanel }, { InputRouter }, { createMatch }, { createStatsPanel }, { aggregateStats }, { createCombatFeedbackRenderer }, { statusBadges }] = await Promise.all([
        import('/src/rendering/strategy-panel.ts'), import('/src/rendering/input-router.ts'), import('/src/simulation/match.ts'), import('/src/stats/stats-panel.ts'),
        import('/src/stats/aggregate.ts'), import('/src/stats/combat-feedback-renderer.ts'), import('/src/presentation/combat-status.ts')]);
      const strategyRoot = Object.assign(document.createElement('div'), { id: 'strategy-root' }); strategyRoot.style.width = '440px'; document.body.append(strategyRoot);
      const statsHost = document.createElement('div'); statsHost.style.width = '420px'; document.body.append(statsHost);
      const feedbackHost = document.createElement('div'); Object.assign(feedbackHost.style, { position: 'relative', width: '720px', height: '420px' }); document.body.append(feedbackHost);
      // Public Match state for the panel shell; the combat snapshot under inspection is the domain-produced one.
      const match = createMatch(42);
      const retained = [{ label: 'match', value: match, json: JSON.stringify(match) }];
      const retain = (label, value) => { retained.push({ label, value, json: JSON.stringify(value) }); return value; };
      let view = { combat: null, selected: null };
      const noop = () => {};
      const strategy = new StrategyPanel({ state: () => view.combat ? { ...match, combat: view.combat } : match, shopLock: noop, selectedUnit: () => view.selected, selectUnit: noop,
        combine: noop, equip: noop, choose: noop, target: noop, rerollAnomaly: noop, buy: noop, deploy: noop, control: noop, unitAt: () => undefined, cancelGesture: noop,
        status: noop, help: noop, highlight: noop }, new InputRouter());
      strategy.render();
      strategyRoot.querySelector('[data-debug="panel:events"]').click();
      let selectedCallback = null;
      const stats = createStatsPanel(statsHost, id => { selectedCallback = id; });
      const feedback = createCombatFeedbackRenderer(feedbackHost);
      const unchanged = (values) => { const before = values.map(v => JSON.stringify(v)); return () => values.every((v, i) => JSON.stringify(v) === before[i]); };
      const texts = (scope, selector) => [...scope.querySelectorAll(selector)].map(node => node.textContent);
      window.u4 = {
        strategy({ label, combat, selected, events }) {
          retain(`${label}:combat`, combat); if (events) retain(`${label}:events`, events);
          const same = unchanged([combat, events ?? null, match]);
          view = { combat, selected }; strategy.reset(); if (events?.length) strategy.observeEvents(events); strategy.render();
          const section = strategyRoot.querySelector('.combat-sources');
          return { lines: [...section.querySelectorAll('p')].map(p => ({ text: p.textContent, cls: p.className, debug: p.dataset.debug ?? null })),
            log: texts(strategyRoot, '[data-debug=battle-record] p'), readOnly: same() };
        },
        stats({ label, combat, events, selected, filters = ['all'], click = null }) {
          retain(`${label}:combat`, combat); retain(`${label}:events`, events);
          const battleStats = retain(`${label}:stats`, aggregateStats('u4-run', events[0]?.combatId ?? label, events));
          const same = unchanged([combat, events, battleStats]);
          stats.render({ stats: battleStats, combat, events, selectedUnitId: selected });
          if (click) { statsHost.querySelector(`button[data-unit="${click}"]`).click(); }
          const filter = statsHost.querySelector('select[data-debug=m6-stats-filter]'), byFilter = {};
          for (const value of filters) {
            filter.value = value; filter.dispatchEvent(new Event('change'));
            byFilter[value] = { range: statsHost.querySelector('details p').textContent, list: texts(statsHost, 'ol li') };
          }
          filter.value = 'all'; filter.dispatchEvent(new Event('change'));
          const table = Object.fromEntries([...statsHost.querySelectorAll('tbody tr')].map(row => [row.querySelector('button').dataset.unit, [...row.cells].slice(1).map(c => c.textContent)]));
          return { byFilter, table, detail: statsHost.querySelector('[data-debug=m6-stats-details]').textContent, statuses: texts(statsHost, '[data-debug=m8-stats-statuses] li'),
            selectedCallback, stats: battleStats, readOnly: same() };
        },
        floats({ label, batches, anchors }) {
          retain(`${label}:floats`, batches);
          const same = unchanged([batches]);
          const observed = [];
          feedback.reset();
          for (const batch of batches) {
            feedback.push(batch.events, batch.at); feedback.render(batch.at + 50, new Map(Object.entries(anchors)));
            observed.push([...feedbackHost.querySelectorAll('span')].filter(span => !span.hidden).map(span => span.textContent));
          }
          feedback.reset();
          return { observed, readOnly: same() };
        },
        badges({ label, combat, unitId }) { retain(`${label}:combat`, combat); const same = unchanged([combat]); const value = statusBadges(combat, unitId); return { ...value, readOnly: same() }; },
        /** Final read-only sweep over everything any display was given during the run. */
        finalReadOnly() { return retained.filter(entry => JSON.stringify(entry.value) !== entry.json).map(entry => entry.label); },
      };
    });
    const call = (method, args) => page.evaluate(([name, value]) => window.u4[name](value), [method, args]);
    const readOnly = (entry, label, result) => check(entry, `只读：${label}`, result.readOnly, result.readOnly);
    const has = (lines, ...parts) => lines.some(line => parts.every(part => norm(line).includes(norm(part))));
    const lineWith = (lines, ...parts) => lines.find(line => parts.every(part => norm(line).includes(norm(part)))) ?? null;
    const SUPPRESSED = '同类状态由另一来源提供';

    /* ---------- R1 减伤适用范围 ---------- */
    {
      const entry = scenario('R1', 'R1 减伤适用范围（8% 普攻 + 50% 技能直接伤害，100 物理普攻）');
      const filter = deliveries => ({ deliveries, damageTypes: ['physical', 'magic'], redirected: 'exclude' });
      let groups = seed([], 'e', itemSource('u4-dr-basic', 'dr-basic', 'e'), statusApp('damage-reduction', 800, 200, { polarity: 'beneficial', damageFilter: filter(['basic-attack']) }));
      groups = seed(groups, 'e', itemSource('u4-dr-ability', 'dr-ability', 'e'), statusApp('damage-reduction', 5000, 200, { polarity: 'beneficial', damageFilter: filter(['ability-direct']) }));
      const run = simulate('u4-r1', battle([dummy('p', 'player', { col: 1, row: 4 }, { attackDamage: 100, cooldownTicks: 0 }),
        dummy('e', 'enemy', { col: 1, row: 3 }, { mechanismState: { ...EMPTY_MECHANISMS, statuses: groups } })]), 1);
      const packet = run.events.find(e => e.type === 'packetDamage');
      const o = packet.outcome;
      check(entry, '前提：护甲 0、无护盾、无暴击，100 物理普攻', o.raw === 100 && o.context.damageType === 'physical' && o.context.delivery === 'basic-attack' && o.absorbed === 0 && !o.critical && unitOf(run.final, 'e').armor === 0,
        { raw: o.raw, delivery: o.context.delivery, absorbed: o.absorbed, critical: o.critical });
      check(entry, '领域 HP 伤害 92', o.hpDamage === 92, o.hpDamage);
      const strategy = await call('strategy', { label: 'R1', combat: run.final, selected: 'e', events: run.events }); readOnly(entry, '策略面板', strategy);
      const rows = strategy.lines.filter(line => line.debug === 'combat-status:damage-reduction');
      check(entry, '策略面板两行减伤', rows.length === 2, rows.map(r => r.text));
      check(entry, '两行均无“同类状态由另一来源提供”', rows.every(r => !r.text.includes(SUPPRESSED)), rows.map(r => r.text));
      check(entry, '两行均无 inactive 样式', rows.every(r => !r.cls.split(' ').includes('inactive')), rows.map(r => r.cls));
      check(entry, '8% 行显示“适用：普攻…”', rows.some(r => r.text.startsWith('减伤 8%') && r.text.includes('适用：普攻')), rows.map(r => r.text));
      check(entry, '50% 行显示“适用：技能直接伤害…”', rows.some(r => r.text.startsWith('减伤 50%') && r.text.includes('适用：技能直接伤害')), rows.map(r => r.text));
      const stats = await call('stats', { label: 'R1', combat: run.final, events: run.events, selected: 'e' }); readOnly(entry, '统计面板', stats);
      const listed = stats.statuses.filter(text => text.startsWith('减伤'));
      check(entry, '统计面板状态列表同为两行有效、各带适用范围', listed.length === 2 && listed.every(t => !t.includes(SUPPRESSED)) && has(listed, '减伤 8%', '适用：普攻') && has(listed, '减伤 50%', '适用：技能直接伤害'), listed);
      check(entry, '事件日志实际生命伤害 92', has(strategy.log, '物理实际生命伤害 92'), lineWith(strategy.log, '物理实际生命伤害'));
    }

    /* ---------- 同类最强（无过滤）：shred 30%→100、50%→60，读 59/60/61 ---------- */
    {
      const entry = scenario('strongest', '同类最强（无过滤 shred 30% 至 100、50% 至 60，tick 59/60/61）');
      let groups = seed([], 'e', itemSource('u4-shred-30', 'shred-30', 'p'), statusApp('shred', 3000, 100));
      groups = seed(groups, 'e', itemSource('u4-shred-50', 'shred-50', 'p'), statusApp('shred', 5000, 60));
      const run = simulate('u4-strongest', battle([dummy('p', 'player', { col: 1, row: 4 }), dummy('e', 'enemy', { col: 1, row: 3 }, { mechanismState: { ...EMPTY_MECHANISMS, statuses: groups } })]), 61);
      for (const tick of [59, 60, 61]) {
        const combat = run.at(tick), group = unitOf(combat, 'e').mechanismState.statuses.find(g => g.kind === 'shred');
        const domain = group ? group.contributions.map(c => ({ bps: c.application.magnitudeBps, effective: c.key === group.effectiveSourceKey, expiresAtTick: c.expiresAtTick })) : [];
        const strategy = await call('strategy', { label: `strongest-${tick}`, combat, selected: 'e' }); readOnly(entry, `策略面板 tick ${tick}`, strategy);
        const stats = await call('stats', { label: `strongest-${tick}`, combat, events: run.events.filter(e => e.tick <= tick), selected: 'e' }); readOnly(entry, `统计面板 tick ${tick}`, stats);
        const rows = strategy.lines.filter(l => l.debug === 'combat-status:shred').map(l => l.text), listed = stats.statuses.filter(t => t.startsWith('魔抗击碎'));
        const observed = { tick, domain, strategy: rows, stats: listed, inactive: strategy.lines.filter(l => l.debug === 'combat-status:shred').map(l => l.cls.includes('inactive')) };
        for (const [panel, lines] of [['策略面板', rows], ['统计面板', listed]]) {
          if (tick === 59) {
            check(entry, `${panel} tick 59：50% 行正常、30% 行“同类状态由另一来源提供（本来源保留）”`, lines.length === 2 && lines.some(t => t.startsWith('魔抗击碎 50%') && !t.includes(SUPPRESSED))
              && lines.some(t => t.startsWith('魔抗击碎 30%') && t.includes('同类状态由另一来源提供（本来源保留）')), observed);
          } else {
            check(entry, `${panel} tick ${tick}：仅 30% 行且无该文字`, lines.length === 1 && lines[0].startsWith('魔抗击碎 30%') && !lines[0].includes(SUPPRESSED), observed);
          }
        }
        if (tick === 59) check(entry, 'tick 59 策略面板仅 30% 行为 inactive 样式', observed.inactive.filter(Boolean).length === 1 && strategy.lines.find(l => l.cls.includes('inactive'))?.text.startsWith('魔抗击碎 30%'), observed);
        check(entry, `tick ${tick} 领域快照与显示一致`, tick === 59 ? domain.length === 2 && domain.find(d => d.bps === 5000).effective : domain.length === 1 && domain[0].bps === 3000 && domain[0].effective, domain);
      }
    }

    /* ---------- 同类同强度：两名同星厄加特各 20% 护甲击碎 ---------- */
    {
      const entry = scenario('tie', '同类同强度（两名 1 星厄加特对同一目标各施加 20% 护甲击碎）');
      const run = simulate('u4-tie', battle([hero('urgot', 'p1', 'player', { col: 1, row: 4 }), hero('urgot', 'p2', 'player', { col: 2, row: 4 }), dummy('e', 'enemy', { col: 2, row: 3 })]), 2);
      const group = unitOf(run.final, 'e').mechanismState.statuses.find(g => g.kind === 'sunder');
      const unpicked = group.contributions.findIndex(c => c.key !== group.effectiveSourceKey);
      check(entry, '领域：两份 20% 击碎，按 key 选定一份', group.contributions.length === 2 && group.contributions.every(c => c.application.magnitudeBps === 2000) && unpicked >= 0,
        { contributions: group.contributions.map(c => [c.source.ownerId, c.application.magnitudeBps]), effective: group.effectiveSourceKey });
      const strategy = await call('strategy', { label: 'tie', combat: run.final, selected: 'e', events: run.events }); readOnly(entry, '策略面板', strategy);
      const stats = await call('stats', { label: 'tie', combat: run.final, events: run.events, selected: 'e' }); readOnly(entry, '统计面板', stats);
      const rows = strategy.lines.filter(l => l.debug === 'combat-status:sunder').map(l => l.text), listed = stats.statuses.filter(t => t.startsWith('护甲击碎'));
      for (const [panel, lines] of [['策略面板', rows], ['统计面板', listed]]) {
        check(entry, `${panel}：两行均显示“护甲击碎 20%”`, lines.length === 2 && lines.every(t => t.startsWith('护甲击碎 20%')), lines);
        // Rows follow the domain's contribution order (no UI sorting), so the unpicked index is the suppressed row.
        check(entry, `${panel}：仅领域未选中的一行显示“同类状态由另一来源提供（本来源保留）”`, lines.length === 2 && lines.every((t, i) => t.includes('同类状态由另一来源提供（本来源保留）') === (i === unpicked)), { unpicked, lines });
        check(entry, `${panel}：无“更强”等暗示大小的文字`, lines.every(t => !/更强|更弱|较强|较弱|最强|最弱|更高|更低/.test(t)), lines);
      }
      check(entry, '事件日志两条“护甲击碎 20% 生效”', strategy.log.filter(t => t.includes('护甲击碎 20% 生效')).length === 2, strategy.log.filter(t => t.includes('护甲击碎')));
    }

    /* ---------- R2 施加事件（正式 group） ---------- */
    {
      const entry = scenario('R2', 'R2 施加事件：厄加特/蕾欧娜/芮尔/库奇技能施加（按 UR-U4-05 正式 group 预期）');
      const expected = { urgot: ['护甲击碎 20% 生效'], leona: ['减伤 50% 生效'], rell: ['属性削弱 护甲 −10 / 魔抗 −10 生效'], corki: ['属性削弱 护甲 −1 生效'] };
      for (const [name, strings] of Object.entries(expected)) {
        const run = simulate(`u4-r2-${name}`, battle([hero(name, 'p', 'player', { col: 1, row: 4 }), dummy('e', 'enemy', { col: 1, row: 3 })]), 1);
        const applied = run.events.filter(e => e.type === 'statusChanged' && e.reason === 'applied');
        check(entry, `${name}：施加事件均带正式 group`, applied.length > 0 && applied.every(e => e.group && typeof e.group.kind === 'string' && e.group.contributions.length > 0),
          applied.map(e => ({ kind: e.group?.kind, contributions: e.group?.contributions.map(c => c.application.modifier ? [c.application.modifier.stat, c.application.modifier.value.amount] : c.application.magnitudeBps) })));
        const strategy = await call('strategy', { label: `R2-${name}`, combat: run.final, selected: 'p', events: run.events }); readOnly(entry, `${name} 策略面板`, strategy);
        const stats = await call('stats', { label: `R2-${name}`, combat: run.final, events: run.events, selected: null, filters: ['status'] }); readOnly(entry, `${name} 统计面板`, stats);
        for (const text of strings) {
          check(entry, `${name}：事件日志“${text}”`, has(strategy.log, text), strategy.log.filter(t => t.includes('：') && /生效|刷新/.test(t)));
          check(entry, `${name}：统计面板事件明细“${text}”`, has(stats.byFilter.status.list, text), stats.byFilter.status.list);
        }
        check(entry, `${name}：不出现“眩晕”/“属性变化”兼容文案`, [...strategy.log, ...stats.byFilter.status.list].every(t => !t.includes('眩晕') && !t.includes('属性变化')), null);
        if (name === 'rell') check(entry, 'rell：自身“属性提升 护甲 +10 / 魔抗 +10 生效”', has(strategy.log, '属性提升 护甲 +10 / 魔抗 +10 生效'), lineWith(strategy.log, '属性提升'));
      }
    }

    /* ---------- R2a / R2b 清理事件 ---------- */
    const cleanup = simulate('u4-cleanup', battle([
      hero('zyra', 'p', 'player', { col: 1, row: 4 }, { mana: 0, maxMana: 1000, attackDamage: 10, cooldownTicks: 0, itemPrograms: [bindItem('p', 'red-buff', 'item-1')] }),
      dummy('e', 'enemy', { col: 1, row: 3 }, { hp: 15, maxHp: 1000, attackDamage: 1, cooldownTicks: 0, itemPrograms: [bindItem('e', 'red-buff', 'enemy:1:e:0')] })]), 80);
    {
      const entry = scenario('R2a', 'R2a 兼容清理锚点（无 group / 无 contributionKeys / 无 activity）');
      const ends = cleanup.events.filter(e => e.type === 'statusChanged' && ['death-cleanup', 'combat-end'].includes(e.reason));
      check(entry, '固定输入不可再由领域产生：实际阵亡/战斗结束清理事件全部带正式 group', ends.length > 0 && ends.every(e => e.group && e.group.contributions.length > 0 && e.group.kind !== undefined),
        ends.map(e => [e.tick, e.reason, e.group?.kind, e.group?.contributions.length]));
      const strategy = await call('strategy', { label: 'R2a', combat: cleanup.final, selected: 'p', events: cleanup.events }); readOnly(entry, '策略面板', strategy);
      const endLines = strategy.log.filter(t => t.includes('阵亡清除') || t.includes('战斗结束'));
      check(entry, '清理日志不猜种类、不出现“眩晕”', endLines.length > 0 && endLines.every(t => !t.includes('眩晕')), endLines);
      manifest.deviations.push({ scenario: 'R2a', spec: '输入固定为无 group、无 contributionKeys、无 activity 的清理事件，显示“状态清理（阵亡清除）/（战斗结束）”',
        actual: 'B9 replay2 起 LedgerCombatEvent 的 statusChanged.group 为必填（contracts.ts M8CombatEvent），cleanupMechanisms 只发 endedStatusEvents（带 group）；该形状不是合法账本事件，界面也已无“状态清理”兼容分支。改为断言真实阵亡/战斗结束清理事件全部带 group、日志按真实种类显示且无“眩晕”。',
        why: 'UR-U4-05 已交付正式 group，规格写明交付后改按正式 group 预期；手写无 group 事件属于领域不会产生的假数据。' });
    }
    {
      const entry = scenario('R2b', 'R2b 正式 group 清理（灼烧/重伤 × 阵亡清除/战斗结束）');
      const ends = cleanup.events.filter(e => e.type === 'statusChanged' && ['death-cleanup', 'combat-end'].includes(e.reason));
      const kinds = ends.map(e => `${e.group?.kind}:${e.reason}`);
      check(entry, '领域：burn/wound 各有阵亡清除与战斗结束事件且带 group', ['burn:death-cleanup', 'wound:death-cleanup', 'burn:combat-end', 'wound:combat-end'].every(k => kinds.includes(k)), kinds);
      const strategy = await call('strategy', { label: 'R2b', combat: cleanup.final, selected: 'p', events: cleanup.events }); readOnly(entry, '策略面板', strategy);
      const stats = await call('stats', { label: 'R2b', combat: cleanup.final, events: cleanup.events, selected: null, filters: ['status'] }); readOnly(entry, '统计面板', stats);
      for (const [kind, reason] of [['灼烧', '阵亡清除'], ['重伤', '阵亡清除'], ['灼烧', '战斗结束'], ['重伤', '战斗结束']]) {
        const re = new RegExp(`：${kind} [^ ]+ ${reason}`);
        check(entry, `事件日志“${kind} … ${reason}”`, strategy.log.some(t => re.test(t)), strategy.log.find(t => re.test(t)) ?? strategy.log.filter(t => t.includes(reason)));
        check(entry, `统计面板“${kind} … ${reason}”`, stats.byFilter.status.list.some(t => re.test(t)), stats.byFilter.status.list.find(t => re.test(t)) ?? null);
      }
      check(entry, '不出现“眩晕”', [...strategy.log, ...stats.byFilter.status.list].every(t => !t.includes('眩晕')), null);
    }

    /* ---------- R3 来源：临时子件护盾、状态与治疗 ---------- */
    {
      const entry = scenario('R3', 'R3 来源（窃贼手套临时子件：饮血剑护盾/吸血、红霸符灼烧/重伤）');
      const parent = 'item-9', child = slot => JSON.stringify([parent, '4-7', slot]);
      const run = simulate('u4-r3', battle([
        hero('zyra', 'p', 'player', { col: 1, row: 4 }, { mana: 0, maxMana: 1000, hp: 450, cooldownTicks: 0, itemPrograms: [bindItem('p', 'bloodthirster', child(1), parent), bindItem('p', 'red-buff', child(2), parent)] }),
        dummy('e', 'enemy', { col: 1, row: 3 }, { attackDamage: 100, cooldownTicks: 0 })]), 2);
      const p = unitOf(run.final, 'p'), layer = p.shieldLayers.find(l => l.remaining > 0);
      check(entry, '领域：护盾 m8State.source.parentItemInstanceId 非空', layer?.m8State?.source.parentItemInstanceId === parent, layer?.m8State?.source);
      const legacyHasParent = Boolean(layer?.source.parentItemInstanceId);
      if (legacyHasParent) manifest.deviations.push({ scenario: 'R3', spec: '临时子件护盾 layer.source 无 parentItemInstanceId（只有 m8State.source 有）',
        actual: `当前 shieldProjection 的 layer.source 也带 parentItemInstanceId=${layer.source.parentItemInstanceId}`, why: '后端后续把父实例写进旧投影；界面仍优先读 m8State.source（shieldSource），断言不依赖旧字段缺失。' });
      const heal = run.events.find(e => e.type === 'heal'), burn = run.events.find(e => e.type === 'statusChanged' && e.group.kind === 'burn');
      check(entry, '领域：治疗份额与灼烧贡献来源带父实例', heal?.outcome.shares.every(s => s.source.parentItemInstanceId === parent) && burn?.group.contributions[0].source.parentItemInstanceId === parent,
        { heal: heal?.outcome.shares.map(s => s.source), burn: burn?.group.contributions[0].source });
      const strategyP = await call('strategy', { label: 'R3-p', combat: run.final, selected: 'p', events: run.events }); readOnly(entry, '策略面板（持有者）', strategyP);
      const strategyE = await call('strategy', { label: 'R3-e', combat: run.final, selected: 'e', events: run.events }); readOnly(entry, '策略面板（目标）', strategyE);
      const stats = await call('stats', { label: 'R3', combat: run.final, events: run.events, selected: null, filters: ['shield', 'status', 'heal'] }); readOnly(entry, '统计面板', stats);
      const statsE = await call('stats', { label: 'R3-e', combat: run.final, events: run.events, selected: 'e' }); readOnly(entry, '统计面板（目标）', statsE);
      const shieldRow = strategyP.lines.find(l => l.cls === 'combat-shield')?.text ?? null;
      check(entry, '策略面板盾行含“临时子件”', shieldRow?.includes('· 饮血剑 · 临时子件'), shieldRow);
      for (const [label, filter, part] of [['护盾', 'shield', '饮血剑 · 临时子件 → '], ['状态', 'status', '红霸符 · 临时子件 → '], ['治疗', 'heal', '饮血剑 · 临时子件 → ']]) {
        check(entry, `事件日志${label}含“临时子件”`, has(strategyP.log, part), lineWith(strategyP.log, part.split(' → ')[0]));
        check(entry, `统计面板${label}来源含“临时子件”`, has(stats.byFilter[filter].list, part), stats.byFilter[filter].list);
      }
      const statusRowStrategy = strategyE.lines.find(l => l.debug === 'combat-status:burn')?.text ?? '', statusRowStats = statsE.statuses.find(t => t.startsWith('灼烧')) ?? '';
      check(entry, '目标状态行（两面板）来源含“临时子件”', statusRowStrategy.includes('红霸符 · 临时子件') && statusRowStats.includes('红霸符 · 临时子件'), { strategy: statusRowStrategy, stats: statusRowStats });
      // Both panels format the source with the same originLabel; each panel keeps its own owner-name style.
      const tail = text => (text.match(/来源 (.*)$/)?.[1] ?? '').replace(/^[^·]+· /, '');
      check(entry, '两面板来源格式一致（originLabel 同一串）', tail(statusRowStrategy) !== '' && tail(statusRowStrategy) === tail(statusRowStats), { strategy: tail(statusRowStrategy), stats: tail(statusRowStats) });
      const owner = text => text.match(/来源 ([^·]+) ·/)?.[1]?.trim() ?? null;
      if (owner(statusRowStrategy) !== owner(statusRowStats)) manifest.observations.push({ scenario: 'R3', note: '来源中的单位名两面板写法不同（策略面板用 ★，统计面板用“N星”）；来源串本身（originLabel）一致。', strategy: owner(statusRowStrategy), stats: owner(statusRowStats) });
    }

    /* ---------- R4 治疗分项（A10 两套） ---------- */
    {
      const entry = scenario('R4', 'R4 治疗分项（A10：饮血剑请求 20 + 枪刃请求 15，缺血 20；无重伤 / 33% 重伤）');
      const vamp = ['bloodthirster', 'gunblade'].map((id, i) => ({ source: itemSource(id, id, 'p'), modifier: { stat: 'omnivamp', unit: 'bps', value: { kind: 'constant', amount: i === 0 ? 2000 : 1500 }, condition: { kind: 'always' }, damageFilter: null }, allyBps: 0, allyCondition: { kind: 'always' } }));
      const sets = { none: { wound: [], expect: { total: [35, 20, 15, 0], shares: [['饮血剑', 20, 11, 9, 0], ['海克斯科技枪刃', 15, 9, 6, 0]] } },
        wound33: { wound: seed([], 'p', itemSource('u4-wound', 'wound', 'e'), statusApp('wound', 3300, 100)), expect: { total: [35, 20, 3, 12], shares: [['饮血剑', 20, 11, 2, 7], ['海克斯科技枪刃', 15, 9, 1, 5]] } } };
      for (const [name, set] of Object.entries(sets)) {
        const run = simulate(`u4-r4-${name}`, battle([dummy('p', 'player', { col: 1, row: 4 }, { hp: 980, maxHp: 1000, attackDamage: 100, cooldownTicks: 0,
          mechanismDefinitions: { periodicTasks: [], survivalTriggers: [], vamp }, mechanismState: { ...EMPTY_MECHANISMS, statuses: set.wound } }), dummy('e', 'enemy', { col: 1, row: 3 })]), 1);
        const heal = run.events.filter(e => e.type === 'heal');
        const o = heal[0]?.outcome;
        check(entry, `${name}：领域一次治疗 ${set.expect.total.join('/')}`, heal.length === 1 && o.requested === set.expect.total[0] && o.actual === set.expect.total[1] && o.overheal === set.expect.total[2] && o.preventedByWound === set.expect.total[3],
          o && { requested: o.requested, afterWound: o.afterWound, actual: o.actual, overheal: o.overheal, preventedByWound: o.preventedByWound, shares: o.shares.map(s => [s.source.definitionId, s.requested, s.actual, s.overheal, s.preventedByWound]) });
        const strategy = await call('strategy', { label: `R4-${name}`, combat: run.final, selected: 'p', events: run.events }); readOnly(entry, `${name} 策略面板`, strategy);
        const stats = await call('stats', { label: `R4-${name}`, combat: run.final, events: run.events, selected: 'p', filters: ['heal'] }); readOnly(entry, `${name} 统计面板`, stats);
        const [requested, actual, overheal, prevented] = set.expect.total;
        const parts = [`请求 ${requested}，有效治疗 ${actual}，过量治疗 ${overheal}，重伤减少 ${prevented}`, ...set.expect.shares.map(([label, r, a, ov, pw]) => `${label}：请求 ${r}，有效 ${a}，过量 ${ov}，重伤减少 ${pw}`)];
        check(entry, `${name}：事件日志含总数与两来源各自分项`, has(strategy.log, ...parts), lineWith(strategy.log, '有效治疗'));
        check(entry, `${name}：统计面板治疗明细含两来源各自分项`, has(stats.byFilter.heal.list, ...parts), stats.byFilter.heal.list);
        check(entry, `${name}：统计表有效治疗 ${actual}`, stats.table.p?.[2] === String(actual), stats.table.p);
        check(entry, `${name}：选中详情过量治疗 ${overheal}`, stats.detail.includes(`有效治疗 ${actual}；过量治疗 ${overheal}`), stats.detail);
      }
    }

    /* ---------- 三类伤害 ---------- */
    {
      const entry = scenario('damage-types', '三类伤害（物理 10、魔法 20、真实 30 各一包，同一来源单位）');
      // Lux's empowered attack (360 magic vs 1700 MR → 20) and Red Buff's burn (1% of 3000 max HP → 30 true) on an AD 10 basic attack.
      const run = simulate('u4-types', battle([hero('lux', 'p', 'player', { col: 1, row: 4 }, { attackDamage: 10, baseAttackSpeedBps: 5000, itemPrograms: [bindItem('p', 'red-buff', 'item-1')] }),
        dummy('e', 'enemy', { col: 1, row: 3 }, { hp: 3000, maxHp: 3000, magicResist: 1700 })]), 61);
      const packets = run.events.filter(e => e.type === 'packetDamage' && e.outcome.context.source.ownerId === 'p' && e.outcome.hpDamage > 0);
      const byType = Object.fromEntries(packets.map(e => [e.outcome.context.damageType, e.outcome.hpDamage]));
      check(entry, '领域：三包各一，物理 10 / 魔法 20 / 真实 30', packets.length === 3 && byType.physical === 10 && byType.magic === 20 && byType.true === 30,
        packets.map(e => [e.tick, e.outcome.context.damageType, e.outcome.context.delivery, e.outcome.hpDamage]));
      const strategy = await call('strategy', { label: 'types', combat: run.final, selected: 'e', events: run.events }); readOnly(entry, '策略面板', strategy);
      for (const [label, value] of [['物理', 10], ['魔法', 20], ['真实', 30]]) check(entry, `事件日志“${label}实际生命伤害 ${value}”`, has(strategy.log, `${label}实际生命伤害 ${value}`), lineWith(strategy.log, `${label}实际生命伤害`));
      const stats = await call('stats', { label: 'types', combat: run.final, events: run.events, selected: null, click: 'p', filters: ['damage'] }); readOnly(entry, '统计面板（点选单位）', stats);
      check(entry, '点选统计表单位触发选择回调', stats.selectedCallback === 'p', stats.selectedCallback);
      check(entry, '选中单位详情三类分别 10/20/30', ['物理实际伤害 10', '魔法实际伤害 20', '真实实际伤害 30'].every(t => stats.detail.includes(t)), stats.detail);
      check(entry, '统计表实际伤害合计 60', stats.table.p?.[0] === '60', stats.table.p);
      const anchors = { e: { x: 360, y: 300, radius: 16 }, p: { x: 360, y: 390, radius: 16 } };
      const byTick = [...new Set(packets.map(e => e.tick))].map((tick, i) => ({ events: packets.filter(e => e.tick === tick), at: i * 2000 }));
      const floats = await call('floats', { label: 'types', batches: byTick, anchors }); readOnly(entry, '飘字', floats);
      const shown = floats.observed.flat();
      for (const text of ['−10', '−20 魔', '−30 真']) check(entry, `飘字“${text}”`, shown.includes(text), floats.observed);
      // Observation: the same ticks pushed with the whole ledger (status floats share the renderer's per-unit cap of 3).
      const ledgerTicks = [...new Set(packets.map(e => e.tick))].map((tick, i) => ({ events: run.events.filter(e => e.tick === tick), at: i * 2000 }));
      const full = await call('floats', { label: 'types-full', batches: ledgerTicks, anchors }); readOnly(entry, '飘字（完整账本）', full);
      if (!['−10', '−20 魔', '−30 真'].every(text => full.observed.flat().includes(text))) manifest.observations.push({ scenario: 'damage-types',
        note: '按完整账本逐 tick 推送时，同 tick 的灼烧/重伤状态飘字与伤害飘字共用每单位 3 个上限，较早的伤害飘字被挤掉（仅表现节流，账本与统计不受影响）。规格断言按伤害包推送核对。', observed: full.observed });
    }

    /* ---------- 引导被控取消（范德尔） ---------- */
    const vander = simulate('u4-vander', battle([hero('vander', 'p', 'player', { col: 1, row: 4 }), hero('zyra', 'e', 'enemy', { col: 1, row: 3 }, { mana: 80, attackDamage: 10, cooldownTicks: 0 })]), 60);
    {
      const entry = scenario('channel', '引导被控取消（范德尔引导，婕拉眩晕）');
      const activity = vander.events.filter(e => e.type === 'activityChanged' && e.activity.targetId === 'p');
      const start = activity.find(e => e.reason === 'applied'), cancel = activity.find(e => e.reason === 'control-cancelled');
      const stun = vander.events.filter(e => e.type === 'statusChanged' && e.group.kind === 'stun' && e.group.targetId === 'p');
      const stunEnd = stun.find(e => e.reason === 'expired');
      check(entry, '领域：引导开始、被控制取消、眩晕到期', start && cancel && stunEnd && cancel.tick > start.tick && stunEnd.tick > cancel.tick && cancel.tick < start.activity.expiresAtTick,
        { start: start?.tick, plannedEnd: start?.activity.expiresAtTick, cancelled: cancel?.tick, stunApplied: stun.find(e => e.reason === 'applied')?.tick, stunExpired: stunEnd?.tick });
      const strategy = await call('strategy', { label: 'channel-log', combat: vander.final, selected: 'p', events: vander.events }); readOnly(entry, '策略面板日志', strategy);
      check(entry, '日志“引导 被控制打断”', has(strategy.log, '引导 被控制打断'), lineWith(strategy.log, '引导'));
      const stats = await call('stats', { label: 'channel-log', combat: vander.final, events: vander.events, selected: null, filters: ['status'] }); readOnly(entry, '统计面板日志', stats);
      check(entry, '统计面板事件明细“引导 被控制打断”', has(stats.byFilter.status.list, '引导 被控制打断'), lineWith(stats.byFilter.status.list, '引导'));
      const ticks = cancel && stunEnd ? [cancel.tick - 1, cancel.tick, cancel.tick + 1, stunEnd.tick, stunEnd.tick + 1, start.activity.expiresAtTick - 1] : [];
      for (const tick of ticks) {
        const combat = vander.at(tick), before = tick < cancel.tick;
        const s = await call('strategy', { label: `channel-${tick}`, combat, selected: 'p' }); readOnly(entry, `策略面板 tick ${tick}`, s);
        const st = await call('stats', { label: `channel-${tick}`, combat, events: vander.events.filter(e => e.tick <= tick), selected: 'p' }); readOnly(entry, `统计面板 tick ${tick}`, st);
        const badges = await call('badges', { label: `channel-${tick}`, combat, unitId: 'p' }); readOnly(entry, `棋子小标 tick ${tick}`, badges);
        const listed = s.lines.some(l => l.debug === 'combat-status:channel') || st.statuses.some(t => t.startsWith('引导'));
        check(entry, `tick ${tick}（${before ? '取消前' : tick >= stunEnd.tick ? '眩晕结束后' : '取消后'}）：状态列表${before ? '有' : '无'}引导，棋子小标${before ? '有' : '无'}“引”`,
          listed === before && badges.beneficial.includes('引') === before, { strategy: s.lines.filter(l => l.debug?.startsWith('combat-status')).map(l => l.text), stats: st.statuses, badges: [badges.beneficial, badges.harmful] });
      }
      manifest.observations.push({ scenario: 'channel', note: '棋子“引”小标通过 statusBadges(combat, unitId)（UnitView/ReplayView 棋子小标的唯一数据源）核对，未读取 Phaser 画布文字。' });
    }

    /* ---------- 状态与法力筛选 ---------- */
    {
      const entry = scenario('filters', '状态与法力筛选（统计面板“状态”“法力”“全部事件（法力单列）”）');
      const stats = await call('stats', { label: 'filters', combat: vander.final, events: vander.events, selected: null, filters: ['status', 'mana', 'all'] }); readOnly(entry, '统计面板（切换筛选）', stats);
      const count = types => vander.events.filter(e => types(e.type)).length;
      const shown = new Set(['packetDamage', 'heal', 'targetChanged', 'cast', 'shieldLayerChanged', 'statusChanged', 'activityChanged', 'statChanged', 'maxHpChanged', 'manaChanged', 'growth', 'kill', 'death', 'combatFinished', 'effectTriggered']);
      const expected = { status: count(t => t === 'statusChanged' || t === 'activityChanged'), statusOnly: count(t => t === 'statusChanged'), mana: count(t => t === 'manaChanged'), all: count(t => shown.has(t) && t !== 'manaChanged') };
      const total = filter => Number(stats.byFilter[filter].range.match(/共 (\d+) 条/)?.[1] ?? NaN);
      const manaLine = /：[^：]*法力 \d+ → \d+$/;
      const statusLine = /：(灼烧|重伤|护甲击碎|魔抗击碎|眩晕|免疫控制|不可选中|伤害防止|属性提升|属性削弱|减伤|引导|伤害分担)[^：]* (生效|刷新|到期|被净化|来源失效|阵亡清除|被替换|战斗结束|被控制打断)/;
      check(entry, '“状态”只含状态事件（statusChanged，及正式 activityChanged）', total('status') === expected.status && stats.byFilter.status.list.every(t => statusLine.test(t)) && expected.status > 0,
        { total: total('status'), expected, sample: stats.byFilter.status.list.slice(0, 6) });
      check(entry, '“法力”只含 manaChanged', total('mana') === expected.mana && expected.mana > 0 && stats.byFilter.mana.list.every(t => manaLine.test(t)), { total: total('mana'), expected: expected.mana, sample: stats.byFilter.mana.list.slice(0, 4) });
      check(entry, '“全部事件（法力单列）”不含 manaChanged', total('all') === expected.all && stats.byFilter.all.list.every(t => !manaLine.test(t)), { total: total('all'), expected: expected.all });
      if (expected.status !== expected.statusOnly) manifest.deviations.push({ scenario: 'filters', spec: '“状态”只有 statusChanged',
        actual: `“状态”筛选含 statusChanged ${expected.statusOnly} 条 + activityChanged ${expected.status - expected.statusOnly} 条`,
        why: 'UR-U4-04 已把引导/分担改为冻结的 activityChanged，并要求筛选同步改读该事件；引导/分担在界面上属于状态类，仍不混入法力或伤害。' });
    }

    /* ---------- 护盾 A / B / C ---------- */
    let shieldAAbsorbed = null;
    {
      const entry = scenario('shield-A', '护盾 A：600 线性衰减盾，自然衰减 100 后吸收 120（艾瑞莉娅技能）');
      // Irelia 1★ at 150 AP: 600 shield over 60 ticks (10 per tick); the enemy's 120 attack lands 10 ticks after the grant.
      const run = simulate('u4-shield-a', battle([hero('irelia', 'p', 'player', { col: 1, row: 4 }, { abilityPower: 150, attackDamage: 0 }), dummy('e', 'enemy', { col: 1, row: 3 }, { attackDamage: 120, cooldownTicks: 11 })]), 11);
      const shieldEvents = run.events.filter(e => e.type === 'shieldLayerChanged'), absorbed = shieldEvents.find(e => e.reason === 'absorbed');
      check(entry, '领域：剩余 380、已吸收 120、已衰减 100', absorbed?.layer.granted === 600 && absorbed.layer.remaining === 380 && absorbed.layer.absorbed === 120 && absorbed.layer.decayed === 100,
        absorbed && { granted: absorbed.layer.granted, remaining: absorbed.layer.remaining, absorbed: absorbed.layer.absorbed, decayed: absorbed.layer.decayed, tick: absorbed.tick });
      const strategy = await call('strategy', { label: 'shield-A', combat: run.final, selected: 'p', events: run.events }); readOnly(entry, '策略面板', strategy);
      const stats = await call('stats', { label: 'shield-A', combat: run.final, events: run.events, selected: 'p', filters: ['shield'] }); readOnly(entry, '统计面板', stats);
      check(entry, '日志含“自然衰减”', has(strategy.log, '护盾自然衰减'), lineWith(strategy.log, '自然衰减'));
      check(entry, '日志含“吸收伤害”，剩余 380、已吸收 120、已衰减 100', has(strategy.log, '护盾吸收伤害，剩余 380，已吸收 120，已衰减 100'), lineWith(strategy.log, '吸收伤害'));
      check(entry, '统计面板护盾明细同上', has(stats.byFilter.shield.list, '护盾吸收伤害，剩余 380，已吸收 120，已衰减 100'), lineWith(stats.byFilter.shield.list, '吸收伤害'));
      const row = strategy.lines.find(l => l.cls === 'combat-shield')?.text ?? null;
      check(entry, '策略面板盾行 380 / 600 · 已吸收 120 · 已衰减 100', row?.startsWith('盾 380 / 600 · 已吸收 120 · 已衰减 100'), row);
      check(entry, '本子场景统计吸收 120（衰减不计）', stats.stats.units.find(u => u.unitId === 'p')?.shieldAbsorbed === 120 && stats.table.p?.[1] === '120', { table: stats.table.p, detail: stats.detail.match(/受击护盾吸收 \d+/)?.[0] });
      shieldAAbsorbed = stats.stats.units.find(u => u.unitId === 'p')?.shieldAbsorbed ?? null;
    }
    {
      const entry = scenario('shield-B', '护盾 B：另一盾受伤害至 0（拉克丝技能盾）');
      const run = simulate('u4-shield-b', battle([hero('lux', 'p', 'player', { col: 1, row: 4 }, { attackDamage: 0 }), dummy('e', 'enemy', { col: 1, row: 3 }, { attackDamage: 1000, cooldownTicks: 3 })]), 4);
      const depleted = run.events.find(e => e.type === 'shieldLayerChanged' && e.reason === 'depleted'), absorbed = run.events.find(e => e.type === 'shieldLayerChanged' && e.reason === 'absorbed');
      check(entry, '领域：吸收至 0 并耗尽', absorbed?.layer.remaining === 0 && depleted?.layer.remaining === 0 && depleted.layer.absorbed === depleted.layer.granted,
        depleted && { granted: depleted.layer.granted, absorbed: depleted.layer.absorbed, remaining: depleted.layer.remaining });
      const strategy = await call('strategy', { label: 'shield-B', combat: run.final, selected: 'p', events: run.events }); readOnly(entry, '策略面板', strategy);
      const stats = await call('stats', { label: 'shield-B', combat: run.final, events: run.events, selected: 'p', filters: ['shield'] }); readOnly(entry, '统计面板', stats);
      const granted = depleted?.layer.granted;
      check(entry, `日志含“吸收伤害”至剩余 0（已吸收 ${granted}）与“耗尽”`, has(strategy.log, `护盾吸收伤害，剩余 0，已吸收 ${granted}`) && has(strategy.log, `护盾耗尽，剩余 0，已吸收 ${granted}`),
        strategy.log.filter(t => t.includes('护盾')));
      check(entry, `该盾吸收量单独统计 ${granted}，与 A 的 120 分开`, stats.stats.units.find(u => u.unitId === 'p')?.shieldAbsorbed === granted && stats.table.p?.[1] === String(granted) && shieldAAbsorbed === 120,
        { table: stats.table.p, A: shieldAAbsorbed });
      check(entry, '耗尽后策略面板不再显示该盾行', !strategy.lines.some(l => l.cls === 'combat-shield'), strategy.lines.filter(l => l.cls === 'combat-shield').map(l => l.text));
      manifest.deviations.push({ scenario: 'shield-B', spec: '日志含“吸收伤害（耗尽）”',
        actual: '领域在同一 tick 先发 absorbed（剩余 0）再发 depleted 两条 shieldLayerChanged；日志分别显示“护盾吸收伤害，剩余 0…”与“护盾耗尽，剩余 0…”',
        why: 'B9 replay2 账本按结束原因单独发事件，界面逐条显示；断言两条均出现，而不是合并文案。' });
    }
    {
      const entry = scenario('shield-C', '护盾 C：持盾单位阵亡 / 战斗结束');
      const death = simulate('u4-shield-c-death', battle([hero('irelia', 'p', 'player', { col: 1, row: 4 }, { abilityPower: 150, attackDamage: 0 }), hero('lux', 'p2', 'player', { col: 3, row: 4 }, { mana: 0, attackDamage: 0 }),
        dummy('e', 'enemy', { col: 1, row: 3 }, { attackDamage: 3000, cooldownTicks: 3 })]), 4);
      const end = simulate('u4-shield-c-end', battle([hero('lux', 'p', 'player', { col: 1, row: 4 }, { attackDamage: 5000 }), dummy('e', 'enemy', { col: 1, row: 3 }, { hp: 100, maxHp: 100 })]), 40);
      for (const [label, run, reason, text] of [['阵亡', death, 'death-cleanup', '阵亡清除'], ['战斗结束', end, 'combat-end', '战斗结束']]) {
        const index = run.events.findIndex(e => e.type === 'shieldLayerChanged' && e.reason === reason);
        check(entry, `领域：${label}清理事件存在`, index >= 0, run.events.filter(e => e.type === 'shieldLayerChanged').map(e => [e.tick, e.reason, e.layer.remaining]));
        const before = await call('stats', { label: `shield-C-${reason}-before`, combat: run.final, events: run.events.slice(0, index), selected: 'p' }); readOnly(entry, `${label}前统计面板`, before);
        const after = await call('stats', { label: `shield-C-${reason}`, combat: run.final, events: run.events, selected: 'p', filters: ['shield'] }); readOnly(entry, `${label}后统计面板`, after);
        const strategy = await call('strategy', { label: `shield-C-${reason}`, combat: run.final, selected: 'p', events: run.events }); readOnly(entry, `${label}策略面板`, strategy);
        check(entry, `日志“护盾${text}”`, has(strategy.log, `护盾${text}`) && has(after.byFilter.shield.list, `护盾${text}`), lineWith(strategy.log, `护盾${text}`));
        const absorbedOf = view => view.stats.units.find(u => u.unitId === 'p')?.shieldAbsorbed ?? 0;
        check(entry, `${label}清理不增加统计吸收`, absorbedOf(before) === absorbedOf(after) && before.table.p?.[1] === after.table.p?.[1], { before: absorbedOf(before), after: absorbedOf(after) });
      }
      manifest.deviations.push({ scenario: 'shield-C', spec: '日志“到期（阵亡清除）/（战斗结束）”',
        actual: '结束原因 death-cleanup / combat-end 是独立的 ShieldEndReason（不是 expired 的子类），日志显示“护盾阵亡清除”“护盾战斗结束”',
        why: '界面按领域结束原因原样映射（SHIELD_REASON_NAMES），不把非到期原因改写成“到期”。断言原因文字出现且统计吸收不变。' });
    }

    /* ---------- 只读汇总 ---------- */
    {
      const entry = scenario('read-only', '只读（每个场景渲染、切换筛选、选中单位前后 JSON.stringify 不变）');
      const perCall = manifest.scenarios.flatMap(s => s.checks.filter(c => c.name.startsWith('只读：')).map(c => ({ scenario: s.id, name: c.name, passed: c.passed })));
      check(entry, '每次渲染/筛选/选中前后输入不变', perCall.length > 0 && perCall.every(c => c.passed), { calls: perCall.length, failed: perCall.filter(c => !c.passed) });
      const mutated = await page.evaluate(() => window.u4.finalReadOnly());
      check(entry, '全程交给界面的事件、战斗快照、BattleStats 与 Match 状态均未被改写', mutated.length === 0, mutated);
    }
  } catch (error) {
    manifest.errors.push(error.stack ?? String(error));
  } finally {
    await browser?.close();
    await server.close();
    for (const s of manifest.scenarios) s.passed = s.checks.length > 0 && s.checks.every(c => c.passed);
    manifest.runtimeMs = Date.now() - started;
    manifest.passed = manifest.errors.length === 0 && manifest.scenarios.length > 0 && manifest.scenarios.every(s => s.passed);
    fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
    for (const s of manifest.scenarios) console.log(`${s.passed ? 'PASS' : 'FAIL'} ${s.id} (${s.checks.filter(c => c.passed).length}/${s.checks.length}) ${s.title}`);
    for (const s of manifest.scenarios) for (const c of s.checks.filter(c => !c.passed)) console.log(`  ✗ ${s.id}: ${c.name}\n    ${JSON.stringify(c.observed)}`);
    for (const error of manifest.errors) console.error(error);
    console.log(`${manifest.passed ? 'PASSED' : 'FAILED'} in ${(manifest.runtimeMs / 1000).toFixed(1)}s → ${path.join(output, 'manifest.json')}`);
    if (!manifest.passed) process.exitCode = 1;
  }
})();
