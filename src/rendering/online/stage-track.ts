import { attachTextCards, textCard } from '../../presentation/text-card';
/**
 * TFT-style stage tracker in the countdown strip above the board: one icon per round of the current stage (对战, 野怪,
 * 选秀, 强化, 异常), the current one lit, the upcoming ones grey and the finished ones in their result's colour (14.24
 * stageicons: victory teal, defeat red). Hovering a round says what it was or will be, in the 14.24 zh_cn stageui_hover
 * wording ("曾经获胜：X", "当前对手：X", "对抗：未知", "对抗：石甲虫 ×3", "选秀"). Like 14.24, only the current stage is shown.
 *
 * Results come from my private seat view's `roundResults`, opponents from the view's `opponentHistory`; both optional.
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
const FAMILY: Record<MonsterFamily, string> = { minion: '小兵', krug: '石甲虫', wolf: '暗影狼', razorbeak: '锋喙鸟', 'elder-dragon': '远古巨龙', 'rift-herald': '峡谷先锋', scuttle: '迅捷蟹', 'giant-crab': '危险巨蟹' };
/** 16×16 line icons, drawn with currentColor. */
const PATH: Record<StageIcon, string> = {
  pvp: 'M3 3l7 7M3 3h3M3 3v3M13 3l-7 7M13 3h-3M13 3v3M5 11l-2 2M11 11l2 2',
  pve: 'M3 6c0-2.5 2-4 5-4s5 1.5 5 4v3l-2 1v3H5v-3L3 9zM6 7h1M9 7h1M7 13v-2M9 13v-2',
  carousel: 'M13 8a5 5 0 1 1-1.5-3.5M13 2v3h-3',
  augment: 'M8 1.5l5.5 3.2v6.6L8 14.5l-5.5-3.2V4.7zM8 5l3 3-3 3-3-3z',
  anomaly: 'M8 2l1.6 4.4L14 8l-4.4 1.6L8 14l-1.6-4.4L2 8l4.4-1.6z',
};

/** A finished round's result for me (14.24 victory / defeat / defeat_neutral). */
export type StageOutcome = 'win' | 'loss' | 'draw';
export interface StageTrackRound {
  readonly roundId: string; readonly icon: StageIcon; readonly title: string; readonly state: 'done' | 'current' | 'next';
  /** Finished, non-carousel rounds with a known result only. */
  readonly outcome: StageOutcome | null;
}
/** What the tracker knows about past rounds; every field may be empty (older server, spectator, no battle yet). */
export interface StageHistory {
  /** My result by round ordinal (`RoundResult.result`, my side: playerWin = I won). */
  readonly results?: ReadonlyMap<number, 'playerWin' | 'enemyWin' | 'draw' | 'supply'>;
  /** My opponent's display name by round ordinal (PvP rounds only). */
  readonly opponents?: ReadonlyMap<number, string>;
}

