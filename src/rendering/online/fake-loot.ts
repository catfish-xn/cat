/**
 * C18-B: where the R3/R4 loot panels get their data. The server's private view carries the draft fields of
 * MULTIPLAYER_CONTRACT §18.4 (`revealedLoot.revealedOrbs`, `consumables`) once T13-B lands; until then `?fakeLoot=1`
 * feeds a fixed local sample so layout and flow can be checked. The sample is layout data only: its tiers, contents
 * and counts are made up for the screen and say nothing about drop rates, qualities or reforge results.
 *
 * TODO(T13-B, contract §18.4): once the fields are signed and projected, drop the sample and the flag.
 */
import type { MatchState } from '../../simulation/match-types';
import type { DraftConsumable, DraftConsumablePreview, DraftConsumableTarget, DraftOrbLoot } from '../../presentation/orb-loot';

/** `?fakeLoot=1` in the page URL: show the local sample where the server sends nothing. Never set by default. */
export const fakeLootEnabled = (): boolean => typeof location !== 'undefined' && new URLSearchParams(location.search).get('fakeLoot') === '1';

type DraftFields = { readonly revealedLoot?: Partial<DraftOrbLoot>; readonly consumables?: readonly DraftConsumable[] };

/** The server's orb summary of my current PvE round when it carries the §18.4 orb list; null otherwise. */
function realOrbLoot(state: MatchState): DraftOrbLoot | null {
  const loot = (state as MatchState & DraftFields).revealedLoot;
  return loot && typeof loot.roundId === 'string' && Array.isArray(loot.revealedDrops) && Array.isArray(loot.revealedOrbs) ? loot as DraftOrbLoot : null;
}
/** The server's consumable list of my seat when present; null when the field is not sent. */
function realConsumables(state: MatchState): readonly DraftConsumable[] | null {
  const tools = (state as MatchState & DraftFields).consumables;
  return Array.isArray(tools) ? tools : null;
}

/**
 * Orb panel data: the server's when sent; the sample under `?fakeLoot=1` in a PvE round; otherwise none. When it is
 * shown (after my battle has played out) is the panel's decision, as for the C9 revealed drops.
 */
export function readOrbLoot(state: MatchState): { readonly loot: DraftOrbLoot; readonly preview: boolean } | null {
  const real = realOrbLoot(state);
  if (real) return { loot: real, preview: false };
  if (!fakeLootEnabled() || state.m8.round.kind !== 'pve') return null;
  return { loot: sampleOrbLoot(state.roundDefinitionId), preview: true };
}
/** Consumable shelf data: the server's when sent; the sample under `?fakeLoot=1`; otherwise none. */
export function readConsumables(state: MatchState): { readonly tools: readonly DraftConsumable[]; readonly preview: boolean } | null {
  const real = realConsumables(state);
  if (real) return { tools: real, preview: false };
  return fakeLootEnabled() ? { tools: SAMPLE_CONSUMABLES, preview: true } : null;
}

/**
 * The panel's single source for whether `consumableId` can be used on `target`.
 * TODO(T13-B, contract §18.1 previewUseConsumable / SR-C18-01): §18.1 forbids running the authoritative preview on the
 * private view, so this stays a placeholder until Codex exports a client-usable answer (a projected target list or a
 * seat-view preview); it never says "allowed" on its own and never computes a reforge result.
 */
export function previewConsumable(_state: MatchState, _consumableId: string, _target: DraftConsumableTarget): DraftConsumablePreview {
  return { ok: 'pending', contract: '§18.1' };
}

const SAMPLE_CONSUMABLES: readonly DraftConsumable[] = Object.freeze([
  { consumableId: 'fake-tool-1', definitionId: 'magnetic-remover' },
  { consumableId: 'fake-tool-2', definitionId: 'component-reforger' },
  { consumableId: 'fake-tool-3', definitionId: 'completed-reforger' },
]);

/** One orb of every tier and every entry state the panel has to show, including both forfeit reasons. */
function sampleOrbLoot(roundId: string): DraftOrbLoot {
  const drop = (orbId: string, entryOrdinal: number, payload: DraftOrbLoot['revealedDrops'][number]['payload'], status: DraftOrbLoot['revealedDrops'][number]['status'], reason?: DraftOrbLoot['revealedDrops'][number]['reason']) => ({
    orbId, entryOrdinal, dropId: `${orbId}:${entryOrdinal}`, encounterId: 'fake-encounter', sourceUnitId: `fake-source-${orbId}`, roundId, payload, status,
    receiptId: status === 'granted' ? `fake-receipt-${orbId}-${entryOrdinal}` : null, allowedActions: [] as const, ...(reason ? { reason } : {}),
  });
  const revealedDrops = [
    drop('orb-1', 0, { kind: 'gold', quantity: 2 }, 'granted'),
    drop('orb-1', 1, { kind: 'consumable', definitionId: 'magnetic-remover', quantity: 1 }, 'granted'),
    drop('orb-2', 0, { kind: 'item', definitionId: 'sword', quantity: 1 }, 'granted'),
    drop('orb-2', 1, { kind: 'gold', quantity: 3 }, 'granted'),
    drop('orb-3', 0, { kind: 'item', definitionId: 'deathblade', quantity: 1 }, 'granted'),
    drop('orb-3', 1, { kind: 'unit', definitionId: 'irelia', quantity: 1 }, 'forfeited', 'timeout-forfeited'),
    drop('orb-4', 0, { kind: 'consumable', definitionId: 'completed-reforger', quantity: 2 }, 'forfeited', 'eliminated-forfeited'),
    drop('orb-4', 1, { kind: 'gold', quantity: 8 }, 'forfeited', 'eliminated-forfeited'),
  ];
  const ids = (orbId: string) => revealedDrops.filter(entry => entry.orbId === orbId).map(entry => entry.dropId);
  return {
    roundId, revealedDrops,
    revealedOrbs: [
      { orbId: 'orb-1', tier: 'gray', status: 'claimed', entryDropIds: ids('orb-1') },
      { orbId: 'orb-2', tier: 'blue', status: 'claimed', entryDropIds: ids('orb-2') },
      { orbId: 'orb-3', tier: 'gold', status: 'partially-claimed', entryDropIds: ids('orb-3') },
      { orbId: 'orb-4', tier: 'prismatic', status: 'forfeited', entryDropIds: ids('orb-4') },
    ],
  };
}
