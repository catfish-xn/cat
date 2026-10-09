/**
 * Dismissible, reopenable help (M7 P0-D). Shows information and the reduced-motion
 * preference only: it never submits a game command or changes the seed.
 */
import { reducedMotion, setReducedMotion } from './preferences';

const SECTIONS: readonly (readonly [string, readonly string[]])[] = [
  ['快捷键', ['D：刷新商店（2 金币）', 'F：购买 4 点经验（4 金币）', 'E：出售鼠标悬停的我方棋子；没有悬停时出售已选中的棋子', '在输入框里打字不会触发快捷键']],
  ['布阵', ['把棋子从备战席拖到我方半场（下方四行）', '手机或触屏：在“部署”页签先点棋子，再点目标格', '人口上限等于等级；三个同名同星棋子自动升星']],
  ['装备', ['开局与每阶段 .4 补给、.7 野怪提供组件', '在“装备”页签点两件组件合成成装，再点单位的空装备槽穿戴；也可以把装备拖到棋子上', '出售棋子会返还它身上的装备', '选中物品后，各装备槽会提前标出能否装备、拒绝原因和冲突装备；合成按钮同样先显示能否合成。最终以实际操作结果为准', '窃贼手套独占三个装备槽，每轮生成的临时装备显示在单位详情中，只能查看、不能操作', '“装备”页签底部可展开装备图鉴与合成表；鼠标悬停或键盘聚焦装备可查看效果说明、唯一与占槽声明；合成表按 Tab 进入后用方向键移动。图鉴只是静态目录，能否合成或装备以实际操作结果为准']],
  ['阶段选择', ['2-1、3-2、4-2 三选一强化；4-6 先选目标棋子再选异常，可花 1 金币刷新', '选择期间运营暂停，完成后继续']],
  ['战斗与结算', ['点击“开始战斗”后自动进行，期间不能买卖和布阵', '结算后点击“继续”进入下一回合；生命归零或打完 6-7 时对局结束', '棋子中部的小字是当前状态：左侧红底为减益（灼=灼烧、伤=重伤、甲=护甲击碎、抗=魔抗击碎、晕=眩晕），右侧绿底为增益；名称、来源和剩余时间见单位详情与战斗统计', '伤害飘字：物理无后缀、魔法带“魔”、真实带“真”；“盾”为护盾吸收，“+”为有效治疗']],
  ['存档与回放', ['自动保存：显示“最近保存成功”才表示已写入', '可导出 / 导入对局文件；新局或导入会替换当前自动存档', '准备、结算或终局时可在“已完成战斗回放”里回看，回放不影响当前对局']],
];

export class HelpPanel {
  private readonly dialog = document.createElement('section');
  private returnFocus: HTMLElement | null = null;
  private readonly onKey = (event: KeyboardEvent) => {
    if (!this.open) return;
    if (event.key === 'Escape') { event.preventDefault(); this.close(); return; }
    if (event.key === 'Tab') {
      const targets = Array.from(this.dialog.querySelectorAll<HTMLButtonElement>('button'));
      const index = targets.indexOf(document.activeElement as HTMLButtonElement);
      event.preventDefault();
      targets[index < 0 ? 0 : (index + (event.shiftKey ? -1 : 1) + targets.length) % targets.length]?.focus();
    }
  };
  constructor(private readonly onMotionChange: () => void = () => {}) {
    this.dialog.className = 'help-overlay'; this.dialog.hidden = true;
    this.dialog.setAttribute('role', 'dialog'); this.dialog.setAttribute('aria-modal', 'true'); this.dialog.setAttribute('aria-label', '操作说明');
    this.dialog.dataset.debug = 'help-dialog';
    // Keep board input from receiving events that land on the help layer.
    for (const type of ['pointerdown', 'click', 'mousedown', 'mouseup', 'mousemove', 'touchstart', 'touchmove', 'touchend'])
      this.dialog.addEventListener(type, event => { event.stopPropagation(); if (event.target === this.dialog && type === 'click') this.close(); });
    document.body.append(this.dialog);
    document.addEventListener('keydown', this.onKey, true);
  }
  get open(): boolean { return !this.dialog.hidden; }
  show(): void {
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.render(); this.dialog.hidden = false; document.body.dataset.helpOpen = 'true';
    this.dialog.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }
  close(): void {
    if (!this.open) return;
    this.dialog.hidden = true; delete document.body.dataset.helpOpen;
    if (this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true });
    this.returnFocus = null;
  }
  private render(): void {
    const card = document.createElement('div'); card.className = 'help-dialog';
    const head = document.createElement('div'); head.className = 'help-head';
    const title = document.createElement('h2'); title.textContent = '怎么玩';
    const close = document.createElement('button'); close.type = 'button'; close.textContent = '关闭'; close.dataset.debug = 'help-close';
    close.addEventListener('click', () => this.close());
    head.append(title, close); card.append(head);
    const motion = document.createElement('button'); motion.type = 'button'; motion.dataset.debug = 'help-reduced-motion';
    const label = () => { motion.textContent = `减少动效：${reducedMotion() ? '开' : '关'}`; motion.setAttribute('aria-pressed', String(reducedMotion())); };
    motion.addEventListener('click', () => { setReducedMotion(!reducedMotion()); label(); this.onMotionChange(); });
    label(); card.append(motion);
    for (const [heading, lines] of SECTIONS) {
      const section = document.createElement('section'); const h3 = document.createElement('h3'); h3.textContent = heading;
      const list = document.createElement('ul');
      for (const line of lines) { const item = document.createElement('li'); item.textContent = line; list.append(item); }
      section.append(h3, list); card.append(section);
    }
    this.dialog.replaceChildren(card);
  }
  destroy(): void {
    document.removeEventListener('keydown', this.onKey, true);
    delete document.body.dataset.helpOpen; this.dialog.remove();
  }
}
