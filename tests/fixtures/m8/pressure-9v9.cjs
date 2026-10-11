/* M8 engine pressure fixture: 9v9, every unit three-star with three M8 completed items.
 *
 * Purpose: per-tick cost of the current S13 combat engine (stepCombat) under a denser load than any
 * public route reaches (M8_PLAN.md §7.6 "另测合法9v9满装引擎压力fixture"). It is an engine fixture,
 * not a Match route: no economy, shop, loot or reward is involved and no production file is changed.
 *
 * Legality, all checked by build() before a single tick runs:
 * - roster: nine distinct S13 champions per side from UNIT_DEFINITIONS, star level 3, inside each side's
 *   deployment zone of DEFAULT_BOARD (player rows 4-7, enemy rows 0-3), no shared cell;
 * - equipment: 27 slots per side, M8 completed items only (slotCost 1, with a combat program),
 *   each placement accepted by the production checkEquipmentPlacement (unique/exclusive/slot);
 *   all 26 such M8 items appear on side A; thiefs-gloves (slotCost 3) is excluded by design;
 * - strategy: compiled only by the production buildStrategySnapshot. The engine snapshot boundary
 *   binds owned items to the player team only, so side B is compiled once in a mirrored state
 *   (B as "player") and its unit entries are merged; build() asserts that every non-item source
 *   (traits) of each B unit is identical in both compilations (apart from the team label inside the
 *   trait instance id), so mirroring adds items and nothing else.
 *
 * Deterministic: the spec below is data; build(modules, rngSeed) returns a fresh graph each call.
 * Variants: "distinct" = 18 different champions (A: player-side S13 lines, B: the other roster);
 * "mirror" = side A against itself reflected across the board, the densest events-per-tick load.
 * Usage (from repository root): node tests/fixtures/m8/pressure-9v9.cjs [rngSeed] [distinct|mirror]
 * prints the spec digest, unit/item counts and one full combat summary.
 */
const SIDE_A = Object.freeze([
  ['irelia', [1, 4], ['titans-resolve', 'bloodthirster', 'steraks-gage']],
  ['rell', [2, 4], ['bramble-vest', 'sunfire-cape', 'protectors-vow']],
  ['leona', [3, 4], ['crownguard', 'redemption', 'evenshroud']],
  ['loris', [4, 4], ['steadfast-heart', 'adaptive-helm', 'ionic-spark']],
  ['garen', [5, 4], ['edge-of-night', 'quicksilver', 'hand-of-justice']],
  ['corki', [1, 7], ['infinity-edge', 'last-whisper', 'runaans-hurricane']],
  ['zoe', [2, 7], ['jeweled-gauntlet', 'blue-buff', 'morellonomicon']],
  ['kogmaw', [4, 7], ['guardbreaker', 'statikk-shiv', 'nashors-tooth']],
  ['caitlyn', [5, 7], ['giant-slayer', 'red-buff', 'infinity-edge']],
]);
const SIDE_B = Object.freeze([
  ['darius', [1, 3], ['titans-resolve', 'steraks-gage', 'edge-of-night']],
  ['vander', [2, 3], ['bramble-vest', 'sunfire-cape', 'redemption']],
  ['scar', [4, 3], ['crownguard', 'protectors-vow', 'ionic-spark']],
  ['urgot', [5, 3], ['bloodthirster', 'quicksilver', 'hand-of-justice']],
  ['ezreal', [1, 0], ['infinity-edge', 'last-whisper', 'giant-slayer']],
  ['tristana', [2, 0], ['runaans-hurricane', 'red-buff', 'guardbreaker']],
  ['nami', [3, 0], ['blue-buff', 'morellonomicon', 'nashors-tooth']],
  ['lux', [4, 0], ['jeweled-gauntlet', 'statikk-shiv', 'adaptive-helm']],
  ['zyra', [5, 0], ['evenshroud', 'steadfast-heart', 'morellonomicon']],
]);
/** Same nine champions and items as side A, cells reflected across the board (row r -> 7 - r). */
const MIRROR_B = Object.freeze(SIDE_A.map(([id, [col, row], ids]) => Object.freeze([id, Object.freeze([col, 7 - row]), ids])));
const STAR_LEVEL = 3;
/** distinct: 18 different champions (ability coverage); mirror: A vs A (highest event density per tick). */
const VARIANTS = Object.freeze({ distinct: Object.freeze({ sideA: SIDE_A, sideB: SIDE_B }), mirror: Object.freeze({ sideA: SIDE_A, sideB: MIRROR_B }) });
const SPEC = Object.freeze({ id: 'm8-pressure-9v9-v1', starLevel: STAR_LEVEL, variants: VARIANTS });

