/**
 * Ring-buffer logger — captures console output for the web console Logs page.
 * Stores the last 500 entries in memory. Each entry has a timestamp, level, and message.
 * Call `initLogger()` early in startup to begin capturing.
 */

export interface LogEntry {
  ts: number;       // unix ms
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

const MAX_ENTRIES = 500;
const entries: LogEntry[] = [];
let startTime = Date.now();

export function getLogEntries(): LogEntry[] {
  return entries;
}

export function getUptime(): number {
  return Date.now() - startTime;
}

function push(level: LogEntry['level'], args: any[]): void {
  const message = args.map(a =>
    typeof a === 'string' ? a : (a instanceof Error ? a.message : JSON.stringify(a))
  ).join(' ');
  entries.push({ ts: Date.now(), level, message });
  if (entries.length > MAX_ENTRIES) entries.shift();
}

export function initLogger(): void {
  startTime = Date.now();

  const origLog   = console.log.bind(console);
  const origWarn  = console.warn.bind(console);
  const origError = console.error.bind(console);

  console.log = (...args: any[]) => {
    push('info', args);
    origLog(...args);
  };

  console.warn = (...args: any[]) => {
    push('warn', args);
    origWarn(...args);
  };

  console.error = (...args: any[]) => {
    push('error', args);
    origError(...args);
  };
}
