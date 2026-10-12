/**
 * Seat credentials (V2 §5.4). The server issues an unguessable token per seat; only its SHA-256
 * digest is kept. A resume bumps `connectionEpoch`, so the connection that held the seat before
 * is no longer allowed to act. This is the one server file that touches node:crypto: the token
 * is a network credential, not a rule input, so the simulation's lcg32 constraint does not apply.
 */
import { createHash, randomBytes } from 'node:crypto';
import { CommandDedupe, DEFAULT_DEDUPE_WINDOW } from './dedupe';
import type { ReceiptMessage } from './messages';

export interface SeatSession {
  readonly seatId: string;
  /** Room the seat belongs to once a match started; null while queued. */
  roomId: string | null;
  connectionEpoch: number;
  /** Opaque owner handle set by the server (the live connection); null when detached. */
  connection: unknown;
  readonly dedupe: CommandDedupe<ReceiptMessage>;
}

export type ResumeResult = { readonly ok: true; readonly session: SeatSession } | { readonly ok: false; readonly reason: 'invalid-token' };

export function digestOf(text: string): string { return createHash('sha256').update(text).digest('hex'); }

export class SessionRegistry {
  private readonly byDigest = new Map<string, SeatSession>();
  private readonly bySeat = new Map<string, SeatSession>();

  constructor(private readonly dedupeWindow = DEFAULT_DEDUPE_WINDOW, private readonly random: (bytes: number) => string = bytes => randomBytes(bytes).toString('base64url')) {}

  get size(): number { return this.bySeat.size; }

  /** Issues a fresh credential for a seat; any older credential of that seat stops working. */
  issue(seatId: string): { readonly token: string; readonly session: SeatSession } {
    this.revoke(seatId);
    const token = this.random(24);
    const session: SeatSession = { seatId, roomId: null, connectionEpoch: 1, connection: null, dedupe: new CommandDedupe(this.dedupeWindow) };
    this.byDigest.set(digestOf(token), session);
    this.bySeat.set(seatId, session);
    return { token, session };
  }

  /** Validates a token and advances the epoch; the caller detaches the previous connection. */
  resume(token: string): ResumeResult {
    const session = this.byDigest.get(digestOf(token));
    if (!session) return { ok: false, reason: 'invalid-token' };
    session.connectionEpoch += 1;
    return { ok: true, session };
  }

  sessionOf(seatId: string): SeatSession | null { return this.bySeat.get(seatId) ?? null; }

  revoke(seatId: string): void {
    const session = this.bySeat.get(seatId);
    if (!session) return;
    this.bySeat.delete(seatId);
    for (const [digest, candidate] of this.byDigest) if (candidate === session) this.byDigest.delete(digest);
  }

  /** Forgets every credential (a new match starts, the old seats are gone). */
  clear(): void { this.byDigest.clear(); this.bySeat.clear(); }

  [Symbol.iterator](): IterableIterator<SeatSession> { return this.bySeat.values(); }
}
