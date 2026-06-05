// Function Runner — Bun Runtime Execution (FR-002)
// ============================================================
//
// Core execution engine for running TypeScript functions
// with the Bun runtime. Manages the full lifecycle:
//   1. Load function definition from DB
//   2. Generate scoped JWT
//   3. Execute in sandbox (DinD or file-based)
//   4. Collect logs
//   5. Track invocation in DB

import { getFunctionById, createInvocation, completeInvocation, failInvocation, timeoutInvocation } from './db.js';
import { getSandbox } from './sandbox.js';
import { generateScopedJwt, defaultScope } from './jwt.js';
import { getLogCollector, parseLogOutput, truncateLogMessage } from './logs.js';
import { resolveLimits, validateFunctionSource, createTimeoutController } from './limits.js';

export interface ExecuteOptions {
  functionId: string;
  tenantId: string;
  payload: unknown;
  invokedBy: string;
  allowedTables?: string[];
  allowedBuckets?: string[];
  timeoutMs?: number;
}

export interface ExecuteResult {
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
  };
  invocationId: string;
  durationMs: number;
  logs: Array<{ type: 'stdout' | 'stderr'; message: string }>;
}

/**
 * Execute a function by its ID.
 * This is the main entry point for the function runner.
 */
export async function executeFunction(options: ExecuteOptions): Promise<ExecuteResult> {
  const startTime = Date.now();
  const logs: Array<{ type: 'stdout' | 'stderr'; message: string }> = [];

  try {
    // 1. Load function definition
    const funcDef = await getFunctionById(options.functionId);
    if (!funcDef) {
      return {
        success: false,
        error: { code: 'FUNCTION_NOT_FOUND', message: 'Function not found or inactive' },
        invocationId: '',
        durationMs: Date.now() - startTime,
        logs,
      };
    }

    if (funcDef.tenant_id !== options.tenantId) {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Function does not belong to this tenant' },
        invocationId: '',
        durationMs: Date.now() - startTime,
        logs,
      };
    }

    // 2. Validate source
    const validation = validateFunctionSource(funcDef.source, funcDef.entrypoint);
    if (!validation.valid) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: validation.errors.join('; ') },
        invocationId: '',
        durationMs: Date.now() - startTime,
        logs,
      };
    }

    // 3. Resolve resource limits
    const limits = resolveLimits(funcDef);
    if (options.timeoutMs) {
      limits.timeoutMs = Math.min(options.timeoutMs, limits.timeoutMs);
    }

    // 4. Create invocation record
    const invocation = await createInvocation(funcDef.id, funcDef.tenant_id, options.payload);

    // 5. Generate scoped JWT
    const scope = defaultScope({
      invocationId: invocation.id,
      functionId: funcDef.id,
      tenantId: funcDef.tenant_id,
      invokedBy: options.invokedBy,
    });

    const scopedJwt = await generateScopedJwt({
      invocationId: invocation.id,
      functionId: funcDef.id,
      tenantId: funcDef.tenant_id,
      invokedBy: options.invokedBy,
      allowedTables: options.allowedTables || scope.allowedTables,
      allowedBuckets: options.allowedBuckets || scope.allowedBuckets,
      maxQueries: scope.maxQueries,
      ttlSeconds: scope.ttlSeconds,
    });

    // 6. Create timeout controller
    const { clear: clearTimeout } = createTimeoutController(
      limits.timeoutMs,
      async () => {
        await timeoutInvocation(invocation.id, Date.now() - startTime);
      },
    );

    try {
      // 7. Execute in sandbox
      const sandbox = getSandbox();
      const result = await sandbox.execute({
        functionId: funcDef.id,
        tenantId: funcDef.tenant_id,
        invocationId: invocation.id,
        source: funcDef.source,
        entrypoint: funcDef.entrypoint,
        envVars: funcDef.env_vars,
        limits,
        scopedJwt,
      });

      // 8. Collect logs
      const logCollector = getLogCollector();
      const stdoutLines = parseLogOutput(result.stdout);
      const stderrLines = parseLogOutput(result.stderr);

      for (const line of stdoutLines) {
        const msg = truncateLogMessage(line);
        logCollector.addStdout(funcDef.id, funcDef.tenant_id, invocation.id, msg);
        logs.push({ type: 'stdout', message: msg });
      }

      for (const line of stderrLines) {
        const msg = truncateLogMessage(line);
        logCollector.addStderr(funcDef.id, funcDef.tenant_id, invocation.id, msg);
        logs.push({ type: 'stderr', message: msg });
      }

      // 9. Record result
      if (result.exitCode === 0) {
        let output: unknown;
        try {
          output = stdoutLines.length > 0 ? JSON.parse(stdoutLines[stdoutLines.length - 1]) : null;
        } catch {
          output = stdoutLines.join('\n');
        }

        await completeInvocation(invocation.id, output, result.durationMs);

        return {
          success: true,
          data: output,
          invocationId: invocation.id,
          durationMs: result.durationMs,
          logs,
        };
      }
      await failInvocation(invocation.id, result.stderr || 'Non-zero exit code', result.durationMs);

      return {
        success: false,
        error: { code: 'EXECUTION_ERROR', message: result.stderr || `Exit code: ${result.exitCode}` },
        invocationId: invocation.id,
        durationMs: result.durationMs,
        logs,
      };
    } finally {
      clearTimeout();
    }
  } catch (err) {
    const durationMs = Date.now() - startTime;

    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'Unknown execution error',
      },
      invocationId: '',
      durationMs,
      logs,
    };
  }
}

/**
 * Validate that a function can be executed (syntax check) without
 * actually running it.
 */
export async function validateFunctionCode(
  source: string,
  entrypoint: string,
  _envVars: Record<string, string>,
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  // Basic validation
  const validation = validateFunctionSource(source, entrypoint);
  if (!validation.valid) {
    errors.push(...validation.errors);
    return { valid: false, errors };
  }

  // Try syntax parsing if possible
  try {
    // Check for basic TypeScript syntax issues
    // This is a lightweight check; Bun's runtime will catch deeper issues
    if (!source.includes('export')) {
      errors.push('Function must have at least one export');
    }
  } catch {
    errors.push('Function source contains syntax errors');
  }

  return { valid: errors.length === 0, errors };
}
