import { isPlanned, type PlannerState } from './model';

/** Idempotent DOM decoration; never changes purchase handlers, disabled state or upgrade markers. */
export function highlightShop(scope: ParentNode, state: PlannerState): void {
  for (const card of Array.from(scope.querySelectorAll<HTMLElement>('.shop-card'))) {
    const planned = isPlanned(state, card.dataset.unitDef);
    if (planned === card.classList.contains('planned')) continue;
    card.classList.toggle('planned', planned);
    const suffix = '，在阵容规划中', label = (card.getAttribute('aria-label') ?? '').replace(suffix, '');
    if (planned) {
      const mark = document.createElement('span'); mark.textContent = '规划'; mark.className = 'planner-mark';
      mark.setAttribute('aria-hidden', 'true'); card.append(mark); card.setAttribute('aria-label', label + suffix);
    } else { card.querySelector('.planner-mark')?.remove(); card.setAttribute('aria-label', label); }
  }
}
