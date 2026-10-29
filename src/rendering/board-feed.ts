/**
 * Bridge between the 2D BoardScene and the optional 3D layer (?render=3d). Without a subscriber every publish is a
 * single boolean check, so the default 2D path builds nothing. Frames and events flow out read-only; input flows back
 * only through BoardControls, which BoardScene implements with its own 2D gesture code and the same session commands.
 */
import type { MelSaveReceipt } from './mel-save-feedback';
import type { DisplayCombatEvent } from '../presentation/combat-display';
import type { PublicBoard, PublicOrbSummary } from '../server/protocol';
import type { LegendWalk, LegendWalkRequest } from '../server/legend-motion';
import { readLegendChoice } from './legend-choice';

export interface BoardPiece {
  readonly id: string; readonly definitionId: string; readonly team: 'player' | 'enemy'; readonly starLevel: number;
  /** 4 on a promoted 终极英雄 (mine, or an opponent's in a shown battle); `starLevel` stays physical. Draw `effectiveStarLevel ?? starLevel` stars in `starColor`. */
  readonly effectiveStarLevel?: 4;
  /** The combat snapshot's frozen form, independent of movement/tween coordinates. */
  readonly form?: 'melee' | 'ranged';
  /** A PvE monster (hero-identity `neutral`, from the neutral catalog); the 3D layer gives it no star row. */
  readonly neutral?: true;
  /** BoardScene logical coordinates of the drawn token (tweens included); 3D maps x→x and y→z. */
  readonly x: number; readonly y: number;
  /** Authoritative bench cell, independent of the token's transient drag/tween coordinates. Absent on the board. */
  readonly benchSlot?: number | null;
  /** Shown on the board apart from dying: a unit killed in this combat stays visible here and is flagged by `alive`. */
  readonly visible: boolean;
  /** False once the shown combat has killed it; the 3D layer plays the death action before hiding the piece. */
  readonly alive: boolean;
  /** The 2D combat meters while BoardScene draws them (a shown combat, alive); absent otherwise. */
  readonly meters?: BoardMeters;
  /** Server-projected Enforcer wanted target; display only. */
  readonly enforcerWanted?: boolean;
  /** Worn items in slot order, then this round's temporary (窃贼手套) items, with the 2D icon URL (null when there is none); absent when it has none. */
  readonly items?: readonly { readonly id: string; readonly icon: string | null; readonly stacks?: number; readonly maxStacks?: number }[];
  /** Crowd control on it in the shown combat (presentation/control-display.ts): 'airborne' is a knock-up; absent when none. */
  readonly control?: 'stun' | 'airborne';
}
export interface BoardMeters { readonly hp: number; readonly maxHp: number; readonly mana: number; readonly maxMana: number; readonly shield: number }
export interface BoardFrame {
  readonly rows: number; readonly columns: number; readonly hexRadius: number; readonly origin: { readonly x: number; readonly y: number };
  readonly bench: readonly { readonly x: number; readonly y: number }[];
  readonly pieces: readonly BoardPiece[];
  /** True while a combat is shown; the 3D layer resets per-unit action state when this flips. */
  readonly fighting: boolean;
  /** The unit BoardScene is dragging (either input), or null; the 3D layer drops its own drag once this clears. */
  readonly dragging: string | null;
  /** Owner-only sacrifice marker from the private seat view, or null when hidden. */
  readonly mutationSacrificeCell?: { readonly col: number; readonly row: number } | null;
  /** v15 (online): my unclaimed orbs as the private view lists them (oldest first); empty offline. Where they sit is the layer's own layout. */
  readonly orbs?: readonly BoardOrb[];
  /** Orbs (by orbId) with a claim receipt that granted something (not forfeited); an orb that leaves `orbs` and is named here was opened. */
  readonly openedOrbs?: readonly string[];
  /** How many claims of each orb still listed the session refused (the orb dock put it back); absent orbs have none. */
  readonly orbRefusals?: Readonly<Record<string, number>>;
  /** My HP loss of the latest settled round (roundResults, the server's projection online); null when it cost none. */
  readonly hit?: BoardHit | null;
  /** My own 征服层数 and 微光 (owner-only, like the trait column's counters; never another seat's), for the 3D chest and flask. */
  readonly mechanics?: BoardMechanics;
  /** Online owner-only banked-gold light count; absent offline and before my first private view. Display only. */
  readonly goldMines?: number;
  /** Latest settled round whose deferred income has reached my bank (next round entered); null before any payment. */
  readonly goldMineIncomeKey?: string | null;
}
/** Absent parts are not in play (trait not fielded and nothing gathered yet). */
export interface BoardMechanics {
  /** 征服层数 with the band toward the next chest: `from` is the last opened chest's threshold, `next` null once all are open. */
  readonly conquest?: { readonly stacks: number; readonly opened: number; readonly from: number; readonly next: number | null };
  /** 微光 with the next black-market breakpoint (null past the last); `offer` while a black market waits for an answer. */
  readonly shimmer?: { readonly value: number; readonly next: number | null; readonly offer: boolean };
  /** 家人团聚 easter egg: the six reunited units (rules' familyReunionParticipants), dancing in planning; absent otherwise. */
  readonly reunion?: readonly string[];
}
export interface BoardOrb {
  readonly orbId: string; readonly tier: 'gray' | 'blue' | 'gold' | 'prismatic'; readonly queued: boolean;
  /** S13 trait orb skin, only when this seat's own mechanic receipt names it (see orbVariant); absent → the generic tier. */
  readonly variant?: 'warband' | 'crime';
  /** The PvE monster (its combat unit id, the drop's sourceUnitId) that dropped it, while this round's loot names one. */
  readonly source?: string;
}
/** `key` names the round, so the layer plays each loss once and skips the one already settled when it mounts. */
export interface BoardHit { readonly key: string; readonly damage: number }
export interface BoardDropHint {
  /** Where the dragged unit would land, as BoardScene's own hit test reads the point; undefined over nothing. */
  readonly target?: { readonly kind: 'board'; readonly x: number; readonly y: number } | { readonly kind: 'bench'; readonly x: number; readonly y: number };
  /** False when the 2D board would refuse the drop (the status line says why); the session still decides. */
  readonly allowed: boolean;
}
/**
 * The 3D layer's pointer, replayed as 2D board gestures. Points are BoardScene logical coordinates (3D x→x, z→y);
 * `client` is the CSS pixel position, used to tell a release over the shop (sell) from one over the board.
 */