/** Modules the builder needs, loaded through the same Vite SSR loader as scripts/generate-m5-route.cjs. */
async function loadModules(server) {
  const [match, snapshot, combat, board, policy, items, units] = await Promise.all([
    '/src/simulation/match.ts', '/src/simulation/strategy-snapshot.ts', '/src/simulation/combat.ts',
    '/src/simulation/board.ts', '/src/simulation/equipment-policy.ts', '/src/simulation/content/items.ts',
    '/src/simulation/units.ts'].map(id => server.ssrLoadModule(id)));
  return { match, snapshot, combat, board, policy, items, units };
}

function fail(message) { throw new Error(`pressure-9v9: ${message}`); }
const sideUnits = (side, prefix, team) => side.map(([definitionId, [col, row]], index) => ({
  id: `${prefix}-${index + 1}`, definitionId, team, starLevel: STAR_LEVEL, location: { kind: 'board', cell: { col, row } } }));
const sideItems = (side, prefix) => side.flatMap(([, , ids], index) => ids.map((definitionId, slot) => ({
  id: `${prefix}-item-${index + 1}-${slot}`, definitionId, location: { kind: 'unit', unitId: `${prefix}-${index + 1}`, slot } })));
// Trait instance ids embed the compiling team label ("enemy:2" vs "player:2"); compare everything else.
const nonItemSources = entry => JSON.stringify(entry.sources.filter(source => source.source.sourceKind !== 'item')
  .map(({ source: { sourceInstanceId, ...source }, effect }) => ({ source, effect })));

