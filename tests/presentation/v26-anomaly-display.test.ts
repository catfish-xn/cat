import { afterEach, describe, expect, it, vi } from 'vitest';
import { anomalyNotes, unitAnomalies } from '../../src/presentation/anomaly-display';
import { anomalyDisplayName, anomalyPlayerDescription } from '../../src/presentation/g23-display';
import { itemDescriptions } from '../../src/presentation/item-codex';
import { OpponentBoardPanel } from '../../src/rendering/online/opponent-board';
import type { PublicBenchUnit, PublicBoardUnit } from '../../src/server/protocol';

const portable = 'TFT13_AnotherAnomaly_Item:the-finisher';
class Node {
  children: Node[] = []; dataset: Record<string, string> = {}; title = ''; textContent = ''; innerHTML = '';
  constructor(readonly tag: string, public className = '') {}
  append(...nodes: Node[]) { this.children.push(...nodes); }
  insertAdjacentHTML(_position: string, html: string) { this.innerHTML += html; }
  all(): Node[] { return [this, ...this.children.flatMap(child => child.all())]; }
}
afterEach(() => vi.unstubAllGlobals());

describe('P4 obtained anomaly descriptions', () => {
  it('identifies native and equipment copies separately from held item definitions without changing input', () => {
    const items = ['sword', portable], before = JSON.stringify(items);
    expect(unitAnomalies(undefined, ['sword'])).toEqual([]);
    expect(unitAnomalies('the-finisher', items)).toEqual([
      { id: 'the-finisher', source: 'native' }, { id: 'the-finisher', source: 'portable' },
    ]);
    expect(JSON.stringify(items)).toBe(before);
    expect(anomalyNotes(unitAnomalies('the-finisher', items))).toEqual([
      `异常：${anomalyDisplayName('the-finisher')}`, anomalyPlayerDescription('the-finisher'),
      `便携异常（装备复制）：${anomalyDisplayName('the-finisher')}`, anomalyPlayerDescription('the-finisher'),
    ]);
    expect(itemDescriptions(portable)).toContain(`复制异变：${anomalyDisplayName('the-finisher')}`);
    expect(itemDescriptions(portable)).toContain(anomalyPlayerDescription('the-finisher'));
    expect(itemDescriptions(portable)).toContain('复制效果定义，不携带原英雄累计状态；卸下即失效，原异常英雄不能装备。');
  });

  it.each(['board', 'bench'] as const)('marks a public %s holder from native binding or portable equipment, with the full effect', place => {
    vi.stubGlobal('document', { createElement: (tag: string) => new Node(tag) });
    const panel = Object.create(OpponentBoardPanel.prototype) as { unitChip(unit: PublicBoardUnit | PublicBenchUnit, place: string): Node };
    for (const copy of [false, true]) {
      const unit = { definitionId: 'vex', starLevel: 2 as const, items: copy ? [portable] : [],
        ...(!copy ? { anomaly: 'the-finisher' } : {}),
        ...(place === 'board' ? { cell: { row: 4, col: 0 } } : { slot: 0 }) };
      const before = JSON.stringify(unit), chip = panel.unitChip(unit, place), mark = chip.all().find(n => n.className === 'opponent-anomaly')!;
      expect(mark).toBeDefined();
      expect(mark.dataset.anomaly).toBe('the-finisher');
      expect(mark.title).toContain(anomalyDisplayName('the-finisher'));
      expect(mark.title).toContain(anomalyPlayerDescription('the-finisher'));
      expect(mark.title).toContain(copy ? '便携异常（装备复制）' : '异常：');
      expect(chip.title).toContain(mark.title);
      expect(chip.dataset.unitAnomaly).toBe(copy ? undefined : 'the-finisher');
      expect(chip.all().filter(n => n.dataset.itemDef === portable)).toHaveLength(copy ? 1 : 0);
      expect(JSON.stringify(unit)).toBe(before);
    }
  });
});
