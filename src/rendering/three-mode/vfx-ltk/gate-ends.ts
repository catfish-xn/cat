/**
 * The cells a line effect opens at: the two ends of the rules' line of cells (CastReceipt.area, listed from one end to the
 * other), each facing the other end; a one-cell line opens once, facing `fallback` (the caster). Malzahar's gate.
 */
export function gateEnds<T>(cells: readonly T[]): { cell: T; facing: T | null }[] {
  if (!cells.length) return [];
  if (cells.length === 1) return [{ cell: cells[0]!, facing: null }];
  const first = cells[0]!, last = cells[cells.length - 1]!;
  return [{ cell: first, facing: last }, { cell: last, facing: first }];
}
