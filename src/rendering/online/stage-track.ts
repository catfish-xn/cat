/**
 * TFT-style stage tracker in the countdown strip above the board: one icon per round of the current stage (对战, 野怪,
 * 选秀, 强化, 异常), the current one lit, the finished ones dimmed. Hovering a 野怪 round names its monsters.
 *
 * Every round is read, none is worked out here: the schedule is the rules' `getMultiplayerRoundByOrdinal` on the
 * server's `phase.round`, the stage's other rounds come from `ROUND_CATALOG`, augment/anomaly marks from
 * `ROUND_SEMANTIC_NODES`, monsters from `NEUTRAL_ENCOUNTERS`. Presentation only; no new server field.
 */
import { NEUTRAL_ENCOUNTERS } from '../../simulation/content/neutral-encounters';
import { NEUTRAL_DEFINITIONS, type MonsterFamily } from '../../simulation/content/neutrals';
import { ROUND_CATALOG, ROUND_SEMANTIC_NODES } from '../../simulation/content/round-catalog';
import type { RoundDefinition } from '../../simulation/m8/contracts';
import { getMultiplayerRoundByOrdinal } from '../../simulation/multiplayer-round';

export type StageIcon = 'pvp' | 'pve' | 'carousel' | 'augment' | 'anomaly';
const LABEL: Record<StageIcon, string> = { pvp: '玩家对战', pve: '野怪', carousel: '选秀', augment: '强化', anomaly: '异常' };
/** 14.24 zh_cn monster family names. */
const FAMILY: Record<MonsterFamily, string> = { minion: '小兵', krug: '石甲虫', wolf: '暗影狼', razorbeak: '锋喙鸟', 'elder-dragon': '远古巨龙', 'rift-herald': '峡谷先锋' };
/** 16×16 line icons, drawn with currentColor. */
const PATH: Record<StageIcon, string> = {
  pvp: 'M3 3l7 7M3 3h3M3 3v3M13 3l-7 7M13 3h-3M13 3v3M5 11l-2 2M11 11l2 2',
  pve: 'M3 6c0-2.5 2-4 5-4s5 1.5 5 4v3l-2 1v3H5v-3L3 9zM6 7h1M9 7h1M7 13v-2M9 13v-2',
  carousel: 'M13 8a5 5 0 1 1-1.5-3.5M13 2v3h-3',
  augment: 'M8 1.5l5.5 3.2v6.6L8 14.5l-5.5-3.2V4.7zM8 5l3 3-3 3-3-3z',
  anomaly: 'M8 2l1.6 4.4L14 8l-4.4 1.6L8 14l-1.6-4.4L2 8l4.4-1.6z',
};

export interface StageTrackRound { readonly roundId: string; readonly icon: StageIcon; readonly title: string; readonly state: 'done' | 'current' | 'next' }

function iconOf(round: RoundDefinition): StageIcon {
  const marks = ROUND_SEMANTIC_NODES[round.roundId] ?? [];
  if (marks.includes('augment')) return 'augment';
  if (marks.includes('anomaly')) return 'anomaly';
  return round.kind === 'supply' ? 'carousel' : round.kind;
}
function monsters(encounterId: string | null): string {
  const slots = NEUTRAL_ENCOUNTERS.find(encounter => encounter.encounterId === encounterId)?.slots ?? [];
  const counts = new Map<string, number>();
  for (const slot of slots) { const name = FAMILY[NEUTRAL_DEFINITIONS[slot.definitionId]!.monsterFamily]; counts.set(name, (counts.get(name) ?? 0) + 1); }
  return [...counts].map(([name, count]) => `${name} ×${count}`).join('、');
}
function titleOf(round: RoundDefinition, icon: StageIcon): string {
  const what = icon === 'augment' ? `${LABEL.augment} · ${LABEL.pvp}` : icon === 'anomaly' ? `${LABEL.pvp} · ${LABEL.anomaly}`
    : icon === 'pve' ? `${LABEL.pve}：${monsters(round.encounterId)}` : LABEL[icon];
  return `${round.displayName} ${what}`;
}

/** The rounds the tracker shows for round ordinal `ordinal` (the server's `phase.round`); empty before the first round. */
export function stageTrackRounds(ordinal: number): StageTrackRound[] {
  if (!Number.isSafeInteger(ordinal) || ordinal < 1) return [];
  const current = getMultiplayerRoundByOrdinal(ordinal);
  // Overtime (after 6-7) is open-ended PvP: the current round and the next one.
  const rounds = current.roundId.startsWith('overtime-') ? [current, getMultiplayerRoundByOrdinal(ordinal + 1)]
    : ROUND_CATALOG.filter(round => round.stage === current.stage);
  return rounds.map(round => {
    const icon = iconOf(round);
    return { roundId: round.roundId, icon, title: titleOf(round, icon), state: round.ordinal < ordinal ? 'done' : round.ordinal === ordinal ? 'current' : 'next' };
  });
}

export class StageTrack {
  readonly root: HTMLElement;
  private ordinal = -1;
  constructor() {
    this.root = document.createElement('ol'); this.root.className = 'stage-track'; this.root.dataset.debug = 'online:stage-track';
    this.root.setAttribute('aria-label', '本阶段回合'); this.root.hidden = true;
  }
  render(ordinal: number): void {
    if (ordinal === this.ordinal) return;
    this.ordinal = ordinal;
    const rounds = stageTrackRounds(ordinal);
    this.root.hidden = rounds.length === 0;
    this.root.replaceChildren(...rounds.map(round => {
      const item = document.createElement('li');
      item.className = `stage-round ${round.state}`; item.dataset.icon = round.icon; item.dataset.debug = `online:stage-round:${round.roundId}`;
      item.title = round.title; item.setAttribute('aria-label', round.title);
      if (round.state === 'current') item.setAttribute('aria-current', 'step');
      item.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${PATH[round.icon]}"/></svg>`;
      return item;
    }));
  }
}
