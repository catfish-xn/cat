/* Independent M5_RULES R3/R4 and approved M8B_OPENING/LOOT/ADDENDUM arithmetic. No production imports. */
/* Augment tier/reroll rules: user agreement 2026-10-19 08:15, documented in
 * docs/MATCH_CONTRACT.md. Independently implemented; never imports tested code. */
const assert = require('node:assert/strict');
const {concreteMarketItems}=require('./black-market-oracle.cjs');
const CATALOG = [[], ["amumu", "darius", "draven", "irelia", "lux", "maddie", "morgana", "powder", "singed", "steb", "trundle", "vex", "violet", "zyra"], ["akali", "camille", "leona", "nocturne", "rell", "renata", "sett", "tristana", "urgot", "vander", "vladimir", "zeri", "ziggs"], ["blitzcrank", "cassiopeia", "ezreal", "gangplank", "kogmaw", "loris", "nami", "nunu", "renni", "scar", "smeech", "swain", "twistedfate"], ["ambessa", "corki", "drmundo", "ekko", "elise", "garen", "heimerdinger", "illaoi", "silco", "twitch", "vi", "zoe"], ["caitlyn", "jayce", "jinx", "leblanc", "malzahar", "mordekaiser", "rumble", "sevika"]];
CATALOG.push(['mel','viktor','warwick']); // Approved v19 six-cost identities; raw historical recordings stay immutable.
const COST = Object.fromEntries(CATALOG.flatMap((ids,cost)=>ids.map(id=>[id,cost])));
const ODDS = {1:[100,0,0,0,0],2:[100,0,0,0,0],3:[75,25,0,0,0],4:[55,30,15,0,0],5:[45,33,20,2,0],6:[30,40,25,5,0],7:[19,30,40,10,1],8:[18,25,32,22,3],9:[15,20,25,30,10],10:[5,10,20,40,25]};
const XP = {1:2,2:2,3:6,4:10,5:20,6:36,7:48,8:68,9:68};
// Literal W4 + S13 P2 pools independently transcribed from the retained raw source.
// No production content import; lexical ordering is the public choice contract.
const AUGMENTS=["all-for-one-ii", "backup", "belt-overflow", "blistering-strikes", "bronze-for-life-i", "bronze-for-life-ii", "built-different", "bulky-buddies-i", "bulky-buddies-ii", "bulky-buddies-iii", "calculated-enhancement", "climb-the-ladder-i", "climb-the-ladder-ii", "clockwork-accelerator", "crown-guarded", "crownguard-spirit", "find-your-center", "flurry-of-blows", "glass-cannon-i", "glass-cannon-ii", "guardbreaker-spirit", "immovable-object", "inspiring-epitaph", "investment-strategy-i", "item-collector-i", "item-collector-ii", "lineup", "little-buddies", "lone-hero", "manaflow-i", "manaflow-ii", "mentorship-i", "mentorship-ii", "not-today", "pair-of-fours", "placebo", "placebo-plus", "pumping-up-i", "pumping-up-ii", "pumping-up-iii", "shojin-spirit", "sword-overflow", "trifecta-ii", "wand-overflow"];
// v22 anvil units (hand-copied ids).
const ANVIL_IDS=new Set(['TFT_ArmoryKeyCompleted','TFT_ArmoryKeyComponent','TFT_ArmoryKeyOrnn','TFT_ArmoryKeySupport']);
const AUGMENT_GOLD={'placebo':8,'placebo-plus':15,'going-long':15,'hedge-fund':25,'investment-strategy-ii':5};
// User P 10-23: Placebo pays once by acquisition stage 8/11/15 (stage 2/3/4+); Placebo+ 15/18/22.
const STAGED_AUGMENT_GOLD={'placebo':[8,11,15],'placebo-plus':[15,18,22]};
function augmentGold(id,roundId){const staged=STAGED_AUGMENT_GOLD[id];if(!staged)return AUGMENT_GOLD[id]??0;return staged[Math.min(2,Math.max(0,Number(roundId.split('-')[0])-2))];}
const ANOMALIES=["TFT13_GoopBuff_CenteroftheUniverse","TFT13_GoopBuff_CertainDeath","TFT13_GoopBuff_DeftHands","TFT13_GoopBuff_DramaticEntrance","TFT13_GoopBuff_EvenInDeath","TFT13_GoopBuff_HungerForPower","TFT13_GoopBuff_Invisibility","TFT13_GoopBuff_Repulsor","TFT13_GoopBuff_ScuttleFamiliar","TFT13_GoopBuff_UnstoppableForce","TFT13_GoopBuff_WolfFamiliars","arcana-overwhelming","attack-expert","avalanche-of-armor","berserker-rage","bully","bulwark","comeback-story","cull-the-weak","deep-roots","defense-expert","eagle-eye","energy-absorption","force-of-friendship","fortified","freestyling","giant-sized","heavy-hitter","hypervelocity","kill-streak","laser-eyes","legacy-of-shurima","mage-armor","magic-expert","magic-training","one-thousand-cuts","power-absorption","protective-shielding","share-your-energy","slime-time","slow-cooker","stoneskin","strength-training","titanic-strikes"];

// Independent gift identities and lcg32 arithmetic: no production planner imports.
const P2_ITEMS={'crown-guarded':['crownguard',1],'not-today':['edge-of-night',1],'belt-overflow':['belt',4],'sword-overflow':['sword',5],'wand-overflow':['rod',5],'crownguard-spirit':['rod',1],'guardbreaker-spirit':['gloves',1],'shojin-spirit':['sword',1],'flurry-of-blows':['TFT_Item_ZekesHerald',1],'immovable-object':['TFT4_Item_OrnnRanduinsSanctum',1]};
function p2Gifts(state){const gifts=new Map();for(const a of state.augments){
 // V19_MECHANICS: sisters grants one Vi then one Jinx, with P2 unit indices 0/1.
 // Plan from owned augments so capacity-delayed grants keep the same identities.
 const teamups={mentorship:['ambessa','caitlyn'],reunion:['vi','ekko'],geniuses:['heimerdinger','ekko'],menaces:['powder','silco'],'unlikely-duo':['jinx','sevika']};
 if(teamups[a.definitionId])for(const [i,id] of teamups[a.definitionId].entries())gifts.set(JSON.stringify(['s13-augments-p2',a.choiceId,'unit',i]),{kind:'unit',definitionId:id});
 if(a.definitionId==='sisters')for(const [i,id] of ['vi','jinx'].entries())gifts.set(JSON.stringify(['s13-augments-p2',a.choiceId,'unit',i]),{kind:'unit',definitionId:id});
 const item=P2_ITEMS[a.definitionId];if(item)for(let i=0;i<item[1];i++)gifts.set(JSON.stringify(['s13-augments-p2',a.choiceId,'item',i]),{kind:'item',definitionId:item[0]});
 const units={'all-for-one-ii':[1,3],'pair-of-fours':[4,1],'trifecta-ii':[3,3]}[a.definitionId];if(!units)continue;
 const namespace=`s13-augments-p2/${state.multiplayer?.seatId??'solo'}/${a.choiceId}`;let hash=2166136261n;
 for(const c of namespace)hash=((hash^BigInt(c.charCodeAt(0)))*16777619n)%4294967296n;
 let rng=Number(BigInt(state.seed)^hash);for(let i=0;i<units[1];i++){rng=word(rng);const pool=CATALOG[units[0]],id=pool[Number(BigInt(rng)*BigInt(pool.length)/4294967296n)];gifts.set(JSON.stringify(['s13-augments-p2',a.choiceId,'unit',i]),{kind:'unit',definitionId:id});}
 }for(const a of state.augments){
 const tier={'all-for-one-i':1,'trifecta-i':3}[a.definitionId];if(!tier)continue;
 let h=2166136261n;for(const c of JSON.stringify(['d11-fill',state.multiplayer?.seatId??'solo',a.choiceId,a.definitionId]))h=((h^BigInt(c.charCodeAt(0)))*16777619n)%4294967296n;
 let rng=Number(BigInt(state.seed)^h);for(let i=0;i<2;i++){rng=word(rng);const pool=CATALOG[tier];gifts.set(JSON.stringify(['d11-fill',a.choiceId,a.definitionId,'unit',i]),{kind:'unit',definitionId:pool[Number(BigInt(rng)*BigInt(pool.length)/4294967296n)]});}
 }return gifts;}
