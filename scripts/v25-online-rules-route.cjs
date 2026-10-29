/* Public rerolls keep seed-42 route fixtures independent of history-only augments. */
const safe=['pumping-up-ii','climb-the-ladder-ii','overheal','reunion','blistering-strikes','clockwork-accelerator','mentorship-ii','watcher-crest','sentinel-crest','sniper-crest','visionary-crest','dominator-crest','sorcerer-crest'];
exports.routeOptions=(build,seed)=>seed!==42?{}:build==='cannon'?{
 augmentRerollPriorities:{'4-2':safe}
}:build==='mage'?{
 augmentRerollPriorities:{'3-2':safe,'4-2':safe}
}:{};
