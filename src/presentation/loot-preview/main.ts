/**
 * U6 static preview page (dev server only: /u6-preview.html). Renders each sample with the
 * real U6 renderers. Clicking an offer only echoes the command the formal wiring would send;
 * nothing is granted and no Match exists on this page.
 */
import '../../style.css';
import './preview.css';
import { applyThemeVariables } from '../theme';
import { displayUnitName } from '../../rendering/display-names';
import { lootChoiceDialog, lootPanelSection, lootTerminalSummary, type LootLabels } from '../loot-view';
import { LOOT_SAMPLES, SAMPLE_SOURCES } from './fixtures';

applyThemeVariables();
const labels: LootLabels = { sourceName: id => (id && SAMPLE_SOURCES[id] ? displayUnitName(SAMPLE_SOURCES[id]) : '未知来源') };
const PHASE = { combat: '战斗中', choice: '构筑选择', settlement: '回合结算', gameOver: '对局结束' } as const;

const root = document.getElementById('u6-preview')!;
const nav = document.createElement('nav'); nav.className = 'panel-tabs u6-preview-tabs'; nav.setAttribute('aria-label', '样例状态');
const stage = document.createElement('main'); stage.className = 'u6-preview-stage';
root.append(nav, stage);

function show(id: string): void {
  const sample = LOOT_SAMPLES.find(entry => entry.id === id) ?? LOOT_SAMPLES[0];
  for (const button of Array.from(nav.querySelectorAll('button'))) button.setAttribute('aria-pressed', String(button.dataset.sample === sample.id));
  const head = document.createElement('header'); head.className = 'u6-preview-head';
  const title = document.createElement('h2'); title.textContent = `${sample.title} · ${PHASE[sample.phase]}`;
  const description = document.createElement('p'); description.textContent = sample.description;
  head.append(title, description);
  const echo = document.createElement('p'); echo.className = 'u6-preview-echo'; echo.dataset.debug = 'u6-preview-echo'; echo.setAttribute('role', 'status');
  const body = document.createElement('div'); body.className = 'u6-preview-body';
  body.append(sample.phase === 'gameOver' ? lootTerminalSummary(sample.view, labels) : lootPanelSection(sample.view, labels));
  if (sample.pendingChoice) {
    const sourceId = sample.view.pendingChoice?.sourceUnitId ?? null;
    body.append(lootChoiceDialog(sample.pendingChoice, labels.sourceName(sourceId), (choiceId, generation, definitionId) => {
      echo.textContent = `预览不发送命令。正式接线将调用 selectChoice(${choiceId}, ${generation}, ${definitionId})，结果以领域返回为准。`;
    }));
  }
  stage.replaceChildren(head, body, echo);
  if (location.hash.slice(1) !== sample.id) history.replaceState(null, '', `#${sample.id}`);
}
for (const sample of LOOT_SAMPLES) {
  const button = document.createElement('button'); button.type = 'button'; button.textContent = sample.title;
  button.dataset.sample = sample.id; button.dataset.debug = `u6-sample:${sample.id}`;
  button.addEventListener('click', () => show(sample.id)); nav.append(button);
}
addEventListener('hashchange', () => show(location.hash.slice(1)));
show(location.hash.slice(1));
