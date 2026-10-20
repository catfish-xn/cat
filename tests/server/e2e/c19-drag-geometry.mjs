/** Keep the real mouse's source and destination visible together before reading their coordinates.
 * A nonzero debug rectangle may still be below the viewport (notably under the PvE loot cards). */
export async function showDragEndpoints(page, sourceDebug, targetDebug) {
  await page.evaluate(async ({ sourceDebug, targetDebug }) => {
    const keys = [sourceDebug, targetDebug];
    const nodes = keys.map(debug => document.querySelector(`[data-debug="${CSS.escape(debug)}"]`)
      ?? (debug.startsWith('unit:') ? document.querySelector('canvas') : null));
    if (nodes.some(node => !node)) throw new Error('C19 drag endpoint is missing');
    const rectangle = (node, index) => {
      if (node.tagName !== 'CANVAS') return node.getBoundingClientRect();
      const id = keys[index].slice('unit:'.length);
      const token = window.__CAT_DEBUG__.read().tokens.find(token => token.visible && (token.owner ?? token.id) === id);
      if (!token) throw new Error(`C19 visible unit is missing: ${id}`);
      return { left: token.screenX - 1, top: token.screenY - 1, width: 2, height: 2, bottom: token.screenY + 1 };
    };
    const rects = nodes.map(rectangle);
    const top = Math.min(...rects.map(rect => rect.top)), bottom = Math.max(...rects.map(rect => rect.bottom));
    if (bottom - top > innerHeight) throw new Error('C19 drag endpoints cannot fit in the viewport together');
    window.scrollBy(0, (top + bottom - innerHeight) / 2);
    // Scroll cancels existing gestures in the UI; let it finish before starting this one.
    await new Promise(resolve => requestAnimationFrame(resolve));
    for (const [index, node] of nodes.entries()) {
      const rect = rectangle(node, index), x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      if ((node.tagName === 'CANVAS' ? hit : hit?.closest('[data-debug]')) !== node)
        throw new Error(`C19 drag endpoint is not hittable: ${[sourceDebug, targetDebug][index]}`);
    }
  }, { sourceDebug, targetDebug });
}
