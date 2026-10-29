// Public rerolls and selections only: no scripted offers or history stripping.
// Keep corruption fixtures on routes where solo augment replay cannot preempt
// the specific grant/resource/anomaly validator under test. Callers also use
// a seed with a non-prismatic 4-2: that offer tier alone records Max Cap history.
export const historyFreeAugments = [
  'pumping-up-i', 'manaflow-i', 'backup', 'bronze-for-life-i', 'bulky-buddies-i', 'placebo',
  'pumping-up-ii', 'blistering-strikes', 'bronze-for-life-ii', 'item-collector-ii', 'mentorship-ii',
  'little-buddies', 'bulky-buddies-ii', 'lineup', 'manaflow-ii', 'glass-cannon-ii',
  'pumping-up-iii', 'bulky-buddies-iii', 'clockwork-accelerator',
];
export const historyFreeRerollPriorities = Object.fromEntries(
  ['2-1', '3-2', '4-2'].map(round => [round, historyFreeAugments]),
);
