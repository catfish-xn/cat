/* Public rerolls keep seed-42 route fixtures independent of history-only augments.
 * v26 (D5 augment registration) changed seed-42's 2-1 offers: every M5 build would
 * otherwise take snipers-nest at 2-1 (and sniper rebel-resurgence at 4-2), both
 * AUGMENT_HISTORY_OWNERS augments, forcing full-history replay on every restore. */
const safe=['pumping-up-ii','climb-the-ladder-ii','overheal','reunion','blistering-strikes','clockwork-accelerator','mentorship-ii','watcher-crest','sentinel-crest','sniper-crest','visionary-crest','dominator-crest','sorcerer-crest'];
exports.routeOptions=(build,seed)=>seed!==42?{}:build==='cannon'||build==='sniper'||build==='sniper-caitlyn'?{
 augmentRerollPriorities:{'2-1':safe,'4-2':safe}
}:build==='mage'?{
 augmentRerollPriorities:{'2-1':safe,'3-2':safe,'4-2':safe}
}:{};
