// Regenerates two display-only tables from the archived 14.24 client data. Run from the repo root:
// `node src/presentation/client-tables/generate.mjs` (add --check to verify the committed files are current).
// - ../ability-zh.ts: the zh_cn client name and tooltip of every S13 ability whose content text is the English client string,
//   plus the six-cost heroes (CLIENT_KEYS) and Sevika's three spells, whose tokens are checked against the rules' display values;
//   RULE_PHRASES replaces the few client phrases that say something our rules do not do.
// - ../unit-roles.ts: each S13 champion's client role (角色定位), its zh_cn name and the role card's recommended items.
// Matching is by exact English text in the archived 14.24 en_us string table, then the same key is read from zh_cn; the
// zh template must use exactly the English template's @tokens@, so the rules' display values fill it unchanged.
import { buildSync } from 'esbuild';
import fs from 'node:fs';
import zlib from 'node:zlib';

const RAW = 'src/simulation/content/source/s13-14.24b/raw/';
const OUT = 'src/presentation/ability-zh.ts', ROLES_OUT = 'src/presentation/unit-roles.ts';
const table = (file, whole = false) => { const json = JSON.parse(zlib.gunzipSync(fs.readFileSync(RAW + file))); return whole ? json : json.entries; };
const en = table('en_us.tft.stringtable.json.gz'), zh = table('zh_cn.tft.stringtable.json.gz');
const bundled = buildSync({ stdin: { contents: "export { S13_ABILITY_DATA } from './src/simulation/content/abilities'; export { UNIT_DEFINITIONS } from './src/simulation/units'; export { abilityDisplayValues } from './src/simulation/ability-display';", resolveDir: '.', loader: 'ts' },
  bundle: true, write: false, format: 'esm', platform: 'node' }).outputFiles[0].text;
const { S13_ABILITY_DATA, UNIT_DEFINITIONS, abilityDisplayValues } = await import('data:text/javascript;base64,' + Buffer.from(bundled).toString('base64'));

/** Project-authored notes (not client strings) of project-defined units without a client ability, in plain Chinese. */
const AUTHORED = {
  'g23-sion-ability': { name: 'spell_tft13_sionspell_name', text: '获得持续3秒、175%法术强度（5档及以上黑色玫瑰为75%）的护盾，然后对目标方向一条直线上的敌人造成300%攻击力的物理伤害并眩晕1秒。挣脱束缚时冲向最近的敌人，对路径上的敌人造成100%攻击力的物理伤害并击飞0.5秒。' },
  'g23-forge-ability': { zhName: '海克斯科技锻炉', name: null, text: '固定不动、不会攻击的锻炉；杰斯施放技能时会将其复活。' },
  'g24-voidspawn-ability': { name: null, text: '只会普通攻击的召唤单位。14.6 版本后不再嘲讽。' },
  ...Object.fromEntries(['crab', 'wolf', 'mini'].map(kind => [`s13-${kind}-ability`, { name: null, text: '只在战斗中出现，不继承技能和装备。' }])),
  'training-dummy-ability': { name: null, text: '固定不动、不会攻击的训练假人。' },
  'tower-dummy-ability': { name: null, text: '固定不动的假人，射击造成100%攻击力加一部分随法术强度提升的伤害。' },
};
/**
 * Abilities whose content text is a project summary rather than the client string (six-cost heroes): the client tooltip
 * key is named here, and its @tokens@ must all be display values the rules give for that hero (ability-display.ts).
 */
const CLIENT_KEYS = {
  'mel-ability': 'spell_tft13_missmagespell', 'warwick-ability': 'spell_tft13_warwickspell', 'viktor-ability': 'spell_tft13_viktorspell',
};
/**
 * Where a client sentence says something our rules do not do, that phrase is replaced by a plain description of what they
 * do (each listed in the L10 mismatch list). Every `from` must occur exactly once in the zh_cn client text.
 */
const RULE_PHRASES = {
  // Blood Frenzy's per-second damage hits every adjacent enemy (combat-six-cost.ts), not the target alone.
  'warwick-ability': [{ from: '并每秒对目标造成', to: '并每秒对邻格的敌人们造成' }],
  // Flamethrower's physical splash hits the enemies adjacent to the target (combat-g2-3.ts flame()), not a cone.
  // Jackpot's coins only deal damage: no loot is generated (combat-g2-3.ts sevikaSpell).
  'sevika-ability': [{ from: '目标周围锥形范围内的敌人们受到物理伤害', to: '目标邻格的敌人们受到物理伤害' },
    { from: '物理伤害，有时还会生成战利品。', to: '物理伤害。' }],
  // Laboratory bonuses: Urgot does not reposition; Dr. Mundo grows on his own kills only (g2-3-combat.ts settleG23ExperimentKills).
  'urgot-ability': [{ from: '位移至目标后方。 ', to: '' }],
  'drmundo-ability': [{ from: '参与击杀后', to: '击杀后' }],
};
const tokens = text => [...new Set(text.match(/@[^@<>\s]+@/g) ?? [])].sort().join(' ');
const mainText = text => /<mainText>([\s\S]*)<\/mainText>/.exec(text)?.[1].replace('@SpellModifierDescriptionAppend@', '');
/** Markup the display formatter strips anyway; only <br> and spellActive (the Experiment branch marker) are kept. */
const compact = text => text.replace(/<(?!\/?spellActive\b|br\b)[^>]*>/gi, '').replace(/&nbsp;/g, ' ');

