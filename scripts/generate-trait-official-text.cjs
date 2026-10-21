// Offline only. Extract the active traits' archived 14.24 client descriptions.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const root = path.resolve(__dirname, '..');
const raw = path.join(root, 'src/simulation/content/source/s13-14.24b/raw');
const read = name => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(raw, `${name}.json.gz`))));
const zh = read('zh_cn.tft.stringtable').entries;
const en = read('en_us.tft.stringtable').entries;
const traits = read('en_us').setData.find(set => set.mutator === 'TFTSet13').traits;
// This is the active runtime catalogue; Form Swapper and augment team-ups are not active traits.
const ids = ['automata', 'sorcerer', 'scrap', 'artillerist', 'emissary', 'sentinel', 'family',
  'ambusher', 'visionary', 'sniper', 'conqueror', 'high-roller', 'academy', 'chem-baron', 'rebel',
  'dominator', 'pit-fighter', 'enforcer', 'firelight', 'experiment', 'bruiser', 'junker-king',
  'black-rose', 'quickstriker', 'watcher'];
// zh_cn has no High Roller trait description. Faithful translation of the archived en_us description.
const highRoller = '施放技能时，【塞薇卡】会为她的技能随机抽取一种【金克丝】改装，并获得持续@Duration@秒的@Durability*100@%伤害减免。<br><br>改装：<br>-火箭：发射@Bonus1NumRockets@枚火箭，每枚造成@Bonus1RocketDamage@物理伤害<br>-护盾：获得持续@Bonus2ShieldDuration@秒的@Bonus2ShieldAmount@护盾值<br>-硬币：获得@Bonus4Gold@金币<br>-三倍：强化她抽取到的技能！';
const result = Object.fromEntries(ids.map(id => {
  const trait = traits.find(t => t.name.toLowerCase().replaceAll(' ', '-') === id);
  if (!trait) throw new Error(`Missing archived trait: ${id}`);
  const key = `tft_trait_description_${trait.apiName.toLowerCase()}`;
  if (!zh[key] && (id !== 'high-roller' || !(en[key] ?? trait.desc))) throw new Error(`Untranslated trait: ${id}`);
  return [id, { apiName: trait.apiName, locale: zh[key] ? 'zh_cn' : 'en_us', description: zh[key] ?? highRoller }];
}));
const target = path.join(root, 'src/presentation/trait-official-text.ts');
const output = '// Generated offline by scripts/generate-trait-official-text.cjs from archived 14.24 stringtables.\n'
  + '// Keep client wording and markup intact here; rendering fills current rule values and annotates deferred effects.\n'
  + 'export const TRAIT_OFFICIAL_TEXT: Readonly<Record<string, { readonly apiName: string; readonly locale: string; readonly description: string }>> = '
  + JSON.stringify(result, null, 2) + ';\n';
if (process.argv.includes('--check')) {
  if (fs.readFileSync(target, 'utf8') !== output) throw new Error('Official trait text is stale');
  console.log(`Official trait text matches archive (${ids.length} traits; en_us: high-roller).`);
} else fs.writeFileSync(target, output);
