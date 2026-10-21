/**
 * 3D shop fold (TFT hides the shop to show the whole board): a small tab over the shop bar folds it away and the board box
 * takes the room; clicking it again brings the shop back. Shown in 3D only (CSS); presentation only, not kept across loads.
 */
export class ShopToggle {
  readonly button = document.createElement('button');
  constructor(host: HTMLElement | null = document.getElementById('board-frame')) {
    const button = this.button; button.type = 'button'; button.className = 'shop-toggle'; button.dataset.debug = 'online:shop-toggle';
    button.setAttribute('aria-controls', 'shop-dock'); button.addEventListener('click', () => this.set(!this.folded));
    host?.append(button); this.set(false);
  }
  get folded(): boolean { return document.body.dataset.onlineShop === 'folded'; }
  set(folded: boolean): void {
    if (folded) document.body.dataset.onlineShop = 'folded'; else delete document.body.dataset.onlineShop;
    this.button.textContent = folded ? '商店 ▴' : '▾'; this.button.title = folded ? '展开商店' : '收起商店，棋盘占满下方';
    this.button.setAttribute('aria-expanded', String(!folded));
  }
  dispose(): void { this.button.remove(); delete document.body.dataset.onlineShop; }
}
