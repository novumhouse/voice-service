type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const configured = (process.env.LOG_LEVEL || 'info').toLowerCase() as LogLevel;
const threshold = LEVELS[configured] ?? LEVELS.info;

function log(level: LogLevel, message: string, meta?: unknown): void {
  if (LEVELS[level] < threshold) return;
  const ts = new Date().toISOString();
  const payload: Record<string, unknown> = { ts, level, message };
  if (meta !== undefined) payload.meta = meta;
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload));
}

export const logger = {
  debug: (msg: string, meta?: unknown) => log('debug', msg, meta),
  info: (msg: string, meta?: unknown) => log('info', msg, meta),
  warn: (msg: string, meta?: unknown) => log('warn', msg, meta),
  error: (msg: string, meta?: unknown) => log('error', msg, meta),
};


