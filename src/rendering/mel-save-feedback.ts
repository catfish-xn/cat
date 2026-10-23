import './mel-save-feedback.css';
import { reducedMotion } from '../presentation/preferences';
/** Settlement feedback shared by 2D and 3D. Only a confirmed Mel receipt starts it. */
export const MEL_SAVE_MS = 2000;
export interface MelSaveReceipt { readonly type: 'playerSaved'; readonly source: 'mel'; readonly battleId: string }
export function createMelSaveFeedback(host: HTMLElement, onSaved: (event: MelSaveReceipt) => void = () => {}) {
  const seen = new Set<string>();
  let element: HTMLElement | null = null, timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => { clearTimeout(timer); element?.remove(); element = null; };
  return {
    push(events: readonly { readonly type: string }[]) {
      for (const event of events) {
        if (event.type !== 'playerSaved') continue;
        const receipt = event as MelSaveReceipt;
        if (receipt.source !== 'mel' || !receipt.battleId || seen.has(receipt.battleId)) continue;
        seen.add(receipt.battleId); clear();
        element = document.createElement('div'); element.className = `mel-save-feedback${reducedMotion() ? ' mel-save-reduced' : ''}`;
        element.setAttribute('role', 'status'); element.setAttribute('aria-label', '梅尔 · 免死');
        const shield = document.createElement('span'); shield.className = 'mel-save-shield'; shield.setAttribute('aria-hidden', 'true');
        const label = document.createElement('strong'); label.textContent = '免死';
        element.append(shield, label); host.append(element);
        timer = setTimeout(clear, MEL_SAVE_MS);
        onSaved(receipt);
      }
    },
    reset() { clear(); seen.clear(); },
    dispose() { clear(); seen.clear(); },
  };
}
