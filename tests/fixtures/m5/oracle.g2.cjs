const {buffetPlan,validatePandoraEntry}=require('./augment-inventory-oracle.cjs');
/* Independent M5_RULES R3/R4 and approved M8B_OPENING/LOOT/ADDENDUM arithmetic. No production imports. */
/* Augment tier/reroll rules: user agreement 2026-10-19 08:15, documented in
 * docs/MATCH_CONTRACT.md. Independently implemented; never imports tested code. */
const assert = require('node:assert/strict');
const {validateRewards,validateGhostCombatInputs}=require('./augment-rewards-oracle.cjs');
const {validateScoreboardCombat:checkScoreboardCombat}=require('./augment-h6-oracle.cjs');
const {angerDefinition}=require('./augment-r2-oracle.cjs');
const {expectedRolls,pipelineOrbs}=require('./augment-batch5-g5-oracle.cjs');
const {battleGold}=require('./battle-gold-oracle.cjs');
const {concreteMarketItems}=require('./black-market-oracle.cjs');
const h3=require('./h3-growth-oracle.cjs');
const CATALOG = [[], ["amumu", "darius", "draven", "irelia", "lux", "maddie", "morgana", "powder", "singed", "steb", "trundle", "vex", "violet", "zyra"], ["akali", "camille", "leona", "nocturne", "rell", "renata", "sett", "tristana", "urgot", "vander", "vladimir", "zeri", "ziggs"], ["blitzcrank", "cassiopeia", "ezreal", "gangplank", "kogmaw", "loris", "nami", "nunu", "renni", "scar", "smeech", "swain", "twistedfate"], ["ambessa", "corki", "drmundo", "ekko", "elise", "garen", "heimerdinger", "illaoi", "silco", "twitch", "vi", "zoe"], ["caitlyn", "jayce", "jinx", "leblanc", "malzahar", "mordekaiser", "rumble", "sevika"]];
CATALOG.push(['mel','viktor','warwick']); // Approved v19 six-cost identities; raw historical recordings stay immutable.
const COST = Object.fromEntries(CATALOG.flatMap((ids,cost)=>ids.map(id=>[id,cost])));
const createH3Ledger=initial=>h3.createH3Ledger(initial,[...CATALOG.flat(),'elise-ranged','gangplank-ranged','jayce-ranged','swain-ranged']);
const {checkH3Growth,h3GrowthForUnit}=h3;
const ODDS = {1:[100,0,0,0,0],2:[100,0,0,0,0],3:[75,25,0,0,0],4:[55,30,15,0,0],5:[45,33,20,2,0],6:[30,40,25,5,0],7:[19,30,40,10,1],8:[18,25,32,22,3],9:[15,20,25,30,10],10:[5,10,20,40,25]};
const XP = {1:2,2:2,3:6,4:10,5:20,6:36,7:48,8:68,9:68};
// Literal W4 + S13 P2 pools independently transcribed from the retained raw source.
// No production content import; lexical ordering is the public choice contract.
const AUGMENTS=["all-for-one-ii", "backup", "belt-overflow", "blistering-strikes", "bronze-for-life-i", "bronze-for-life-ii", "built-different", "bulky-buddies-i", "bulky-buddies-ii", "bulky-buddies-iii", "calculated-enhancement", "climb-the-ladder-i", "climb-the-ladder-ii", "clockwork-accelerator", "crown-guarded", "crownguard-spirit", "find-your-center", "flurry-of-blows", "glass-cannon-i", "glass-cannon-ii", "guardbreaker-spirit", "immovable-object", "inspiring-epitaph", "investment-strategy-i", "item-collector-i", "item-collector-ii", "lineup", "little-buddies", "lone-hero", "manaflow-i", "manaflow-ii", "mentorship-i", "mentorship-ii", "not-today", "pair-of-fours", "placebo", "placebo-plus", "pumping-up-i", "pumping-up-ii", "pumping-up-iii", "shojin-spirit", "sword-overflow", "trifecta-ii", "wand-overflow"];
// v22 anvil units (hand-copied ids).
const ANVIL_IDS=new Set(['TFT_ArmoryKeyCompleted','TFT_ArmoryKeyComponent','TFT_ArmoryKeyOrnn','TFT_ArmoryKeySupport','TFT_ArmoryKeyRadiant']);
const AUGMENT_GOLD={'pandoras-bench':2,'max-cap':60,'mirrored-monetization':2,'tiniest-titan-plus':15,'reroll-transfer':3,'all-that-shimmers-plus':4,'beggars-can-be-choosers':7,'diversified-portfolio-plus':4,'diversified-portfolio':1,'table-scraps':1,'young-and-wild-and-free':2,'called-shot':4,'firesale':1,'reinfourcement':12,'subscription-service':6,'starry-night':6,'starry-night-plus':8,'placebo':8,'placebo-plus':15,'going-long':15,'hedge-fund':25,'investment-strategy-ii':5,
 // v23 batch 1 instant gold (14.24 records 40, 26, 124, 157, 158, 83, 233; hand transcription in tests/augment-pool-source-expectations.ts).
 'one-two-five':2,'iron-assets':4,'heroic-grab-bag':9,'raining-gold':8,'raining-gold-plus':18,'big-grab-bag':2,'build-a-bud':8,
 // 14.24 archive: Scapegoat InitialGold, trainer Gold, Trade Sector Gold; XP batch Gold.
 'scapegoat':4,'wandering-trainer-i':1,'wandering-trainer-ii':6,'trade-sector':1,'shopping-spree':4,'kingslayer':1,'invested-plus':26,'invested-plus-plus':45};
