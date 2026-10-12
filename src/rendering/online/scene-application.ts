import type { ReplaySnapshot } from '../../replay';
/** What BoardScene needs from whichever application drives it (offline MatchApplication or OnlineApplication). */
export interface SceneApplication {
  frame(delta: number): boolean;
  debug(): { readonly mode: string; readonly runId: string } & Record<string, unknown>;
  requestNew(): void;
  selectReplayUnit(id: string | null): void;
  replaySelectedUnit: string | null;
  readonly replay: ReplaySnapshot | null;
  dispose(): void;
}