// P3 literal union: independent from production registration.
AUGMENTS.push('defense-call','high-voltage','piercing-lotus-i','piercing-lotus-ii','pyromaniac','thorn-plated-armor','unleash-the-beast');AUGMENTS.sort();
const AUGMENT_ITEMS={'high-voltage':'ionic-spark','pyromaniac':'red-buff','thorn-plated-armor':'bramble-vest','unleash-the-beast':'steraks-gage'};
ANOMALIES.push('the-finisher','touch-of-frost','fireball','dragonsoul','nothing-wasted','thornskin','knockout');ANOMALIES.sort();
// P1 literal union: independent from production registration.
AUGMENTS.push('blinding-speed','portable-forge','radiant-relics','going-long','hedge-fund','investment-strategy-ii');AUGMENTS.sort();
ANOMALIES.push('dual-wielding');ANOMALIES.sort();
// D11 raw identities/tags, independently transcribed from the retained archive.
AUGMENTS.push('all-for-one-i','trifecta-i','spirit-link','sisters','mentorship','reunion','geniuses','menaces','unlikely-duo');AUGMENTS.sort();
ANOMALIES.push('ultimate-hero','into-the-unknown');
ANOMALIES.push('avarice-incarnate','headhunter');ANOMALIES.sort();
// Literal tier identities, transcribed independently; no runtime content imports.
const AUGMENT_POOLS={
 silver:['backup','blistering-strikes','bulky-buddies-i','climb-the-ladder-i','find-your-center','glass-cannon-i','item-collector-i','lineup','lone-hero','manaflow-i','mentorship-i','placebo','placebo-plus','pumping-up-i'],
 gold:['all-for-one-ii','bronze-for-life-i','built-different','bulky-buddies-ii','climb-the-ladder-ii','clockwork-accelerator','crown-guarded','crownguard-spirit','defense-call','glass-cannon-ii','guardbreaker-spirit','high-voltage','inspiring-epitaph','investment-strategy-i','item-collector-ii','little-buddies','manaflow-ii','mentorship-ii','not-today','pair-of-fours','piercing-lotus-i','portable-forge','pumping-up-ii','pyromaniac','shojin-spirit','thorn-plated-armor','unleash-the-beast'],
 prismatic:['belt-overflow','blinding-speed','bronze-for-life-ii','bulky-buddies-iii','calculated-enhancement','flurry-of-blows','going-long','hedge-fund','immovable-object','investment-strategy-ii','piercing-lotus-ii','pumping-up-iii','radiant-relics','sword-overflow','trifecta-ii','wand-overflow']
};
AUGMENT_POOLS.silver.push('all-for-one-i');AUGMENT_POOLS.gold.push('trifecta-i','spirit-link','sisters','mentorship','reunion','menaces','unlikely-duo');
AUGMENT_POOLS.prismatic.push('geniuses');
// v23 pool expansion: literal identities from 14.24 research; no state recording or production imports.
AUGMENT_POOLS.silver.push('item-grab-bag-i','one-two-five','band-of-thieves-i','teaming-up-i','iron-assets','missed-connections','ones-twos-three','silver-spoon');
AUGMENT_POOLS.gold.push('heroic-grab-bag','raining-gold','raining-gold-plus','academy-crest','ambusher-crest','artillerist-crest','automata-crest','bruiser-crest','black-rose-crest','chem-baron-crest','conqueror-crest','dominator-crest','enforcer-crest','experiment-crest','family-crest','firelight-crest','pit-fighter-crest','quickstriker-crest','rebel-crest','scrap-crest','sentinel-crest','sniper-crest','sorcerer-crest','visionary-crest','watcher-crest','big-grab-bag','teaming-up-ii','support-cache','duo-queue','two-trick');
AUGMENT_POOLS.prismatic.push('build-a-bud','radiant-refactor','academy-crown','ambusher-crown','artillerist-crown','automata-crown','bruiser-crown','black-rose-crown','chem-baron-crown','conqueror-crown','dominator-crown','enforcer-crown','experiment-crown','family-crown','firelight-crown','pit-fighter-crown','quickstriker-crown','rebel-crown','scrap-crown','sentinel-crown','sniper-crown','sorcerer-crown','visionary-crown','watcher-crown','final-polish','one-buff-two-buff');
AUGMENTS.push('item-grab-bag-i','one-two-five','band-of-thieves-i','teaming-up-i','iron-assets','missed-connections','ones-twos-three','silver-spoon','heroic-grab-bag','raining-gold','raining-gold-plus','academy-crest','ambusher-crest','artillerist-crest','automata-crest','bruiser-crest','black-rose-crest','chem-baron-crest','conqueror-crest','dominator-crest','enforcer-crest','experiment-crest','family-crest','firelight-crest','pit-fighter-crest','quickstriker-crest','rebel-crest','scrap-crest','sentinel-crest','sniper-crest','sorcerer-crest','visionary-crest','watcher-crest','big-grab-bag','teaming-up-ii','support-cache','duo-queue','two-trick','build-a-bud','radiant-refactor','academy-crown','ambusher-crown','artillerist-crown','automata-crown','bruiser-crown','black-rose-crown','chem-baron-crown','conqueror-crown','dominator-crown','enforcer-crown','experiment-crown','family-crown','firelight-crown','pit-fighter-crown','quickstriker-crown','rebel-crown','scrap-crown','sentinel-crown','sniper-crown','sorcerer-crown','visionary-crown','watcher-crown','final-polish','one-buff-two-buff');AUGMENTS.sort();
const batch2Offers=require('../../augment-pool-batch2-oracle-data.cjs');
// Batch 3 (14.24 tiers): player-combat scheduled grants and free shop rerolls.
const batch3Offers={silver:['team-building','latent-forge','eye-for-an-eye','eye-for-an-eye-plus','rolling-for-days-i','superstars-i','corrosion'],gold:['what-doesnt-kill-you','prizefighter','superstars-ii','trade-sector','worth-the-wait'],prismatic:['phreaky-friday','phreaky-friday-plus','dark-alley-dealings','living-forge','shimmerscale-essence','building-a-collection-iii','worth-the-wait-ii','flexible']};
// Batch 3 XP (14.24 tiers): XP grants and XP-purchase rules.
batch3Offers.gold.push('patient-study','epoch','epoch-plus');batch3Offers.prismatic.push('level-up','shopping-spree');
for(const tier of ['silver','gold','prismatic']){AUGMENT_POOLS[tier].push(...batch2Offers[tier],...batch3Offers[tier]);AUGMENTS.push(...batch2Offers[tier],...batch3Offers[tier]);}AUGMENTS.sort();
assert.deepEqual(Object.values(AUGMENT_POOLS).flat().sort(),AUGMENTS,'independent tier catalog coverage');
// PR9: independent literal opening table from approved PR1/PR2 (16 entries,
// original cumulative weights including disabled entries; never renormalize).
function openingEncounter(seed) {
 const entries=[['none',1000],['scuttle-puddle',750],['crab-rave',250],['golden-gala',1000],
  ['prismatic-party',500],['prismatic-prelude',600],['prismatic-finale',400],['gold-subscription',400],
  ['loot-subscription',400],['trainer-golems',400],['wind-up-monkey',500],['component-anvils',1000],
  ['viktors-vision',800],['mels-blessing',800],['warwicks-hunger',800],['artifact-anvil',400]];
 let hash=2166136261n;const name='opening-encounter-v1/select';
 for(let i=0;i<name.length;i++)hash=((hash^BigInt(name.charCodeAt(i)))*16777619n)%4294967296n;
 let ticket=Number(BigInt(word(Number(BigInt(seed)^hash)))*10000n/4294967296n);
 for(const [id,weight] of entries){if(ticket<weight)return id;ticket-=weight;}
 throw Error('independent opening weights');
}
function augmentTier(seed,node){
 const index=['round:2-1:augment','round:3-2:augment','round:4-2:augment'].indexOf(node);
 if(index<0)throw Error('Unknown augment tier node');
 const encounter=openingEncounter(seed);
 if(['round:2-1:augment','round:3-2:augment','round:4-2:augment'].includes(node)) {
  if(encounter==='golden-gala')return 'gold';
  if(encounter==='prismatic-party'||encounter==='prismatic-prelude'&&node==='round:2-1:augment'
    ||encounter==='prismatic-finale'&&node==='round:4-2:augment')return 'prismatic';
 }

 // Independent 14.24 client CSV (approved 2026-10-23): 18 nonzero rows / 109.
 const table=[['SSG',5],['SSP',5],['SGG',12],['SGP',5],['SPP',1],['GSG',18],['GSP',2],['GGG',22],['GGP',12],['GPS',6],['GPG',10],['GPP',1],['PSG',4],['PSP',1],['PGG',2],['PGP',1],['PPG',1],['PPP',1]];
 let hash=2166136261n;const name='augment-tier-sequence-v1';
 for(let i=0;i<name.length;i++)hash=((hash^BigInt(name.charCodeAt(i)))*16777619n)%4294967296n;
 let ticket=word(Number(BigInt(seed)^0x61756774n^hash))%109;
 for(const [combination,weight] of table){
  if(ticket<weight)return {S:'silver',G:'gold',P:'prismatic'}[combination[index]];
  ticket-=weight;
 }
 throw Error('independent augment combination weights');
}
// v22 (user approval 2026-10-23), transcribed by hand from augments-research-2026-10-23 for the current pool only:
// 14.24 MutuallyExclusiveItems among pool augments (triggered by ownership, both directions; groups are pairwise),
// and team-up AssociatedTraits (offered at 3-2/4-2 only with a fielded member; 2-1 untailored).
const EXCLUSIVE_GROUPS=[['all-for-one-i','all-for-one-ii','pair-of-fours'],['bronze-for-life-i','bronze-for-life-ii','built-different'],
 ['built-different','climb-the-ladder-i','climb-the-ladder-ii'],['bulky-buddies-i','bulky-buddies-ii','bulky-buddies-iii'],
 ['bulky-buddies-i','mentorship-i'],['bulky-buddies-i','mentorship-ii'],['bulky-buddies-ii','mentorship-i'],['bulky-buddies-ii','mentorship-ii'],
 ['bulky-buddies-iii','mentorship-i'],['bulky-buddies-iii','mentorship-ii'],['crown-guarded','not-today'],['high-voltage','not-today'],
 ['sisters','mentorship','reunion','geniuses','menaces','unlikely-duo'],['glass-cannon-i','glass-cannon-ii'],['manaflow-i','manaflow-ii'],
 ['piercing-lotus-i','piercing-lotus-ii'],['placebo','placebo-plus'],['pumping-up-i','pumping-up-ii','pumping-up-iii'],['trifecta-i','trifecta-ii']];
