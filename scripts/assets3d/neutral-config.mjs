/** Non-champion configurations. Paths are resolved from skin BIN bindings. */
export const NEUTRAL_CONFIG = [
  { sourceName: 'tft_chaosminionmelee', ids: ['pve-minion-melee-a', 'pve-minion-melee-b', 'pve-minion-melee-c'], height: 52 },
  { sourceName: 'tft_chaosminionranged', ids: ['pve-minion-ranged-b', 'pve-minion-ranged-c'], height: 52 },
  { sourceName: 'tft_krug', ids: ['pve-krug'], height: 72 },
  { sourceName: 'tft_murkwolf', ids: ['pve-wolf-large'], height: 80 },
  { sourceName: 'tft_murkwolfmini', ids: ['pve-wolf-small'], height: 48,
    animations: { cast: 'tft_murkwolfmini_leap' } },
  { sourceName: 'tft_razorbeak', ids: ['pve-razorbeak-large'], height: 80 },
  { sourceName: 'tft_razorbeakmini', ids: ['pve-razorbeak-small'], height: 44 },
  { sourceName: 'tft_elderdragon', ids: ['pve-elder-dragon'], height: 140,
    animations: { idle: 'tft_dragon_idle_aggro1', move: 'tft_dragon_run', attack: 'tft_dragon_spell', cast: 'tft_elderdragon_takeoff', death: 'tft_dragon_death' } },
  { sourceName: 'tft_riftherald', ids: ['pve-rift-herald'], height: 125 },
];
export const NEUTRAL_ACTION_RULES = {
  idle: { aliases: ['Idle', 'Idle1'], tokens: ['idle', 'idle1'] },
  move: { aliases: ['Run', 'Run1'], tokens: ['run', 'run1'] },
  attack: { aliases: ['Attack1', 'Attack'], tokens: ['attack1', 'attack'] },
  cast: { aliases: ['Attack2', 'Spell', 'Spawn'], tokens: ['attack2', 'spell', 'leap', 'spawn'] },
  death: { aliases: ['Death', 'Death1'], tokens: ['death', 'death1'] },
};
export function parseNeutralConfig(value) {
  if (!Array.isArray(value) || !value.length) throw new Error('invalid-neutral-config');
  const ids = new Set(), names = new Set();
  return value.map(row => {
    if (!row || !/^[a-z][a-z0-9_]*$/.test(row.sourceName) || names.has(row.sourceName)
      || !Array.isArray(row.ids) || !row.ids.length || !Number.isFinite(row.height) || row.height <= 0)
      throw new Error('invalid-neutral-config');
    names.add(row.sourceName);
    for (const id of row.ids) {
      if (typeof id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(id) || ids.has(id)) throw new Error('invalid-neutral-id');
      ids.add(id);
    }
    if (row.animations && (typeof row.animations !== 'object' || Array.isArray(row.animations)
      || Object.entries(row.animations).some(([k, v]) => !Object.hasOwn(NEUTRAL_ACTION_RULES, k) || typeof v !== 'string' || !/^[a-z0-9_]+$/.test(v))))
      throw new Error('invalid-neutral-animation');
    return { ...row, ids: [...row.ids], animations: { ...row.animations } };
  });
}
