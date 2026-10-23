/**
 * A small top-right button that puts the whole page (board, HUD and panels) into browser fullscreen.
 * Esc or the button leaves it. While fullscreen, body[data-fullscreen] lifts the desktop size caps so the
 * board grows with the screen; Phaser FIT and the 3D layer follow #board-root's size on their own.
 * Browsers without the Fullscreen API (iPhone Safari) get no button. Display only: nothing reaches a rule.
 */
export function mountFullscreenToggle(host: HTMLElement, doc: Document = document): () => void {
  const root = doc.documentElement;
  if (!doc.fullscreenEnabled || typeof root.requestFullscreen !== 'function') return () => {};
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'fullscreen-toggle';
  button.dataset.debug = 'fullscreen-toggle';
  const sync = () => {
    const active = doc.fullscreenElement !== null;
    button.textContent = active ? '退出全屏' : '全屏';
    button.title = active ? '退出全屏（Esc）' : '全屏显示';
    button.setAttribute('aria-pressed', String(active));
    if (active) doc.body.dataset.fullscreen = ''; else delete doc.body.dataset.fullscreen;
  };
  button.addEventListener('click', () => {
    const request = doc.fullscreenElement ? doc.exitFullscreen() : root.requestFullscreen({ navigationUI: 'hide' });
    request.catch(sync); // a refused request leaves the page as it was
  });
  doc.addEventListener('fullscreenchange', sync);
  sync();
  host.append(button);
  return () => { doc.removeEventListener('fullscreenchange', sync); button.remove(); delete doc.body.dataset.fullscreen; };
}
