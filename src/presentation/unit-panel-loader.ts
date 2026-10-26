import type { UnitPanel, UnitPanelData } from './unit-panel';
export interface InspectPoint { x: number; y: number }
/** null = empty board; undefined = outside board. Native capture works even for non-interactive enemy tokens. */
export function installUnitInspect(resolve: (point: InspectPoint, target: EventTarget | null) => UnitPanelData | null | undefined,
  read: (id: string) => UnitPanelData | null, dragging: () => boolean): { refresh(now: number): void; readonly pinned: boolean; dispose(): void } {
  let panel: UnitPanel | undefined, pending: Promise<UnitPanel> | undefined, alive = true, generation = 0;
  let press: { id: number; x: number; y: number; unit: UnitPanelData | null; moved: boolean } | undefined;
  const down = (e: PointerEvent) => {
    if (e.button !== 0 || !e.isPrimary) return;
    const unit = resolve({ x: e.clientX, y: e.clientY }, e.target);
    if (unit === undefined) return;
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, unit, moved: false };
  };
  const move = (e: PointerEvent) => { if (press?.id === e.pointerId && (Math.hypot(e.clientX - press.x, e.clientY - press.y) >= 6 || dragging())) press.moved = true; };
  const cancel = () => { press = undefined; generation++; };
  const up = (e: PointerEvent) => {
    if (!press || press.id !== e.pointerId) return;
    move(e); const start = press; press = undefined;
    if (start.moved || dragging()) return;
    const unit = resolve({ x: e.clientX, y: e.clientY }, e.target);
    const ticket = ++generation;
    if (unit === null && start.unit === null) { panel?.close(); return; }
    if (!unit || unit.id !== start.unit?.id) return;
    (pending ??= import('./unit-panel').then(module => module.createUnitPanel())).then(value => {
      if (!alive) { value.dispose(); return; } panel = value;
      if (ticket === generation) value.pin(() => read(unit.id));
    }).catch(() => { pending = undefined; });
  };
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { generation++; panel?.close(); } };
  window.addEventListener('pointerdown', down, true); window.addEventListener('pointermove', move, true); window.addEventListener('pointerup', up, true);
  window.addEventListener('pointercancel', cancel, true); window.addEventListener('blur', cancel); window.addEventListener('keydown', key, true);
  return { get pinned() { return !!panel && !panel.root.hidden; }, refresh: now => { if (press && dragging()) press.moved = true; panel?.refresh(now); }, dispose: () => {
    alive = false; cancel(); panel?.dispose(); window.removeEventListener('pointerdown', down, true); window.removeEventListener('pointermove', move, true);
    window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', cancel, true); window.removeEventListener('blur', cancel); window.removeEventListener('keydown', key, true);
  } };
}