const TEAMUP_TRAITS={sisters:['enforcer','rebel','pit-fighter','ambusher'],mentorship:['enforcer','conqueror','quickstriker','sniper'],
 reunion:['enforcer','pit-fighter','ambusher','firelight','scrap'],geniuses:['academy','firelight','ambusher','scrap','visionary'],
 menaces:['family','dominator','ambusher','scrap'],'unlikely-duo':['rebel','chem-baron','pit-fighter','ambusher']};
// 14.24 batch1 AssociatedTraits/MutuallyExclusiveItems (research source columns).
Object.assign(TEAMUP_TRAITS,{"academy-crest": ["academy"], "ambusher-crest": ["ambusher"], "artillerist-crest": ["artillerist"], "automata-crest": ["automata"], "bruiser-crest": ["bruiser"], "black-rose-crest": ["black-rose"], "chem-baron-crest": ["chem-baron"], "conqueror-crest": ["conqueror"], "dominator-crest": ["dominator"], "enforcer-crest": ["enforcer"], "experiment-crest": ["experiment"], "family-crest": ["family"], "firelight-crest": ["firelight"], "pit-fighter-crest": ["pit-fighter"], "quickstriker-crest": ["quickstriker"], "rebel-crest": ["rebel"], "scrap-crest": ["scrap"], "sentinel-crest": ["sentinel"], "sniper-crest": ["sniper"], "sorcerer-crest": ["sorcerer"], "visionary-crest": ["visionary"], "watcher-crest": ["watcher"], "academy-crown": ["academy"], "ambusher-crown": ["ambusher"], "artillerist-crown": ["artillerist"], "automata-crown": ["automata"], "bruiser-crown": ["bruiser"], "black-rose-crown": ["black-rose"], "chem-baron-crown": ["chem-baron"], "conqueror-crown": ["conqueror"], "dominator-crown": ["dominator"], "enforcer-crown": ["enforcer"], "experiment-crown": ["experiment"], "family-crown": ["family"], "firelight-crown": ["firelight"], "pit-fighter-crown": ["pit-fighter"], "quickstriker-crown": ["quickstriker"], "rebel-crown": ["rebel"], "scrap-crown": ["scrap"], "sentinel-crown": ["sentinel"], "sniper-crown": ["sniper"], "sorcerer-crown": ["sorcerer"], "visionary-crown": ["visionary"], "watcher-crown": ["watcher"]});
EXCLUSIVE_GROUPS.push(...[["academy-crest", "academy-crown"], ["academy-crest", "built-different"], ["academy-crown", "built-different"], ["ambusher-crest", "ambusher-crown"], ["ambusher-crest", "built-different"], ["ambusher-crown", "built-different"], ["artillerist-crest", "artillerist-crown"], ["artillerist-crest", "built-different"], ["artillerist-crown", "built-different"], ["automata-crest", "automata-crown"], ["automata-crest", "built-different"], ["automata-crown", "built-different"], ["black-rose-crest", "black-rose-crown"], ["black-rose-crest", "built-different"], ["black-rose-crown", "built-different"], ["bruiser-crest", "bruiser-crown"], ["bruiser-crest", "built-different"], ["bruiser-crown", "built-different"], ["built-different", "chem-baron-crest"], ["built-different", "chem-baron-crown"], ["built-different", "conqueror-crest"], ["built-different", "conqueror-crown"], ["built-different", "dominator-crest"], ["built-different", "dominator-crown"], ["built-different", "enforcer-crest"], ["built-different", "enforcer-crown"], ["built-different", "experiment-crest"], ["built-different", "experiment-crown"], ["built-different", "family-crest"], ["built-different", "family-crown"], ["built-different", "firelight-crest"], ["built-different", "firelight-crown"], ["built-different", "pit-fighter-crest"], ["built-different", "pit-fighter-crown"], ["built-different", "quickstriker-crest"], ["built-different", "quickstriker-crown"], ["built-different", "rebel-crest"], ["built-different", "rebel-crown"], ["built-different", "scrap-crest"], ["built-different", "scrap-crown"], ["built-different", "sentinel-crest"], ["built-different", "sentinel-crown"], ["built-different", "sniper-crest"], ["built-different", "sniper-crown"], ["built-different", "sorcerer-crest"], ["built-different", "sorcerer-crown"], ["built-different", "visionary-crest"], ["built-different", "visionary-crown"], ["built-different", "watcher-crest"], ["built-different", "watcher-crown"], ["chem-baron-crest", "chem-baron-crown"], ["conqueror-crest", "conqueror-crown"], ["dominator-crest", "dominator-crown"], ["enforcer-crest", "enforcer-crown"], ["experiment-crest", "experiment-crown"], ["family-crest", "family-crown"], ["firelight-crest", "firelight-crown"], ["pit-fighter-crest", "pit-fighter-crown"], ["quickstriker-crest", "quickstriker-crown"], ["raining-gold", "raining-gold-plus"], ["rebel-crest", "rebel-crown"], ["scrap-crest", "scrap-crown"], ["sentinel-crest", "sentinel-crown"], ["sniper-crest", "sniper-crown"], ["sorcerer-crest", "sorcerer-crown"], ["visionary-crest", "visionary-crown"], ["watcher-crest", "watcher-crown"]]);
Object.assign(TEAMUP_TRAITS,batch2Offers.traits);
EXCLUSIVE_GROUPS.push(...batch2Offers.exclusive);
function excludedByOwned(id,owned){return owned.some(a=>a.definitionId!==id&&EXCLUSIVE_GROUPS.some(g=>g.includes(id)&&g.includes(a.definitionId)));}
function traitAllowed(id,node,traits){return !['round:3-2:augment','round:4-2:augment'].includes(node)||!TEAMUP_TRAITS[id]||TEAMUP_TRAITS[id].some(t=>traits.includes(t));}
function augmentPool(tier,owned,excluded=[],node=null,traits=[]){return AUGMENT_POOLS[tier].filter(id=>!(node==='round:2-1:augment'&&['black-rose-crest','black-rose-crown'].includes(id))&&!owned.some(a=>a.definitionId===id)&&!excluded.includes(id)&&!excludedByOwned(id,owned)&&traitAllowed(id,node,traits)).sort();}
function augmentDraw(rng,tier,owned,excluded=[],node=null,traits=[]){
 const pool=augmentPool(tier,owned,excluded,node,traits);assert(pool.length>=3,'independent augment pool has three candidates');
 for(let i=0;i<3;i++){rng=word(rng);const j=i+rng%(pool.length-i);[pool[i],pool[j]]=[pool[j],pool[i]];}
 return {offers:pool.slice(0,3),rng};
}
function openingTraits(state,choiceId){return state.augmentOffers.find(r=>r.choiceId===choiceId).fieldedTraits;}
// User-approved card reroll: exactly one use per slot; v22: every shown card stays excluded (seen once, never again).
function augmentCardDraw(before,index){
 const c=before.pendingChoice,tier=augmentTier(augmentSeed(before),c.choiceId);
 const pool=augmentPool(tier,before.augments,[...before.removedAugmentIds,...c.offers],c.choiceId,openingTraits(before,c.choiceId));
 assert(pool.length>0,'independent card pool nonempty');
 const rng=word(before.choiceRngState),offers=[...c.offers],rerolledSlots=[...c.rerolledSlots];
 offers[index]=pool[rng%pool.length];rerolledSlots[index]=true;
 return {rng,offers,rerolledSlots};
}
function augmentSeed(state){
 if(!state.multiplayer)assert.equal(state.augmentTierSeed,state.seed,'independent solo tier seed binding');
 return state.augmentTierSeed;
}
function validateAugmentReroll(before,result,command){
 assert.equal(command.type,'rerollAugment');const c=before.pendingChoice;
 let reason=null,tier;
 if(before.phase!=='choice'||c?.kind!=='augment'||c.step!=='offer'||before.multiplayer?.combatRosterLocked||before.multiplayer?.status==='eliminated')reason='wrong-phase';
 else if(command.choiceId!==c.choiceId||command.generation!==c.generation)reason='stale-choice';
 else if(!Number.isSafeInteger(command.optionIndex)||command.optionIndex<0||command.optionIndex>=c.offers.length)reason='invalid-slot';
 else if(c.rerolledSlots[command.optionIndex])reason='augment-rerolls-exhausted';
 else {tier=augmentTier(augmentSeed(before),c.choiceId);if(!augmentPool(tier,before.augments,[...before.removedAugmentIds,...c.offers],c.choiceId,openingTraits(before,c.choiceId)).length)reason='augment-pool-too-small';}
 if(reason){assert.deepEqual(result,{ok:false,state:before,reason},'independent reroll rejection');assert.equal(result.state,before,'failed reroll preserves state reference');return;}
 assert.equal(result.ok,true);const after=result.state,draw=augmentCardDraw(before,command.optionIndex);
 const next={...c,offers:draw.offers,augmentTier:tier,generation:c.generation+1,rerollCount:c.rerollCount+1,rerollsRemaining:3-c.rerollCount-1,rerolledSlots:draw.rerolledSlots};
 assert.equal(c.augmentTier,tier,'reroll locks node tier');
 assert.deepEqual(after,{...before,choiceRngState:draw.rng,pendingChoice:next,nextMatchEventSeq:before.nextMatchEventSeq+1,
  removedAugmentIds:[...before.removedAugmentIds,draw.offers[command.optionIndex]],
  augmentOffers:before.augmentOffers.map(r=>r.choiceId===c.choiceId?{...r,rerollCount:next.rerollCount,rerolledIndices:[...r.rerolledIndices,command.optionIndex],externalBlocks:[...r.externalBlocks,[]]}:r)},'independent free atomic reroll state');
 assert.deepEqual(result.events,[{domain:'match',eventSeq:before.nextMatchEventSeq,type:'choiceOpened',choice:next}],'independent reroll event');
}
const COMPONENTS=['sword','vest','belt','rod','cloak','bow','gloves','tear'];
const SELL = {1:[1,3,9],2:[2,5,17],3:[3,8,26],4:[4,11,35],5:[5,14,44],6:[6,17,53]};
function word(value){return Number((BigInt(value)*1664525n+1013904223n)%4294967296n);}
// Independent approved v19 odds, hand-transcribed: unlock ordinal23 (4-6), 20 Bps +4/round, +160 at level10.
// v22 batch A (approved 10-23): base slots never roll six-cost; one seat-stream draw per shop may replace one uniform
// slot with a six-cost member at clamp(5q), q from the hand-copied 21-row table [solo, solo L10, Viktor, Viktor L10].
const SIX_COST_Q=[[0,0,10,340],[16,126,48,378],[19,129,57,387],[22,132,66,396],[25,135,75,405],[28,138,84,414],[31,141,93,423],[34,144,102,432],
 [38,148,114,444],[42,152,126,456],[46,156,138,468],[50,160,150,480],[54,164,162,492],[58,168,174,504],[78,188,234,564],[98,208,294,624],
 [118,228,354,684],[138,248,414,744],[158,268,474,804],[178,288,534,864],[400,510,1200,1530]];
