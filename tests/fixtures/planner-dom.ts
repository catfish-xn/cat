import { vi } from 'vitest';

/** DOM recorder for planner controls/lifecycle. Passive icon HTML is deliberately not parsed. */
export function plannerDom() {
  let active: PlannerNode | null = null;
  class PlannerNode extends EventTarget {
    children: PlannerNode[] = [];
    parentElement: PlannerNode | null = null;
    dataset: Record<string, string> = {};
    className = ''; textContent = ''; type = ''; title = ''; id = ''; value = '';
    hidden = false; inert = false; disabled = false; open = false;
    style = { display: '' };
    attrs = new Map<string, string>();
    onclick?: () => void;
    constructor(readonly tagName: string) { super(); }
    get isConnected(): boolean { return this === html || !!this.parentElement?.isConnected; }
    get childElementCount() { return this.children.length; }
    classList = {
      contains: (name: string) => this.className.split(' ').includes(name),
      add: (...names: string[]) => { this.className = [...new Set([...this.className.split(' '), ...names])].join(' '); },
      toggle: (name: string, on: boolean) => { this.className = this.className.split(' ').filter(n => n !== name).concat(on ? [name] : []).join(' '); },
    };
    append(...nodes: PlannerNode[]) { for (const node of nodes) { node.remove(); this.children.push(node); node.parentElement = this; } }
    replaceChildren(...nodes: PlannerNode[]) { for (const child of [...this.children]) child.remove(); this.append(...nodes); }
    remove() {
      if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(node => node !== this);
      this.parentElement = null;
      if (this.contains(active)) active = body;
    }
    contains(node: PlannerNode | null): boolean { return node !== null && (node === this || this.children.some(child => child.contains(node))); }
    setAttribute(name: string, value: string) { this.attrs.set(name, value); }
    getAttribute(name: string) { return this.attrs.get(name) ?? null; }
    insertAdjacentHTML() {}
    focus() { if (this.isConnected && !this.disabled) active = this; }
    click() { if (!this.disabled) { this.onclick?.(); this.dispatchEvent(new Event('click')); } }
    showModal() { this.open = true; this.querySelector('button:not(:disabled)')?.focus(); }
    close() { this.open = false; }
    matches(selector: string): boolean {
      if (selector === '[hidden], [inert]') return this.hidden || this.inert;
      if (selector.endsWith(':not([hidden])')) return !this.hidden && this.matches(selector.replace(':not([hidden])', ''));
      if (selector.endsWith(':not(:disabled)')) return !this.disabled && this.matches(selector.replace(':not(:disabled)', ''));
      if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
      const attr = /^\[data-([\w-]+)="([^"]+)"\]$/.exec(selector);
      if (attr) return this.dataset[attr[1].replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())] === attr[2];
      return this.tagName === selector;
    }
    closest(selector: string): PlannerNode | null { return this.matches(selector) ? this : this.parentElement?.closest(selector) ?? null; }
    querySelectorAll(selector: string): PlannerNode[] {
      const split = selector.indexOf(' ');
      if (split >= 0) return this.querySelectorAll(selector.slice(0, split)).flatMap(node => node.querySelectorAll(selector.slice(split + 1)));
      return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
    }
    querySelector(selector: string): PlannerNode | null { return this.querySelectorAll(selector)[0] ?? null; }
  }
  const html = new PlannerNode('html'), head = new PlannerNode('head'), body = new PlannerNode('body');
  html.append(head, body); active = body;
  const document = { body, head, createElement: (tag: string) => new PlannerNode(tag), get activeElement() { return active; },
    querySelector: (selector: string) => html.querySelector(selector), querySelectorAll: (selector: string) => html.querySelectorAll(selector) };
  // Node's EventTarget does not remove capture listeners with a boolean option;
  // normalize it to the equivalent options object to model browser behavior.
  class WindowTarget extends EventTarget {
    override removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean) {
      super.removeEventListener(type, callback, typeof options === 'boolean' ? { capture: options } : options);
    }
  }
  const window = new WindowTarget();
  const observers: { callback: () => void; options?: MutationObserverInit }[] = [];
  class Observer {
    record: typeof observers[number];
    constructor(callback: () => void) { this.record = { callback }; observers.push(this.record); }
    observe(_target: unknown, options: MutationObserverInit) { this.record.options = options; }
  }
  const data = new Map<string, string>();
  vi.stubGlobal('document', document); vi.stubGlobal('window', window); vi.stubGlobal('MutationObserver', Observer);
  vi.stubGlobal('getComputedStyle', (node: PlannerNode) => ({ display: node.style.display || 'block' }));
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
  const make = (tag: string, className = '') => { const node = new PlannerNode(tag); node.className = className; return node; };
  return { document, window, data, make, observers, flush: () => observers.forEach(observer => observer.callback()) };
}
