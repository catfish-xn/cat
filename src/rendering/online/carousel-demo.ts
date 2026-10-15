/**
 * Preview-only carousel (`?mode=online&carouselDemo=1`): fake data that drives CarouselPanel before or without the
 * server carousel, so its layout and flow can be checked by eye. Nothing here reaches the room or the rules: the
 * units, items, release order and the other seats' picks are made up and the bench does not change.
 */
import { COMPONENT_IDS } from '../../simulation/content/items';
import { SHOP_CATALOG } from '../../simulation/match-rules';
import type { CarouselSlotView, CarouselView, SeatPublic } from './protocol';

export interface DemoCarouselOptions {
  readonly batchSize: number;
  readonly batchMs: number;
  readonly tailMs: number;
  readonly slots: number;
}
export const DEMO_CAROUSEL_DEFAULTS: DemoCarouselOptions = { batchSize: 2, batchMs: 4_000, tailMs: 4_000, slots: 9 };

export class DemoCarousel {
  private readonly slots: CarouselSlotView[];
  private readonly batches: { readonly seatIds: readonly string[]; readonly opensAt: number }[];
  private readonly endsAt: number;
  constructor(seats: readonly SeatPublic[], private readonly mySeatId: string, start: number, options: DemoCarouselOptions = DEMO_CAROUSEL_DEFAULTS) {
    this.slots = Array.from({ length: options.slots }, (_, slot) => ({
      slot, definitionId: SHOP_CATALOG[(slot * 5 + 3) % SHOP_CATALOG.length]!, starLevel: 1,
      items: [COMPONENT_IDS[slot % COMPONENT_IDS.length]!], pickedBy: null,
    }));
    // Lowest HP first, seat order on a tie; eliminated seats are not on the carousel.
    const order = seats.map((seat, index) => ({ seat, index })).filter(entry => entry.seat.alive)
      .sort((a, b) => a.seat.hp - b.seat.hp || a.index - b.index).map(entry => entry.seat.seatId);
    this.batches = [];
    for (let at = 0; at < order.length; at += options.batchSize) {
      this.batches.push({ seatIds: order.slice(at, at + options.batchSize), opensAt: start + this.batches.length * options.batchMs });
    }
    this.endsAt = start + this.batches.length * options.batchMs + options.tailMs;
  }
  get finished(): boolean { return this.closed; }
  private closed = false;
  private openBatches(now: number): number { return this.batches.filter(batch => batch.opensAt <= now).length; }
  private released(seatId: string, now: number): boolean {
    return this.batches.slice(0, this.openBatches(now)).some(batch => batch.seatIds.includes(seatId));
  }
  private holds(seatId: string): boolean { return this.slots.some(slot => slot.pickedBy === seatId); }
  /** My click; refused unless released, still without a unit and the slot still stands. */
  pick(slot: number, now: number): boolean {
    const target = this.slots.find(candidate => candidate.slot === slot);
    if (!target || target.pickedBy !== null || this.holds(this.mySeatId) || !this.released(this.mySeatId, now) || now >= this.endsAt) return false;
    this.take(slot, this.mySeatId); return true;
  }
  private take(slot: number, seatId: string) {
    const index = this.slots.findIndex(candidate => candidate.slot === slot);
    this.slots[index] = { ...this.slots[index]!, pickedBy: seatId };
  }
  /** The other seats take the first free slot a second after their batch opens; at the end every seat left gets one. */
  private advance(now: number) {
    for (const batch of this.batches) {
      for (const seatId of batch.seatIds) {
        if (this.holds(seatId)) continue;
        const due = now >= this.endsAt || (seatId !== this.mySeatId && now >= batch.opensAt + 1_000);
        const free = this.slots.find(slot => slot.pickedBy === null);
        if (due && free) this.take(free.slot, seatId);
      }
    }
    if (now >= this.endsAt) this.closed = true;
  }
  view(now: number): CarouselView {
    this.advance(now);
    const mine = this.slots.find(slot => slot.pickedBy === this.mySeatId);
    return {
      carouselId: 'demo', roundName: '演示数据', slots: this.slots.map(slot => ({ ...slot })), batches: this.batches.map(batch => ({ ...batch })),
      openBatches: this.openBatches(now), endsAt: this.endsAt,
      canPick: !mine && this.released(this.mySeatId, now) && now < this.endsAt, myPick: mine?.slot ?? null,
    };
  }
}