function openingWords(seed,path,count){
 const name=`opening-encounter-v1/${path}`;let hash=2166136261n;
 for(let i=0;i<name.length;i++)hash=((hash^BigInt(name.charCodeAt(i)))*16777619n)%4294967296n;
 let rng=Number(BigInt(seed)^hash);return Array.from({length:count},()=>rng=word(rng));
}
function sixCostQ(round,level,viktor){
 let stage,sub;if(round<=ROUND_IDS.length)[stage,sub]=ROUND_IDS[round-1].split('-').map(Number);else{const n=round-ROUND_IDS.length-1;stage=7+Math.floor(n/7);sub=n%7+1;}
 if(stage<4)return 0;
 const row=stage>=8?20:stage===4?(sub<6?0:1):2+(stage-5)*6+sub-1-(sub>=5?1:0);
 return SIX_COST_Q[row][(viktor?2:0)+(level===10?1:0)];
}
function shop(rng,generation,level,locked=false,round=1,context=null){
 const slots=[];
 for(let i=0;i<5;i++){
  rng=word(rng);let roll=Number(BigInt(rng)*100n/4294967296n),cost=1;
  for(const p of ODDS[level]){if(roll<p)break;roll-=p;cost++;}
  rng=word(rng);const bucket=CATALOG[cost];slots.push({status:'available',definitionId:bucket[Number(BigInt(rng)*BigInt(bucket.length)/4294967296n)]});
 }
 if(context){const [hit,slot,member]=openingWords(context.seed,`seat/solo/six-cost-shop/${generation}`,3),p=Math.min(10000,5*sixCostQ(round,level,context.viktor));
  if(BigInt(hit)*10000n<BigInt(p)*4294967296n)slots[Number(BigInt(slot)*5n/4294967296n)]={status:'available',definitionId:CATALOG[6][Number(BigInt(member)*BigInt(CATALOG[6].length)/4294967296n)]};}
 return {rngState:rng,shop:{generation,slots,locked}};
}
function xp(level,value,amount){let applied=0;while(amount>0&&level<10){const take=Math.min(amount,XP[level]-value);amount-=take;applied+=take;value+=take;if(value===XP[level]){value=0;level++;}}return {level,xp:value,xpApplied:applied};}
// Hand-transcribed 38-round identity list from approved OPENING; no production imports.
const ROUND_IDS=['1-2','1-3','1-4','2-1','2-2','2-3','2-4','2-5','2-6','2-7',
 '3-1','3-2','3-3','3-4','3-5','3-6','3-7','4-1','4-2','4-3','4-4','4-5','4-6','4-7',
 '5-1','5-2','5-3','5-4','5-5','5-6','5-7','6-1','6-2','6-3','6-4','6-5','6-6','6-7'];
const ROUNDS=ROUND_IDS.map((roundId,index)=>{const [stage,sub]=roundId.split('-').map(Number);return {roundId,ordinal:index+1,stage,sub,kind:stage===1?'pve':sub===4?'supply':sub===7?'pve':'pvp'};});
// v22 opening crabs replace a round's neutrals; original slot k (sorted ids) drops from crab c{min(k,n-1)}.
const ORIGINAL_PVE_SLOTS={'1-2':['m01','m02'],'1-3':['m01','m02','r01'],'1-4':['m01','m02','r01','r02'],'2-7':['k01','k02','k03'],'3-7':['w00','w01','w02','w03','w04'],'4-7':['r00','r01','r02','r03','r04','r05'],'5-7':['d01'],'6-7':['h01']};
function lootCarrier(combat,sourceId){
 const [kind,roundId,,slotId]=JSON.parse(sourceId),units=combat?.units??[];
 if(kind!=='pve'||units.some(u=>u.id===sourceId))return sourceId;
 const crabs=units.map(u=>u.id).filter(id=>id.startsWith('[')&&(([k,r,e])=>k==='pve'&&r===roundId&&String(e).endsWith(`/${roundId}`))(JSON.parse(id))).sort();
 const index=(ORIGINAL_PVE_SLOTS[roundId]??[]).indexOf(slotId);
 return crabs.length&&index>=0?crabs[Math.min(index,crabs.length-1)]:sourceId;
}
function roundOrdinal(id){const round=ROUNDS.find(r=>r.roundId===id);assert(round,`Unknown independent round ${id}`);return round.ordinal;}
// Public helper accepts the pre-combat snapshot too. Derive ungranted gold from the
// approved independent plan plus formal source deaths, never from production income.
function ungrantedLootGold(before,combat){
 if(before.seed===undefined||!combat)return 0;
 const drops=lootPlan(before.seed,before.round).rounds.find(r=>r.encounterPlan.roundId===ROUNDS[before.round-1].roundId)?.encounterPlan.drops??[];
 return drops.filter(d=>d.payload.kind==='gold'&&!before.m8?.loot.receipts.some(r=>r.dropId===d.dropId)
  &&combat.neutralReceipts?.deaths.some(e=>e.unitId===lootCarrier(combat,d.sourceUnitId))
  &&combat.units.some(u=>u.id===lootCarrier(combat,d.sourceUnitId)&&u.team==='enemy'&&!u.alive)).reduce((sum,d)=>sum+d.payload.quantity,0);
}
function settlement(before,combat,goldBefore=before.gold+ungrantedLootGold(before,combat)){
 const round=before.round,definition=ROUNDS[round-1];assert(definition,'Round outside approved campaign');
 const {roundId,stage,sub,kind:roundKind}=definition,result=combat?.result??'supply';
 const survivingEnemyCount=combat?.units.filter(u=>u.team==='enemy'&&u.alive).length??0;
 let streakAfter=before.streak;
 if(roundKind!=='supply'){const kind=result==='playerWin'?'win':'loss';streakAfter={kind,count:before.streak.kind===kind?before.streak.count+1:1};}
 const base=stage===1?{2:2,3:3,4:4}[sub]:5 /* v22 10-23: next-entry 2/3/4G */,naturalXp=2 /* T11 signed opening: 2/2/2; opening XP unchanged; high-level XP68 is user custom 2026-10-22 */;
 const win=roundKind==='pvp'&&result==='playerWin'?1:0,interestBasis=goldBefore+win;
 const owned=new Set(before.augments.map(a=>a.definitionId));
 const cap=owned.has('going-long')?0:owned.has('hedge-fund')?10:owned.has('investment-strategy-ii')?7:5;
 const interest=stage===1?0:Math.min(cap,Math.floor(interestBasis/10));
 const streak=roundKind==='supply'?0:streakAfter.count>=6?3:streakAfter.count>=5?2:streakAfter.count>=2?1:0; /* v22: PvE counts; 2-4/5/6+ */
 const baseDamage=roundKind==='pvp'?[2,5,8,10,12][stage-2]:roundKind==='pve'?3:0;
 const playerDamage=result==='playerWin'||roundKind==='supply'?0:roundKind==='pve'?3:baseDamage+survivingEnemyCount;
 const progression=xp(before.level,before.xp,naturalXp),income=base+win+interest+streak,hpLost=Math.min(before.playerHp,playerDamage);
 return {round,roundId,result,combatTicks:combat?.tick??0,combatEventCount:combat?.nextEventSeq??0,settlementId:`round-${round}-settled`,roundKind,
  incomeBreakdown:{base,win,interest,streak},interestBasis,streakBefore:before.streak,streakAfter,xpRequested:naturalXp,
  income,mechanicReceiptPrefixLength:before.seatMechanics?.receipts.length??0,goldBefore,goldAfter:goldBefore+income,xpAwarded:progression.xpApplied,levelBefore:before.level,
  levelAfter:progression.level,xpBefore:before.xp,xpAfter:progression.xp,hpBefore:before.playerHp,hpAfter:before.playerHp-hpLost,
  baseDamage,survivingEnemyCount,playerDamage,hpLost};
}
// Independent transcription of LOOT §§2–5,7 and ADDENDUM §§1–3. Never import a planner.
const LOOT_TABLE=['1-2','1-3','1-4','2-7','3-7','4-7','5-7','6-7'].map(id=>[id]);
const counterKey=id=>JSON.stringify(['s13-orbs-project-v17',id,'components-granted']);
const receiptId=id=>JSON.stringify([id,'grant']);
const choiceId=id=>JSON.stringify(['m8b-loot-choice',id]);
function lootIndex(rng,n){const limit=4294967296n/BigInt(n)*BigInt(n);let state=rng.state,draws=rng.draws;do{state=word(state);draws++;}while(BigInt(state)>=limit);return {index:state%n,rng:{state,draws}};}
// v17 independent literal/BigInt oracle; no production planner imports.
function lootPlan(seed,ordinal){return require('../orb-combo-oracle.cjs').lootPlan(seed,ordinal);}

