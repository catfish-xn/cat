import type { BattleRecord } from '../m6/contracts';
import type { ReplaySnapshot } from './playback-session';
export interface ReplayCallbacks {
  select(record: BattleRecord): void; play(): void; pause(): void;
  speed(speed: 1 | 2 | 4): void; seek(tick: number): void; close(): void;
}
export class ReplayPanel {
  private root = document.createElement('section');
  private choices = document.createElement('select');
  private slider = document.createElement('input');
  private status = document.createElement('p');
  private controls = document.createElement('div');
  private records: readonly BattleRecord[] = [];
  private callbacks: ReplayCallbacks | null;
  private showingReplay = false;
  constructor(host: HTMLElement, callbacks: ReplayCallbacks) {
    this.callbacks = callbacks; this.root.className = 'replay-panel'; this.root.setAttribute('aria-label','战斗回放');
    const title = document.createElement('h3'); title.textContent = '已完成战斗回放';
    this.choices.setAttribute('aria-label','选择已完成战斗');
    this.choices.style.cssText = 'min-width:44px;min-height:44px;max-width:100%;width:100%';
    this.choices.onchange = () => { if (this.choices.value === '') return; const record = this.records[Number(this.choices.value)]; if (record) this.callbacks?.select(record); };
    this.slider.type = 'range'; this.slider.min = '0'; this.slider.step = '1'; this.slider.setAttribute('aria-label','按 tick 跳转');
    this.slider.style.cssText = 'min-height:44px;min-width:44px;width:100%';
    this.slider.oninput = () => this.callbacks?.seek(Number(this.slider.value));
    this.controls.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
    const button = (label: string, action: () => void) => { const b = document.createElement('button'); b.textContent = label; b.style.cssText = 'min-width:44px;min-height:44px'; b.onclick = action; this.controls.append(b); };
    button('播放',()=>this.callbacks?.play()); button('暂停',()=>this.callbacks?.pause());
    for (const value of [1,2,4] as const) button(`${value}×`,()=>this.callbacks?.speed(value));
    button('返回当前局',()=>this.callbacks?.close());
    this.root.append(title,this.choices,this.status,this.slider,this.controls); host.append(this.root); this.setRecords([]); this.render(null);
  }
  setRecords(records: readonly BattleRecord[]): void {
    this.records = records; this.choices.replaceChildren();
    const placeholder = document.createElement('option'); placeholder.textContent = records.length ? '请选择战斗' : '暂无已完成战斗'; placeholder.value = ''; this.choices.append(placeholder);
    records.forEach((record,index)=>{const option=document.createElement('option'); option.value=String(index); option.textContent=`第 ${record.context.round} 轮 · ${record.result === 'playerWin' ? '胜利' : record.result === 'enemyWin' ? '失败' : '平局'} · 对局 ${record.runId.slice(-8)}`; this.choices.append(option);});
  }
  setEnabled(enabled: boolean): void { this.choices.disabled = !enabled; }
  render(snapshot: ReplaySnapshot | null): void {
    // Reset only on exit: an idle render must not erase a selection while its
    // asynchronous open is waiting for the active save queue to finish.
    if (this.showingReplay && snapshot === null) this.choices.value = '';
    this.showingReplay = snapshot !== null;
    this.slider.disabled = !snapshot; this.slider.hidden = !snapshot; this.controls.hidden = !snapshot;
    this.status.textContent = snapshot ? `${snapshot.playing ? '播放中' : '已暂停'} · ${snapshot.speed}× · tick ${snapshot.tick} / ${snapshot.endTick}` : '在准备、结算或终局查看已完成战斗';
    if(snapshot) { this.slider.max=String(snapshot.endTick);this.slider.value=String(snapshot.tick); }
  }
  dispose(): void { this.callbacks=null;this.records=[];this.choices.onchange=null;this.slider.oninput=null;this.root.remove(); }
}