function iconOf(round: RoundDefinition): StageIcon {
  const marks = ROUND_SEMANTIC_NODES[round.roundId] ?? [];
  if (marks.includes('augment')) return 'augment';
  if (marks.includes('anomaly')) return 'anomaly';
  return round.kind === 'supply' ? 'carousel' : round.kind;
}
function monsters(roundId: string): string {
  const slots = NEUTRAL_ENCOUNTERS.find(encounter => encounter.roundId === roundId)?.slots ?? [];
  const counts = new Map<string, number>();
  for (const slot of slots) { const name = FAMILY[NEUTRAL_DEFINITIONS[slot.definitionId]!.monsterFamily]; counts.set(name, (counts.get(name) ?? 0) + 1); }
  return [...counts].map(([name, count]) => `${name} ×${count}`).join('、');
}
/** The monster family a 野怪 round's icon shows (its first slot), for the 3D original icon; null for other rounds. */
export function stageMonsterFamily(roundId: string): MonsterFamily | null {
  const slot = NEUTRAL_ENCOUNTERS.find(encounter => encounter.roundId === roundId)?.slots[0];
  return slot ? NEUTRAL_DEFINITIONS[slot.definitionId]!.monsterFamily : null;
}
const OUTCOME_TEXT: Record<StageOutcome, string> = { win: '曾经获胜', loss: '曾经失利', draw: '曾经打平' };
function outcomeOf(result: 'playerWin' | 'enemyWin' | 'draw' | 'supply' | undefined): StageOutcome | null {
  return result === 'playerWin' ? 'win' : result === 'enemyWin' ? 'loss' : result === 'draw' ? 'draw' : null;
}
/** 14.24 stageui_hover_* lines: round name first, then what it is against, then any extra. */
function titleOf(round: RoundDefinition, icon: StageIcon, state: StageTrackRound['state'], outcome: StageOutcome | null, opponent: string | undefined): string {
  if (icon === 'carousel') return `${round.displayName}\n${LABEL.carousel}`;
  let against: string;
  if (icon === 'pve') against = `对抗：${monsters(round.roundId)}`;
  else if (state === 'done' && outcome) against = opponent ? `${OUTCOME_TEXT[outcome]}：${opponent}` : OUTCOME_TEXT[outcome];
  else if (state === 'current' && opponent) against = `当前对手：${opponent}`;
  else against = icon === 'augment' ? '对阵：未知' : '对抗：未知';
  const extra = state === 'done' ? null : icon === 'augment' ? '外加：选择一个【强化符文】。' : icon === 'anomaly' ? '外加：异常突变' : null;
  return [round.displayName, against, ...(extra ? [extra] : [])].join('\n');
}

/** The rounds the tracker shows for round ordinal `ordinal` (the server's `phase.round`); empty before the first round. */
export function stageTrackRounds(ordinal: number, history: StageHistory = {}): StageTrackRound[] {
  if (!Number.isSafeInteger(ordinal) || ordinal < 1) return [];
  const current = getMultiplayerRoundByOrdinal(ordinal);
  // Overtime (after 6-7) is open-ended PvP: the current round and the next one.
  const rounds = current.roundId.startsWith('overtime-') ? [current, getMultiplayerRoundByOrdinal(ordinal + 1)]
    : ROUND_CATALOG.filter(round => round.stage === current.stage);
  return rounds.map(round => {
    const icon = iconOf(round);
    const state = round.ordinal < ordinal ? 'done' : round.ordinal === ordinal ? 'current' : 'next';
    const outcome = state === 'done' && icon !== 'carousel' ? outcomeOf(history.results?.get(round.ordinal)) : null;
    return { roundId: round.roundId, icon, title: titleOf(round, icon, state, outcome, history.opponents?.get(round.ordinal)), state, outcome };
  });
}

export class StageTrack {
  readonly root: HTMLElement;
  private key = '';
  private readonly detach: () => void;
  constructor() {
    this.root = document.createElement('ol'); this.root.className = 'stage-track'; this.root.dataset.debug = 'online:stage-track';
    this.detach = attachTextCards(this.root);
    this.root.setAttribute('aria-label', '本阶段回合'); this.root.hidden = true;
  }
  dispose(): void { this.detach(); this.root.remove(); }
  render(ordinal: number, history: StageHistory = {}): void {
    const rounds = stageTrackRounds(ordinal, history);
    const key = JSON.stringify(rounds);
    if (key === this.key) return;
    this.key = key;
    this.root.hidden = rounds.length === 0;
    this.root.replaceChildren(...rounds.map(round => {
      const item = document.createElement('li');
      item.className = `stage-round ${round.state}`; item.dataset.icon = round.icon; item.dataset.debug = `online:stage-round:${round.roundId}`;
      // 3D original icon set: <kind>.<victory|defeat|current|upcoming>; a 野怪 round also names its monster family.
      item.dataset.state = round.state === 'done' ? (round.outcome === 'win' ? 'victory' : 'defeat') : round.state === 'current' ? 'current' : 'upcoming';
      if (round.outcome) item.dataset.outcome = round.outcome;
      const family = round.icon === 'pve' ? stageMonsterFamily(round.roundId) : null;
      if (family) item.dataset.family = family;
      textCard(item, round.title);
      if (round.state === 'current') item.setAttribute('aria-current', 'step');
      item.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${PATH[round.icon]}"/></svg>`;
      return item;
    }));
  }
}