function appended(before,after,key,label){assert.deepEqual(after.slice(0,before.length),before,`${label} append-only`);assert.equal(new Set(after.map(x=>x[key])).size,after.length,`${label} unique identity`);return after.slice(before.length);}
function bare(event){const {domain,eventSeq,...value}=event;return value;}
function validateLoot(state){
 const loot=state.m8.loot,expected=lootPlan(state.seed,state.round),frozen=loot.frozen;
 assert.equal(frozen.version,'s13-orb-freeze-v17');assert.equal(frozen.seed,state.seed);assert.equal(frozen.throughRoundOrdinal,state.round);
 assert.deepEqual(frozen.rounds,expected.rounds,'independent frozen loot source/payload/fallback');assert.deepEqual(frozen.rng,expected.rng,'independent loot RNG conservation');
 const direct=expected.rounds.flatMap(r=>r.encounterPlan.drops),choices=expected.rounds.flatMap(r=>r.choices);
 const entries=new Map([...direct,...choices].map(d=>[d.dropId,d]));
 assert.deepEqual(loot.direct.map(d=>d.dropId),direct.map(d=>d.dropId),'direct loot identity');
 assert.deepEqual(loot.choiceEligibility.map(d=>d.dropId),choices.map(d=>d.dropId),'choice loot identity');
 for(const [records,key,label] of [[loot.receipts,'receiptId','loot receipt'],[loot.receipts,'dropId','loot drop receipt'],[loot.earnedEvidence,'dropId','earned loot'],[loot.choiceResolutions,'dropId','choice resolution']])assert.equal(new Set(records.map(r=>r[key])).size,records.length,`${label} unique identity`);
 const earned=new Map(loot.earnedEvidence.map(e=>[e.dropId,e]));
 for(const evidence of earned.values()){
  const entry=entries.get(evidence.dropId);assert(entry,'earned loot must have approved source');
  assert.equal(evidence.death.combatId,`round-${roundOrdinal(entry.roundId)}`,'earned combat identity');
  assert(Number.isSafeInteger(evidence.death.tick)&&evidence.death.tick>=0);assert(Number.isSafeInteger(evidence.death.eventSeq)&&evidence.death.eventSeq>=0);
  if(entry.roundId===state.roundDefinitionId){const combat=state.combat;assert(combat,'earned loot requires combat');
   const source=lootCarrier(combat,entry.sourceUnitId);
   assert(combat.units.some(u=>u.id===source&&u.team==='enemy'&&u.unitKind==='neutral'&&!u.alive),'earned source must be dead');
   const deaths=combat.neutralReceipts.deaths.filter(d=>d.unitId===source);assert.equal(deaths.length,1,'unique source death');
   assert.deepEqual(evidence.death,{combatId:combat.combatId,tick:deaths[0].tick,eventSeq:deaths[0].eventSeq},'earned source death identity');
   assert(evidence.death.tick<=combat.tick&&evidence.death.eventSeq<combat.nextEventSeq,'earned death boundary');
  }
 }
 const receipts=new Map(loot.receipts.map(r=>[r.dropId,r]));
 const resolutions=new Map(loot.choiceResolutions.map(r=>[r.dropId,r]));
 for(const drop of loot.direct){assert(['planned','revealed','pending-capacity','retained-terminal','forfeited','granted'].includes(drop.status));
  assert.equal(earned.has(drop.dropId),!['planned','forfeited'].includes(drop.status),'direct earned-only status');
  assert.equal(receipts.has(drop.dropId),drop.status==='granted','direct actual receipt');
  assert.equal(drop.receiptId,drop.status==='granted'?receiptId(drop.dropId):null);
  if(['pending-capacity','retained-terminal'].includes(drop.status))assert.equal(entries.get(drop.dropId).payload.kind,'unit','only heroes wait for capacity');
 }
 for(const choice of loot.choiceEligibility){assert(['planned','revealed','forfeited'].includes(choice.status));assert.equal(earned.has(choice.dropId),choice.status==='revealed','choice earned-only status');
  assert.equal(receipts.has(choice.dropId),resolutions.has(choice.dropId),'choice receipt and resolution atomic');
  if(resolutions.has(choice.dropId))assert.equal(choice.status,'revealed','resolved choice is earned');
 }
 const itemIds=[],unitIds=[],counters=Object.fromEntries(LOOT_TABLE.map(([id])=>[counterKey(id),0]));
 for(const receipt of loot.receipts){const entry=entries.get(receipt.dropId);assert(entry,'receipt must have approved source');assert(earned.has(receipt.dropId),'receipt must be earned');
  assert.equal(receipt.receiptId,receiptId(receipt.dropId),'canonical loot receipt');
  if(entry.payload)assert.deepEqual(receipt.payload,entry.payload,'independent loot receipt payload');
  else{const resolution=resolutions.get(receipt.dropId);assert(resolution,'choice resolution required');assert.equal(resolution.receiptId,receipt.receiptId);
   assert(['player-choice','terminal-fallback'].includes(resolution.method));
   assert.deepEqual(receipt.payload,{kind:'item',definitionId:receipt.payload.definitionId,quantity:1});assert(COMPONENTS.includes(receipt.payload.definitionId),'all eight component candidates only');
   if(resolution.method==='terminal-fallback'){assert.equal(receipt.payload.definitionId,entry.terminalFallbackDefinitionId,'pre-frozen terminal fallback');assert.equal(state.phase,'gameOver','terminal fallback remains terminal');}
  }
  const {payload,grantedItemIds,grantedUnitIds}=receipt;
  assert.equal(grantedItemIds.length,payload.kind==='item'?1:0,'actual loot item count');assert.equal(grantedUnitIds.length,payload.kind==='unit'||payload.kind==='forge'?1:0,'actual loot unit count' /* v22: an anvil is a bench unit */);
  // Eight random-component candidates are not the complete component taxonomy.
  // Archived S13 emblem recipes consume one Spatula/Pan plus one normal component.
  itemIds.push(...grantedItemIds);unitIds.push(...grantedUnitIds);if(payload.kind==='item')counters[counterKey(entry.roundId)]+=[...COMPONENTS,'spatula','frying-pan'].includes(payload.definitionId)?1:2;
 }
 for(const resolution of resolutions.values())assert(choices.some(c=>c.dropId===resolution.dropId)&&receipts.has(resolution.dropId),'resolution requires actual choice receipt');
 assert.equal(new Set(itemIds).size,itemIds.length,'unique loot item identities');assert.equal(new Set(unitIds).size,unitIds.length,'unique loot unit births');assert.deepEqual(loot.guaranteeCounters,counters,'actual-only component counters');
 const pending=state.pendingChoice;
 if(pending?.kind==='component'){
  const descriptor=choices.find(c=>choiceId(c.dropId)===pending.choiceId);
  if(descriptor){assert(earned.has(descriptor.dropId)&&!resolutions.has(descriptor.dropId),'pending earned choice');
   assert.deepEqual(pending,{kind:'component',step:'offer',choiceId:choiceId(descriptor.dropId),eventId:choiceId(descriptor.dropId),generation:0,returnPhase:'settlement',offers:COMPONENTS,targetId:null,rerollCount:0},'complete loot choice');}
  else assert.equal(pending.eventId,`round:${state.roundDefinitionId}:supply`,'schedule component source');
 }
 // OPENING removed both old starting components and old .7 ScheduleReceipts.
 for(const receipt of state.scheduleReceipts){const round=ROUNDS[receipt.round-1];assert(round,'schedule round');
  const kind=round.kind==='supply'?'component':['2-1','3-2','4-2'].includes(round.roundId)?'augment':round.roundId==='4-6'?'anomaly':null;
  assert(kind,'approved schedule receipt source');assert.equal(receipt.kind,kind);assert.equal(receipt.eventId,`round:${round.roundId}:${kind==='component'?'supply':kind}`,'schedule namespace');
 }
 return entries;
}
function validateLootTransition(before,after,command,events){
 const prior=before.m8.loot,next=after.m8.loot,entries=validateLoot(after);
 const receipts=appended(prior.receipts,next.receipts,'receiptId','loot receipts');
 const earned=appended(prior.earnedEvidence,next.earnedEvidence,'dropId','loot evidence');
 const resolved=appended(prior.choiceResolutions,next.choiceResolutions,'dropId','loot resolutions');
 assert.deepEqual(events.filter(e=>e.type==='lootGranted').map(e=>e.receipt),receipts,'exactly one event per actual loot receipt');
 assert.deepEqual(events.filter(e=>e.type==='lootRevealed').map(e=>bare(e)),earned.map(e=>({type:'lootRevealed',...e})),'exactly one event per earned loot');
 assert.deepEqual(events.filter(e=>e.type==='lootChoiceResolved').map(e=>bare(e)),resolved.map(e=>({type:'lootChoiceResolved',...e})),'exactly one event per choice resolution');
 const newlyForfeited=[...next.direct,...next.choiceEligibility].filter(d=>d.status==='forfeited'&&![...prior.direct,...prior.choiceEligibility].some(p=>p.dropId===d.dropId&&p.status==='forfeited'));
 assert.deepEqual(events.filter(e=>e.type==='lootForfeited').map(e=>e.dropId),newlyForfeited.map(d=>d.dropId),'exactly one event per loot forfeit');
 for(const drop of newlyForfeited){assert.equal(after.combat?.status,'finished','forfeit only after combat');assert.equal(entries.get(drop.dropId).roundId,after.roundDefinitionId,'forfeit only current round');}
 for(const evidence of earned){const entry=entries.get(evidence.dropId);assert(events.some(e=>e.domain==='combat'&&e.type==='death'&&e.unitId===lootCarrier(after.combat,entry.sourceUnitId)&&e.tick===evidence.death.tick&&e.eventSeq===evidence.death.eventSeq),'reveal requires this transition actual source death');}
 for(const receipt of receipts){assert.equal(after.combat?.status,'finished','loot only after combat');const entry=entries.get(receipt.dropId);assert.equal(entry.roundId,after.roundDefinitionId,'grant only current round');
  for(const id of receipt.grantedItemIds)assert.equal(after.items.find(i=>i.id===id)?.definitionId,receipt.payload.definitionId,'actual granted component definition');
 }
 for(const resolution of resolved){if(resolution.method==='terminal-fallback')assert.equal(after.phase,'gameOver','fallback only terminal');
  else{assert.equal(command?.type,'select','player choice needs command');assert.equal(command.choiceId,choiceId(resolution.dropId));assert.equal(command.generation,0);assert.equal(command.definitionId,receipts.find(r=>r.dropId===resolution.dropId).payload.definitionId);}}
 return receipts;
}
function investment(before,record){return {pumpingRounds:before.augmentProgress.pumpingRounds+(before.augments.some(a=>a.definitionId==='pumping-up-i')?1:0),investmentHp:before.augmentProgress.investmentHp+((before.augments.some(a=>a.definitionId==='investment-strategy-i')?8:0)+(before.augments.some(a=>a.definitionId==='investment-strategy-ii')?9:0))*record.incomeBreakdown.interest};}
// Into the Unknown (D14 contract): departure retains ownership of the exact
// hero and equipped items. These remain in conservation totals while absent.
// No production ownership/projector helper is imported here.
function heldResources(state){
 const d=state.d14;
 if(d?.anomalyId!=='into-the-unknown'||d.phase!=='absent'){assert(!d?.held,'D14 only absent hero may be held');return {units:[],items:[]};}
 assert(d.held,'D14 absent hero retains ownership');
 assert.deepEqual(d.held.unit,d.originalUnit,'D14 held original hero');
 const selected=state.resourceProvenance.entries.filter(e=>e.kind==='d14-selected'&&e.choiceId===d.choiceId);
 assert.equal(selected.length,1,'D14 unique departure');assert.equal(selected[0].unitId,d.unitId);
 assert.deepEqual(d.held.items,selected[0].heldItems,'D14 held original equipment');
 assert(!state.preparation.units.some(u=>u.id===d.unitId),'D14 absent hero cannot also be active');
 assert(d.held.items.every(i=>!state.items.some(a=>a.id===i.id)),'D14 held items cannot also be active');
 return {units:[d.held.unit],items:d.held.items};
}
// v22 Trainer Golem is an opening structure whose star follows the stage (audited by opening-encounters-trainer-golems), not a card.
const ownedUnits=state=>[...state.preparation.units.filter(u=>u.team==='player'&&u.definitionId!=='trainer-golem'),...heldResources(state).units];
const ownedItems=state=>[...state.items,...heldResources(state).items];
// CHEM_BARON_FIX: independent standard 14.24b PvP values and archive map22 source-order weights.
// One whole bundle per 14.24b UI evidence; no production content/planner/RNG imports.
const CHEM_GAIN={3:[15,35],4:[20,45],5:[20,55],6:[25,70],7:[30,100]};
const MARKET_WEIGHTS=[[25,20,20,20,10,5],[35,20,20,10,10,5],[55,15,15,5,5,5],[40,30,20,9,1],[30,25,25,15,5],[70,10,10,5,5],[100],[100]];
function blackMarket(tier,rng){
 const remaining=MARKET_WEIGHTS[tier-1].map((weight,index)=>({weight,id:'TFT13_Crime_Loot'+'ABCDEFGH'[tier-1]+(index||'')})),offers=[];
 while(offers.length<1&&remaining.length){rng=word(rng);let ticket=BigInt(rng)*BigInt(remaining.reduce((n,x)=>n+x.weight,0))/4294967296n;
  const index=remaining.findIndex(x=>{ticket-=BigInt(x.weight);return ticket<0n;});offers.push(remaining.splice(index,1)[0].id);
 }
 return {offers,rng,draws:offers.length};
}
function validateChemTransition(before,after){
 const prior=before.seatMechanics?.hidden.progress,next=after.seatMechanics?.hidden.progress;
 if(!prior||!next)return;
 assert.deepEqual(next.economyReceipts.slice(0,prior.economyReceipts.length),prior.economyReceipts,'chem economy append-only');
 const receipts=next.economyReceipts.slice(prior.economyReceipts.length);
 let chem=structuredClone(before.seatMechanics.seat.alchemist),rng=prior.rngState,draws=prior.rngDraws;
 for(const r of receipts){
  if(r.kind==='battle'){
   const f=r.facts;chem.losses=f.roundKind==='pvp'?(f.result==='loss'?chem.losses+1:0):chem.losses;
   if(f.roundKind==='pvp'&&f.chemBaronTier){chem.shimmer+=CHEM_GAIN[f.chemBaronTier][chem.losses>=3?1:0];
    const tier=Math.min(8,Math.floor(chem.shimmer/100));
    if(!chem.offer&&tier>chem.offeredThrough){const roll=blackMarket(tier,rng);rng=roll.rng;draws+=roll.draws;chem.offeredThrough=tier;
     chem.offer={id:`g23:market:${f.battleId}:${tier}`,tier,optionId:roll.offers[0],optionIds:roll.offers,round:f.round};
     chem.offer.concreteItems=concreteMarketItems(before.seed,chem.offer);
    }
   }
   if(f.result==='win')for(let i=0;i<(f.crowns??0);i++){rng=word(rng);draws++;}
  }else if(r.kind==='market'){
   assert.equal(r.offerId,chem.offer?.id,'independent market decision identity');
   if(r.take)assert(chem.offer.optionIds.includes(r.optionId),'selected complete bundle was offered');
   const choice=after.seatMechanics.receipts.find(x=>x.receiptId===r.offerId);
   assert(choice&&choice.kind==='choice'&&choice.choiceKind==='blackMarket'&&choice.itemId===null&&choice.price===0,'market choice grants no item directly');
   assert.equal(choice.optionId,r.take?r.optionId:'@skip');assert.equal(choice.skipped,!r.take);
   chem={...chem,offer:null,shimmer:r.take?0:chem.shimmer,offeredThrough:r.take?0:chem.offeredThrough,skips:chem.skips+(r.take?0:1)};
  }
 }
 assert.deepEqual(after.seatMechanics.seat.alchemist,chem,'independent PvP shimmer, distinct bundles and keep');
 assert.equal(next.rngState,rng,'independent market then crown stream');assert.equal(next.rngDraws,draws,'one explicit word per candidate/crown');
 if(after.pendingChoice?.kind==='blackMarket')assert.deepEqual(after.pendingChoice.offers,chem.offer.optionIds,'pending choice offers complete bundles');
}
class Ledger {
 constructor(initial){this.gold=0;this.pending={gold:0,investmentHp:0};
  // v22 openings can start with extra cards; conservation starts from the actual opening roster (Trainer Golem excluded).
  this.cards=ownedUnits(initial).reduce((n,u)=>n+3**(u.starLevel-1),0);assert(this.cards>=1,'opening unit');this.combinations=0;this.costs={purchases:0,sales:0,saleLoss:0,rerolls:0,xp:0,anomaly:0,income:0,rewards:0};this.rows=[];this.receipts=new Set();this.check(initial);}
 apply(before,after,command,events=[]){
  validateChemTransition(before,after);
  if(command?.type==='rerollAugment')validateAugmentReroll(before,{ok:true,state:after,events},command);
  if(!events.some(e=>e.type==='choiceOpened'&&e.choice.kind==='augment'))assert.deepEqual(after.augmentOffers,before.augmentOffers,'augment history retained without draw');
  const lootReceipts=validateLootTransition(before,after,command,events);
  // Round income (base/interest/streak) and its investment growth are paid at the next round entry (deferred-income.ts); win gold is immediate.
  let paidInvestment=0;
  if(command?.type==='continue'){this.gold+=this.pending.gold;this.pending.gold=0;paidInvestment=this.pending.investmentHp;this.pending.investmentHp=0;}
  if(command?.type==='continue'){const expected=xp(before.level,before.xp,before.augments.some(a=>a.definitionId==='going-long')?4:0);assert.deepEqual([after.level,after.xp],[expected.level,expected.xp],'independent round-start XP');}
  let choice=before.choiceRngState,reward=before.rewardRngState,battle=before.battleSeedRngState;
  if(command?.type==='start')battle=word(battle);
  if(command?.type==='target'||command?.type==='anomalyReroll'){choice=word(choice);const target=before.preparation.units.find(u=>u.id===(command.unitId??before.pendingChoice.targetId));const pool=ANOMALIES.filter(id=>(command.type!=='anomalyReroll'||!before.pendingChoice.offers.includes(id))&&(id!=='ultimate-hero'||target?.location.kind==='board'&&target.starLevel===3&&COST[target.definitionId]===1)&&(id!=='into-the-unknown'||target?.location.kind==='board'));assert.deepEqual(after.pendingChoice.offers,[pool[Number(BigInt(choice)*BigInt(pool.length)/4294967296n)]],'independent anomaly offer');}
  for(const event of events){
   if(event.type==='choiceOpened'&&event.choice.kind==='augment'){
    const c=event.choice,tier=augmentTier(augmentSeed(after),c.choiceId),rerolled=command?.type==='rerollAugment';
    assert.equal(c.choiceId,`round:${after.roundDefinitionId}:augment`,'independent scheduled augment node identity');
    const traits=openingTraits(after,c.choiceId);
    assert(['round:3-2:augment','round:4-2:augment'].includes(c.choiceId)||traits.length===0,'2-1 is not tailored to the comp');
    const draw=rerolled?augmentCardDraw(before,command.optionIndex):augmentDraw(choice,tier,after.augments,before.removedAugmentIds,c.choiceId,traits);choice=draw.rng;
    assert.deepEqual(after.removedAugmentIds,rerolled?[...before.removedAugmentIds,draw.offers[command.optionIndex]]:[...before.removedAugmentIds,...draw.offers],'independent seen-once ledger');
    assert.deepEqual(c.offers,draw.offers,'independent augment offers');
    const used=rerolled?before.pendingChoice.rerollCount+1:0;
    assert.deepEqual(c,{kind:'augment',step:'offer',choiceId:c.choiceId,eventId:c.choiceId,generation:used,offers:draw.offers,targetId:null,
     rerollCount:used,augmentTier:tier,rerollsRemaining:3-used,rerolledSlots:rerolled?draw.rerolledSlots:[false,false,false],returnPhase:'preparation'},'independent augment node/reset metadata');
    assert.deepEqual(after.pendingChoice,c,'augment event equals pending state');
    const prior=rerolled?before.augmentOffers.find(r=>r.choiceId===c.choiceId):null;
    const record={choiceId:c.choiceId,tier,rerollCount:used,rerolledIndices:rerolled?[...prior.rerolledIndices,command.optionIndex]:[],
     fieldedTraits:traits,externalBlocks:rerolled?[...prior.externalBlocks,[]]:[[]]};
    assert.deepEqual(after.augmentOffers,rerolled?before.augmentOffers.map(r=>r.choiceId===c.choiceId?record:r):[...before.augmentOffers,record],'independent augment history');
   }
   if(event.type==='rewardGranted'){reward=word(reward);assert.equal(event.receipt.itemIds.length,1);assert.equal(after.items.find(i=>i.id===event.receipt.itemIds[0]).definitionId,COMPONENTS[reward%8],'independent random component');}
  }
  assert.equal(after.choiceRngState,choice,'choice RNG conservation');assert.equal(after.rewardRngState,reward,'reward RNG conservation');assert.equal(after.battleSeedRngState,battle,'battle seed RNG conservation');
  const domain=events.filter(e=>e.domain==='match');assert.deepEqual(domain.map(e=>e.eventSeq),domain.map((_,i)=>before.nextMatchEventSeq+i),'match event sequence');assert.equal(after.nextMatchEventSeq,before.nextMatchEventSeq+domain.length);
  const costs=this.costs,units=new Map(ownedUnits(before).map(u=>[u.id,{definitionId:u.definitionId,starLevel:u.starLevel}]));
  let serial=before.nextUnitSerial;
  if(command?.type==='buy'){const definitionId=before.shop.slots[command.slot].definitionId,cost=COST[definitionId];this.gold-=cost;costs.purchases+=cost;this.cards++;units.set(`unit-${serial++}`,{definitionId,starLevel:1});}
  // v22: selling an anvil opens its four-pick for 0 gold; the anvil unit leaves the bench.
  if(command?.type==='sell'&&ANVIL_IDS.has(before.preparation.units.find(u=>u.id===command.id)?.definitionId)){this.cards-=1;units.delete(command.id);}
  else if(command?.type==='sell'){const unit=before.preparation.units.find(u=>u.id===command.id),cost=COST[unit.definitionId],copies=3**(unit.starLevel-1),value=SELL[cost][unit.starLevel-1];this.gold+=value;costs.sales+=value;costs.saleLoss+=cost*copies-value;this.cards-=copies;units.delete(unit.id);}
  for(const [type,cost,key] of [['reroll',2,'rerolls'],['buyXp',4,'xp'],['anomalyReroll',1,'anomaly']])if(command?.type===type){this.gold-=cost;costs[key]+=cost;}
  for(const receipt of lootReceipts){if(receipt.payload.kind==='gold'){this.gold+=receipt.payload.quantity;costs.rewards+=receipt.payload.quantity;}
   if(receipt.payload.kind==='unit'||receipt.payload.kind==='forge'){assert.deepEqual(receipt.grantedUnitIds,[`unit-${serial}`],'true loot candidate serial');units.set(`unit-${serial++}`,{definitionId:receipt.payload.definitionId,starLevel:1});this.cards++;}}
  const appendedMechanics=appended(before.seatMechanics?.receipts??[],after.seatMechanics?.receipts??[],'receiptId','mechanic gifts');
  const mechanicGifts=appendedMechanics.filter(r=>r.source==='s13-augments-p2'||r.source==='d11-fill'&&r.kind==='unit'),giftPlan=p2Gifts(after);
  for(const r of appendedMechanics.filter(r=>r.source==='d11-fill'&&r.kind==='gold')){
   assert.equal(command?.type,'select');assert.equal(command.definitionId,'avarice-incarnate');assert.equal(r.amount,5);
   assert.equal(r.receiptId,JSON.stringify(['d11-fill',before.pendingChoice.choiceId,'avarice-gold']));this.gold+=5;costs.rewards+=5;
  }
  // v22 opening encounters (batch A/B, trainer golems…): rewards are audited by the opening-encounters suites; the ledger books them.
  let lateGold=0;
  // G2-4 item gold (Gambler's Blade and friends) pays per combat roll after the settlement record; its rolls are audited by g2-4b-collector.
  for(const r of appendedMechanics.filter(r=>r.source==='g24-item-gold'&&r.kind==='gold')){this.gold+=r.amount;costs.rewards+=r.amount;lateGold+=r.amount;}
  for(const r of appendedMechanics.filter(r=>r.source.startsWith('opening-'))){
   if(r.kind==='gold'){this.gold+=r.amount;costs.rewards+=r.amount;lateGold+=r.amount;}
   else if(r.kind==='unit'){assert.equal(r.unitId,`unit-${serial}`,'opening reward unit serial');units.set(`unit-${serial++}`,{definitionId:r.definitionId,starLevel:r.starLevel??1});this.cards+=3**((r.starLevel??1)-1);}
  }
  for(const receipt of mechanicGifts){const expected=giftPlan.get(receipt.receiptId);assert(expected,'independent P2 gift identity');assert.equal(receipt.kind,expected.kind);assert.equal(receipt.definitionId,expected.definitionId,'independent P2 gift definition');
   if(receipt.kind==='unit'){if(receipt.resolution==='gold'){assert.equal(receipt.gold,COST[receipt.definitionId]);this.gold+=receipt.gold;costs.rewards+=receipt.gold;}else{assert.equal(receipt.unitId,`unit-${serial}`);units.set(`unit-${serial++}`,{definitionId:receipt.definitionId,starLevel:1});this.cards++;}}}
  assert.equal(after.nextUnitSerial,serial,'unit serial accounting');
  for(const event of events.filter(e=>e.type==='unitUpgraded')){assert.equal(event.consumedIds.length,2);assert.equal(new Set([event.survivorId,...event.consumedIds]).size,3);for(const id of [event.survivorId,...event.consumedIds])assert.deepEqual(units.get(id),{definitionId:event.definitionId,starLevel:event.fromStar},'upgrade consumes actual candidate lineage');assert.equal(event.toStar,event.fromStar+1);for(const id of event.consumedIds)units.delete(id);units.set(event.survivorId,{definitionId:event.definitionId,starLevel:event.toStar});}
  assert.deepEqual(new Map(ownedUnits(after).map(u=>[u.id,{definitionId:u.definitionId,starLevel:u.starLevel}])),units,'actual player unit lineage');
  const schedule=appended(before.scheduleReceipts,after.scheduleReceipts,'eventId','schedule receipts');
  for(const receipt of schedule){if(before.pendingChoice?.kind==='augment'&&receipt.eventId===before.pendingChoice.eventId){assert.equal(command?.type,'select');assert.equal(receipt.gold,augmentGold(command.definitionId,before.roundDefinitionId),'independent once-only augment acquisition gold');const item=AUGMENT_ITEMS[command.definitionId];assert.deepEqual(receipt.itemIds,item?[`item-${before.nextItemSerial}`]:[],'independent exact augment item grant');if(item)assert.equal(after.items.find(i=>i.id===receipt.itemIds[0])?.definitionId,item,'independent augment item identity');}assert(!this.receipts.has(receipt.eventId),'schedule receipt only once');this.receipts.add(receipt.eventId);this.gold+=receipt.gold;costs.rewards+=receipt.gold;}
  let itemSerial=before.nextItemSerial;
  for(const receipt of lootReceipts)for(const id of receipt.grantedItemIds)assert.equal(id,`item-${itemSerial++}`,'loot item serial');
  for(const receipt of schedule)for(const id of receipt.itemIds)assert.equal(id,`item-${itemSerial++}`,'schedule item serial');
  const mechanic=appended(before.seatMechanics?.receipts??[],after.seatMechanics?.receipts??[],'receiptId','mechanic receipts');
  const acquired=mechanic.filter(r=>r.kind==='item'||r.kind==='choice'&&r.itemId!==null);
  for(const r of acquired){assert.equal(r.itemId,`item-${itemSerial++}`,'mechanic item serial');const actual=after.items.find(i=>i.id===r.itemId);assert(actual,'mechanic item exists');assert.equal(actual.definitionId,r.kind==='item'?r.definitionId:r.optionId,'mechanic item definition');}
  if(command?.type==='select'&&command.definitionId==='blinding-speed')assert.deepEqual(acquired.map(r=>r.definitionId),['red-buff','rageblade','bow'],'source-fixed augment items');
  if(command?.type==='select'&&command.definitionId==='dual-wielding'){assert.equal(acquired.length,2,'source two role items');assert.equal(new Set(acquired.map(r=>r.definitionId)).size,2,'project no-repeat role draws');assert(acquired.every(r=>r.source==='s13-anomaly-acquisition'));}
  if(before.pendingChoice?.kind==='forge'&&before.pendingChoice.payload?.source==='s13-augment-acquisition'){assert.equal(acquired.length,1,'one forge item');assert.equal(acquired[0].optionId,command?.definitionId);assert(before.pendingChoice.offers.includes(acquired[0].optionId));}
  const records=appended(before.roundResults,after.roundResults,'settlementId','settlements');assert(records.length<=1,'one settlement per command');
  // Original 14.23 onward: +1 fixed remover per survived PvE, independent of box loot.
  const pveBonus=appendedMechanics.filter(r=>r.source==='pve-remover'||r.receiptId.startsWith('pve-remover:'));
  const eligible=records.filter(r=>r.roundKind==='pve'&&r.hpAfter>0);
  assert.equal(pveBonus.length,eligible.length,'independent fixed PvE remover count');
  for(const [i,r] of pveBonus.entries()){const round=eligible[i];assert.equal(r.receiptId,`pve-remover:${round.roundId}`);assert.equal(r.source,'pve-remover');assert.equal(r.kind,'consumable');assert.equal(r.definitionId,'magnetic-remover');assert.equal(r.round,round.round);assert.equal(r.roundId,round.roundId);assert(after.consumables.some(c=>c.consumableId===r.consumableId&&c.definitionId==='magnetic-remover'));}
  let growth=paidInvestment?{...before.augmentProgress,investmentHp:before.augmentProgress.investmentHp+paidInvestment}:before.augmentProgress;
  for(const record of records){const expected=settlement(before,after.combat,this.gold-lateGold /* batch B pays after the settlement record */);assert.deepEqual(record,expected,`independent settlement R${before.round}`);this.gold+=expected.incomeBreakdown.win;this.pending.gold+=expected.income-expected.incomeBreakdown.win;costs.income+=expected.income;this.rows.push(expected);const grown=investment(before,expected);this.pending.investmentHp+=grown.investmentHp-before.augmentProgress.investmentHp;growth={...grown,investmentHp:growth.investmentHp};}
  assert.deepEqual(after.augmentProgress,growth,'once-only independent augment growth');
  this.combinations+=events.filter(e=>e.type==='itemCombined').length;this.check(after,true);
 }
 check(state,lootChecked=false){if(!lootChecked)validateLoot(state);assert.equal(state.gold,this.gold,'independent gold ledger R'+state.round+' sim='+state.gold+' ledger='+this.gold+' '+state.roundDefinitionId+' '+state.phase+' '+JSON.stringify(state.m8?.round?.kind));const units=ownedUnits(state),items=ownedItems(state);assert.equal(units.reduce((n,u)=>n+3**(u.starLevel-1),0),this.cards,'card-equivalent conservation');assert.equal(new Set(items.map(i=>i.id)).size,items.length,'unique item IDs');
  const grants=state.scheduleReceipts.reduce((n,r)=>n+r.itemIds.length,0)+state.m8.loot.receipts.reduce((n,r)=>n+r.grantedItemIds.length,0)+(state.seatMechanics?.receipts??[]).filter(r=>r.kind==='item'||r.kind==='choice'&&r.itemId!==null).length;
  assert.equal(items.length,grants-this.combinations,'component/completed-item conservation');assert.equal(new Set(state.scheduleReceipts.map(r=>r.eventId)).size,state.scheduleReceipts.length,'receipt identity');assert.equal(state.nextItemSerial,1+grants+this.combinations,'item serial accounting');}
}
module.exports={ANVIL_IDS,blackMarket,validateChemTransition,ANOMALIES,ROUNDS,roundOrdinal,CATALOG,COST,ODDS,XP,SELL,COMPONENTS,word,shop,xp,settlement,investment,lootIndex,lootPlan,validateLoot,validateLootTransition,Ledger,openingEncounter,augmentTier,augmentPool,augmentDraw,validateAugmentReroll};