export interface BoardControls {
  hover(id: string | null): void;
  /** The piece of any team under the pointer, for its description card only (never a command target). */
  look?(id: string | null): void;
  /** Read-only scene description. Boxes are projected CSS pixels; null dismisses it. */
  describe?(target: BoardDescription | null, box?: BoardScreenBox): void;
  select(id: string): void;
  /** False when the 2D board would not let this unit be dragged now. */
  dragStart(id: string): boolean;
  dragMove(point: { x: number; y: number }): BoardDropHint;
  dragEnd(point: { x: number; y: number } | null, client: { x: number; y: number }): void;
  dragCancel(): void;
  /** v15: the same as clicking that orb on the 2D orb dock (the dock decides whether it can be claimed now). */
  claimOrb?(orbId: string): void;
}
export type BoardDescription =
  | { readonly kind: 'unit'; readonly id: string }
  | { readonly kind: 'carousel'; readonly unit: BoardCarouselSlot }
  | { readonly kind: 'item'; readonly id: string }
  | { readonly kind: 'orb'; readonly id: string }
  | { readonly kind: 'public-orbs'; readonly count: number; readonly tiers: readonly string[] };
export interface BoardFeedListener {
  playerSaved?(event: MelSaveReceipt): void;
  frame(frame: BoardFrame): void; events(events: readonly DisplayCombatEvent[]): void;
  /** The visible piece (either team) drawn under a CSS-pixel point, by the layer's own picking; undefined over none. */
  unitAt?(client: { x: number; y: number }): string | undefined;
  /** CSS-pixel box of the drawn piece as the layer projects it; undefined when the piece is not drawn or off screen. */
  screenBox?(id: string): BoardScreenBox | undefined;
  /** Online 选秀 to draw instead of the board, or null to show the board again (and release the stage). */
  carousel?(view: BoardCarousel | null): void;
  /** Another seat's public build to draw instead of my board (3D 看对手), or null to show mine again. */
  scout?(view: BoardScout | null): void;
  /** A little-legend walk the room took (any seat, either scene). */
  legendWalk?(walk: BoardLegendWalk): void;
  /** Sends my legend onto my orb, which it claims on arrival (BoardControls.claimOrb); false when it cannot go there now. */
  walkToOrb?(orbId: string): boolean;
}
/**
 * A walk as the room published it (src/server/legend-motion.ts) with its times moved onto performance.now(), and whose
 * legend it is from my seat: mine, the opponent of this round, or another seat.
 */
