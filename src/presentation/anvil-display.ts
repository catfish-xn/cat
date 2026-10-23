/**
 * v22 anvils (锻造器) as the player sees them: a bench piece with the 14.24 client icon, the client's sell text in place of
 * a sale price, and the armory (武器库) its sale opens in the shop row with the server's 30 s countdown. Texts come from
 * the rules' `anvilDisplay`; nothing here decides an offer, a timeout or a grant.
 */
import { anvilDisplay, isAnvil } from '../simulation/content/anvils';
import { lootEntry } from './g23-display';

export type AnvilInfo = NonNullable<ReturnType<typeof anvilDisplay>>;
/** Name, sell text and hover description of an anvil unit; null for every other unit. */
export const anvilInfo = (definitionId: string): AnvilInfo | null => anvilDisplay(definitionId) ?? null;
export const isAnvilUnit = (definitionId: string): boolean => isAnvil(definitionId);
/** The anvil's 14.24 client icon (TFT_ArmoryKey*_Square), bundled with the Conqueror loot icons. */
export const anvilIconUrl = (definitionId: string): string | null => (isAnvil(definitionId) ? lootEntry(definitionId)?.iconUrl ?? null : null);

/** The four-way pick an anvil's sale opened (rules payload `source: 'anvil-unit'`): shown in the shop row, not as a popup. */
export function isAnvilArmory(choice: object | null | undefined): boolean {
  const { kind, payload } = (choice ?? {}) as { kind?: unknown; payload?: { source?: unknown } };
  return kind === 'forge' && !!payload && typeof payload === 'object' && payload.source === 'anvil-unit';
}

/** Drag-to-shop / E hint: the client's sell text instead of a price. */
export const anvilSellHint = (info: AnvilInfo): string => `松手${info.sellText}`;

let serverOffset: number | null = null;
/** Online: the server clock of the latest view (`phase.serverNow`), so a server deadline can be counted down locally. */
export function noteServerNow(serverNow: number): void { serverOffset = performance.now() - serverNow; }
/** Forget the server clock (back to the lobby or offline). */
export function forgetServerNow(): void { serverOffset = null; }

interface DeadlineState { readonly pendingChoice?: { readonly choiceId: string; readonly generation: number } | null; readonly choiceDeadline?: { readonly choiceId: string; readonly generation: number; readonly endsAt: number } }
/**
 * Whole seconds left on my open armory: the server's own deadline for this choiceId and generation (`choiceDeadline`,
 * kept across a reconnect). Null without a matching deadline or before the first view gave the server clock.
 */
export function armorySecondsLeft(state: DeadlineState): number | null {
  const deadline = state.choiceDeadline, choice = state.pendingChoice;
  if (!deadline || !choice || deadline.choiceId !== choice.choiceId || deadline.generation !== choice.generation || serverOffset === null) return null;
  return Math.max(0, Math.ceil((deadline.endsAt - (performance.now() - serverOffset)) / 1000));
}
