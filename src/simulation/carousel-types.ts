import type { SharedPoolState } from './shared-pool-types';
export type CarouselRoundId = '1-1' | '2-4' | '3-4' | '4-4' | '5-4' | '6-4';
export interface CarouselRng {
    readonly algorithm: 'lcg32-v1';
    readonly state: number;
}
export interface CarouselParticipant {
    readonly seatId: string;
    readonly seatIndex: number;
    readonly hp: number;
    /** Server-prepared, authenticated acquisition; absent for ordinary participants. */
    readonly titanicTitanChoiceId?: string;
}
export interface CarouselReservation {
    readonly carouselId: string;
    readonly reservationId: string;
    readonly slot: number;
    readonly definitionId: string;
    readonly seatId: string | null;
}
export interface CarouselSlot {
    readonly slot: number;
    readonly definitionId: string;
    readonly itemId: string;
    readonly reservationId: string;
    readonly pickedBy: string | null;
}
export interface CarouselReceipt {
    readonly id: string;
    readonly carouselId: string;
    readonly seatId: string;
    readonly slot: number;
    readonly definitionId: string;
    readonly itemId: string;
    readonly holdingSource: string;
    readonly unitId: string | null;
    readonly itemInstanceId: string | null;
    readonly status: 'reserved' | 'granted' | 'released';
}
export interface CarouselState {
    readonly version: 'carousel-v1';
    readonly id: string;
    readonly roundId: CarouselRoundId;
    readonly pool: SharedPoolState;
    readonly initialAvailable: Readonly<Record<string, number>>;
    readonly participants: readonly CarouselParticipant[];
    readonly status: 'open' | 'closed';
    readonly revision: number;
    readonly elapsedMs: number;
    readonly slots: readonly CarouselSlot[];
    readonly releaseOrder: readonly string[];
    readonly releaseAtMs: Readonly<Record<string, number>>;
    readonly deadlineMs: number;
    readonly rngBefore: CarouselRng;
    readonly rngAfter: CarouselRng;
    readonly receipts: readonly CarouselReceipt[];
}
export type CarouselFailure = 'invalid-pool' | 'invalid-round' | 'invalid-rng' | 'invalid-participants' | 'pool-exhausted' | 'carousel-exists' | 'invalid-carousel' | 'carousel-closed' | 'unknown-seat' | 'seat-eliminated' | 'seat-locked' | 'already-picked' | 'invalid-slot' | 'slot-taken' | 'invalid-time' | 'receipt-mismatch' | 'stale-pool' | 'invalid-match';
export type CarouselEvent = {
    readonly type: 'carousel-created';
    readonly carouselId: string;
    readonly roundId: CarouselRoundId;
} | {
    readonly type: 'carousel-picked';
    readonly receipt: CarouselReceipt;
} | {
    readonly type: 'carousel-closed';
    readonly carouselId: string;
    readonly returnedSlots: readonly number[];
} | {
    readonly type: 'carousel-seat-released';
    readonly carouselId: string;
    readonly seatId: string;
};
export type CarouselResult = {
    readonly ok: true;
    readonly state: CarouselState;
    readonly events: readonly CarouselEvent[];
} | {
    readonly ok: false;
    readonly state: CarouselState;
    readonly reason: CarouselFailure;
    readonly events: readonly [
    ];
};
export interface HeldCarouselUnit {
    readonly receiptId: string;
    readonly unitId: string;
    readonly definitionId: string;
}

/** @deprecated Storage/API type alias retained for the current server adapter. */
export type PendingCarouselUnit = HeldCarouselUnit;
