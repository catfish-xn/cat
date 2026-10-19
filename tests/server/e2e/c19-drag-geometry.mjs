/** Keep the real mouse's source and destination visible together before reading their coordinates.
 * A nonzero debug rectangle may still be below the viewport (notably under the PvE loot cards). */
export async function showDragEndpoints(page, sourceDebug, targetDebug) {
  await page.evaluate(async ({ sourceDebug, targetDebug }) => {
    const nodes = [sourceDebug, targetDebug].map(debug => document.querySelector(`[data-debug="${CSS.escape(debug)}"]`));
    if (nodes.some(node => !node)) throw new Error('C19 drag endpoint is missing');
    const rects = nodes.map(node => node.getBoundingClientRect());
    const top = Math.min(...rects.map(rect => rect.top)), bottom = Math.max(...rects.map(rect => rect.bottom));
    if (bottom - top > innerHeight) throw new Error('C19 drag endpoints cannot fit in the viewport together');
    window.scrollBy(0, (top + bottom - innerHeight) / 2);
    // Scroll cancels existing gestures in the UI; let it finish before starting this one.
    await new Promise(resolve => requestAnimationFrame(resolve));
    for (const [index, node] of nodes.entries()) {
      const rect = node.getBoundingClientRect(), x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
      if (document.elementFromPoint(x, y)?.closest('[data-debug]') !== node)
        throw new Error(`C19 drag endpoint is not hittable: ${[sourceDebug, targetDebug][index]}`);
    }
  }, { sourceDebug, targetDebug });
}
