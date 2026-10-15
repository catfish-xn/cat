/**
 * Structured server log (G3). One JSON object per line: `ts`, `level`, `event`, then `roomId` / `seatId` when the
 * record concerns one, then the event's own fields. Records carry identifiers, phases, counts and error text only:
 * never a seat credential (token), a seat's private state or a per-frame/per-tick payload. The sink and the clock are
 * injected (main.ts writes to stdout with the wall clock), so this module stays pure.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export const LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];

export type LogFields = Readonly<Record<string, string | number | boolean | null | undefined>>;
export interface LogRecord extends LogFields {
  readonly level: LogLevel;
  readonly event: string;
}
/** What the server calls; `event` is a dotted name (`room.started`, `seat.joined`, ...). */
export type Logger = (level: LogLevel, event: string, fields?: LogFields) => void;

/** Keys a record never carries, whatever a caller passes (defence in depth; no caller passes them). */
const REDACTED = new Set(['token', 'credential', 'secret']);

export function parseLogLevel(raw: string | undefined, fallback: LogLevel = 'info'): LogLevel {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === '') return fallback;
  if ((LOG_LEVELS as readonly string[]).includes(value)) return value as LogLevel;
  throw new RangeError(`log level must be one of ${LOG_LEVELS.join('/')}, got "${raw}"`);
}

/** Orders a record as `ts, level, event, roomId, seatId, ...rest`, drops undefined and redacted keys. */
export function formatLogRecord(ts: string, level: LogLevel, event: string, fields: LogFields = {}): string {
  const record: Record<string, unknown> = { ts, level, event };
  if (fields.roomId !== undefined) record.roomId = fields.roomId;
  if (fields.seatId !== undefined) record.seatId = fields.seatId;
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || key in record || REDACTED.has(key.toLowerCase())) continue;
    record[key] = value;
  }
  return JSON.stringify(record);
}

/** A Logger writing JSON lines at or above `level` through `write`, stamped by `now` (an ISO time string). */
export function createJsonLogger(options: { readonly level: LogLevel; readonly write: (line: string) => void; readonly now: () => string }): Logger {
  const threshold = LOG_LEVELS.indexOf(options.level);
  return (level, event, fields) => {
    if (LOG_LEVELS.indexOf(level) < threshold) return;
    options.write(formatLogRecord(options.now(), level, event, fields));
  };
}

/** Adapts the older one-line text sink (`log: line => ...`, e.g. scripts/loadtest-room.cjs) to a Logger. */
export function textLogger(sink: (line: string) => void): Logger {
  return (level, event, fields = {}) => {
    const rest = Object.entries(fields).filter(([key, value]) => value !== undefined && !REDACTED.has(key.toLowerCase())).map(([key, value]) => `${key}=${typeof value === 'string' ? JSON.stringify(value) : String(value)}`);
    sink([level === 'info' ? null : level, event, ...rest].filter(Boolean).join(' '));
  };
}
