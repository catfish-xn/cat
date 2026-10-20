/*
 * S13 (14.24) augment icons, downloaded from the CommunityDragon 14.24 mirror (Riot Games assets,
 * free non-commercial fan use; see README). Icon paths come from the archived client data
 * (src/simulation/content/source/s13-14.24b/raw/en_us.json.gz). Kept apart from the
 * generated s13-asset-manifest.ts so the shared fetch script output is untouched.
 *
 * Asset checks: `bytes` and `sha256` are the length and SHA-256 of the PNG as bundled under public/<path>, and equal the
 * original file at `source`. CommunityDragon sits behind Cloudflare Polish, which may answer a plain request with a
 * recompressed copy (smaller, different hash; the `cf-polished: orig_size=` header gives the original length), so
 * re-download with a cache-busting query string before comparing. tests/presentation/g2-3-display.test.ts recomputes
 * both values from disk. Placebo and Placebo+ share one client icon (Placebo_I.TFT_Set12), hence identical rows.
 */
export interface S13AugmentAsset { readonly apiName: string; readonly id: string; readonly path: string; readonly source: string; readonly bytes: number; readonly sha256: string }
export const S13_AUGMENT_ASSETS: readonly S13AugmentAsset[] = [
  {
    "apiName": "TFT_Augment_Placebo",
    "id": "placebo",
    "path": "assets/s13/augments/placebo.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/placebo_i.tft_set12.png",
    "bytes": 7801,
    "sha256": "8c26ef75ca2bf9f05368122db2727ecfe78621790fb9796733a70024e63cfd2b"
  },
  {
    "apiName": "TFT_Augment_Manaflow1",
    "id": "manaflow-i",
    "path": "assets/s13/augments/manaflow-i.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/manaflow_i.tft_set13.png",
    "bytes": 6356,
    "sha256": "674df0da6852cccde52c9109b43c49fc5e03c5eebdbc7d9b50c2b5dd493add25"
  },
  {
    "apiName": "TFT_Augment_GlassCannonI",
    "id": "glass-cannon-i",
    "path": "assets/s13/augments/glass-cannon-i.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/glasscannon_i.tft_set13.png",
    "bytes": 7409,
    "sha256": "c25d0bcb23424ccec4580a7f33111ba80763a415f2948abb60f31d708226d8a6"
  },
  {
    "apiName": "TFT9_Augment_PumpingUp",
    "id": "pumping-up-i",
    "path": "assets/s13/augments/pumping-up-i.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/pumping-up-i.png",
    "bytes": 7337,
    "sha256": "5307d839102d70a796f2555827b38b20699d47871ebf44b319961a93920a1aab"
  },
  {
    "apiName": "TFT_Augment_InvestmentStrategy1",
    "id": "investment-strategy-i",
    "path": "assets/s13/augments/investment-strategy-i.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/investmentstrategy_ii.tft_set13.png",
    "bytes": 8171,
    "sha256": "5b41101982cae770df00d977cc7cd1ef72cfbd3b2297aea375bb451a7adf4dd2"
  },
  {
    "apiName": "TFT_Augment_BulkyBuddies1",
    "id": "bulky-buddies-i",
    "path": "assets/s13/augments/bulky-buddies-i.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/bulkybuddies_i.tft_set13.png",
    "bytes": 8084,
    "sha256": "ed9675e2cd02c911cf83726acc2e6213083794f5136d84dd67f3068b93b31bb5"
  },
  {
    "apiName": "TFT_Augment_Manaflow2",
    "id": "manaflow-ii",
    "path": "assets/s13/augments/manaflow-ii.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/manaflow_ii.tft_set13.png",
    "bytes": 6441,
    "sha256": "029c3c6d4b32310859738e49040127cddbd5b3917d6e5a749d126174c9f74f66"
  },
  {
    "apiName": "TFT_Augment_GlassCannonII",
    "id": "glass-cannon-ii",
    "path": "assets/s13/augments/glass-cannon-ii.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/glasscannon_ii.tft_set13.png",
    "bytes": 7490,
    "sha256": "cd4ee2c05bca275ad8d4fd4ddf5c91e2d27d11321e3cd150bbac810ce6ec3b11"
  },
  {
    "apiName": "TFT9_Augment_PumpingUp2",
    "id": "pumping-up-ii",
    "path": "assets/s13/augments/pumping-up-ii.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/pumping-up-ii.png",
    "bytes": 7511,
    "sha256": "b0c6f763ee51612b015583bc8d33e3826fb4a00876f1ac4a756a2cf843f6bbdf"
  },
  {
    "apiName": "TFT9_Augment_PumpingUp3",
    "id": "pumping-up-iii",
    "path": "assets/s13/augments/pumping-up-iii.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/pumping-up-iii.png",
    "bytes": 8091,
    "sha256": "4269d13f549659c46796cba3b42d78363664b886f317cdeac00a61fa705b9cfd"
  },
  {
    "apiName": "TFT_Augment_BulkyBuddies2",
    "id": "bulky-buddies-ii",
    "path": "assets/s13/augments/bulky-buddies-ii.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/bulkybuddies_ii.tft_set13.png",
    "bytes": 8079,
    "sha256": "6acbdd65a10dd62b2aa8376b3a45996f0d040c8a53465c096405515c31cd04a4"
  },
  {
    "apiName": "TFT_Augment_BulkyBuddies3",
    "id": "bulky-buddies-iii",
    "path": "assets/s13/augments/bulky-buddies-iii.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/bulkybuddies_iii.tft_set13.png",
    "bytes": 8629,
    "sha256": "dccd6944e19afec8553496d68eea4b7144a9f4235294cabfd607d208a64dd460"
  },
  {
    "apiName": "TFT_Augment_PlaceboPlus",
    "id": "placebo-plus",
    "path": "assets/s13/augments/placebo-plus.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/placebo_i.tft_set12.png",
    "bytes": 7801,
    "sha256": "8c26ef75ca2bf9f05368122db2727ecfe78621790fb9796733a70024e63cfd2b"
  },
  {
    "apiName": "TFT_Augment_Mentorship1",
    "id": "mentorship-i",
    "path": "assets/s13/augments/mentorship-i.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/mentorship-i.png",
    "bytes": 8027,
    "sha256": "2ccebeab46f833d686f941f5d18bedb21982b2afc5e764ac93a83805288fa89b"
  },
  {
    "apiName": "TFT_Augment_Mentorship2",
    "id": "mentorship-ii",
    "path": "assets/s13/augments/mentorship-ii.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/mentorship-ii.png",
    "bytes": 8217,
    "sha256": "359abe7cdfb01d41a09c6a90327e452c80fef434130313458d86cfeca7872640"
  },
  {
    "apiName": "TFT_Augment_ItemCollector1",
    "id": "item-collector-i",
    "path": "assets/s13/augments/item-collector-i.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/itemcollector_i.tft_set12.png",
    "bytes": 7739,
    "sha256": "0013e42b8251b1d0b29d4795fd5cd942dece34086caf886ba9c5de4f54d5149e"
  },
  {
    "apiName": "TFT_Augment_ItemCollector2",
    "id": "item-collector-ii",
    "path": "assets/s13/augments/item-collector-ii.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/itemcollector_ii.tft_set12.png",
    "bytes": 7820,
    "sha256": "27b8d91868188a38ad1c87345523682a42fc229a200461f84c44d46e5a086763"
  },
  {
    "apiName": "TFT_Augment_BronzeForLifeI",
    "id": "bronze-for-life-i",
    "path": "assets/s13/augments/bronze-for-life-i.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/bronzeforlife_ii.tft_set13.png",
    "bytes": 9535,
    "sha256": "30a2184002eff2d531bc7bce0d4aa1aa08c7da903c74ba5a61d9fad70ce10590"
  },
  {
    "apiName": "TFT_Augment_BronzeForLife2",
    "id": "bronze-for-life-ii",
    "path": "assets/s13/augments/bronze-for-life-ii.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/bronzeforlife_iii.tft_set13.png",
    "bytes": 10114,
    "sha256": "58aeb89777c2d0aaf0cfe832a0cfb27e29477044a66f8a867a0a6a13c9e00c5d"
  },
  {
    "apiName": "TFT10_Augment_LittleBuddies",
    "id": "little-buddies",
    "path": "assets/s13/augments/little-buddies.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/little-buddies-ii.png",
    "bytes": 7985,
    "sha256": "633760dc2151d2d04d8ee1da34c2ecfc07a3ef89ba473bdb7e47bce07b0143cf"
  },
  {
    "apiName": "TFT_Augment_Backup",
    "id": "backup",
    "path": "assets/s13/augments/backup.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/backup-i.png",
    "bytes": 7571,
    "sha256": "90549d130cff4b2217f870985f60f53ba653f31c242d1bd674776b4ed150d375"
  },
  {
    "apiName": "TFT_Augment_Lineup",
    "id": "lineup",
    "path": "assets/s13/augments/lineup.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/lineup-i.png",
    "bytes": 7902,
    "sha256": "a87ecb25d204dc1799d872b81344733be97017bc58201a79d4b32272f3ddf5ad"
  },
  {
    "apiName": "TFT_Augment_FindYourCenter",
    "id": "find-your-center",
    "path": "assets/s13/augments/find-your-center.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/findyourcenter_i.tft_set12.png",
    "bytes": 6561,
    "sha256": "8df5476cbaae760d9f361795d3b2707b574483d7ceb7d2554471ca8647fa4e23"
  },
  {
    "apiName": "TFT6_Augment_Traitless2",
    "id": "built-different",
    "path": "assets/s13/augments/built-different.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/builtdifferent2.png",
    "bytes": 7114,
    "sha256": "fcd1d5d670211d66b1d66b1479934b317a1563b96bc19498ca26f44d9ccbf1a8"
  },
  {
    "apiName": "TFT9_Augment_RedBuff",
    "id": "blistering-strikes",
    "path": "assets/s13/augments/blistering-strikes.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/red-buff-i.png",
    "bytes": 7609,
    "sha256": "2e35371f3b7c0db7446fb48f2ac1e9e4426891b21fbefc9d6ba3fe127cf2a931"
  },
  {
    "apiName": "TFT_Augment_ClockworkAccelerator",
    "id": "clockwork-accelerator",
    "path": "assets/s13/augments/clockwork-accelerator.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/clockworkaccelerator_ii.tft_set12.png",
    "bytes": 7615,
    "sha256": "17619f50fef7f9378d364b705f8e460bf396b45345a5034c176cbad9f866c98f"
  },
  {
    "apiName": "TFT_Augment_LoneHero",
    "id": "lone-hero",
    "path": "assets/s13/augments/lone-hero.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/lonesurvivor_i.tft_set13.png",
    "bytes": 7198,
    "sha256": "11989200cefdcf3d5c46237501bb8f0026df64ad609a283585022cbf1aafbacc"
  },
  {
    "apiName": "TFT_Augment_ClimbTheLadder1",
    "id": "climb-the-ladder-i",
    "path": "assets/s13/augments/climb-the-ladder-i.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/climbtheladder_i.tft_set13.png",
    "bytes": 7656,
    "sha256": "a08e815367c9f1eb670a884d52204c15ca2b235a3b75be60991aa36ac4813bde"
  },
  {
    "apiName": "TFT_Augment_ClimbTheLadder2",
    "id": "climb-the-ladder-ii",
    "path": "assets/s13/augments/climb-the-ladder-ii.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/climbtheladder_ii.tft_set13.png",
    "bytes": 7482,
    "sha256": "e6ec7a88e6c2ccb719cc9e6f0e9498b77b147a5bbe711e06cfa48b2cc07f66a0"
  },
  {
    "apiName": "TFT10_Augment_InspiringEpitaph",
    "id": "inspiring-epitaph",
    "path": "assets/s13/augments/inspiring-epitaph.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/inspiring-epitaph-ii.png",
    "bytes": 7697,
    "sha256": "0dcd0aeb6086dbafedebb673aca5c667fa1a08b858800a73476a74be8bdad35c"
  },
  {
    "apiName": "TFT9_Augment_BlindingSpeed",
    "id": "blinding-speed",
    "path": "assets/s13/augments/blinding-speed.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/berserk-iii.png",
    "bytes": 6583,
    "sha256": "54f0bc25ea73c0c40a40c709210fa5a872f72877ff215475ca5e2d588fcc2d37"
  },
  {
    "apiName": "TFT6_Augment_PortableForge",
    "id": "portable-forge",
    "path": "assets/s13/augments/portable-forge.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/portableforge2.png",
    "bytes": 6253,
    "sha256": "574d213e108a779952653f9c40c32903f2ba224a25c6a053af7449e6e58e002c"
  },
  {
    "apiName": "TFT6_Augment_RadiantRelics",
    "id": "radiant-relics",
    "path": "assets/s13/augments/radiant-relics.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/radiantrelic-iii.png",
    "bytes": 10930,
    "sha256": "d7b42a09596301a4ef8a80220566ef1dd30946a1bf37b14ddee88ca5822b5ccc"
  },
  {
    "apiName": "TFT10_Augment_GoingLong",
    "id": "going-long",
    "path": "assets/s13/augments/going-long.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/going-long-iii.png",
    "bytes": 8912,
    "sha256": "0e3977e8c549e258a2be340898898717697f7a007c9724992a49864770a49b81"
  },
  {
    "apiName": "TFT9_Augment_HedgeFund",
    "id": "hedge-fund",
    "path": "assets/s13/augments/hedge-fund.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/richgetricher3.png",
    "bytes": 11238,
    "sha256": "2ce8335784c43a420be4fb025c2e2b54894439ecbfb13b979269f9a3c8bfddcd"
  },
  {
    "apiName": "TFT_Augment_InvestmentStrategy2",
    "id": "investment-strategy-ii",
    "path": "assets/s13/augments/investment-strategy-ii.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/investmentstrategy_iii.tft_set13.png",
    "bytes": 9062,
    "sha256": "03a025fe61978771ed74c115e88d64bc7eb2b140c258a3384ab8c6fe43e801fb"
  },
  {
    "apiName": "TFT10_Augment_CrownGuarded",
    "id": "crown-guarded",
    "path": "assets/s13/augments/crown-guarded.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/crown-guarded-ii.png",
    "bytes": 7942,
    "sha256": "ddf078bb93c03b57ef5ef7caef77dfa0b7fe8234047070be0165ad6be4fa5acc"
  },
  {
    "apiName": "TFT9_Augment_NotToday",
    "id": "not-today",
    "path": "assets/s13/augments/not-today.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/not-today-ii.png",
    "bytes": 9066,
    "sha256": "edc5560ef978b641f2a20e88ef8c515e8d404b5b2e5bd7b6b7223a1c4dd39f20"
  },
  {
    "apiName": "TFT_Augment_AllForOneII",
    "id": "all-for-one-ii",
    "path": "assets/s13/augments/all-for-one-ii.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/allforone_ii.tft_set13.png",
    "bytes": 9188,
    "sha256": "d8b4d8fa2d0256a90483baed4fd9c608231e7cfe5ffe62dfcab2055c54c724b5"
  },
  {
    "apiName": "TFT_Augment_BeltOverflow",
    "id": "belt-overflow",
    "path": "assets/s13/augments/belt-overflow.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/beltoverflow_iii.tft_set13.png",
    "bytes": 8118,
    "sha256": "52c8191673860503446cf46bc262b06ffd15cf9ab0d2934489a3eae0c00dcd54"
  },
  {
    "apiName": "TFT_Augment_CalculatedEnhancement",
    "id": "calculated-enhancement",
    "path": "assets/s13/augments/calculated-enhancement.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/calculatedenhancement_iii.tft_set13.png",
    "bytes": 8891,
    "sha256": "db0d55eba3ab96d7f4f1cca319d32fbcda4815dd03ed65032d42773df3856efc"
  },
  {
    "apiName": "TFT_Augment_CrownguardSpirit",
    "id": "crownguard-spirit",
    "path": "assets/s13/augments/crownguard-spirit.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/will-of-the-crown-ii.png",
    "bytes": 8458,
    "sha256": "adb982ed68fe1b46511591813af4b391abaf06f6fa92941284c57ae52f1242ae"
  },
  {
    "apiName": "TFT_Augment_FlurryOfBlows",
    "id": "flurry-of-blows",
    "path": "assets/s13/augments/flurry-of-blows.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/flurryofblows_iii.tft_set13.png",
    "bytes": 9993,
    "sha256": "642050b85c91e80ded524d9fe15afafdd06d81f4dafc2241c4628b0bbb7dc06c"
  },
  {
    "apiName": "TFT_Augment_GuardbreakerSpirit",
    "id": "guardbreaker-spirit",
    "path": "assets/s13/augments/guardbreaker-spirit.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/will-of-the-flail-ii.png",
    "bytes": 8153,
    "sha256": "158681ceef621daa43f73bbcbe9606fd6155ac29a2305fbd73b6e3a9f7ee7729"
  },
  {
    "apiName": "TFT_Augment_PairOfFours",
    "id": "pair-of-fours",
    "path": "assets/s13/augments/pair-of-fours.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/pairoffours_ii.tft_set13.png",
    "bytes": 7860,
    "sha256": "663837d041a3705c85ea8420236cbf6773e945e74fde2643cbeb92f4fa200d89"
  },
  {
    "apiName": "TFT_Augment_RanduinsImmovableObject",
    "id": "immovable-object",
    "path": "assets/s13/augments/immovable-object.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/randuinsimmovableobject_iii.tft_set12.png",
    "bytes": 9995,
    "sha256": "a93091b4634c2a98c149c0af6f5bfd4c9124a16d65dd29af56a9aa6415208ae5"
  },
  {
    "apiName": "TFT_Augment_ShojinSpirit",
    "id": "shojin-spirit",
    "path": "assets/s13/augments/shojin-spirit.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/will-of-the-spear-ii.png",
    "bytes": 8059,
    "sha256": "29ca0250970291afbdf866e241cb365f81234c1999f4f35059cb7d791adc72a5"
  },
  {
    "apiName": "TFT_Augment_SwordOverflow",
    "id": "sword-overflow",
    "path": "assets/s13/augments/sword-overflow.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/bladeoverflow_iii.tft_set13.png",
    "bytes": 11350,
    "sha256": "4a12962d99603b100f5d237683061e74d91ed3dab1ad06792e44bf56425c4dd6"
  },
  {
    "apiName": "TFT_Augment_Trifecta2",
    "id": "trifecta-ii",
    "path": "assets/s13/augments/trifecta-ii.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/trifecta-iii.png",
    "bytes": 8930,
    "sha256": "99ce9ee4f8607b8017a16b4d57a9be313e0e56763b52bfbef96c8700d6e93ff2"
  },
  {
    "apiName": "TFT_Augment_WandOverflow",
    "id": "wand-overflow",
    "path": "assets/s13/augments/wand-overflow.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/wandoverflow_iii.tft_set13.png",
    "bytes": 10019,
    "sha256": "49f33fa370bec648cf55bbd8f80604b32699e0ea5fc069351113fd201de10197"
  },
  {
    "apiName": "TFT_Augment_DefenseCall",
    "id": "defense-call",
    "path": "assets/s13/augments/defense-call.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/defensive-call-ii.png",
    "bytes": 8361,
    "sha256": "722e9f18a3c55e088a7e7f026667c41dcbf8351e359be29d629989f6c9a8ce7c"
  },
  {
    "apiName": "TFT_Augment_HighVoltage",
    "id": "high-voltage",
    "path": "assets/s13/augments/high-voltage.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/highvoltage_ii.tft_set12.png",
    "bytes": 10088,
    "sha256": "f0a395761d3c2b262348947d9435bab5172230300c8f58eac79bdd7b03cfca36"
  },
  {
    "apiName": "TFT_Augment_PiercingLotus1",
    "id": "piercing-lotus-i",
    "path": "assets/s13/augments/piercing-lotus-i.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/piercing-lotus-ii.png",
    "bytes": 7676,
    "sha256": "2b29d0930b5356a65665bca40f605e7463c489a8ccf56d3171d92cd82613f544"
  },
  {
    "apiName": "TFT_Augment_PiercingLotus2",
    "id": "piercing-lotus-ii",
    "path": "assets/s13/augments/piercing-lotus-ii.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/piercing-lotus-iii.png",
    "bytes": 8269,
    "sha256": "cc0f27b6b81ca7c877b2e55d780ff4acf9ee519a8cc5d96a5c09724d94e6a310"
  },
  {
    "apiName": "TFT_Augment_Pyromaniac",
    "id": "pyromaniac",
    "path": "assets/s13/augments/pyromaniac.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/pyromaniac_ii.tft_set13.png",
    "bytes": 8953,
    "sha256": "b11ed634ddb925f23bd4dced855580bd03bc86cf11a091fc56b2c694e254bd34"
  },
  {
    "apiName": "TFT_Augment_ThornPlatedArmor",
    "id": "thorn-plated-armor",
    "path": "assets/s13/augments/thorn-plated-armor.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/thornplatedarmor_ii.tft_set12.png",
    "bytes": 10353,
    "sha256": "c0e59e05e487e9d4ceb0fd74d12ca537ecba5b72fc0bc7ab31714ca962c60fac"
  },
  {
    "apiName": "TFT_Augment_UnleashTheBeast",
    "id": "unleash-the-beast",
    "path": "assets/s13/augments/unleash-the-beast.png",
    "source": "https://raw.communitydragon.org/14.24/game/assets/maps/tft/icons/augments/hexcore/unleashthebeast_ii.tft_set12.png",
    "bytes": 10592,
    "sha256": "e6c2bc012db3965c8c0cb7738ab0a60a8f0fb0a7d25d10fcb369ef82cc64bfa0"
  }
];