export interface BoardLegendWalk extends Omit<LegendWalk, 'startedAt' | 'arriveAt'> { readonly startedAt: number; readonly arriveAt: number; readonly who: 'me' | 'opponent' | 'other' }
/** Sends my legend's walk to the room; false when this client cannot (no room, or a client without walks: then it is local only). */
export interface LegendControls { walk(request: LegendWalkRequest): boolean }
export interface BoardScreenBox { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }
/**
 * Online 选秀 (docs/ASSETS3D_CAROUSEL.md 界面接线需求) as the 3D layer draws it: copied from `PlayerView.carousel` by the
 * online application while the carousel side is shown, null otherwise. Display only; the layer decides nothing.
 */
export interface BoardCarousel {
  /** The carousel id; a new one rebuilds the stage. */
  readonly id: string;
  readonly slots: readonly BoardCarouselSlot[];
  /**
   * Public seat order (stable legend anchors) with each seat's release time (logical ms; Infinity when the view has none):
   * the layer holds a seat while the carousel clock is before it, and a seat has picked once a slot names it in `pickedBy`.
   */
  readonly seats: readonly { readonly seatId: string; readonly me: boolean; readonly releaseAtMs: number; readonly legend?: string }[];
  /** Logical ms since the carousel opened, as of `at` (performance.now()); the ring's angle and the release clock run from it. */
  readonly elapsedMs: number;
  readonly at: number;
}
export interface BoardCarouselSlot {
  readonly slot: number; readonly definitionId: string; readonly starLevel: number;
  /** The unit's shop cost (1–5), from the 2D hero identity; the 3D stage draws the matching quality ring. */
  readonly cost?: number;
  /** Item ids with the 2D icon URL (null when there is none). */
  readonly items: readonly { readonly id: string; readonly icon: string | null }[];
  /** Seat that took it in the server's view, null while it stands: that seat's legend fetches it (the server's own field). */
  readonly pickedBy: string | null;
  /** The 2D panel would take a click on it now (my batch is out, it still stands, no pick is pending). */
  readonly takable: boolean;
  /** My click on it is still waiting for the server's answer. */
  readonly pending: boolean;
}
/**
 * 3D 看对手: the seat the scout panel shows, as published to every seat (SeatPublic.publicBoard and .orbs, passed as
 * received). The server never sends another seat's gold, XP, streak or shop; the 3D layer still copies only the fields
 * it draws (scout-stage.ts readScout).
 */
export interface BoardScout {
  readonly seatId: string; readonly name: string; readonly board?: PublicBoard; readonly orbs?: PublicOrbSummary | null;
  /** The seat's little legend (SeatPublic.legend, cosmetic); absent means the default. */
  readonly legend?: string;
  /** Its battle of this round is playing on my board (my frames carry it): nothing static is drawn, the board still takes no input. */
  readonly watching?: true;
}
/** The 3D carousel's pointer, replayed as the 2D carousel panel's own slot click and hover. */
export interface CarouselControls { pick(slot: number): void; hover(slot: number | null): void }

let listener: BoardFeedListener | null = null, listenerGeneration = 0, controls: BoardControls | null = null, carouselControls: CarouselControls | null = null,
  legendControls: LegendControls | null = null;

export const boardFeedActive = (): boolean => listener !== null;
/** Grows each time a layer subscribes, so a publisher of state that changes rarely (the carousel) can resend it once. */
export const boardFeedGeneration = (): number => listenerGeneration;
/** null when no layer answers (2D picks itself); otherwise the layer's piece under the point, if any. */
export function boardFeedUnitAt(client: { x: number; y: number }): string | undefined | null {
  return listener?.unitAt ? listener.unitAt(client) : null;
}
/** null when no layer answers (2D places its own cards); otherwise where the layer drew the piece, if anywhere. */
export function boardFeedScreenBox(id: string): BoardScreenBox | undefined | null {
  return listener?.screenBox ? listener.screenBox(id) : null;
}
/** null when no layer walks to orbs (the orb dock claims itself); otherwise whether my legend set off for it. */
export function boardFeedWalkToOrb(orbId: string): boolean | null {
  return listener?.walkToOrb ? listener.walkToOrb(orbId) : null;
}
export function publishBoardFrame(build: () => BoardFrame): void { if (listener) listener.frame(build()); }
export function publishCombatEvents(build: () => readonly DisplayCombatEvent[]): void {
  if (!listener) return;
  const events = build();
  if (events.length) listener.events(events);
}
/** Only a layer that draws the carousel gets the build called; true when one does (the 2D panel then hides its ring). */
export function publishCarousel(build: () => BoardCarousel | null): boolean {
  if (!listener?.carousel) return false;
  listener.carousel(build());
  return true;
}
/** Only a layer that draws scouting gets the build called; true when one does (the 2D panel then shrinks to its strip). */
export function publishScout(build: () => BoardScout | null): boolean {
  if (!listener?.scout) return false;
  listener.scout(build());
  return true;
}
export function publishPlayerSaved(event: MelSaveReceipt): void { listener?.playerSaved?.(event); }
export function publishLegendWalk(walk: BoardLegendWalk): void { listener?.legendWalk?.(walk); }
/** One 3D layer at a time; the returned function detaches it. */
export function subscribeBoardFeed(next: BoardFeedListener): () => void {
  listener = next; listenerGeneration++;
  // Detaching also moves the generation on, so whatever a 3D layer drew (carousel, scout) goes back to 2D on the next frame.
  return () => { if (listener === next) { listener = null; listenerGeneration++; } };
}
/** BoardScene registers its controls while it runs; the returned function withdraws them. */
export function provideBoardControls(next: BoardControls): () => void {
  controls = next;
  return () => { if (controls === next) controls = null; };
}
/** The online application registers the carousel panel's click and hover; the returned function withdraws them. */
export function provideCarouselControls(next: CarouselControls): () => void {
  carouselControls = next;
  return () => { if (carouselControls === next) carouselControls = null; };
}

