import type { Logger } from '../log';

export type PerfPart = 'combat' | 'projection' | 'broadcast' | 'room';
interface Context { roomId: string; round: number; roundName: string }
/** One bounded accumulator. Times are synchronous work, never phase duration or socket delivery latency. */
export class RoundPerf {
  private context: Context | null = null;
  private ms = { combat: 0, projection: 0, broadcast: 0, room: 0 };
  private max = { combat: 0, projection: 0, broadcast: 0, room: 0 };
  private bytes = 0;
  private messages = 0;
  constructor(private readonly now: () => number, private readonly log: Logger) {}
  enter(context: Context): void {
    if (this.context?.roomId === context.roomId && this.context.round === context.round) return;
    this.flush(); this.context = { roomId: context.roomId, round: context.round, roundName: context.roundName };
  }
  add(part: PerfPart, ms: number): void {
    if (!this.context) return;
    this.ms[part] += ms; this.max[part] = Math.max(this.max[part], ms);
  }
  measure<T>(part: PerfPart, work: () => T): T {
    const started = this.now();
    try { return work(); } finally { this.add(part, this.now() - started); }
  }
  sent(bytes: number): void { this.bytes += bytes; this.messages++; }
  flush(): void {
    if (this.context && (this.ms.combat >= 100 || this.ms.projection >= 25 || this.ms.broadcast >= 25 || this.max.room >= 50)) {
      this.log('warn', 'round.perf', { ...this.context, combatMs: Math.round(this.ms.combat), projectionMs: Math.round(this.ms.projection),
        broadcastMs: Math.round(this.ms.broadcast), roomWorkMs: Math.round(this.ms.room), combatMaxMs: Math.round(this.max.combat),
        projectionMaxMs: Math.round(this.max.projection), broadcastMaxMs: Math.round(this.max.broadcast), taskMaxMs: Math.round(this.max.room),
        bytes: this.bytes, messages: this.messages });
    }
    this.context = null;
    this.ms = { combat: 0, projection: 0, broadcast: 0, room: 0 };
    this.max = { combat: 0, projection: 0, broadcast: 0, room: 0 };
    this.bytes = 0; this.messages = 0;
  }
}
