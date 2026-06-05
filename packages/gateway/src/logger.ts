// Forge — Structured JSON Logger with Correlation IDs
// Provides consistent JSON logging across all services

export interface LogEntry {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  service: string;
  correlationId?: string;
  timestamp: string;
  [key: string]: unknown;
}

let correlationId: string | null = null;

export function setCorrelationId(id: string): void {
  correlationId = id;
}

export function getCorrelationId(): string | null {
  return correlationId;
}

export function generateCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

function createLogEntry(
  level: LogEntry["level"],
  message: string,
  extra: Record<string, unknown> = {},
): LogEntry {
  return {
    level,
    message,
    service: process.env.SERVICE_NAME || "forge",
    correlationId: correlationId || extra.correlationId as string | undefined,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

function writeLog(entry: LogEntry): void {
  const output = JSON.stringify(entry);
  const stream = entry.level === "error" ? process.stderr : process.stdout;

  if (process.env.NODE_ENV === "production" || process.env.JSON_LOGS === "true") {
    stream.write(output + "\n");
  } else {
    // Dev mode: pretty-print
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.service}]`;
    const corr = entry.correlationId ? ` [corr:${entry.correlationId}]` : "";
    stream.write(`${prefix}${corr} ${entry.message}\n`);
    if (Object.keys(extra).length > 0) {
      stream.write(`  ${JSON.stringify(extra, null, 2)}\n`);
    }
  }
}

function extra(extraArg?: Record<string, unknown>): Record<string, unknown> {
  return extraArg || {};
}

export const logger = {
  debug(message: string, extraData?: Record<string, unknown>): void {
    writeLog(createLogEntry("debug", message, extra(extraData)));
  },
  info(message: string, extraData?: Record<string, unknown>): void {
    writeLog(createLogEntry("info", message, extra(extraData)));
  },
  warn(message: string, extraData?: Record<string, unknown>): void {
    writeLog(createLogEntry("warn", message, extra(extraData)));
  },
  error(message: string, extraData?: Record<string, unknown>): void {
    writeLog(createLogEntry("error", message, extra(extraData)));
  },
};