/**
 * Little legends (cosmetic) the 3D layer draws beside the board: mine and the shown PvP opponent's, as the online view
 * names them (SeatPublic.legend). Offline, or before the first view, mine is this browser's pick and there is no opponent.
 */
export interface BoardLegends { readonly me: string; readonly opponent: string | null }
let legends: BoardLegends | null = null;
/** The online application sets this from each view; null when it leaves the match. */
export function setBoardLegends(next: BoardLegends | null): void { legends = next; }
const currentLegends = (): BoardLegends => legends ?? { me: readLegendChoice(), opponent: null };

/**
 * The lobby's 外观 panel, drawn by the 3D chunk (three-mode/legend-picker.ts) once a mounted layer has an asset root.
 * Opens in `host` on `current` among `choices`; `pick` gets each choice the player makes, `closed` runs once it is gone
 * (its own close button or the returned close).
 */
export interface LegendPickerOptions { readonly choices: readonly string[]; readonly current: string; pick(id: string): void; closed(): void }
export type LegendPicker = (host: HTMLElement, options: LegendPickerOptions) => () => void;
let legendPicker: LegendPicker | null = null;
const pickerWatchers = new Set<(picker: LegendPicker | null) => void>();
function provideLegendPicker(next: LegendPicker | null): void { legendPicker = next; for (const watch of pickerWatchers) watch(next); }
/** The lobby watches whether a picker is offered (called now and on every change); the returned function stops. */
export function watchLegendPicker(watch: (picker: LegendPicker | null) => void): () => void {
  pickerWatchers.add(watch); watch(legendPicker);
  return () => { pickerWatchers.delete(watch); };
}

/** The online application registers my legend's walk to the room; the returned function withdraws it. */
export function provideLegendControls(next: LegendControls): () => void {
  legendControls = next;
  return () => { if (legendControls === next) legendControls = null; };
}

/**
 * Champion ids the 3D layer may warm ahead (three-mode/model-warmup.ts), most likely first: my shop's heroes, the next
 * opponent's public board, the board I scout. The online application sets them from each view and state push; the
 * version grows only when the list changes, so the layer asks for new models once.
 */
export interface BoardWarmHints { readonly version: number; readonly ids: readonly string[] }
let warmHints: BoardWarmHints = { version: 0, ids: [] }, warmKey = '';
export function setBoardWarmHints(ids: readonly string[]): void {
  const unique = [...new Set(ids)], key = unique.join(',');
  if (key === warmKey) return;
  warmKey = key; warmHints = { version: warmHints.version + 1, ids: unique };
}

/** What three-loader.ts hands the 3D chunk (it must not import this module itself; see placeholder-renderer.ts). */
export interface BoardFeed {
  subscribe(next: BoardFeedListener): () => void; controls(): BoardControls | null; carouselControls?(): CarouselControls | null;
  legends?(): BoardLegends; provideLegendPicker?(next: LegendPicker | null): void; legendControls?(): LegendControls | null;
  warmHints?(): BoardWarmHints;
}
export const boardFeed: BoardFeed = { subscribe: subscribeBoardFeed, controls: () => controls, carouselControls: () => carouselControls,
  legends: currentLegends, provideLegendPicker, legendControls: () => legendControls, warmHints: () => warmHints };
