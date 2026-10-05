/** Offline, hash-gated extraction. Usage: node scripts/import-s13-data.mjs path/to/en_us.json
 * The input must be the unmodified historical archive, never a live endpoint.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const expected = 'c1237ba2441f932a1b9761ce12887ad21089dffbd3a8004671cc9cb82dfd5bd3';
const path = process.argv[2];
if (!path) throw new Error('Supply the downloaded 14.24 en_us.json file; this importer never accesses the network.');
const raw = readFileSync(path);
const actual = createHash('sha256').update(raw).digest('hex');
if (actual !== expected) throw new Error(`Historical source changed: expected ${expected}, received ${actual}`);
const data = JSON.parse(raw);
const candidates = data.setData.filter(set => set.mutator === 'TFTSet13');
if (candidates.length !== 1) throw new Error('Expected exactly one standard TFTSet13 mutator');
const set = candidates[0];
const championIds = {
  irelia:'TFT13_Irelia', maddie:'TFT13_Shooter', darius:'TFT13_Darius', lux:'TFT13_Lux', zyra:'TFT13_Zyra',
  tristana:'TFT13_Tristana', urgot:'TFT13_Urgot', rell:'TFT13_Rell', leona:'TFT13_Leona', vander:'TFT13_Prime',
  kogmaw:'TFT13_KogMaw', scar:'TFT13_FlyGuy', ezreal:'TFT13_Ezreal', loris:'TFT13_Beardy', nami:'TFT13_Nami',
  corki:'TFT13_Corki', garen:'TFT13_Garen', zoe:'TFT13_Zoe', caitlyn:'TFT13_Caitlyn',
};
const itemIds = {
  sword:'TFT_Item_BFSword', bow:'TFT_Item_RecurveBow', rod:'TFT_Item_NeedlesslyLargeRod', tear:'TFT_Item_TearOfTheGoddess',
  vest:'TFT_Item_ChainVest', cloak:'TFT_Item_NegatronCloak', belt:'TFT_Item_GiantsBelt',
  rageblade:'TFT_Item_GuinsoosRageblade', deathblade:'TFT_Item_Deathblade', shojin:'TFT_Item_SpearOfShojin',
  archangel:'TFT_Item_ArchangelsStaff', deathcap:'TFT_Item_RabadonsDeathcap', warmog:'TFT_Item_WarmogsArmor',
  'dragons-claw':'TFT_Item_DragonsClaw', gargoyle:'TFT_Item_GargoyleStoneplate', gunblade:'TFT_Item_HextechGunblade',
};
const augmentIds = {
  placebo:'TFT_Augment_Placebo', 'manaflow-i':'TFT_Augment_Manaflow1', 'glass-cannon-i':'TFT_Augment_GlassCannonI',
  'pumping-up-i':'TFT9_Augment_PumpingUp', 'investment-strategy-i':'TFT_Augment_InvestmentStrategy1',
  'bulky-buddies-i':'TFT_Augment_BulkyBuddies1',
};
function select(mapping, entries) {
  return Object.fromEntries(Object.entries(mapping).map(([id, apiName]) => {
    const found = entries.filter(entry => entry.apiName === apiName);
    if (found.length !== 1) throw new Error(`Expected unique record ${apiName}, found ${found.length}`);
    return [id, found[0]];
  }));
}
for (const apiName of Object.values(augmentIds)) if (!set.augments.includes(apiName)) throw new Error(`Nonstandard augment ${apiName}`);
const traitNames = ['Sentinel','Artillerist','Sniper','Watcher','Sorcerer'];
const source = {
  provenance: { url:'https://raw.communitydragon.org/14.24/cdragon/tft/en_us.json', sha256:actual,
    selector:'setData[mutator === "TFTSet13"]', patch:'14.24 + Riot 2024-12-17 overrides',
    normalization:'All raw fields below are unmodified archive records. Runtime values round to 4 decimals before fixed point conversion.',
    overrides:[{path:'champions.loris.stats.initialMana',from:50,to:40},{path:'champions.loris.stats.mana',from:90,to:80}],
    overrideSource:'https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-24-notes/',
    anomalySource:'https://wiki.leagueoflegends.com/en-us/TFT:Anomaly?oldid=3848901',
  },
  champions:select(championIds,set.champions), traits:set.traits.filter(trait => traitNames.includes(trait.name)),
  items:select(itemIds,data.items), augments:select(augmentIds,data.items),
};
const destination = fileURLToPath(new URL('../src/simulation/content/source/s13-14.24.json',import.meta.url));
writeFileSync(destination, JSON.stringify(source,null,2)+'\n');
console.log(`Verified ${actual}; archived ${Object.keys(source.champions).length} champions, ${source.traits.length} traits, 16 items, 6 augments.`);
