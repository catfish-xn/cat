import { describe, expect, it } from 'vitest';
import { mountFullscreenToggle } from '../src/rendering/fullscreen-toggle';

// Just enough of a DOM for the toggle: one button, the body dataset and fullscreenchange.
function fakeDocument(enabled: boolean) {
  const listeners = new Map<string, () => void>();
  const button = { type: '', className: '', dataset: {} as Record<string, string>, textContent: '', title: '', attrs: {} as Record<string, string>,
    click: () => {}, removed: false,
    setAttribute(name: string, value: string) { this.attrs[name] = value; },
    addEventListener(_: string, fn: () => void) { this.click = fn; }, remove() { this.removed = true; } };
  const doc = {
    fullscreenEnabled: enabled, fullscreenElement: null as unknown, requests: 0, exits: 0,
    body: { dataset: {} as Record<string, string> },
    documentElement: { requestFullscreen() { doc.requests++; return Promise.resolve(); } },
    exitFullscreen() { doc.exits++; return Promise.resolve(); },
    createElement: () => button,
    addEventListener(type: string, fn: () => void) { listeners.set(type, fn); },
    removeEventListener(type: string) { listeners.delete(type); },
    fire(type: string) { listeners.get(type)?.(); },
  };
  const host = { children: [] as unknown[], append(node: unknown) { this.children.push(node); } };
  return { doc, button, host };
}

describe('fullscreen toggle', () => {
  it('adds no button where the Fullscreen API is missing', () => {
    const { doc, host } = fakeDocument(false);
    mountFullscreenToggle(host as never, doc as never)();
    expect(host.children).toHaveLength(0);
  });
  it('enters on click, follows fullscreenchange (Esc included) and cleans up', () => {
    const { doc, button, host } = fakeDocument(true);
    const dispose = mountFullscreenToggle(host as never, doc as never);
    expect(host.children).toEqual([button]);
    expect(button.textContent).toBe('全屏'); expect(button.attrs['aria-pressed']).toBe('false');
    button.click(); expect(doc.requests).toBe(1);
    doc.fullscreenElement = doc.documentElement; doc.fire('fullscreenchange');
    expect(button.textContent).toBe('退出全屏'); expect('fullscreen' in doc.body.dataset).toBe(true);
    button.click(); expect(doc.exits).toBe(1);
    doc.fullscreenElement = null; doc.fire('fullscreenchange'); // also what Esc produces
    expect(button.textContent).toBe('全屏'); expect('fullscreen' in doc.body.dataset).toBe(false);
    dispose(); expect(button.removed).toBe(true);
  });
});
