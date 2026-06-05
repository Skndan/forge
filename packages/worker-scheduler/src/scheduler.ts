// Worker Scheduler — Cron-based Function Triggers
// Evaluates cron expressions and triggers scheduled functions

import postgres from 'postgres';
import crypto from 'crypto';

// ============================================================
// Types
// ============================================================

export interface ScheduledFunction {
  id: string;
  tenant_id: string;
  function_id: string;
  cron_expression: string;
  is_active: boolean;
  last_run_at: Date | null;
  next_run_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface FunctionDefinition {
  id: string;
  tenant_id: string;
  slug: string;
  runtime: string;
  is_active: boolean;
}

// ============================================================
// Configuration
// ============================================================

const POLL_INTERVAL_MS = parseInt(process.env.SCHEDULER_POLL_INTERVAL || '15000', 15_000);
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://gateway:3000';
const ADMIN_TOKEN = process.env.ADMIN_SERVICE_TOKEN || 'forge_admin_token_change_me';

function getSql(): ReturnType<typeof postgres> {
  return postgres(process.env.POSTGRES_URL || 'postgres://forge:forge_dev_password_change_me@localhost:5432/forge', {
    max: 5,
    connection: {
      application_name: 'forge-worker-scheduler',
    },
  });
}

// ============================================================
// Cron Expression Parser (simplified — supports common patterns)
// ============================================================

export interface CronParts {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

export function parseCronExpression(expression: string): CronParts {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: "${expression}". Expected 5 fields.`);
  }
  return {
    minute: parts[0],
    hour: parts[1],
    dayOfMonth: parts[2],
    month: parts[3],
    dayOfWeek: parts[4],
  };
}

export function matchesCronField(field: string, value: number): boolean {
  if (field === '*') return true;

  // Handle comma-separated values
  if (field.includes(',')) {
    return field.split(',').some((part) => matchesCronField(part.trim(), value));
  }

  // Handle step values: */5
  if (field.startsWith('*/')) {
    const step = parseInt(field.slice(2), 10);
    return step > 0 && value % step === 0;
  }

  // Handle ranges: 1-5
  if (field.includes('-')) {
    const [min, max] = field.split('-').map(Number);
    return value >= min && value <= max;
  }

  // Exact match
  return parseInt(field, 10) === value;
}

export function cronMatches(expression: string, date: Date = new Date()): boolean {
  try {
    const cron = parseCronExpression(expression);
    return (
      matchesCronField(cron.minute, date.getMinutes()) &&
      matchesCronField(cron.hour, date.getHours()) &&
      matchesCronField(cron.dayOfMonth, date.getDate()) &&
      matchesCronField(cron.month, date.getMonth() + 1) &&
      matchesCronField(cron.dayOfWeek, date.getDay())
    );
  } catch {
    return false;
  }
}

// ============================================================
// Scheduled Function Management
// ============================================================

export async function fetchScheduledFunctions(sql: ReturnType<typeof postgres>): Promise<ScheduledFunction[]> {
  return await sql<ScheduledFunction[]>`
    SELECT * FROM forge.scheduled_functions
    WHERE is_active = true
      AND (next_run_at IS NULL OR next_run_at <= now())
    ORDER BY next_run_at ASC NULLS FIRST
    LIMIT 50
  `;
}

export async function triggerFunction(
  scheduledFn: ScheduledFunction,
): Promise<boolean> {
  try {
    const body = JSON.stringify({
      function_id: scheduledFn.function_id,
      payload: {
        scheduled: true,
        scheduled_at: new Date().toISOString(),
        schedule_id: scheduledFn.id,
      },
      async: true,
    });

    const signature = crypto.createHmac('sha256', ADMIN_TOKEN).update(body).digest('hex');

    const response = await fetch(`${GATEWAY_URL}/v1/functions/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': ADMIN_TOKEN,
        'X-Forge-Signature': signature,
      },
      body,
    });

    return response.ok;
  } catch (err) {
    console.error(`[scheduler-worker] Failed to trigger function ${scheduledFn.function_id}:`, (err as Error).message);
    return false;
  }
}

export async function updateLastRun(
  sql: ReturnType<typeof postgres>,
  functionId: string,
  success: boolean,
): Promise<void> {
  const now = new Date();
  
  // Calculate next run (1 minute from now for re-evaluation)
  const nextRun = new Date(now.getTime() + 60_000);

  await sql`
    UPDATE forge.scheduled_functions
    SET
      last_run_at = ${now},
      next_run_at = ${nextRun},
      updated_at = now()
    WHERE id = ${functionId}::uuid
  `;

  if (success) {
    console.log(`[scheduler-worker] Triggered function ${functionId} at ${now.toISOString()}`);
  } else {
    console.warn(`[scheduler-worker] Failed to trigger function ${functionId} at ${now.toISOString()}`);
  }
}

// ============================================================
// Main Scheduler Loop
// ============================================================

export async function startSchedulerLoop(): Promise<void> {
  console.log('[scheduler-worker] Starting scheduler loop...');

  while (true) {
    try {
      const sql = getSql();
      try {
        const functions = await fetchScheduledFunctions(sql);

        for (const fn of functions) {
          // Check if cron expression matches current time
          if (cronMatches(fn.cron_expression)) {
            const success = await triggerFunction(fn);
            await updateLastRun(sql, fn.id, success);
          }
        }
      } finally {
        await sql.end();
      }
    } catch (err) {
      console.error('[scheduler-worker] Loop error:', (err as Error).message);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}
