/**
 * Explicit ranks for skill cast-starts (Fable 11-19, from the 61-row review of cast-starts the old rule ranked by length):
 * 'body' for a cast-start that draws the skill itself (a swipe, a beam, a shield, a transformation, an area, a mark), which
 * nothing short of a hit or a projectile may end on a full board; 'decorative' for a muzzle flash, hand glow, charge dust
 * or trail, which a plain attack or a place's run may end. Keyed by skill branch, then system. Only the label changes:
 * how each rank is admitted or yields is effect-budget.ts / runtime.ts, unchanged. Applied to cast-start cues only.
 */
export const CAST_START_RANKS: Readonly<Record<string, Readonly<Record<string, 'body' | 'decorative'>>>> = {
  // 3381c8eb Q_activation
  'draven': { '3381c8eb': 'decorative' },
  // 2ef508db Q_Flamethrower_NonUpgraded_Cast
  'sevika-flamethrower': { '2ef508db': 'decorative' },
  // 42ceec5b ExtendoArm_Woosh, 0badab98 ExtendoArm_Spring
  'sevika-punch': { '42ceec5b': 'body', '0badab98': 'body' },
  // 91985f5e Q_Jackpot_Fountain
  'sevika-jackpot': { '91985f5e': 'body' },
  // 91985f5e Q_Jackpot_Fountain (the same system)
  'sevika-coin': { '91985f5e': 'body' },
  // 3eab3582 P_Stack
  'mel-energy': { '3eab3582': 'decorative' },
  // 2b8d0d85 Q_Charge_Cast
  'g23-sion': { '2b8d0d85': 'body' },
  // 5afb9708 Cabal_SionUnleash_Cas, 9118f221 Sion_Base_Unleash_Cas
  'g23-sion-unbind': { '5afb9708': 'body', '9118f221': 'body' },
  // e4185048 Ranged_buf
  'elise-spider': { 'e4185048': 'body' },
  // 704b3ed3 R_RelicFlash, deeb59f2 R_Cas_Dust
  'illaoi': { '704b3ed3': 'decorative', 'deeb59f2': 'decorative' },
  // aca297da R_impact
  'illaoi-slam': { 'aca297da': 'body' },
  // 796b6af2 R_PowerUp
  'swain-front': { '796b6af2': 'body' },
  // 6b3b977c Q_Stab_Child
  'rell': { '6b3b977c': 'body' },
  // e22b48b0 Q_Shield_Activate_1
  'loris': { 'e22b48b0': 'body' },
  // 2f1f3b60 Q_AOE
  'loris-retaliation': { '2f1f3b60': 'body' },
  // 754b6c78 R_Energy_Windup, a429a900 R_Cas_Dust, 6390530e R_Hurl_Swipe, 3b4c15e0 Q_ChainSwipe
  'ambessa': { '754b6c78': 'decorative', 'a429a900': 'decorative', '6390530e': 'body', '3b4c15e0': 'body' },
  // 006b32b1 R_Mark
  'ekko': { '006b32b1': 'body' },
  // c44d51d0 W_Cas
  'heimerdinger': { 'c44d51d0': 'decorative' },
  // 7562ce09 R_cas_rocket_Child
  'rumble': { '7562ce09': 'decorative' },
  // 17b8eb5c Z_Jump_Launch, 16749c2e Z_Swipe_Diagonal, 343e410d Z_Swipe_Horizontal, 73020613 Z_Swipe_Dual, 90b31f27 Z_Swipe_vertical
  'smeech': { '17b8eb5c': 'decorative', '16749c2e': 'body', '343e410d': 'body', '73020613': 'body', '90b31f27': 'body' },
  // 8740c168 W_Cas
  'twistedfate': { '8740c168': 'body' },
  // 8de271f2 Q_Cas
  'zoe': { '8de271f2': 'decorative' },
  // cb30a8ce cas_spider, cd8de747 Cocoon_Heal_tar
  'elise-front': { 'cb30a8ce': 'decorative', 'cd8de747': 'body' },
  // ea21ae27 R_Shield, 5bbccb8c R_AoE_Impact
  'garen': { 'ea21ae27': 'body', '5bbccb8c': 'body' },
  // 7d4c2d45 R_cas
  'tristana': { '7d4c2d45': 'decorative' },
  // ce2a567b R_Cas, 4ecddce4 R_Scope_Hologram
  'caitlyn': { 'ce2a567b': 'decorative', '4ecddce4': 'body' },
  // 04ae533c Q_Mace_Charge, 5449dd85 E_HandGlow, 0a5d1c08 E_HandTrail
  'mordekaiser': { '04ae533c': 'decorative', '5449dd85': 'decorative', '0a5d1c08': 'decorative' },
  // b0db024b Q_2_cas, 14e5f3aa Q_2_cas_child
  'camille': { 'b0db024b': 'body', '14e5f3aa': 'body' },
  // 54af463f R_cas
  'twitch': { '54af463f': 'decorative' },
  // f7d4d344 E_cas
  'sett': { 'f7d4d344': 'body' },
  // d900f5b3 E_Run_Dust, 1edf4c0e E_Dash_Dust
  'akali': { 'd900f5b3': 'decorative', '1edf4c0e': 'decorative' },
  // 6d06c644 Q_CAS_HandTrail
  'malzahar': { '6d06c644': 'decorative' },
  // 11416b6c W_Cas, bc884cd6 Q_cas
  'ezreal': { '11416b6c': 'decorative', 'bc884cd6': 'decorative' },
  // a7efa545 Q_Ring_Windup
  'darius': { 'a7efa545': 'body' },
  // cff69d8a E_Cas_Center
  'renata': { 'cff69d8a': 'body' },
  // e4b6f1a3 W_Water_spell
  'nami': { 'e4b6f1a3': 'body' },
  // a6a2b1cc W_Cas, 449d6617 R_MuzzleFlash
  'jinx': { 'a6a2b1cc': 'decorative', '449d6617': 'decorative' },
  // 2143d86a R_Cast_Dust
  'jayce-front': { '2143d86a': 'decorative' },
  // 508e8c05 R_Ranged_Recall_BuildUp, e5c0f9d8 R_Ranged_Recall_Blast_Cast
  'jayce-back': { '508e8c05': 'decorative', 'e5c0f9d8': 'body' },
  // 9f8fe9f1 W_dash, e75b9fe8 Q_cas
  'mel': { '9f8fe9f1': 'body', 'e75b9fe8': 'decorative' },
};

/**
 * The generic basic-attack hit (TFT_Global_BA_Hit, 0f2af66b) holds its run, and so a system slot and its particle room, only
 * as long as its own flash and sparks show (Fable 11-19): it played 1.5 s per hit while its particles were long gone by
 * then, so on a busy board the hits filled the room plain attacks may use and the next hits were dropped. Our own
 * value, not the original's: it ends past the system's longest particle, so the run's closing fade (runtime.ts) never cuts
 * the flash short. A cue already shorter keeps its own length.
 */
export const ATTACK_HIT_SYSTEM = '0f2af66b';
export const ATTACK_HIT_SECONDS = 0.7;
