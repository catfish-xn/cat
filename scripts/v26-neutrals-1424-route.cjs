/* Public rerolls keep seed-42 route fixtures independent of history-only augments.
 * v26 (D5 augment registration) changed seed-42's 2-1 offers: every M5 build would
 * otherwise take snipers-nest at 2-1 (and sniper rebel-resurgence at 4-2), both
 * AUGMENT_HISTORY_OWNERS augments, forcing full-history replay on every restore. */
const safe=['pumping-up-ii','climb-the-ladder-ii','overheal','reunion','blistering-strikes','clockwork-accelerator','mentorship-ii','watcher-crest','sentinel-crest','sniper-crest','visionary-crest','dominator-crest','sorcerer-crest'];
/* v26: the seed-65 sniper Herald route (Herald recorder, m8-neutral-public-route,
 * live-reveal neutral route) likewise took rebel-resurgence at 2-1 (offers rebel-resurgence,
 * family-crest, scoreboard-scrapper). Take the offered history-free family-crest without a
 * reroll: the shop RNG and the later picks (cloning-facility, little-buddies) stay those of the
 * pre-D5 route, which still equips Ionic Spark by 6-7 (m8-b7 aura case). */
exports.routeOptions=(build,seed)=>seed===65&&build==='sniper'?{
 augmentRerollPriorities:{'2-1':['family-crest']}
}:seed!==42?{}:build==='cannon'||build==='sniper'||build==='sniper-caitlyn'?{
 augmentRerollPriorities:{'2-1':safe,'4-2':safe}
}:build==='mage'?{
 augmentRerollPriorities:{'2-1':safe,'3-2':safe,'4-2':safe}
}:{};
