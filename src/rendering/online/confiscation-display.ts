import type { ConfiscationDependencies } from '../../presentation/confiscation-display';

/** Startup pushes can queue on this promise; failure keeps the original equipment drawing path. */
export function loadConfiscationDisplay(dependencies: ConfiscationDependencies) {
  return import('../../presentation/confiscation-display').then(module => new module.default(dependencies)).catch(() => undefined);
}
