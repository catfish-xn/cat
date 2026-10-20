/**
 * Trait breakpoint colours of the TFT trait column (bronze / silver / gold / prismatic), display only.
 * Transcribed from the 14.24b CommunityDragon `effects[].style` of each Set 13 trait
 * (src/simulation/content/source/s13-14.24b/raw/en_us.json.gz): 1 bronze, 3 silver, 4 unique, 5 gold, 6 prismatic.
 * Keyed by threshold; a trait or threshold missing here falls back to its position among the trait's breakpoints.
 */
export type TraitStyle = 'bronze' | 'silver' | 'gold' | 'prismatic' | 'unique';

const CODES: Readonly<Record<string, TraitStyle>> = { b: 'bronze', s: 'silver', g: 'gold', p: 'prismatic', u: 'unique' };
const SOURCE: Readonly<Record<string, string>> = {
  automata: '2b 4s 6g', firelight: '2b 3g 4g', family: '3g 4g 5g', rebel: '3b 5s 7g 10p', enforcer: '2b 4s 6g 8g 10p',
  conqueror: '2b 4s 6g 9p', academy: '3b 4s 5g 6g', scrap: '2b 4s 6g 9g', emissary: '1b 4g', sentinel: '2b 4s 6g',
  artillerist: '2b 4g 6g', sniper: '2b 4g 6g', watcher: '2b 4s 6g', sorcerer: '2b 4s 6g 8g', ambusher: '2b 3s 4s 5g',
  visionary: '2b 4s 6g 8g', 'high-roller': '1u', 'chem-baron': '3b 4s 5g 6g 7g', dominator: '2b 4s 6g', 'pit-fighter': '2b 4s 6g 8g',
  experiment: '3b 5g 7g', bruiser: '2b 4s 6g', 'junker-king': '1u', 'black-rose': '3b 4s 5g 7g', quickstriker: '2b 3s 4g',
};

/** Style of the reached `tier` (a threshold) of `traitId`; null when the trait is inactive. */
export function traitTierStyle(traitId: string, tier: number, thresholds: readonly number[]): TraitStyle | null {
  if (tier <= 0) return null;
  const entry = (SOURCE[traitId] ?? '').split(' ').find(token => Number.parseInt(token, 10) === tier);
  const code = entry ? CODES[entry.slice(-1)] : undefined;
  if (code) return code;
  const index = thresholds.indexOf(tier), last = thresholds.length - 1;
  return index >= last ? 'gold' : index <= 0 ? 'bronze' : 'silver';
}