// User P 10-23: ordinary Placebo keeps acquisition-stage 8/11/15 (stage 2/3/4+).
// Placebo+ is fixed AUGMENT_GOLD=15: augments-14.24.json, TFT_Augment_PlaceboPlus.effects.Gold,
// read-only research archive retrieved 2026-10-23; user approved 14.24 alignment 2026-10-28.
const STAGED_AUGMENT_GOLD={'placebo':[8,11,15]};
function augmentGold(id,roundId){const staged=STAGED_AUGMENT_GOLD[id];if(!staged)return AUGMENT_GOLD[id]??0;return staged[Math.min(2,Math.max(0,Number(roundId.split('-')[0])-2))];}
// Independent 14.24 XP/free-reroll arithmetic; literal values from augments-14.24.json.
function augmentStream(state,a,path){
 let h=2166136261;for(const c of JSON.stringify(['augment-pool-batch3',path,state.multiplayer?.seatId??'solo',a.choiceId,a.definitionId]))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;
 h=(state.seed^h)>>>0;h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;return h>>>0;
}
function magicDice(state,a){let rng=augmentStream(state,a,'dice');return Array.from({length:3},()=>{rng=word(rng);return Number(BigInt(rng)*6n/4294967296n)+1;});}
function chaosOutcome(state,a){
 const h=augmentStream(state,a,'chaos');
 return ['gold','three-star','hullbreakers','horizon-focus','thiefs-gloves','solari-dummy','zeke-dummy','emblems','xp','rerolls'][Number(BigInt(word(h>>>0))*10n/4294967296n)];
}
// One-star HP/AD: normalized/g2-{1,2,3}-champions.json and V19 six-cost source; star scaling P 2026-10-23.
const FORMING_STATS={"akali":[700,45],"ambessa":[1100,65],"amumu":[600,45],"blitzcrank":[850,60],"camille":[700,50],"cassiopeia":[700,40],"draven":[500,55],"drmundo":[1100,60],"ekko":[1100,50],"elise":[1100,60],"elise-ranged":[750,45],"gangplank":[800,65],"gangplank-ranged":[700,50],"heimerdinger":[800,40],"illaoi":[1100,70],"jayce":[1200,90],"jayce-ranged":[900,60],"jinx":[900,60],"leblanc":[900,50],"malzahar":[950,45],"mel":[1800,80],"mordekaiser":[1200,75],"morgana":[500,30],"nocturne":[700,65],"nunu":[800,50],"powder":[500,35],"renata":[600,35],"renni":[850,55],"rumble":[1200,60],"sett":[850,60],"sevika":[1200,80],"silco":[800,40],"singed":[650,55],"smeech":[800,70],"steb":[650,55],"swain":[950,45],"swain-ranged":[650,40],"trundle":[650,50],"twistedfate":[700,35],"twitch":[800,70],"vex":[450,30],"vi":[1100,75],"viktor":[1600,100],"violet":[650,50],"vladimir":[800,45],"warwick":[2100,110],"zeri":[600,45],"ziggs":[600,35]};
// Historical M5 one-star source rows, retained in units.ts as documentation.
Object.assign(FORMING_STATS,{"caitlyn":[900,82],"corki":[850,65],"darius":[600,55],"ezreal":[700,60],"garen":[1000,65],"irelia":[700,45],"kogmaw":[650,15],"leona":[800,55],"loris":[850,50],"lux":[500,30],"maddie":[500,50],"nami":[700,40],"rell":[800,60],"scar":[800,50],"tristana":[550,42],"urgot":[700,50],"vander":[800,50],"zoe":[800,40],"zyra":[500,30]});
function entryXp(state){
 const next=ROUNDS[state.round];let amount=state.augments.some(a=>a.definitionId==='going-long')?4:0;
 for(const a of state.augments){
  if(a.acquiredRound>=state.round+1)continue;
  if(next?.sub===1)amount+=({'epoch':6,'epoch-plus':8}[a.definitionId]??0);
  const r=state.roundResults.find(r=>r.round===state.round);
  if(a.definitionId==='patient-study'&&r?.roundKind==='pvp'&&r.round>=a.acquiredRound)amount+=r.result==='playerWin'?2:3;
 }
 return amount;
}
// 14.24 Clear/Cluttered Mind XP=3, Slammin XP=2; P-B4XP combat-end sampling.
function benchXp(state){
 if(ROUNDS[state.round-1]?.kind!=='pvp'||!state.augments.some(a=>['clear-mind','cluttered-mind','slammin','slammin-plus'].includes(a.definitionId)&&a.acquiredRound<=state.round))return 0;
 const champions=state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench'&&COST[u.definitionId]!==undefined).length;
 let amount=0;
 for(const a of state.augments.filter(a=>a.acquiredRound<=state.round)){
  if(a.definitionId==='clear-mind'&&champions===0)amount+=3;
  if(a.definitionId==='cluttered-mind'&&champions===state.preparation.benchSize)amount+=3;
  if(['slammin','slammin-plus'].includes(a.definitionId)&&!state.items.some(i=>i.location.kind==='inventory'))amount+=2;
 }
 return amount;
}
function freeRerollCredits(state){
 let count=expectedRolls(state).reduce((n,r)=>n+r.rerolls,0);for(const a of state.augments){const id=a.definitionId;
  if(id==='two-much-value')for(let r=a.acquiredRound;r<state.round;r++){
   if(ROUNDS[r-1]?.kind==='supply')continue;
   const rows=state.augmentHistory.facts.filter(f=>f.round===r);
   const roster=state.multiplayer&&ROUNDS[r-1]?.kind==='pvp'
    ?rows.find(f=>f.kind==='pvp-roster')?.seats.find(x=>x.seatId===state.multiplayer.seatId)
    :rows.find(f=>f.kind==='combat-roster')?.roster;
   assert(roster,'independent Two Much Value roster');
   count+=Math.floor(new Set(roster.units.filter(u=>u.team==='player'&&u.location.kind==='board'&&COST[u.definitionId]===2).map(u=>u.definitionId)).size/2);
  }
  if(id==='rigged-shop-plus')count+=5;
  if(id==='prismatic-ticket')for(let i=0;i<(state.seatMechanics?.seat['shop-augments']?.rolls??0);i++)if(shopWord(state,['ticket',a.choiceId,i])*100n/4294967296n<45n)count++;
  count+=({'rolling-for-days-i':11,'superstars-i':2,'superstars-ii':4}[id]??0);
  if(id==='reroll-transfer')count+=3*state.augmentOffers.reduce((sum,o)=>{const r=state.scheduleReceipts.find(x=>x.kind==='augment'&&x.eventId===o.choiceId);return sum+(r&&r.round>a.acquiredRound&&r.round<=state.round?3-o.rerollCount:0);},0);
  if(id==='a-golden-find' && a.acquiredRound<=state.round)count+=10;
  if(id==='crafted-crafting')count+=2*state.resourceProvenance.entries.filter(e=>e.kind==='item-combined'&&ROUNDS.find(r=>r.roundId===e.roundId)?.ordinal>=a.acquiredRound&&ROUNDS.find(r=>r.roundId===e.roundId)?.ordinal<=state.round).length;
  if(id==='trade-sector')count+=state.round-a.acquiredRound+1;
  if(id==='call-to-chaos'&&chaosOutcome(state,a)==='rerolls')count+=40;
  if(['patience-is-a-virtue','invested-plus','invested-plus-plus'].includes(id))for(let r=a.acquiredRound;r<state.round;r++){
   const roundId=ROUNDS[r-1].roundId;
   if(id==='patience-is-a-virtue'){
    if(!state.resourceProvenance.entries.some(e=>e.kind==='unit-acquired'&&e.source.kind==='shop'&&e.roundId===roundId))count+=2;
   }else{
    const result=state.roundResults.find(x=>x.round===r);assert(result,'independent invested entry history');
    const deferred=(state.seatMechanics?.receipts??[]).slice(result.mechanicReceiptPrefixLength).filter(x=>x.round===r)
     .reduce((n,x)=>n+(x.kind==='gold'?x.amount:x.kind==='unit'?x.gold:x.kind==='choice'?-x.price:0),0);
    const sales=state.resourceProvenance.entries.filter(e=>e.kind==='unit-sold'&&e.context==='settlement-capacity'&&e.roundId===roundId).reduce((n,e)=>n+e.goldGranted,0);
    count+=Math.floor(Math.max(0,Math.min(80,result.goldAfter+deferred+sales)-50)/10);
   }
  }
  const stageCredits={'epoch':2,'epoch-plus':3}[id];
  if(stageCredits)count+=stageCredits*(1+ROUNDS.filter(r=>r.ordinal>a.acquiredRound&&r.ordinal<=state.round&&r.sub===1).length);
  if(id==='shopping-spree'||id==='upward-mobility'){
   const level=state.seatMechanics?.seat['augment-acquisition-levels']?.[a.choiceId]??state.level;
   for(let n=level+1;n<=state.level;n++)count+=id==='shopping-spree'?n:3;
  }
 }return count;
}
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
// 14.24 shop augment IDs/tiers, transcribed without importing runtime content.
for(const [tier,ids] of Object.entries({silver:['firesale','rigged-shop-plus'],gold:['reinfourcement','starry-night','starry-night-plus'],prismatic:['prismatic-ticket','subscription-service']})){AUGMENT_POOLS[tier].push(...ids);AUGMENTS.push(...ids);}
const batch2Offers=require('../../augment-pool-batch2-oracle-data.cjs');
// Batch 3 (14.24 tiers): player-combat scheduled grants and free shop rerolls.
const batch3Offers={silver:['team-building','latent-forge','eye-for-an-eye','eye-for-an-eye-plus','rolling-for-days-i','superstars-i','corrosion','wealthy-rehab-i','support-mining','support-mining-plus','field-medic','blade-dance','shocking-troll','spoils-of-war-i','dummify'],gold:['what-doesnt-kill-you','prizefighter','superstars-ii','trade-sector','worth-the-wait','blazing-soul-i','noble-sacrifice','wealthy-rehab-ii','bad-luck-protection','scapegoat','wandering-trainer-i','gold-for-dummies','tower-defense','savage-revenge','all-out','blood-pact','spoils-of-war-ii','golemify','warpath','magic-roll'],prismatic:['blazing-soul-ii','spoils-of-war-iii','wandering-trainer-ii','the-golden-egg','an-exalted-adventure','phreaky-friday','phreaky-friday-plus','dark-alley-dealings','living-forge','shimmerscale-essence','building-a-collection-iii','worth-the-wait-ii','flexible','call-to-chaos']};
// Batch 3 XP (14.24 tiers): XP grants and XP-purchase rules.
batch3Offers.silver.push('kingslayer','risky-moves');batch3Offers.gold.push('patient-study','epoch','epoch-plus');batch3Offers.prismatic.push('level-up','shopping-spree','upward-mobility');
// Batch 4 (14.24 tiers): level rewards, B4XP bench XP, B4reroll free rerolls, B4Combat combat-start effects.
batch3Offers.silver.push('caretakers-ally','lategame-specialist','patience-is-a-virtue');batch3Offers.gold.push('caretakers-favor','clear-mind','cluttered-mind','slammin','slammin-plus','long-distance-pals','category-five','overheal','sated-spellweaver');batch3Offers.prismatic.push('birthday-presents','caretakers-chosen','invested-plus','invested-plus-plus');
batch3Offers.silver.push('good-for-something','lunch-money','titanic-titan');
batch3Offers.gold.push('contested','scoreboard-scrapper','loot-explosion','tomb-raider-1','cloning-facility');
batch3Offers.prismatic.push('tomb-raider-2','hall-of-mirrors');
batch3Offers.gold.push('rebel-resurgence');
batch3Offers.prismatic.push('ghost-of-friends-past');
batch3Offers.gold.push('voidcaller');batch3Offers.prismatic.push('void-swarm');
batch3Offers.gold.push('no-scout-no-pivot','cooking-pot');
batch3Offers.gold.push('two-much-value','shop-glitch');
batch3Offers.gold.push('all-that-shimmers','all-that-shimmers-plus','academic-research','pandoras-items-ii','salvage-bin','replication');
batch3Offers.prismatic.push('roll-the-dice','at-what-cost','quality-over-quantity');
batch3Offers.silver.push('power-up','beggars-can-be-choosers','reroll-transfer','pandoras-items','fine-vintage','component-buffet');
batch3Offers.gold.push('another-anomaly');
batch3Offers.prismatic.push('anger-issues');
batch3Offers.silver.push('mad-chemist');
batch3Offers.silver.push('recombobulator','pandoras-bench');
batch3Offers.prismatic.push('lucky-gloves','lucky-gloves-plus');
batch3Offers.gold.push('aerial-warfare','natural-selection');
batch3Offers.silver.push('survivor','diversified-portfolio-plus','diversified-portfolio','called-shot','crafted-crafting','table-scraps','young-and-wild-and-free');batch3Offers.prismatic.push('dual-purpose','a-change-of-fate','im-the-carry-now');
batch3Offers.gold.push('moonlight','pilfer');batch3Offers.prismatic.push('greater-moonlight','tiniest-titan','tiniest-titan-plus','glorious-evolution','hard-commit');
batch3Offers.gold.push('forward-thinking','mirrored-monetization','dhampyr');
batch3Offers.gold.push('scavenger');batch3Offers.prismatic.push('sponging');
batch3Offers.prismatic.push('artifactory','pandoras-items-iii');
batch3Offers.gold.push('salvage-bin-plus','a-golden-find','forbidden-magic');
for(const tier of ['silver','gold','prismatic']){AUGMENT_POOLS[tier].push(...batch2Offers[tier],...batch3Offers[tier]);AUGMENTS.push(...batch2Offers[tier],...batch3Offers[tier]);}AUGMENTS.sort();
AUGMENT_POOLS.gold.push('snipers-nest','trait-tracker'); AUGMENTS.push('snipers-nest','trait-tracker'); AUGMENTS.sort();
assert.equal(AUGMENTS.length,302,'independent full augment catalog size');
assert.equal(new Set(AUGMENTS).size,302,'independent catalog has no duplicates');
AUGMENT_POOLS.prismatic.push('max-cap');AUGMENT_POOLS.silver.push('head-start');AUGMENTS.push('max-cap','head-start');AUGMENTS.sort();
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
 // v23: murmur3 fmix32 over the stream-salted seed (was one lcg32 step).
 let x=BigInt(seed)^hash;
 x=((x^(x>>16n))*0x85ebca6bn)%4294967296n;
 x=((x^(x>>13n))*0xc2b2ae35n)%4294967296n;
 let ticket=Number((x^(x>>16n))*10000n/4294967296n);
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
const EXCLUSIVE_GROUPS=[['moonlight','greater-moonlight'],['all-for-one-i','all-for-one-ii','pair-of-fours'],['bronze-for-life-i','bronze-for-life-ii','built-different'],
 ['built-different','climb-the-ladder-i','climb-the-ladder-ii'],['bulky-buddies-i','bulky-buddies-ii','bulky-buddies-iii'],
 ['bulky-buddies-i','mentorship-i'],['bulky-buddies-i','mentorship-ii'],['bulky-buddies-ii','mentorship-i'],['bulky-buddies-ii','mentorship-ii'],
 ['bulky-buddies-iii','mentorship-i'],['bulky-buddies-iii','mentorship-ii'],['crown-guarded','not-today'],['high-voltage','not-today'],
 ['sisters','mentorship','reunion','geniuses','menaces','unlikely-duo'],['glass-cannon-i','glass-cannon-ii'],['manaflow-i','manaflow-ii'],
 ['piercing-lotus-i','piercing-lotus-ii'],['placebo','placebo-plus'],['pumping-up-i','pumping-up-ii','pumping-up-iii'],['trifecta-i','trifecta-ii']];
