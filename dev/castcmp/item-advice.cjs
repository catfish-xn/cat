// Which items suit an acceptance recording (castcmp --items), by our own item ids (src/simulation/content/items.ts).
// Fable 11-17. Nothing here changes a recording: jobs-check warns (never refuses) about WARN items, and the keyframes caption
// says when an item changes attack or mana timing. No original values here.

/** Items whose effect shows on screen or changes what the row is about: a warning in jobs-check, never a refusal. */
const WARN_ITEMS = Object.freeze({
  // Shields.
  bloodthirster: 'shield', crownguard: 'shield', 'protectors-vow': 'shield',
  // Heals.
  'dragons-claw': 'heal', redemption: 'heal', gunblade: 'heal',
  // Burn and wound labels.
  'sunfire-cape': 'burn', 'red-buff': 'burn', morellonomicon: 'burn',
  // Extra damage numbers or missiles.
  'ionic-spark': 'extra damage', 'statikk-shiv': 'extra damage', 'runaans-hurricane': 'extra missiles', 'bramble-vest': 'extra damage',
  // Untargetable, random temporary items, crowd-control immunity, a sudden health jump.
  'edge-of-night': 'untargetable', 'thiefs-gloves': 'random items', quicksilver: 'crowd-control immunity', 'steraks-gage': 'health jump',
  // Debuff labels.
  'last-whisper': 'debuff label', evenshroud: 'debuff label', guardbreaker: 'damage bonus on shields',
  // Critical strikes: fine for a row about crits (say so in the task line).
  'infinity-edge': 'crits (ok for a crit row)', 'jeweled-gauntlet': 'crits (ok for a crit row)', 'hand-of-justice': 'crits (ok for a crit row)',
});
/** Items that change attack or mana timing: no warning, but the caption says so. shojin and blue-buff help a non-tank cast sooner. */
const TEMPO_ITEMS = Object.freeze(['shojin', 'blue-buff', 'rageblade', 'nashors-tooth', 'adaptive-helm']);
/** Stats only: the first choice for a task line (a tank: warmog, gargoyle, steadfast-heart). titans-resolve is fine too. */
const STAT_ONLY_ITEMS = Object.freeze(['warmog', 'deathblade', 'deathcap', 'giant-slayer', 'archangel', 'gargoyle', 'steadfast-heart']);

/** "holder:item (reason)" for the WARN items and "holder:item" for the TEMPO items in `items` ({ me: [...], ally: [...] }). */
function itemAdvice(items) {
  const warn = [], tempo = [];
  for (const [holder, list] of Object.entries(items ?? {})) for (const id of list ?? []) {
    if (Object.hasOwn(WARN_ITEMS, id)) warn.push(`${holder}:${id} (${WARN_ITEMS[id]})`);
    if (TEMPO_ITEMS.includes(id)) tempo.push(`${holder}:${id}`);
  }
  return { warn, tempo };
}

module.exports = { WARN_ITEMS, TEMPO_ITEMS, STAT_ONLY_ITEMS, itemAdvice };
