/**
 * M7 shared presentation tokens. CSS reads the same values through custom properties
 * installed by applyThemeVariables(); Phaser reads the numeric forms. Presentation only:
 * nothing here may influence Match, Combat, RNG or save data.
 */
export const THEME = Object.freeze({
  color: Object.freeze({
    bg: '#0a1018', surface: '#14212c', surfaceAlt: '#0f1a24', surfaceRaised: '#1c2e3b', border: '#36505d', borderStrong: '#527080',
    text: '#e2eef1', textMuted: '#9aaeb9', textFaint: '#7e95a4',
    accent: '#68ddd0', accentStrong: '#2f8f84', gold: '#e6bc76', danger: '#f08080', focus: '#ffd782',
    ally: '#68ddd0', enemy: '#f08080', hp: '#5fd68a', hpEnemy: '#f08080', mana: '#449cfa', manaFull: '#bde5ff', shield: '#e8f4ff',
    boardAlly: '#1b3039', boardEnemy: '#30232e', boardLine: '#36505d', bench: '#182531',
  }),
  /** Cost 1–5: gray, green, blue, purple, gold (shape/number always accompany the color). */
  cost: Object.freeze(['#a9b4bc', '#5fbf7a', '#4fa3ff', '#c47cff', '#ffc83d'] as const),
  font: Object.freeze({ body: 14, small: 12, title: 20, hud: 15 }),
  space: Object.freeze({ xs: 4, sm: 6, md: 10, lg: 14 }),
  radius: Object.freeze({ sm: 6, md: 8, lg: 12 }),
  minTarget: 44,
});

export const toNumber = (hex: string): number => Number.parseInt(hex.slice(1), 16);
export const costColor = (cost: number): string => THEME.cost[Math.min(5, Math.max(1, cost)) - 1];

/** Installs the tokens as CSS custom properties on :root (idempotent). */
export function applyThemeVariables(root: HTMLElement = document.documentElement): void {
  for (const [name, value] of Object.entries(THEME.color)) root.style.setProperty(`--c-${name.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`, value);
  THEME.cost.forEach((value, index) => root.style.setProperty(`--cost-${index + 1}`, value));
  for (const [name, value] of Object.entries(THEME.font)) root.style.setProperty(`--font-${name}`, `${value}px`);
  for (const [name, value] of Object.entries(THEME.space)) root.style.setProperty(`--space-${name}`, `${value}px`);
  for (const [name, value] of Object.entries(THEME.radius)) root.style.setProperty(`--radius-${name}`, `${value}px`);
  root.style.setProperty('--min-target', `${THEME.minTarget}px`);
}