EXCLUSIVE_GROUPS.push(['all-that-shimmers','all-that-shimmers-plus']);
EXCLUSIVE_GROUPS.push(['tiniest-titan','tiniest-titan-plus']);
EXCLUSIVE_GROUPS.push(['voidcaller','built-different']);
EXCLUSIVE_GROUPS.push(['firesale','patience-is-a-virtue'],['rigged-shop-plus','subscription-service'],['starry-night','starry-night-plus'],['lategame-specialist','level-up'],
 ['tomb-raider-1','tomb-raider-2'],
 ['clear-mind','cluttered-mind'],['slammin','slammin-plus'],['category-five','not-today'],
 ['sated-spellweaver','wealthy-rehab-i'],['sated-spellweaver','wealthy-rehab-ii'],
 ['invested-plus','invested-plus-plus']);
for(const id of ['invested-plus','invested-plus-plus'])for(const other of ['raining-gold','raining-gold-plus','hedge-fund','going-long'])EXCLUSIVE_GROUPS.push([id,other]);
for(const id of ['betrayal','blood-brothers','geniuses','mentorship','reunion','sisters'])EXCLUSIVE_GROUPS.push(['mad-chemist',id]);
for(const other of ['crown-guarded','category-five','high-voltage','unleash-the-beast'])EXCLUSIVE_GROUPS.push(['anger-issues',other]);
const TEAMUP_TRAITS={voidcaller:['visionary'],'loot-explosion':['ambusher'],
 'rebel-resurgence':['rebel'],'mad-chemist':['sentinel','chem-baron'],sisters:['enforcer','rebel','pit-fighter','ambusher'],mentorship:['enforcer','conqueror','quickstriker','sniper'],
 reunion:['enforcer','pit-fighter','ambusher','firelight','scrap'],geniuses:['academy','firelight','ambusher','scrap','visionary'],
 menaces:['family','dominator','ambusher','scrap'],'unlikely-duo':['rebel','chem-baron','pit-fighter','ambusher']};
