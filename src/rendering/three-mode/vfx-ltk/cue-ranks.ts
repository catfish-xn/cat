/**
 * Explicit ranks for skill cast-starts (Fable 11-19, from the review of cast-starts the old rule ranked by length):
 * 'body' for a cast-start that draws the skill itself (a swipe, a beam, a shield, a transformation, an area, a mark), which
 * nothing short of a hit or a projectile may end on a full board; 'decorative' for a muzzle flash, hand glow, charge dust
 * or trail, which a plain attack or a place's run may end. Keyed by skill branch, then system. Only the label changes:
 * how each rank is admitted or yields is effect-budget.ts / runtime.ts, unchanged. Applied to cast-start cues only.
 */
export const CAST_START_RANKS: Readonly<Record<string, Readonly<Record<string, 'body' | 'decorative'>>>> = {
  // Draven: spinning-axe cast glow
  'draven': { '3381c8eb': 'decorative' },
  // Sevika flamethrower: cast flash
  'sevika-flamethrower': { '2ef508db': 'decorative' },
  // Sevika punch: arm whoosh and spring
  'sevika-punch': { '42ceec5b': 'body', '0badab98': 'body' },
  // Sevika jackpot: coin fountain
  'sevika-jackpot': { '91985f5e': 'body' },
  // Sevika coin: the same coin fountain
  'sevika-coin': { '91985f5e': 'body' },
  // Mel energy: stack glow
  'mel-energy': { '3eab3582': 'decorative' },
  // Sion: charge-up
  'g23-sion': { '2b8d0d85': 'body' },
  // Sion unbound: two cast bursts
  'g23-sion-unbind': { '5afb9708': 'body', '9118f221': 'body' },
  // Elise spider form: buff aura
  'elise-spider': { 'e4185048': 'body' },
  // Illaoi: cast flash and dust
  'illaoi': { '704b3ed3': 'decorative', 'deeb59f2': 'decorative' },
  // Illaoi slam: impact
  'illaoi-slam': { 'aca297da': 'body' },
  // Swain: power-up
  'swain-front': { '796b6af2': 'body' },
  // Rell: lance stab
  'rell': { '6b3b977c': 'body' },
  // Loris: shield
  'loris': { 'e22b48b0': 'body' },
  // Loris retaliation: area
  'loris-retaliation': { '2f1f3b60': 'body' },
  // Ambessa: wind-up glow, cast dust, hurl swipe, chain swipe
  'ambessa': { '754b6c78': 'decorative', 'a429a900': 'decorative', '6390530e': 'body', '3b4c15e0': 'body' },
  // Ekko: mark
  'ekko': { '006b32b1': 'body' },
  // Heimerdinger: cast flash
  'heimerdinger': { 'c44d51d0': 'decorative' },
  // Rumble: rocket cast flash
  'rumble': { '7562ce09': 'decorative' },
  // Smeech: jump-off dust on his cast; his vertical swipe plays with each stab (cue-overrides.ts CUE_EXTRA_SKILLS smeech-stab)
  'smeech': { '17b8eb5c': 'decorative' },
  'smeech-stab': { '90b31f27': 'body' },
  // Twisted Fate: card cast
  'twistedfate': { '8740c168': 'body' },
  // Zoe: cast flash
  'zoe': { '8de271f2': 'decorative' },
  // Elise: spider cast flash, cocoon heal
  'elise-front': { 'cb30a8ce': 'decorative', 'cd8de747': 'body' },
  // Garen: shield, area impact
  'garen': { 'ea21ae27': 'body', '5bbccb8c': 'body' },
  // Tristana: cast flash
  'tristana': { '7d4c2d45': 'decorative' },
  // Caitlyn: cast flash, scope hologram
  'caitlyn': { 'ce2a567b': 'decorative', '4ecddce4': 'body' },
  // Mordekaiser: mace charge, hand glow, hand trail
  'mordekaiser': { '04ae533c': 'decorative', '5449dd85': 'decorative', '0a5d1c08': 'decorative' },
  // Camille: second-hit cast (two layers)
  'camille': { 'b0db024b': 'body', '14e5f3aa': 'body' },
  // Twitch: cast flash
  'twitch': { '54af463f': 'decorative' },
  // Sett: cast
  'sett': { 'f7d4d344': 'body' },
  // Akali: run dust, dash dust
  'akali': { 'd900f5b3': 'decorative', '1edf4c0e': 'decorative' },
  // Malzahar: hand trail
  'malzahar': { '6d06c644': 'decorative' },
  // Ezreal: two cast flashes
  'ezreal': { '11416b6c': 'decorative', 'bc884cd6': 'decorative' },
  // Darius: ring wind-up
  'darius': { 'a7efa545': 'body' },
  // Renata: area centre
  'renata': { 'cff69d8a': 'body' },
  // Nami: water spell
  'nami': { 'e4b6f1a3': 'body' },
  // Jinx: cast flash, muzzle flash
  'jinx': { 'a6a2b1cc': 'decorative' },
  // Her rocket's muzzle flash plays when the rocket leaves (11-21, 'jinx-rocket-fire', batch2-bridge.ts).
  'jinx-rocket-fire': { '449d6617': 'decorative' },
  // Jayce front form: cast dust
  'jayce-front': { '2143d86a': 'decorative' },
  // Jayce back form: build-up, blast
  'jayce-back': { '508e8c05': 'decorative', 'e5c0f9d8': 'body' },
  // Mel: dash, cast flash
  'mel': { '9f8fe9f1': 'body', 'e75b9fe8': 'decorative' },
};

/**
 * The generic basic-attack hit (0f2af66b) holds its run, and so a system slot and its particle room, only as long as its
 * own flash and sparks show (Fable 11-19): its run used to last well past the point its particles were gone, so on a busy
 * board the hits filled the room plain attacks may use and the next hits were dropped. Our own
 * value, not the original's: it ends past the system's longest particle, so the run's closing fade (runtime.ts) never cuts
 * the flash short. A cue already shorter keeps its own length.
 */
export const ATTACK_HIT_SYSTEM = '0f2af66b';
export const ATTACK_HIT_SECONDS = 0.7;
