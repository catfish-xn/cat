import { AUGMENT_BATCH4_B4REROLL } from '../src/simulation/content/augment-pool-batch4-b4reroll';
const NOTES={
  "patience-is-a-virtue": {
    "name": "耐心是一种美德",
    "description": "每回合，如果你在上一回合未购买任何弈子，则会获得2次免费刷新。",
    "source": {
      "description_en_us": "Each round, gain 2 free rerolls if you did not buy a champion last round."
    }
  },
  "invested-plus": {
    "name": "投资+",
    "description": "获得26金币。在每个回合开始时，在50金币之上，每拥有10金币就会获得1次商店刷新(最多80金币)。",
    "source": {
      "description_en_us": "Gain 26 gold. At the start of each round, gain 1 Shop reroll for every 10 gold above 50 (max 80 gold)."
    }
  },
  "invested-plus-plus": {
    "name": "投资++",
    "description": "获得45金币。在每个回合开始时，在50金币之上，每拥有10金币就会获得1次商店刷新(最多80金币)。",
    "source": {
      "description_en_us": "Gain 45 gold. At the start of each round, gain 1 Shop reroll for every 10 gold above 50 (max 80 gold)."
    }
  }
};
export const B4REROLL_ARCHIVE=Object.fromEntries(Object.entries(AUGMENT_BATCH4_B4REROLL).map(([id,row])=>{const note=NOTES[id as keyof typeof NOTES];return [id,{...row,name:note.name,description:note.description,source:{...row.source,...note.source}}];}));