/**
 * `{{Key}}` includes a nested client string (Sevika's three spells). Their computed values are not among the rules'
 * display values, so the include is dropped and only the spell names stay (the English text showed the raw include).
 */
const dropIncludes = text => text.replace(/[:：]?\s*\{\{[^}]*\}\}/g, '');
/** `{{Key}}` replaced by that zh_cn client string (Sevika's three spells, whose values the rules give). */
const expandIncludes = text => text.replace(/\{\{([^}]*)\}\}/g, (_, key) => {
  const included = zh[key.toLowerCase()];
  if (included === undefined) throw new Error(`missing client include ${key}`);
  return included.trim();
});
/** Ability ids whose includes are expanded instead of dropped. */
const EXPANDED = new Set(['sevika-ability']);
/** Client spells shown after an ability's own text as "name：tooltip" (Sevika's Jackpot, which her text only names). */
const APPENDED = { 'sevika-ability': ['spell_tft13_lieutenantspell4'] };
const appended = id => (APPENDED[id] ?? []).map(stem => {
  if (!zh[`${stem}_name`] || !zh[`${stem}_tooltip`]) throw new Error(`missing client spell ${stem}`);
  return `<br><br>${zh[`${stem}_name`]}：${zh[`${stem}_tooltip`].trim()}`;
}).join('');
const rulePhrases = (id, text) => (RULE_PHRASES[id] ?? []).reduce((out, { from, to }) => {
  if (out.split(from).length !== 2) throw new Error(`${id}: rule phrase not found exactly once: ${from}`);
  return out.replace(from, to);
}, text);
/** Every token must be a display value of the hero at every star level, the Experiment line's included. */
const displayTokensMissing = (id, text) => {
  const hero = S13_ABILITY_DATA[id].championId, shown = text;
  return [1, 2, 3].flatMap(star => { const values = abilityDisplayValues(hero, star);
    return [...new Set(shown.match(/@[^@<>\s]+@/g) ?? [])].map(t => t.slice(1, -1)).filter(key => !Object.hasOwn(values, key)); });
};
const rows = {};
const problems = [];
/**
 * The Experiment branch closes the whole tail in the English text; some zh strings close spellActive mid-sentence, so the
 * zh tail is folded into one branch holding the whole Experiment line (the Laboratory bonus, enabled in our rules), which
 * ability-text puts on a line of its own.
 */