// 14.24 batch1 AssociatedTraits/MutuallyExclusiveItems (research source columns).
Object.assign(TEAMUP_TRAITS,{"academy-crest": ["academy"], "ambusher-crest": ["ambusher"], "artillerist-crest": ["artillerist"], "automata-crest": ["automata"], "bruiser-crest": ["bruiser"], "black-rose-crest": ["black-rose"], "chem-baron-crest": ["chem-baron"], "conqueror-crest": ["conqueror"], "dominator-crest": ["dominator"], "enforcer-crest": ["enforcer"], "experiment-crest": ["experiment"], "family-crest": ["family"], "firelight-crest": ["firelight"], "pit-fighter-crest": ["pit-fighter"], "quickstriker-crest": ["quickstriker"], "rebel-crest": ["rebel"], "scrap-crest": ["scrap"], "sentinel-crest": ["sentinel"], "sniper-crest": ["sniper"], "sorcerer-crest": ["sorcerer"], "visionary-crest": ["visionary"], "watcher-crest": ["watcher"], "academy-crown": ["academy"], "ambusher-crown": ["ambusher"], "artillerist-crown": ["artillerist"], "automata-crown": ["automata"], "bruiser-crown": ["bruiser"], "black-rose-crown": ["black-rose"], "chem-baron-crown": ["chem-baron"], "conqueror-crown": ["conqueror"], "dominator-crown": ["dominator"], "enforcer-crown": ["enforcer"], "experiment-crown": ["experiment"], "family-crown": ["family"], "firelight-crown": ["firelight"], "pit-fighter-crown": ["pit-fighter"], "quickstriker-crown": ["quickstriker"], "rebel-crown": ["rebel"], "scrap-crown": ["scrap"], "sentinel-crown": ["sentinel"], "sniper-crown": ["sniper"], "sorcerer-crown": ["sorcerer"], "visionary-crown": ["visionary"], "watcher-crown": ["watcher"]});
EXCLUSIVE_GROUPS.push(...[["academy-crest", "academy-crown"], ["academy-crest", "built-different"], ["academy-crown", "built-different"], ["ambusher-crest", "ambusher-crown"], ["ambusher-crest", "built-different"], ["ambusher-crown", "built-different"], ["artillerist-crest", "artillerist-crown"], ["artillerist-crest", "built-different"], ["artillerist-crown", "built-different"], ["automata-crest", "automata-crown"], ["automata-crest", "built-different"], ["automata-crown", "built-different"], ["black-rose-crest", "black-rose-crown"], ["black-rose-crest", "built-different"], ["black-rose-crown", "built-different"], ["bruiser-crest", "bruiser-crown"], ["bruiser-crest", "built-different"], ["bruiser-crown", "built-different"], ["built-different", "chem-baron-crest"], ["built-different", "chem-baron-crown"], ["built-different", "conqueror-crest"], ["built-different", "conqueror-crown"], ["built-different", "dominator-crest"], ["built-different", "dominator-crown"], ["built-different", "enforcer-crest"], ["built-different", "enforcer-crown"], ["built-different", "experiment-crest"], ["built-different", "experiment-crown"], ["built-different", "family-crest"], ["built-different", "family-crown"], ["built-different", "firelight-crest"], ["built-different", "firelight-crown"], ["built-different", "pit-fighter-crest"], ["built-different", "pit-fighter-crown"], ["built-different", "quickstriker-crest"], ["built-different", "quickstriker-crown"], ["built-different", "rebel-crest"], ["built-different", "rebel-crown"], ["built-different", "scrap-crest"], ["built-different", "scrap-crown"], ["built-different", "sentinel-crest"], ["built-different", "sentinel-crown"], ["built-different", "sniper-crest"], ["built-different", "sniper-crown"], ["built-different", "sorcerer-crest"], ["built-different", "sorcerer-crown"], ["built-different", "visionary-crest"], ["built-different", "visionary-crown"], ["built-different", "watcher-crest"], ["built-different", "watcher-crown"], ["chem-baron-crest", "chem-baron-crown"], ["conqueror-crest", "conqueror-crown"], ["dominator-crest", "dominator-crown"], ["enforcer-crest", "enforcer-crown"], ["experiment-crest", "experiment-crown"], ["family-crest", "family-crown"], ["firelight-crest", "firelight-crown"], ["pit-fighter-crest", "pit-fighter-crown"], ["quickstriker-crest", "quickstriker-crown"], ["raining-gold", "raining-gold-plus"], ["rebel-crest", "rebel-crown"], ["scrap-crest", "scrap-crown"], ["sentinel-crest", "sentinel-crown"], ["sniper-crest", "sniper-crown"], ["sorcerer-crest", "sorcerer-crown"], ["visionary-crest", "visionary-crown"], ["watcher-crest", "watcher-crown"]]);
Object.assign(TEAMUP_TRAITS,{'academic-research':['academy']},batch2Offers.traits);
EXCLUSIVE_GROUPS.push(['salvage-bin','crafted-crafting'],['salvage-bin','flexible']);
EXCLUSIVE_GROUPS.push(['pandoras-items-ii','slammin'],['pandoras-items-ii','slammin-plus'],['pandoras-items-ii','flexible']);
EXCLUSIVE_GROUPS.push(['trait-tracker','built-different'],['trait-tracker','flexible'],['trait-tracker','salvage-bin'],['trait-tracker','salvage-bin-plus']);
Object.assign(TEAMUP_TRAITS, { 'snipers-nest': ['sniper'] });
Object.assign(TEAMUP_TRAITS,{'forbidden-magic':['black-rose']},{'aerial-warfare':['firelight'],'natural-selection':['experiment']});
EXCLUSIVE_GROUPS.push(...batch2Offers.exclusive);
const batch3Rules=require('../../augment-pool-batch3-oracle-data.cjs');
Object.assign(TEAMUP_TRAITS,batch3Rules.traits);
EXCLUSIVE_GROUPS.push(...batch3Rules.exclusive);
EXCLUSIVE_GROUPS.push(['lucky-gloves','lucky-gloves-plus']);
EXCLUSIVE_GROUPS.push(['built-different','diversified-portfolio','diversified-portfolio-plus']);
EXCLUSIVE_GROUPS.push(['built-different','natural-selection']);
EXCLUSIVE_GROUPS.push(['built-different','loot-explosion']);
function excludedByOwned(id,owned){return owned.some(a=>a.definitionId!==id&&EXCLUSIVE_GROUPS.some(g=>g.includes(id)&&g.includes(a.definitionId)));}
function traitAllowed(id,node,traits){return !['round:3-2:augment','round:4-2:augment'].includes(node)||!TEAMUP_TRAITS[id]||TEAMUP_TRAITS[id].some(t=>traits.includes(t));}
// 14.24 stage tags (item_tags_raw {d02ae323}/{d12ae4b6}/{d22ae649} = not at 2-1/3-2/4-2, P inference), written out by id
// Independent research stage bans; Fine Vintage and Table Scraps follow their user-decided stage overrides.
EXCLUSIVE_GROUPS.push(...require('../../augment-pool-batch5-offer-oracle-data.cjs'));
EXCLUSIVE_GROUPS.push(['max-cap','level-up']);
AUGMENT_POOLS.prismatic.push('expected-unexpectedness','prismatic-pipeline');
// User rule (2026-10-27): Loot Explosion is offered at 2-1 and 3-2 only, independently specified rather than derived from the source tags.
const STAGE_BANS={'loot-explosion':['4-2'],'prismatic-pipeline':['4-2'],'expected-unexpectedness':['3-2','4-2'],'void-swarm':['3-2','4-2'],'natural-selection':['2-1'],'ghost-of-friends-past':['3-2','4-2'],'lucky-gloves-plus':['2-1'],'lucky-gloves':['3-2','4-2'],'recombobulator':['2-1'],'mad-chemist':['3-2','4-2'],'hall-of-mirrors':['2-1','3-2','4-2'],'another-anomaly':['2-1','3-2'],'anger-issues':['2-1'],'tomb-raider-1':['2-1','3-2'],'tomb-raider-2':['2-1','3-2'],'forbidden-magic':['2-1','4-2'],'a-golden-find':['2-1','3-2'],'artifactory':['2-1'],'salvage-bin-plus':['2-1'],'max-cap':['2-1','3-2'],'head-start':['3-2','4-2'],'sponging':['2-1'],'trait-tracker':['2-1','4-2'],'dhampyr':['2-1','4-2'],'mirrored-monetization':['2-1','3-2'],'forward-thinking':['2-1','4-2'],'titanic-titan':['4-2'],'lunch-money':['4-2'],'good-for-something':['3-2','4-2'],'greater-moonlight':['2-1','3-2'],'moonlight':['2-1','3-2'],'hard-commit':['3-2','4-2'],'glorious-evolution':['2-1','3-2'],'tiniest-titan-plus':['2-1','4-2'],'tiniest-titan':['3-2','4-2'],"contested":["2-1","4-2"],"scoreboard-scrapper":["3-2","4-2"],"cooking-pot":["3-2","4-2"],"no-scout-no-pivot":["3-2","4-2"],"shop-glitch":["4-2"],"two-much-value":["4-2"],"survivor":["3-2","4-2"],"diversified-portfolio-plus":["2-1","4-2"],"diversified-portfolio":["3-2","4-2"],"young-and-wild-and-free":["4-2"],"table-scraps":["3-2","4-2"],"called-shot":["3-2","4-2"],"crafted-crafting":["3-2","4-2"],"a-change-of-fate":["2-1","3-2"],"firesale":["2-1","4-2"],"rigged-shop-plus":["2-1","4-2"],"reinfourcement":["2-1","3-2"],"starry-night":["3-2","4-2"],"starry-night-plus":["2-1","4-2"],"dual-purpose":["3-2","4-2"],"prismatic-ticket":["4-2"],"subscription-service":["3-2","4-2"],"caretakers-ally":["3-2","4-2"],"lategame-specialist":["2-1","4-2"],"caretakers-favor":["3-2","4-2"],"birthday-presents":["3-2","4-2"],"caretakers-chosen":["3-2","4-2"],"clear-mind":["3-2","4-2"],"cluttered-mind":["3-2","4-2"],"slammin":["3-2","4-2"],"slammin-plus":["2-1","4-2"],"patience-is-a-virtue":["3-2","4-2"],"invested-plus":["2-1","4-2"],"invested-plus-plus":["2-1","3-2"],"category-five":["4-2"],"overheal":["2-1"],"sated-spellweaver":["2-1"],"all-for-one-i":["3-2","4-2"],"all-for-one-ii":["3-2","4-2"],"all-out":["3-2","4-2"],"an-exalted-adventure":["3-2","4-2"],"backup":["2-1"],"bad-luck-protection":["2-1"],"belt-overflow":["2-1"],"betrayal":["2-1","4-2"],"big-grab-bag":["2-1"],"black-rose-crest":["2-1"],"black-rose-crown":["2-1"],"blade-dance":["3-2","4-2"],"blazing-soul-i":["2-1"],"blazing-soul-ii":["2-1"],"blinding-speed":["2-1"],"blood-pact":["3-2","4-2"],"branching-out":["4-2"],"bronze-for-life-i":["2-1"],"bronze-for-life-ii":["2-1"],"build-a-bud":["3-2","4-2"],"building-a-collection-iii":["4-2"],"built-different":["3-2","4-2"],"bulky-buddies-ii":["2-1"],"bulky-buddies-iii":["2-1"],"calculated-enhancement":["2-1"],"call-to-chaos":["2-1","3-2"],"climb-the-ladder-i":["2-1"],"climb-the-ladder-ii":["2-1"],"coronation":["2-1"],"corrosion":["2-1"],"crimson-pact":["4-2"],"crown-guarded":["4-2"],"dark-alley-dealings":["2-1","4-2"],"defense-call":["2-1"],"dummify":["2-1","4-2"],"duo-queue":["2-1","3-2"],"enforce":["4-2"],"epoch":["3-2","4-2"],"epoch-plus":["2-1","4-2"],"eye-for-an-eye":["3-2","4-2"],"eye-for-an-eye-plus":["2-1","4-2"],"field-medic":["3-2","4-2"],"final-polish":["2-1","3-2"],"find-your-center":["2-1"],"flexible":["3-2","4-2"],"geniuses":["2-1","3-2"],"going-long":["3-2","4-2"],"gold-for-dummies":["3-2","4-2"],"golemify":["2-1","4-2"],"hedge-fund":["3-2","4-2"],"high-voltage":["4-2"],"investment-strategy-i":["3-2","4-2"],"investment-strategy-ii":["3-2","4-2"],"iron-assets":["3-2","4-2"],"item-collector-i":["2-1"],"item-collector-ii":["2-1"],"kingslayer":["4-2"],"latent-forge":["3-2","4-2"],"level-up":["3-2","4-2"],"lineup":["2-1"],"little-buddies":["2-1"],"living-forge":["3-2","4-2"],"magic-roll":["2-1","4-2"],"manaflow-i":["2-1"],"manaflow-ii":["2-1"],"menaces":["2-1","4-2"],"mentorship":["2-1","3-2"],"missed-connections":["2-1"],"noble-sacrifice":["2-1"],"one-buff-two-buff":["2-1"],"one-two-five":["2-1","3-2"],"ones-twos-three":["3-2","4-2"],"pair-of-fours":["2-1","3-2"],"patient-study":["3-2","4-2"],"phreaky-friday":["3-2","4-2"],"phreaky-friday-plus":["2-1"],"piercing-lotus-i":["2-1"],"piercing-lotus-ii":["2-1"],"pit-fighter-prizefighter":["3-2","4-2"],"placebo":["3-2","4-2"],"placebo-plus":["2-1","4-2"],"prizefighter":["3-2","4-2"],"pumping-up-i":["3-2","4-2"],"pumping-up-ii":["3-2","4-2"],"pumping-up-iii":["3-2","4-2"],"pyromaniac":["4-2"],"radiant-refactor":["2-1"],"raining-gold":["3-2","4-2"],"raining-gold-plus":["2-1","4-2"],"reunion":["2-1","3-2"],"risky-moves":["3-2","4-2"],"rocket-collection":["3-2","4-2"],"rocket-collection-plus":["2-1","4-2"],"rolling-for-days-i":["2-1"],"savage-revenge":["2-1","4-2"],"scapegoat":["3-2","4-2"],"scrap-recycling":["3-2","4-2"],"shimmerscale-essence":["3-2","4-2"],"shocking-troll":["3-2","4-2"],"shopping-spree":["3-2","4-2"],"silver-spoon":["3-2","4-2"],"sisters":["2-1","3-2"],"spoils-of-war-i":["3-2","4-2"],"spoils-of-war-ii":["3-2","4-2"],"spoils-of-war-iii":["3-2","4-2"],"superstars-i":["3-2","4-2"],"superstars-ii":["3-2","4-2"],"support-mining":["3-2","4-2"],"support-mining-plus":["2-1","4-2"],"sword-overflow":["2-1"],"tacticians-kitchen":["3-2","4-2"],"team-building":["4-2"],"teaming-up-i":["2-1"],"teaming-up-ii":["2-1","3-2"],"the-golden-egg":["2-1","3-2"],"thorn-plated-armor":["4-2"],"tower-defense":["4-2"],"trade-sector":["3-2","4-2"],"trifecta-i":["2-1"],"trifecta-ii":["2-1"],"two-trick":["3-2","4-2"],"unleash-the-beast":["4-2"],"unlikely-duo":["2-1","3-2"],"wand-overflow":["2-1"],"wandering-trainer-i":["3-2","4-2"],"wandering-trainer-ii":["3-2","4-2"],"warpath":["3-2","4-2"],"watcher-growth":["2-1","3-2","4-2"],"wealthy-rehab-i":["2-1"],"wealthy-rehab-ii":["2-1"],"welcome-to-the-playground":["4-2"],"what-doesnt-kill-you":["3-2","4-2"],"worth-the-wait":["3-2","4-2"],"worth-the-wait-ii":["3-2","4-2"],"replication":["4-2"],"quality-over-quantity":["4-2"],"salvage-bin":["3-2","4-2"],"academic-research":["4-2"],"fine-vintage":["3-2","4-2"],"component-buffet":["3-2","4-2"],"at-what-cost":["3-2","4-2"],"reroll-transfer":["3-2","4-2"],"roll-the-dice":["2-1"],"all-that-shimmers":["3-2","4-2"],"all-that-shimmers-plus":["2-1","4-2"],"power-up":["4-2"],"beggars-can-be-choosers":["3-2","4-2"]};
const stageBanned=(id,node)=>node!==null&&(STAGE_BANS[id]??[]).some(n=>node==='round:'+n+':augment');
function augmentPool(tier,owned,excluded=[],node=null,traits=[],sharedCarousel=false,level=1){if(typeof sharedCarousel==='number'){level=sharedCarousel;sharedCarousel=false;}return AUGMENT_POOLS[tier].filter(id=>(id!=='max-cap'||level<=7)&&(sharedCarousel||!['table-scraps','young-and-wild-and-free'].includes(id))&&!(node==='round:2-1:augment'&&['black-rose-crest','black-rose-crown'].includes(id))&&!stageBanned(id,node)&&!owned.some(a=>a.definitionId===id)&&!excluded.includes(id)&&!excludedByOwned(id,owned)&&traitAllowed(id,node,traits)).sort();}
function augmentDraw(rng,tier,owned,excluded=[],node=null,traits=[],sharedCarousel=false,level=1){
 const pool=augmentPool(tier,owned,excluded,node,traits,sharedCarousel,level);assert(pool.length>=3,'independent augment pool has three candidates');
 for(let i=0;i<3;i++){rng=word(rng);const j=i+rng%(pool.length-i);[pool[i],pool[j]]=[pool[j],pool[i]];}
 return {offers:pool.slice(0,3),rng};
}
function openingTraits(state,choiceId){return state.augmentOffers.find(r=>r.choiceId===choiceId).fieldedTraits;}
// User-approved card reroll: exactly one use per slot; v22: every shown card stays excluded (seen once, never again).
function effectiveAugmentTier(state,choiceId){
 const tier=augmentTier(augmentSeed(state),choiceId),nodes=['round:2-1:augment','round:3-2:augment','round:4-2:augment'];
 const index=nodes.indexOf(choiceId),power=state.augments.find(a=>a.definitionId==='power-up'),start=power?nodes.indexOf(power.choiceId):-1;
 if(start<0||index<=start||state.augments.some(a=>nodes.indexOf(a.choiceId)>start&&nodes.indexOf(a.choiceId)<index))return tier;
 return tier==='silver'?'gold':'prismatic';
}
function extraAugmentRolls(state,choiceId){return state.augments.some(a=>a.definitionId==='beggars-can-be-choosers'&&a.choiceId!==choiceId)?3:0;}
function augmentCardDraw(before,index){
 const c=before.pendingChoice,tier=effectiveAugmentTier(before,c.choiceId);
 const pool=augmentPool(tier,before.augments,[...before.removedAugmentIds,...c.offers],c.choiceId,openingTraits(before,c.choiceId),!!before.carousel&&!!before.multiplayer,before.level);
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
 else if(c.rerolledSlots[command.optionIndex] && c.rerollCount-c.rerolledSlots.filter(Boolean).length>=extraAugmentRolls(before,c.choiceId))reason='augment-rerolls-exhausted';
 else {tier=effectiveAugmentTier(before,c.choiceId);if(!augmentPool(tier,before.augments,[...before.removedAugmentIds,...c.offers],c.choiceId,openingTraits(before,c.choiceId),!!before.carousel&&!!before.multiplayer,before.level).length)reason='augment-pool-too-small';}
 if(reason){assert.deepEqual(result,{ok:false,state:before,reason},'independent reroll rejection');assert.equal(result.state,before,'failed reroll preserves state reference');return;}
 assert.equal(result.ok,true);const after=result.state,draw=augmentCardDraw(before,command.optionIndex);
 const next={...c,offers:draw.offers,augmentTier:tier,generation:c.generation+1,rerollCount:c.rerollCount+1,rerollsRemaining:3+extraAugmentRolls(before,c.choiceId)-c.rerollCount-1,rerolledSlots:draw.rerolledSlots};
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
const xpCap=state=>state.augments.some(a=>a.definitionId==='max-cap')?7:10;
function xp(level,value,amount,cap=10){let applied=0;if(level===cap)value=0;while(amount>0&&level<cap){const take=Math.min(amount,XP[level]-value);amount-=take;applied+=take;value+=take;if(value===XP[level]){value=0;level++;}}return {level,xp:value,xpApplied:applied};}
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
 const survivingEnemyCount=combat?.units.filter(u=>u.team==='enemy'&&u.alive&&!u.itemSummon&&!u.anomalySummon&&!['b5-voidling','trainer-golem','g23-sion','g23-forge','g23-barrel','v20-silco-minion'].includes(u.definitionId)).length??0;
 let streakAfter=before.streak;
 if(roundKind!=='supply'){const kind=result==='playerWin'?'win':'loss';streakAfter={kind,count:before.streak.kind===kind?before.streak.count+1:1};}
 const roundGold=before.augments.filter(a=>['raining-gold','raining-gold-plus'].includes(a.definitionId)).length /* v23: RoundGold 1 each (14.24 records 157/158) */;
 const base=stage===1?{2:2,3:3,4:4}[sub]:5+roundGold /* v22 10-23: next-entry 2/3/4G */,naturalXp=2+benchXp(before) /* T11 signed opening: 2/2/2; opening XP unchanged; high-level XP68 is user custom 2026-10-22 */;
 const win=roundKind==='pvp'&&result==='playerWin'?1:0,interestBasis=goldBefore+win;
 const owned=new Set(before.augments.map(a=>a.definitionId));
 const cap=owned.has('going-long')?0:owned.has('hedge-fund')?10:owned.has('investment-strategy-ii')?7:5;
 const interest=stage===1?0:Math.min(cap,Math.floor(interestBasis/10));
 const streak=roundKind==='supply'?0:streakAfter.count>=6?3:streakAfter.count>=5?2:streakAfter.count>=2?1:0; /* v22: PvE counts; 2-4/5/6+ */
 const baseDamage=roundKind==='pvp'?[2,5,8,10,12][stage-2]:roundKind==='pve'?3:0;
 const playerDamage=result==='playerWin'||roundKind==='supply'?0:roundKind==='pve'?3:baseDamage+survivingEnemyCount;
 const progression=xp(before.level,before.xp,naturalXp,xpCap(before)),income=base+win+interest+streak,hpLost=Math.min(before.playerHp,playerDamage);
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
 direct.push(...pipelineOrbs(state).flatMap(o=>o.entries));
 const mechanicIds=new Set();
 for(const orb of loot.rewardOrbs??[]){
  const r=state.seatMechanics?.receipts.find(r=>r.source==='augment-pool-shop'&&r.kind==='unit'&&r.resolution==='orb'&&r.orbId===orb.orbId);
  assert(r,'solo mechanic orb requires a shop gift receipt');
  const orbId=JSON.stringify(['orb',r.roundId,'mechanic',r.receiptId,0]),dropId=JSON.stringify([orbId,0]);
  const e={orbId,entryOrdinal:0,dropId,roundId:r.roundId,encounterId:'mechanic',sourceUnitId:r.receiptId,slotOrdinal:0,status:'planned',receiptId:null,revealCondition:'source-killed',payload:{kind:'unit',definitionId:r.definitionId,quantity:1,starLevel:r.starLevel??1}};
  assert.deepEqual(orb,{orbId,roundId:r.roundId,tier:'gray',source:'mechanic',entries:[e]},'independent shop orb envelope');
  assert(!mechanicIds.has(dropId),'unique shop orb');mechanicIds.add(dropId);direct.push(e);
 }
 for(const r of state.seatMechanics?.receipts??[])if(r.kind==='unit'&&r.resolution==='orb'){assert.equal(r.orbId,JSON.stringify(['orb',r.roundId,'mechanic',r.receiptId,0]),'shop receipt orb binding');assert((loot.rewardOrbs??[]).some(o=>o.orbId===r.orbId),'shop orb coverage');}

 const entries=new Map([...direct,...choices].map(d=>[d.dropId,d]));
 assert.deepEqual(loot.direct.filter(d=>!mechanicIds.has(d.dropId)).map(d=>d.dropId),direct.filter(d=>!mechanicIds.has(d.dropId)).map(d=>d.dropId),'direct loot identity');
 assert.equal(loot.direct.length,direct.length,'all direct loot identity');
 for(const id of mechanicIds)assert.equal(loot.direct.filter(d=>d.dropId===id).length,1,'shop direct coverage');
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
  if(mechanicIds.has(drop.dropId))assert(['revealed','granted'].includes(drop.status),'shop orb lifecycle');
  else assert.equal(earned.has(drop.dropId),!['planned','forfeited'].includes(drop.status),'direct earned-only status');
  assert.equal(receipts.has(drop.dropId),drop.status==='granted','direct actual receipt');
  assert.equal(drop.receiptId,drop.status==='granted'?receiptId(drop.dropId):null);
  if(['pending-capacity','retained-terminal'].includes(drop.status))assert.equal(entries.get(drop.dropId).payload.kind,'unit','only heroes wait for capacity');
 }
 for(const choice of loot.choiceEligibility){assert(['planned','revealed','forfeited'].includes(choice.status));assert.equal(earned.has(choice.dropId),choice.status==='revealed','choice earned-only status');
  assert.equal(receipts.has(choice.dropId),resolutions.has(choice.dropId),'choice receipt and resolution atomic');
  if(resolutions.has(choice.dropId))assert.equal(choice.status,'revealed','resolved choice is earned');
 }
 const itemIds=[],unitIds=[],counters=Object.fromEntries(LOOT_TABLE.map(([id])=>[counterKey(id),0]));
 for(const receipt of loot.receipts){const entry=entries.get(receipt.dropId);assert(entry,'receipt must have approved source');assert(earned.has(receipt.dropId)||mechanicIds.has(receipt.dropId),'receipt must be earned');
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
 for(const receipt of receipts){const entry=entries.get(receipt.dropId);
  if(entry.encounterId==='mechanic'){
   assert.equal(command?.type,'claimOrb','shop orb claim requires a command');assert.equal(command.orbId,entry.orbId);
   assert(['preparation','settlement','choice'].includes(before.phase),'solo shop orb claim phase');
   assert(roundOrdinal(entry.roundId)<=after.round,'shop orb claim timing');
  }else {assert.equal(after.combat?.status,'finished','loot only after combat');assert.equal(entry.roundId,after.roundDefinitionId,'grant only current round');}

  for(const id of receipt.grantedItemIds){if(buffetPlan(after).consumed.has(id))assert(!after.items.some(i=>i.id===id),'converted loot component is consumed');else assert.equal(after.items.find(i=>i.id===id)?.definitionId,receipt.payload.definitionId,'actual granted component definition');}
 }
 for(const resolution of resolved){if(resolution.method==='terminal-fallback')assert.equal(after.phase,'gameOver','fallback only terminal');
  else{assert.equal(command?.type,'select','player choice needs command');assert.equal(command.choiceId,choiceId(resolution.dropId));assert.equal(command.generation,0);assert.equal(command.definitionId,receipts.find(r=>r.dropId===resolution.dropId).payload.definitionId);}}
 return receipts;
}
function investment(before,record){return {...before.augmentProgress,pumpingRounds:before.augmentProgress.pumpingRounds+(before.augments.some(a=>a.definitionId==='pumping-up-i')?1:0),investmentHp:before.augmentProgress.investmentHp+((before.augments.some(a=>a.definitionId==='investment-strategy-i')?8:0)+(before.augments.some(a=>a.definitionId==='investment-strategy-ii')?9:0))*record.incomeBreakdown.interest};}
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
const ownedUnits=state=>[...state.preparation.units.filter(u=>u.team==='player'&&!['trainer-golem','carry-golem'].includes(u.definitionId)),...heldResources(state).units];
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
 constructor(initial){this.gold=0;this.pending={gold:0,investmentHp:0};this.h3=createH3Ledger(initial);
  // v22 openings can start with extra cards; conservation starts from the actual opening roster (Trainer Golem excluded).
  this.cards=ownedUnits(initial).reduce((n,u)=>n+3**(u.starLevel-1),0);assert(this.cards>=1,'opening unit');this.combinations=0;this.costs={purchases:0,sales:0,saleLoss:0,rerolls:0,xp:0,anomaly:0,income:0,rewards:0};this.rows=[];this.receipts=new Set();this.check(initial);}
 apply(before,after,command,events=[]){
  const h3=checkH3Growth(this.h3,before,after,command);
  validateChemTransition(before,after);
  validatePandoraEntry(before,after,assert);
  const inventoryConversions=buffetPlan(after);
  if(command?.type==='rerollAugment')validateAugmentReroll(before,{ok:true,state:after,events},command);
  if(!events.some(e=>e.type==='choiceOpened'&&e.choice.kind==='augment'))assert.deepEqual(after.augmentOffers,before.augmentOffers,'augment history retained without draw');
  const lootReceipts=validateLootTransition(before,after,command,events);
  const independentRewards=validateRewards(before,after,command,events,{CATALOG,COST,ROUNDS,lootReceipts,xp,entryXp,benchXp});
  // Round income (base/interest/streak) and its investment growth are paid at the next round entry (deferred-income.ts); win gold is immediate.
  let paidInvestment=0;
  if(command?.type==='continue'){this.gold+=this.pending.gold;this.pending.gold=0;paidInvestment=this.pending.investmentHp;this.pending.investmentHp=0;}
  if(command?.type==='buyXp'&&before.augments.some(a=>a.definitionId==='dual-purpose')){
   const expectedShop=shopTransition(before,command);
   assert.deepEqual(after.shop,expectedShop.shop,'independent XP shop refresh');assert.equal(after.rngState,expectedShop.rngState);
   assert.equal(after.seatMechanics?.seat['free-shop-rerolls']?.used??0,before.seatMechanics?.seat['free-shop-rerolls']?.used??0,'XP refresh never spends credits');
  }
  if(command?.type==='select'&&command.definitionId==='called-shot')assert.deepEqual(after.streak,{kind:'win',count:4},'Called Shot replaces the streak');
  if(command?.type==='buyXp'){const expected=xp(before.level,before.xp,4+(before.augments.some(a=>a.definitionId==='level-up')?2:0),xpCap(before));assert.deepEqual([after.level,after.xp],[expected.level,expected.xp],'independent purchased XP');}
  if(command?.type==='select'&&before.pendingChoice?.kind==='augment'){const a=after.augments.find(a=>a.definitionId===command.definitionId),amount=({'silver-spoon':10,'epoch':6,'epoch-plus':8,'level-up':12,'slammin-plus':10}[command.definitionId]??0)+(command.definitionId==='call-to-chaos'&&chaosOutcome(after,a)==='xp'?64:0),expected=xp(before.level,before.xp,amount,xpCap(after));assert.deepEqual([after.level,after.xp],[expected.level,expected.xp],'independent acquisition XP');const priorLevels=before.seatMechanics?.seat['augment-acquisition-levels']??{};assert.deepEqual(after.seatMechanics?.seat['augment-acquisition-levels']??{},['shopping-spree','upward-mobility','risky-moves','caretakers-ally','caretakers-favor','caretakers-chosen','birthday-presents','lategame-specialist'].includes(command.definitionId)?{...priorLevels,[a.choiceId]:expected.level}:priorLevels,'independent acquisition level baseline');}
  if(command?.type==='continue'){const expected=xp(before.level,before.xp,entryXp(before),xpCap(before));assert.deepEqual([after.level,after.xp],[expected.level,expected.xp],'independent round-start XP');}
  let choice=before.choiceRngState,reward=before.rewardRngState,battle=before.battleSeedRngState;
  if(command?.type==='start')battle=word(battle);
  if(command?.type==='target'||command?.type==='anomalyReroll'){choice=word(choice);const target=before.preparation.units.find(u=>u.id===(command.unitId??before.pendingChoice.targetId));const pool=ANOMALIES.filter(id=>(command.type!=='anomalyReroll'||!before.pendingChoice.offers.includes(id))&&(id!=='ultimate-hero'||target?.location.kind==='board'&&target.starLevel===3&&COST[target.definitionId]===1)&&(id!=='into-the-unknown'||target?.location.kind==='board'));assert.deepEqual(after.pendingChoice.offers,[pool[Number(BigInt(choice)*BigInt(pool.length)/4294967296n)]],'independent anomaly offer');}
  for(const event of events){
   if(event.type==='choiceOpened'&&event.choice.kind==='augment'){
    const c=event.choice,tier=effectiveAugmentTier(after,c.choiceId),rerolled=command?.type==='rerollAugment';
    assert.equal(c.choiceId,`round:${after.roundDefinitionId}:augment`,'independent scheduled augment node identity');
    const traits=openingTraits(after,c.choiceId);
    assert(['round:3-2:augment','round:4-2:augment'].includes(c.choiceId)||traits.length===0,'2-1 is not tailored to the comp');
    const draw=rerolled?augmentCardDraw(before,command.optionIndex):augmentDraw(choice,tier,after.augments,before.removedAugmentIds,c.choiceId,traits,!!after.carousel&&!!after.multiplayer,after.level);choice=draw.rng;
    assert.deepEqual(after.removedAugmentIds,rerolled?[...before.removedAugmentIds,draw.offers[command.optionIndex]]:[...before.removedAugmentIds,...draw.offers],'independent seen-once ledger');
    assert.deepEqual(c.offers,draw.offers,'independent augment offers');
    const used=rerolled?before.pendingChoice.rerollCount+1:0;
    assert.deepEqual(c,{kind:'augment',step:'offer',choiceId:c.choiceId,eventId:c.choiceId,generation:used,offers:draw.offers,targetId:null,
     rerollCount:used,augmentTier:tier,rerollsRemaining:3+extraAugmentRolls(after,c.choiceId)-used,rerolledSlots:rerolled?draw.rerolledSlots:[false,false,false],returnPhase:'preparation'},'independent augment node/reset metadata');
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
  if(command?.type==='buy'){const offer=before.shop.slots[command.slot],definitionId=offer.definitionId,starLevel=offer.starLevel??1,copies=3**(starLevel-1),cost=COST[definitionId]*copies;this.gold-=cost;costs.purchases+=cost;this.cards+=copies;units.set(`unit-${serial++}`,{definitionId,starLevel});}
  // v22: selling an anvil opens its four-pick for 0 gold; the anvil unit leaves the bench.
  if(command?.type==='sell'&&ANVIL_IDS.has(before.preparation.units.find(u=>u.id===command.id)?.definitionId)){this.cards-=1;units.delete(command.id);}
  else if(command?.type==='sell'){const unit=before.preparation.units.find(u=>u.id===command.id),cost=COST[unit.definitionId],copies=3**(unit.starLevel-1),value=SELL[cost][unit.starLevel-1];this.gold+=value;costs.sales+=value;costs.saleLoss+=cost*copies-value;this.cards-=copies;units.delete(unit.id);}
  // P-B5-80: the selection sells the frozen ordinary army before its four gifts.
  if(command?.type==='select'&&command.definitionId==='head-start')for(const unit of ownedUnits(before)){
   const cost=COST[unit.definitionId];if(cost===undefined)continue;
   const copies=3**(unit.starLevel-1),value=SELL[cost][unit.starLevel-1];
   this.gold+=value;costs.sales+=value;costs.saleLoss+=cost*copies-value;this.cards-=copies;units.delete(unit.id);
  }
  const freeUsed=before.seatMechanics?.seat['free-shop-rerolls']?.used??0;
  const rerollCost=freeRerollCredits(before)>freeUsed?0:2,xpCost=before.augments.some(a=>a.definitionId==='upward-mobility')?3:4;
  if(command?.type==='reroll')assert.equal(after.seatMechanics?.seat['free-shop-rerolls']?.used??0,freeUsed+(rerollCost===0?1:0),'independent free refresh spending');
  for(const [type,cost,key] of [['reroll',rerollCost,'rerolls'],['buyXp',xpCost,'xp'],['anomalyReroll',1,'anomaly']])if(command?.type===type){this.gold-=cost;costs[key]+=cost;}
  for(const receipt of lootReceipts){if(receipt.payload.kind==='gold'){this.gold+=receipt.payload.quantity;costs.rewards+=receipt.payload.quantity;}
   if(receipt.payload.kind==='unit'||receipt.payload.kind==='forge'){assert.deepEqual(receipt.grantedUnitIds,[`unit-${serial}`],'true loot candidate serial');units.set(`unit-${serial++}`,{definitionId:receipt.payload.definitionId,starLevel:receipt.payload.starLevel??1});this.cards+=3**((receipt.payload.starLevel??1)-1);}}
  const appendedMechanics=appended(before.seatMechanics?.receipts??[],after.seatMechanics?.receipts??[],'receiptId','mechanic gifts');
  const mechanicGifts=appendedMechanics.filter(r=>r.source==='s13-augments-p2'||r.source==='d11-fill'&&r.kind==='unit'),giftPlan=p2Gifts(after);
  for(const r of appendedMechanics.filter(r=>r.source==='d11-fill'&&r.kind==='gold')){
   assert.equal(command?.type,'select');assert.equal(command.definitionId,'avarice-incarnate');assert.equal(r.amount,5);
   assert.equal(r.receiptId,JSON.stringify(['d11-fill',before.pendingChoice.choiceId,'avarice-gold']));this.gold+=5;costs.rewards+=5;
  }
  // v22 opening encounters (batch A/B, trainer golems…): rewards are audited by the opening-encounters suites; the ledger books them.
  let lateGold=0;
  // Reconstruct the complete battle payout set from combat inputs/outcomes before booking it.
  const battlePayouts=battleGold(before,after,command,events,{word,blackMarket,ROUNDS});
  for(const r of battlePayouts){this.gold+=r.amount;costs.rewards+=r.amount;lateGold+=r.amount;}
  // G2-3 armory purchases (Junker King upgrades) pay their price; the price table is audited by the G2-3 junker suites.
  this.gold-=independentRewards.price;costs.purchases+=independentRewards.price;
  for(const r of appendedMechanics.filter(r=>['augment-kingslayer','augment-risky-moves'].includes(r.source))){
   const id=r.source==='augment-kingslayer'?'kingslayer':'risky-moves',a=after.augments.find(a=>a.definitionId===id);
   assert(a,'independent settlement-gold owner');assert.equal(r.kind,'gold');
   const battles=after.roundResults.filter(b=>b.roundKind==='pvp'&&b.round>=a.acquiredRound);
   if(id==='risky-moves'){
    assert.equal(r.receiptId,JSON.stringify(['augment-risky-moves',a.choiceId]));assert.equal(r.amount,30);
    assert.equal(r.round,battles[6]?.round,'seventh player combat pays once');
   }else{
    const battle=battles.find(b=>b.round===r.round);assert.equal(battle?.result,'playerWin');
    const opponentHp=after.multiplayer?.receipts.find(b=>b.round===r.round)?.opponentHp;
    assert.equal(r.amount,opponentHp!==undefined&&opponentHp>battle.hpBefore?4:1);
    assert.equal(r.receiptId,JSON.stringify(['augment-kingslayer',a.choiceId,r.round]));
   }
  }
  // Augment amounts/identities come from the independent due plan, never from the received payload.
  const p2ReceiptIds=new Set(mechanicGifts.map(r=>r.receiptId));
  for(const r of appendedMechanics){
   if(p2ReceiptIds.has(r.receiptId)){const receipt=r;const expected=giftPlan.get(receipt.receiptId);assert(expected,'independent P2 gift identity');assert.equal(receipt.kind,expected.kind);assert.equal(receipt.definitionId,expected.definitionId,'independent P2 gift definition');
   if(receipt.kind==='unit'){if(receipt.resolution==='gold'){assert.equal(receipt.gold,COST[receipt.definitionId]);this.gold+=receipt.gold;costs.rewards+=receipt.gold;}else{assert.equal(receipt.unitId,`unit-${serial}`);units.set(`unit-${serial++}`,{definitionId:receipt.definitionId,starLevel:1});this.cards++;}}continue;}
   if(!(['opening-encounter-batch-a','opening-batch-b','opening-encounter-monkey','conqueror','augment-kingslayer','augment-risky-moves'].includes(r.source)||independentRewards.gold.has(r.receiptId)||independentRewards.gifts.has(r.receiptId)))continue;
   const expected=independentRewards.gold.get(r.receiptId)??independentRewards.gifts.get(r.receiptId)??r;
   if(r.kind==='gold'){this.gold+=expected.amount;costs.rewards+=expected.amount;lateGold+=expected.amount;}
   else if(r.kind==='unit'&&r.resolution==='gold'){const gold=COST[expected.definitionId];this.gold+=gold;costs.rewards+=gold;lateGold+=gold;}
   else if(r.kind==='unit'&&r.resolution!=='orb'){assert.equal(r.unitId,`unit-${serial}`,'reward unit serial');units.set(`unit-${serial++}`,{definitionId:expected.definitionId,starLevel:expected.starLevel??1});this.cards+=3**((expected.starLevel??1)-1);}
  }
  // P 2026-10-24: forming consumes every owned hero once; Support Mining retires only its own dummy.
  if(command?.type==='select'&&before.pendingChoice?.kind==='augment'&&['dummify','golemify'].includes(command.definitionId)){
   for(const u of ownedUnits(before))if(COST[u.definitionId]!==undefined){this.cards-=3**(u.starLevel-1);units.delete(u.id);}
  }
  const removals=after.resourceProvenance.entries.slice(before.resourceProvenance.entries.length).filter(e=>e.kind==='unit-removed');
  for(const e of removals)if(e.definitionId===undefined){
   const a=before.augments.find(a=>e.receiptId===JSON.stringify(['augment-pool-batch3',a.choiceId,'retire-dummy']));
   assert(a&&['support-mining','support-mining-plus'].includes(a.definitionId),'independent dummy retirement owner');
   assert.equal(units.get(e.unitId)?.definitionId,'training-dummy');units.delete(e.unitId);this.cards--;
  }
  if(command?.type==='select'&&before.pendingChoice?.kind==='augment'&&command.definitionId==='im-the-carry-now')serial++;
  assert.equal(after.nextUnitSerial,serial,'unit serial accounting');
  for(const event of events.filter(e=>e.type==='unitUpgraded')){assert.equal(event.consumedIds.length,2);assert.equal(new Set([event.survivorId,...event.consumedIds]).size,3);for(const id of [event.survivorId,...event.consumedIds])assert.deepEqual(units.get(id),{definitionId:event.definitionId,starLevel:event.fromStar},'upgrade consumes actual candidate lineage');assert.equal(event.toStar,event.fromStar+1);for(const id of event.consumedIds)units.delete(id);units.set(event.survivorId,{definitionId:event.definitionId,starLevel:event.toStar});}
  assert.deepEqual(new Map(ownedUnits(after).map(u=>[u.id,{definitionId:u.definitionId,starLevel:u.starLevel}])),units,'actual player unit lineage');
  const schedule=appended(before.scheduleReceipts,after.scheduleReceipts,'eventId','schedule receipts');
  const c=before.pendingChoice,scheduled=command?.type==='select'&&['augment','anomaly','component'].includes(c?.kind)&&c.eventId===`round:${before.roundDefinitionId}:${c.kind==='component'?'supply':c.kind}`;
  const dueSchedule=[];
  if(scheduled){
   assert.equal(before.phase,'choice');assert.equal(c.step,'offer');assert.equal(command.choiceId,c.choiceId);assert.equal(command.generation,c.generation);assert(c.offers.includes(command.definitionId));
   assert(events.some(e=>e.type==='choiceSelected'&&e.choiceId===c.choiceId&&e.definitionId===command.definitionId),'schedule requires current selection event');
   const item=c.kind==='component'?command.definitionId:c.kind==='augment'?AUGMENT_ITEMS[command.definitionId]:null;
   dueSchedule.push({eventId:c.eventId,round:before.round,kind:c.kind,itemIds:item?[`item-${before.nextItemSerial}`]:[],gold:c.kind==='augment'?augmentGold(command.definitionId,before.roundDefinitionId):0,unitId:c.targetId,definitionId:command.definitionId});
   if(item)assert.equal(after.items.find(i=>i.id===`item-${before.nextItemSerial}`)?.definitionId,item,'independent schedule item identity');
  }
  assert.deepEqual(schedule,dueSchedule,'independent due schedule receipts (count, node, identity, reward)');
  if(scheduled&&command.definitionId==='forward-thinking')this.gold=0;
  for(const receipt of dueSchedule){assert(!this.receipts.has(receipt.eventId),'schedule receipt only once');this.receipts.add(receipt.eventId);this.gold+=receipt.gold;costs.rewards+=receipt.gold;}
  let itemSerial=before.nextItemSerial;
  for(const receipt of lootReceipts)for(const id of receipt.grantedItemIds)assert.equal(id,`item-${itemSerial++}`,'loot item serial');
  for(const receipt of schedule)for(const id of receipt.itemIds)assert.equal(id,`item-${itemSerial++}`,'schedule item serial');
  const mechanic=appended(before.seatMechanics?.receipts??[],after.seatMechanics?.receipts??[],'receiptId','mechanic receipts');
  const acquired=mechanic.filter(r=>r.kind==='item'||r.kind==='choice'&&r.itemId!==null);
  for(const r of acquired){assert.equal(r.itemId,`item-${itemSerial++}`,'mechanic item serial');const actual=after.items.find(i=>i.id===r.itemId);if(inventoryConversions.consumed.has(r.itemId)){assert(!actual,'converted component is consumed');continue;}assert(actual,'mechanic item exists');assert.equal(actual.definitionId,angerDefinition(r.kind==='item'?r.definitionId:r.optionId,after.augments),'mechanic item definition');}
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
  if(command?.type==='select'&&before.pendingChoice?.kind==='augment'){
   const a=after.augments.find(a=>a.definitionId===command.definitionId);
   if(command.definitionId==='magic-roll')growth={...growth,magicRoll:magicDice(after,a)};
   if(['dummify','golemify'].includes(command.definitionId)){
    let health=0,attack=0;for(const u of ownedUnits(before).filter(u=>COST[u.definitionId]!==undefined)){
     const base=FORMING_STATS[u.definitionId],star=u.starLevel-1;assert(base,'independent forming base stats');
     health+=Math.floor(base[0]*(COST[u.definitionId]===6?[100,180,360]:[100,180,324])[star]/100);
     attack+=Math.floor((base[1]*[100,150,225][star]+(COST[u.definitionId]===6?50:0))/100);
    }
    growth={...growth,forming:{...growth.forming,[command.definitionId]:{health,attack}}};
   }
  }
  assert.deepEqual(after.augmentProgress,growth,'once-only independent augment growth');
  this.combinations+=events.filter(e=>e.type==='itemCombined').length;this.check(after,true);this.h3=h3;
 }
 check(state,lootChecked=false){validateGhostCombatInputs(state);if(!lootChecked)validateLoot(state);assert.equal(state.gold,this.gold,'independent gold ledger R'+state.round+' sim='+state.gold+' ledger='+this.gold+' '+state.roundDefinitionId+' '+state.phase+' '+JSON.stringify(state.m8?.round?.kind));const units=ownedUnits(state),items=ownedItems(state);assert.equal(units.reduce((n,u)=>n+3**(u.starLevel-1),0),this.cards,'card-equivalent conservation');assert.equal(new Set(items.map(i=>i.id)).size,items.length,'unique item IDs');
  const academic=require('./augment-batch5-s3b-oracle.cjs').academicConsumed(state);
  const grants=state.scheduleReceipts.reduce((n,r)=>n+r.itemIds.length,0)+state.m8.loot.receipts.reduce((n,r)=>n+r.grantedItemIds.length,0)+(state.seatMechanics?.receipts??[]).filter(r=>r.kind==='item'||r.kind==='choice'&&r.itemId!==null).length;
  assert.equal(items.length,grants-this.combinations-buffetPlan(state).consumed.size-academic,'component/completed-item conservation');assert.equal(new Set(state.scheduleReceipts.map(r=>r.eventId)).size,state.scheduleReceipts.length,'receipt identity');assert.equal(state.nextItemSerial,1+grants+this.combinations,'item serial accounting');}
}
module.exports={benchXp,entryXp,freeRerollCredits,augmentGold,ANVIL_IDS,blackMarket,validateChemTransition,ANOMALIES,ROUNDS,roundOrdinal,CATALOG,COST,ODDS,XP,SELL,COMPONENTS,word,shop,xp,settlement,investment,lootIndex,lootPlan,validateLoot,validateLootTransition,Ledger,openingEncounter,augmentTier,augmentPool,augmentDraw,validateAugmentReroll};
Object.assign(module.exports,{createH3Ledger,checkH3Growth,h3GrowthForUnit});

// Shop stream implemented with bigint arithmetic; no runtime RNG/content imports.
function shopWord(state,parts){
 let hash=2166136261n;
 const text=JSON.stringify(['augment-pool-shop',state.multiplayer?.seatId??'solo',...parts]);
 for(let i=0;i<text.length;i++)hash=((hash^BigInt(text.charCodeAt(i)))*16777619n)%4294967296n;
 return BigInt(word(Number(BigInt(state.seed)^hash)));
}
function shopForState(state,round=state.round,subscription=false){
 const generation=state.shop.generation+1;
 if(subscription){
  let rng=state.rngState;const candidates=[...CATALOG[4]],slots=[];
  for(let i=0;i<4;i++){rng=word(rng);const j=Number(BigInt(rng)*BigInt(candidates.length)/4294967296n);slots.push({status:'available',definitionId:candidates.splice(j,1)[0]});}
  return {rngState:rng,shop:{generation,slots:[...slots,{status:'purchased',empty:true}],locked:Boolean(state.shop.locked)}};
 }
 const draw=shop(state.rngState,generation,state.level,false,round,{seed:state.augmentTierSeed,viktor:openingEncounter(state.augmentTierSeed)==='viktors-vision'});
 const rig=state.augments.find(a=>a.definitionId==='rigged-shop-plus');
 const first=state.seatMechanics?.seat['shop-augments']?.rigAnchor??generation;
 if(rig&&(generation-first)%4===0){let rng=state.rngState;draw.shop.slots=Array.from({length:5},()=>{rng=word(word(rng));return {status:'available',definitionId:CATALOG[3][Number(BigInt(rng)*BigInt(CATALOG[3].length)/4294967296n)]};});}
 const star=state.augments.find(a=>['starry-night','starry-night-plus'].includes(a.definitionId));
 const chance=starryChanceBps(state.level);
 if(star)draw.shop.slots=draw.shop.slots.map((offer,slot)=>COST[offer.definitionId]<=2&&shopWord(state,['starry',star.choiceId,generation,slot])*10000n/4294967296n<BigInt(chance)?{...offer,starLevel:2}:offer);
 return draw;
}
// Derive an entire public shop transition from pre-command inputs. No new receipt is consulted.
function shopTransition(before,command){
 const type=command?.type,entry=type==='continue',round=before.round+(entry?1:0);
 const subscription=before.augments.some(a=>a.definitionId==='subscription-service'&&a.acquiredRound<round)&&entry&&ROUNDS[round-1].sub===1;
 const acquisition=type==='select'&&before.pendingChoice?.kind==='augment'&&command.definitionId==='subscription-service';
 const dual=type==='buyXp'&&before.augments.some(a=>a.definitionId==='dual-purpose');
 let next={shop:structuredClone(before.shop),rngState:before.rngState};
 if(type==='reroll'||entry&&(!before.shop.locked||subscription)||acquisition||dual){
  const gain=entry?entryXp(before):dual?(before.augments.some(a=>a.definitionId==='level-up')?6:4):0;
  const state={...before,level:xp(before.level,before.xp,gain,xpCap(before)).level};
  next=shopForState(state,round,subscription||acquisition);
  if(type==='reroll'||dual)next.shop.locked=Boolean(before.shop.locked);
 }
 if(type==='buy')next.shop.slots[command.slot]={status:'purchased'};
 if(type==='lock')next.shop.locked=command.locked;
 if(entry){
  const a=before.augments.find(a=>a.definitionId==='firesale'&&a.acquiredRound<round);
  const open=next.shop.slots.flatMap((offer,i)=>offer.status==='available'?[i]:[]);
  if(a&&open.length){const slot=open[Number(shopWord(before,['firesale',a.choiceId,round])*BigInt(open.length)/4294967296n)];next.stolen={...next.shop.slots[slot],slot};next.shop.slots[slot]={status:'purchased'};}
 }
 return next;
}
module.exports.shopWord=shopWord;module.exports.shopForState=shopForState;module.exports.shopTransition=shopTransition;
// Shared with multiplayer room tests; amounts/recipients come from independent history inputs.
module.exports.validateScoreboardCombat=(state,input,prefix)=>checkScoreboardCombat(state,input,{COST,ROUNDS},prefix);

// P-B5-07, 2026-10-27: enumerate the twelve boundaries from caller-owned clock observations.
// No production clock facts, shop history or reward receipts determine the expected refresh count.
function shopGlitchCount(state, previousMs, elapsedMs, acquiredAt=0) {
 if (!state.augments.some(a=>a.definitionId==='shop-glitch') || state.shop.locked ||
     !['preparation','choice'].includes(state.phase) || ROUNDS[state.round-1]?.kind!=='pve') return 0;
 return Array.from({length:12},(_,i)=>acquiredAt+(i+1)*2500)
  .filter(at=>previousMs<at&&at<=elapsedMs).length;
}
function shopGlitchSolo(state, previousMs, elapsedMs, acquiredAt=0) {
 let next={shop:state.shop,rngState:state.rngState};
 for(let i=0;i<shopGlitchCount(state,previousMs,elapsedMs,acquiredAt);i++)next=shopForState({...state,...next});
 return next;
}
// Independent finite-copy draw for early PvE test routes; fail closed outside that scope.
function shopGlitchShared(pool,state,previousMs,elapsedMs,acquiredAt=0) {
 assert(state.round<=10 && state.augments.every(a=>a.definitionId==='shop-glitch'), 'early Shop Glitch oracle scope');
 const available={...pool.available};let reservations=structuredClone(pool.shops);
 let rng=state.rngState,shop=state.shop;
 const seatId=state.sharedPool.seatId;
 const pick=(entries)=>{
  rng=word(rng);const total=entries.reduce((sum,[,weight])=>sum+weight,0);
  const roll=Number(BigInt(rng)*BigInt(total)/4294967296n);
  let cumulative=0;return entries.find(([,weight])=>(cumulative+=weight)>roll)[0];
 };
 for(let n=0;n<shopGlitchCount(state,previousMs,elapsedMs,acquiredAt);n++){
  for(const r of reservations.filter(r=>r.seatId===seatId))available[r.definitionId]+=r.starLevel===2?3:1;
  reservations=reservations.filter(r=>r.seatId!==seatId);
  const generation=shop.generation+1,slots=[];
  for(let slot=0;slot<5;slot++){
   const tiers=[1,2,3,4,5].filter(t=>ODDS[state.level][t-1]>0&&CATALOG[t].some(id=>available[id]>0));
   if(!tiers.length){slots.push({status:'purchased',empty:true});continue;}
   const tier=pick(tiers.map(t=>[t,ODDS[state.level][t-1]]));
   const id=pick(CATALOG[tier].map(id=>[id,available[id]]));available[id]--;
   slots.push({status:'available',definitionId:id});reservations.push({seatId,generation,slot,definitionId:id});
  }
  shop={generation,locked:false,slots};
 }
 return {shop,rngState:rng,available,shops:reservations};
}
module.exports.shopGlitchCount=shopGlitchCount;
module.exports.shopGlitchSolo=shopGlitchSolo;
module.exports.shopGlitchShared=shopGlitchShared;
// The ledger uses the independently transcribed hero costs and equipment pool, never production receipts.
module.exports.tombRaiderPlan=state=>require('./augment-rewards-oracle.cjs').tombRaiderPlan(state,{COST});
module.exports.validateTombRaiderTransition=(before,after,command,events)=>require('./augment-rewards-oracle.cjs').validateTombRaiderTransition(before,after,command,events,{COST});

// B5-67, independent 14.24 transcription + P-B5-67. No production constants/receipts.
module.exports.madChemistExpected = function(star, abilityPower, attackSpeedBps, ticks=20) {
 const total=Number(BigInt([140,210,315,420][star-1])*BigInt(abilityPower)/100n);
 const pulses=Array.from({length:10},(_,i)=>Math.floor(total*(i+1)/10)-Math.floor(total*i/10));
 return {total,pulses,mana:Number(BigInt(attackSpeedBps)*10n*BigInt(ticks)/200000n)};
};

// P-B5-08/09, user 2026-10-28: levels 1/2 restore v24 18%; independent transcription, no content imports.
function starryChanceBps(level){return [1800,1800,1800,2000,2200,2500,3000,5000,8000,10000][level-1];}
module.exports.starryChanceBps=starryChanceBps;
// Finite-pool Starry Night shop oracle, from pre-draw stock (old offers already returned).
// Deliberately scoped to pre-stage-4 shops, where six-cost replacement is zero.
function starrySharedShop(state,stock){
 assert(state.round<=17,'Starry oracle fixture is before stage 4');
 const available={...stock},slots=[],generation=state.shop.generation+1;
 const a=state.augments.find(x=>['starry-night','starry-night-plus'].includes(x.definitionId));
 let rng=state.rngState;
 const pick=(w,n)=>Number(BigInt(w)*BigInt(n)/4294967296n);
 for(let slot=0;slot<5;slot++){
  const tiers=[1,2,3,4,5].filter(t=>ODDS[state.level][t-1]>0&&CATALOG[t].some(id=>available[id]>0));
  if(!tiers.length){slots.push({status:'purchased',empty:true});continue;}
  rng=word(rng);let roll=pick(rng,tiers.reduce((n,t)=>n+ODDS[state.level][t-1],0));
  const tier=tiers.find(t=>{if(roll<ODDS[state.level][t-1])return true;roll-=ODDS[state.level][t-1];return false;});
  rng=word(rng);let copy=pick(rng,CATALOG[tier].reduce((n,id)=>n+(available[id]??0),0));
  const id=CATALOG[tier].find(id=>{if(copy<(available[id]??0))return true;copy-=available[id]??0;return false;});
  const hit=a&&tier<=2&&shopWord(state,['starry',a.choiceId,generation,slot])*10000n/4294967296n<BigInt(starryChanceBps(state.level));
  const star=hit&&available[id]>=3;available[id]-=star?3:1;
  slots.push({status:'available',definitionId:id,...(star?{starLevel:2}:{})});
 }
 return {rngState:rng,shop:{generation,slots,locked:Boolean(state.shop.locked)},available};
}
module.exports.starrySharedShop=starrySharedShop;

// Finite-pool B5 prediction accepts only the pre-transaction stock. Production receipts are never inputs.
module.exports.batch5TransformPlan=(before,augmentId,stock)=>require('./augment-rewards-oracle.cjs').batch5Transforms(before,augmentId,stock,COST);

module.exports.luckyGlovesPair=require('./lucky-gloves-oracle.cjs').pair;
module.exports.validateLuckyGlovesEquipment=require('./lucky-gloves-oracle.cjs').validate;

module.exports.ghostFriendsGrowth=require('./augment-rewards-oracle.cjs').ghostFriendsGrowth;
module.exports.rebelCopyStats=require('./augment-rewards-oracle.cjs').rebelCopyStats;
module.exports.rebelCopyDeaths=require('./augment-rewards-oracle.cjs').rebelCopyDeaths;
// P-B5-72 (2026-10-27): independent literal arithmetic, never production receipts.
module.exports.voidcallerModel=function(costs){let remainder=0,summoned=0;for(const cost of costs){remainder+=cost;while(remainder>=275){remainder-=275;if(summoned<5)summoned++;}}return {remainder,summoned};};

module.exports.voidSwarmPortals=function(completed,acquiredRound){return 1+Math.floor(completed.filter(r=>r.round>=acquiredRound&&r.roundKind==='pvp').length/11);};