/** Returns { preparation, strategy, step, summary }: step is the engine's CombatStep after start effects. */
function build(modules, rngSeed = 42, variant = 'distinct') {
  const { match, snapshot, combat, board, policy, items: { ITEM_DEFINITIONS }, units: { UNIT_DEFINITIONS } } = modules;
  if (!Number.isInteger(rngSeed) || rngSeed < 0 || rngSeed > 0xffffffff) fail('rngSeed must be a uint32');
  const base = match.createMatch(42);
  const zone = board.DEFAULT_BOARD.deploymentZones;
  if (!Object.hasOwn(VARIANTS, variant)) fail(`unknown variant ${variant}`);
  const { sideA: SIDE_A, sideB: SIDE_B } = VARIANTS[variant];
  const all = [...SIDE_A, ...SIDE_B];
  if (SIDE_A.length !== 9 || SIDE_B.length !== 9) fail('nine units per side');
  for (const side of [SIDE_A, SIDE_B]) if (new Set(side.map(([id]) => id)).size !== 9) fail('nine distinct champions per side');
  if (variant === 'distinct' && new Set(all.map(([id]) => id)).size !== 18) fail('18 distinct champions');
  for (const [definitionId] of all) if (!Object.hasOwn(UNIT_DEFINITIONS, definitionId)) fail(`unknown unit ${definitionId}`);
  const cellKey = ([col, row]) => `${col},${row}`;
  if (new Set(all.map(([, cell]) => cellKey(cell))).size !== 18) fail('shared cell');
  for (const [, [col, row]] of SIDE_A) if (col < 0 || col >= 7 || row < zone.player.firstRow || row > zone.player.lastRow) fail('A outside player zone');
  for (const [, [col, row]] of SIDE_B) if (col < 0 || col >= 7 || row < zone.enemy.firstRow || row > zone.enemy.lastRow) fail('B outside enemy zone');
  const m8Completed = Object.values(ITEM_DEFINITIONS).filter(d => d.kind === 'completed' && d.combatProgram && d.slotCost === 1).map(d => d.id).sort();
  for (const [, , ids] of all) for (const id of ids) {
    if (!m8Completed.includes(id)) fail(`${id} is not an M8 one-slot completed item`);
  }
  const usedByA = new Set(SIDE_A.flatMap(([, , ids]) => ids));
  const missing = m8Completed.filter(id => !usedByA.has(id));
  if (missing.length) fail(`side A misses M8 items ${missing.join(',')}`);
  const legal = equipment => {
    const placed = [];
    for (const item of equipment) {
      const preview = policy.checkEquipmentPlacement(placed, { ...item, location: { kind: 'inventory' } }, item.location.unitId, item.location.slot);
      if (!preview.allowed) fail(`${item.id} ${item.definitionId}: ${preview.reason}`);
      placed.push(item);
    }
    return placed;
  };
  const aUnits = sideUnits(SIDE_A, 'pa', 'player'), bUnits = sideUnits(SIDE_B, 'pb', 'enemy');
  const aItems = legal(sideItems(SIDE_A, 'pa')), bItems = legal(sideItems(SIDE_B, 'pb'));
  const inputs = (unitsOnBoard, owned) => ({ ...base, phase: 'preparation', pendingChoice: null, combat: null, augments: [], anomalyBinding: null,
    items: owned, temporaryEquipment: [], persistentGrowth: [], preparation: { ...base.preparation, board: board.DEFAULT_BOARD, units: unitsOnBoard } });
  const preparation = inputs([...aUnits, ...bUnits], aItems).preparation;
  const forA = snapshot.buildStrategySnapshot(inputs([...aUnits, ...bUnits], aItems));
  const mirrored = [...bUnits.map(u => ({ ...u, team: 'player' })), ...aUnits.map(u => ({ ...u, team: 'enemy' }))];
  const forB = snapshot.buildStrategySnapshot(inputs(mirrored, bItems));
  const units = [...forA.units.filter(u => u.unitId.startsWith('pa-')), ...forB.units.filter(u => u.unitId.startsWith('pb-'))]
    .sort((a, b) => a.unitId < b.unitId ? -1 : a.unitId > b.unitId ? 1 : 0);
  for (const entry of forB.units.filter(u => u.unitId.startsWith('pb-'))) {
    const original = forA.units.find(u => u.unitId === entry.unitId);
    if (nonItemSources(original) !== nonItemSources(entry)) fail(`${entry.unitId} mirrored compilation changed non-item sources`);
    if (entry.sources.filter(s => s.source.sourceKind === 'item').length === 0) fail(`${entry.unitId} has no item sources`);
  }
  if (units.length !== 18) fail('18 compiled units');
  const strategy = { traits: forA.traits, units };
  const step = combat.createCombatWithEvents(preparation, strategy, `pressure-9v9-${variant}-${rngSeed}`, rngSeed);
  if (step.state.status !== 'running') fail('combat did not start running');
  return { preparation, strategy, step, summary: { id: SPEC.id, variant, rngSeed, units: units.length, items: aItems.length + bItems.length,
    itemPrograms: units.reduce((n, u) => n + (u.itemPrograms?.length ?? 0), 0), traits: forA.traits.filter(t => t.tier > 0).map(t => `${t.team}:${t.traitId}:${t.tier}`) } };
}

module.exports = { SPEC, VARIANTS, build, loadModules };

if (require.main === module) {
  (async () => {
    const path = require('node:path'), { createHash } = require('node:crypto');
    const root = path.resolve(__dirname, '../../..');
    const { createServer } = await import(require.resolve('vite', { paths: [root] }));
    const server = await createServer({ root, server: { middlewareMode: true, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' });
    try {
      const modules = await loadModules(server), seed = Number(process.argv[2] ?? 42);
      const built = build(modules, seed, process.argv[3] ?? 'distinct');
      let state = built.step.state, events = built.step.events.length;
      while (state.status !== 'finished') { const next = modules.combat.stepCombat(state); events += next.events.length; state = next.state; }
      console.log(JSON.stringify({ specSha256: createHash('sha256').update(JSON.stringify(SPEC)).digest('hex'), ...built.summary,
        ticks: state.tick, events, result: state.result, survivors: state.units.filter(u => u.alive).map(u => u.id) }, null, 2));
    } finally { await server.close(); }
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
