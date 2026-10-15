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
export const DEMO_CAROUSEL_DEFAULTS: DemoCarouselOptions = { batchSize: 2, batchMs: 4_000, tailMs: 6_000, slots: 9 };

export class DemoCarousel {
  private readonly slots: CarouselSlotView[];
  private readonly releaseOrder: readonly string[];
  private readonly releaseAtMs: Readonly<Record<string, number>>;
  private readonly deadlineMs: number;
  private revision = 0;
  constructor(seats: readonly SeatPublic[], private readonly mySeatId: string, private readonly startedAt: number, options: DemoCarouselOptions = DEMO_CAROUSEL_DEFAULTS) {
    this.slots = Array.from({ length: options.slots }, (_, slot) => ({
      slot, definitionId: SHOP_CATALOG[(slot * 5 + 3) % SHOP_CATALOG.length]!, itemId: COMPONENT_IDS[slot % COMPONENT_IDS.length]!, pickedBy: null,
    }));
    // Lowest HP first, seat order on a tie, in pairs (option B); eliminated seats are not on the carousel.
    this.releaseOrder = seats.map((seat, index) => ({ seat, index })).filter(entry => entry.seat.alive)
      .sort((a, b) => a.seat.hp - b.seat.hp || a.index - b.index).map(entry => entry.seat.seatId);
    this.releaseAtMs = Object.fromEntries(this.releaseOrder.map((seatId, index) => [seatId, Math.floor(index / options.batchSize) * options.batchMs]));
    this.deadlineMs = Math.ceil(this.releaseOrder.length / options.batchSize) * options.batchMs + options.tailMs - options.batchMs;
  }
  get finished(): boolean { return this.closed; }
  private closed = false;
  private elapsed(now: number): number { return Math.min(this.deadlineMs, Math.max(0, now - this.startedAt)); }
  private released(seatId: string, now: number): boolean { return (this.releaseAtMs[seatId] ?? Infinity) <= this.elapsed(now); }
  private holds(seatId: string): boolean { return this.slots.some(slot => slot.pickedBy === seatId); }
  /** My click; refused unless released, still without a unit and the slot still stands. */
  pick(slot: number, now: number): boolean {
    const target = this.slots.find(candidate => candidate.slot === slot);
    if (!target || target.pickedBy !== null || this.holds(this.mySeatId) || !this.released(this.mySeatId, now) || this.elapsed(now) >= this.deadlineMs) return false;
    this.take(slot, this.mySeatId); return true;
  }
  private take(slot: number, seatId: string) {
    const index = this.slots.findIndex(candidate => candidate.slot === slot);
    this.slots[index] = { ...this.slots[index]!, pickedBy: seatId }; this.revision++;
  }
  /** The other seats take the first free slot a second after their release; at the deadline every seat left gets one. */
  private advance(now: number) {
    const elapsed = this.elapsed(now), atDeadline = elapsed >= this.deadlineMs;
    for (const seatId of this.releaseOrder) {
      if (this.holds(seatId)) continue;
      const due = atDeadline || (seatId !== this.mySeatId && elapsed >= this.releaseAtMs[seatId]! + 1_000);
      const free = this.slots.find(slot => slot.pickedBy === null);
      if (due && free) this.take(free.slot, seatId);
    }
    // Option B: the panel stays until the deadline (plus a short departure), even when everyone has picked.
    if (now - this.startedAt >= this.deadlineMs + 2_000) this.closed = true;
  }
  view(now: number): CarouselView {
    this.advance(now);
    const mine = this.slots.find(slot => slot.pickedBy === this.mySeatId);
    const elapsedMs = this.elapsed(now);
    return {
      id: 'demo', roundId: 'demo', roundName: '演示数据', revision: this.revision, status: elapsedMs >= this.deadlineMs ? 'closed' : 'open',
      slots: this.slots.map(slot => ({ ...slot })), releaseOrder: [...this.releaseOrder], releaseAtMs: { ...this.releaseAtMs }, elapsedMs, deadlineMs: this.deadlineMs,
      startedAt: this.startedAt, eligible: !mine && this.released(this.mySeatId, now) && elapsedMs < this.deadlineMs, pickedSlot: mine?.slot ?? null, receiptId: null,
    };
  }
}