const EXPERIMENT = '<spellActive enabled=TFT13_ExperimentActive';
const experimentTail = text => {
  if (!text.includes(EXPERIMENT)) return text;
  const at = text.indexOf(EXPERIMENT), line = text.slice(at).replace(/<\/?spellActive[^>]*>/g, '').trim();
  return text.slice(0, at) + `${EXPERIMENT}>${line}</spellActive>`;
};
for (const [id, ability] of Object.entries(S13_ABILITY_DATA)) {
  if (Object.hasOwn(CLIENT_KEYS, id)) {
    const stem = CLIENT_KEYS[id], text = zh[`${stem}_tooltip`], name = zh[`${stem}_name`];
    if (!text || !name) { problems.push(`${id}: no client tooltip ${stem}`); continue; }
    const missing = displayTokensMissing(id, text);
    if (missing.length) { problems.push(`${id}: display values missing ${[...new Set(missing)].join(' ')}`); continue; }
    rows[id] = { name, text: rulePhrases(id, experimentTail(compact(text))) };
    continue;
  }
  if (Object.hasOwn(AUTHORED, id)) {
    const row = AUTHORED[id];
    rows[id] = { ...(row.name ? { name: zh[row.name] } : row.zhName ? { name: row.zhName } : {}), text: row.text };
    continue;
  }
  if (!/[A-Za-z]{2}/.test(ability.name + ability.description)) continue;
  let key = Object.keys(en).find(k => /^spell_.*_tooltip$/.test(k) && en[k] === ability.description), zhText;
  if (key) zhText = zh[key];
  else {
    key = Object.keys(en).find(k => /^generatedtip_spell.*_tooltip$/.test(k) && mainText(en[k]) === ability.description);
    zhText = key && mainText(zh[key] ?? '');
  }
  if (!key || !zhText) { problems.push(`${id}: no client tooltip`); continue; }
  if (EXPANDED.has(id)) {
    zhText = expandIncludes(zhText) + appended(id);
    const missing = displayTokensMissing(id, zhText);
    if (missing.length) { problems.push(`${id}: display values missing ${[...new Set(missing)].join(' ')}`); continue; }
  } else if (tokens(zhText) !== tokens(ability.description)) { problems.push(`${id}: token mismatch ${key}`); continue; }
  zhText = rulePhrases(id, dropIncludes(compact(zhText)));
  if (zhText.includes(EXPERIMENT)) {
    if (!/<spellActive enabled=TFT13_ExperimentActive[^>]*>[\s\S]*?<\/spellActive>\s*$/.test(ability.description)) { problems.push(`${id}: Experiment branch not at the end`); continue; }
    zhText = experimentTail(zhText);
  }
  if (/\{\{/.test(zhText)) { problems.push(`${id}: token mismatch ${key}`); continue; }
  const stem = key.replace(/^generatedtip_spelltft_/, 'spell_').replace(/_tooltip$/, '');
  const nameKey = [`${stem}_name`, stem.replace(/ability$/, 'spell') + '_name', `${key.replace(/_tooltip$/, '')}_displayname`]
    .find(k => en[k] === ability.name);
  if (!nameKey || !zh[nameKey]) { problems.push(`${id}: no client name for ${stem}`); continue; }
  rows[id] = { name: zh[nameKey], text: zhText };
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }

const body = Object.entries(rows).map(([id, row]) => `  ${JSON.stringify(id)}: ${JSON.stringify(row)},`).join('\n');
const output = `/**
 * GENERATED by src/presentation/client-tables/generate.mjs from the archived 14.24 en_us / zh_cn string tables. Do not edit.
 * Ability id -> zh_cn client name and tooltip template (same @tokens@ as the content's English text; markup other than
 * <br> and spellActive removed). Three project-defined abilities carry a translated project note instead; the client
 * phrases in RULE_PHRASES (generate.mjs) are replaced by what our rules do.
 */
export const ABILITY_ZH: Readonly<Record<string, { readonly name?: string; readonly text: string }>> = Object.freeze({
${body}
});
`;
const set13 = table('en_us.json.gz', true).setData.find(set => set.number === 13);
const map22 = JSON.parse(zlib.gunzipSync(fs.readFileSync(RAW + 'map22.bin.json.gz')));
const roleData = new Map(Object.values(map22).filter(row => row?.__type === 'TFTCharacterRoleData').map(row => [row.name, row]));
/** Repo hero id -> role, matching the hero's content name to the client's English champion name (one client row each). */
const clientByName = new Map(set13.champions.filter(c => /^TFT13_/.test(c.apiName) && c.role && c.traits.length).map(c => [c.name, c]));
const championRoles = Object.fromEntries(Object.entries(UNIT_DEFINITIONS).filter(([, unit]) => unit.unitKind !== 'neutral')
  .flatMap(([id, unit]) => clientByName.has(unit.name) ? [[id, clientByName.get(unit.name).role]] : []).sort(([a], [b]) => a.localeCompare(b)));
const roles = {};
for (const role of [...new Set(Object.values(championRoles))].sort()) {
  const row = roleData.get(role), name = row && zh[row.CharacterRoleNameTra.toLowerCase()];
  const items = row?.items.map(path => path.split('/').pop());
  if (!name || !items?.length || items.some(item => !/^TFT_Item_\w+$/.test(item))) { console.error(`role ${role}: incomplete client data`); process.exit(1); }
  roles[role] = { name, items };
}
const rolesOutput = `/**
 * GENERATED by src/presentation/client-tables/generate.mjs from the archived 14.24 client data. Do not edit.
 * Display only: repo hero id -> client role (en_us.json \`role\`), and per role the zh_cn role name and the role card's
 * recommended items (map22 TFTCharacterRoleData, in client order). Not used by any rule.
 */
export const CHAMPION_ROLES: Readonly<Record<string, string>> = Object.freeze(${JSON.stringify(championRoles, null, 1).replace(/\n\s*/g, ' ')});
export const ROLE_DISPLAY: Readonly<Record<string, { readonly name: string; readonly items: readonly string[] }>> = Object.freeze({
${Object.entries(roles).map(([role, row]) => `  ${role}: ${JSON.stringify(row)},`).join('\n')}
});
`;
for (const [file, text] of [[OUT, output], [ROLES_OUT, rolesOutput]]) {
  if (!process.argv.includes('--check')) fs.writeFileSync(file, text);
  else if (fs.readFileSync(file, 'utf8') !== text) { console.error(`${file} is stale`); process.exit(1); }
}
const gz = text => zlib.gzipSync(text, { level: 9 }).length;
console.log(`${Object.keys(rows).length} abilities (gzip ${gz(output)} B), ${Object.keys(championRoles).length} hero roles (gzip ${gz(rolesOutput)} B)`);
