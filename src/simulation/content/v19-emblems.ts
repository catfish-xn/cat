import { freezeContent } from './freeze';
/** User approved total base values. Custom S18-inspired values on the S13 trait identities; replaces, never adds to, the archive. */
export const V19_EMBLEM_VALUES: Readonly<Record<string, Readonly<Record<string,number>>>> = freezeContent({
  conqueror:{Health:200,AD:0.10,AP:10}, artillerist:{AD:0.25}, rebel:{AS:40}, quickstriker:{AS:20},
  'black-rose':{Health:250,AD:0.10,AP:10}, sorcerer:{AP:25}, enforcer:{AS:25,Armor:25,MagicResist:25},
  sentinel:{Armor:25,MagicResist:25}, automata:{AS:10,Armor:15,MagicResist:15},
  'pit-fighter':{AD:0.20,AP:20,Armor:20,MagicResist:20}, experiment:{Health:250,AD:0.15,AP:15}, bruiser:{Health:150},
  firelight:{AS:35,Health:250,CritChance:20}, ambusher:{CritChance:20,CritDamage:8},
  family:{AS:20,ManaPerSecond:3}, visionary:{ManaPerSecond:2}, academy:{AP:25}, dominator:{AP:25},
  'chem-baron':{Health:375}, scrap:{Health:375}, sniper:{AS:25,RangeIncrease:2}, watcher:{Health:188,Armor:25},
});
