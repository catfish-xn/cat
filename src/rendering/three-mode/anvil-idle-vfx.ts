/**
 * Anvils' (锻造器) own 14.24 idle particles (skin0 idleParticlesEffects on Root). The support anvil uses the completed
 * anvil's ArmoryKey_B mesh and texture in the client; its blue idle glow is what sets the two apart (the completed one
 * is purple). Systems come from the asset root's vfx-ltk catalogue under these keys, as one 'passive' cast-start cue on
 * Root (cue duration = one loop, at most 10 s); without them nothing plays.
 */
export const ANVIL_IDLE_VFX: Readonly<Record<string, string>> = Object.freeze({
  TFT_ArmoryKeyComponent: 'anvil-component',
  TFT_ArmoryKeyCompleted: 'anvil-completed',
  TFT_ArmoryKeyOrnn: 'anvil-ornn',
  TFT_ArmoryKeySupport: 'anvil-support',
});
/** At most this many anvils glow at once, so a full bench cannot crowd out combat effects or cost frames. */
export const MAX_ANVIL_IDLES = 3;
const CHECK_SECONDS = 0.5;

export interface AnvilIdleHost {
  /** Starts the catalogue's idle cue on that piece; false while the catalogue is still loading or missing. */
  play(key: string, pieceId: string): boolean;
  /** True while a started idle cue is still queued or running on the piece. */
  playing(pieceId: string): boolean;
  stop(pieceId: string): void;
}
export interface AnvilPiece { readonly id: string; readonly definitionId: string; readonly alive: boolean }

/** Keeps each shown anvil's idle system running: restarts it when its cue ends, stops it when the anvil goes. */
export function createAnvilIdleLoop(host: AnvilIdleHost) {
  const glowing = new Set<string>();
  let wait = 0;
  const stopAll = () => { for (const id of glowing) host.stop(id); glowing.clear(); };
  return {
    update(seconds: number, pieces: Iterable<AnvilPiece>, reduced: boolean): void {
      wait -= seconds;
      if (wait > 0) return;
      wait = CHECK_SECONDS;
      if (reduced) { stopAll(); return; }
      const shown = [...pieces].filter(piece => piece.alive && Object.hasOwn(ANVIL_IDLE_VFX, piece.definitionId))
        .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).slice(0, MAX_ANVIL_IDLES);
      const keep = new Set(shown.map(piece => piece.id));
      for (const id of glowing) if (!keep.has(id)) { host.stop(id); glowing.delete(id); }
      for (const piece of shown) {
        if (glowing.has(piece.id) && host.playing(piece.id)) continue;
        if (host.play(ANVIL_IDLE_VFX[piece.definitionId]!, piece.id)) glowing.add(piece.id); else glowing.delete(piece.id);
      }
    },
    /** Forget every glow (the runtime was cleared); the next update restarts the ones still shown. */
    reset(): void { glowing.clear(); wait = 0; },
    stopAll,
  };
}
