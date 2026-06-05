// Function Runner — Timeout + Resource Limits (FR-008)
// ============================================================
//
// Enforces configurable timeout and resource constraints on
// function execution. These limits are checked both before
// execution starts (validation) and during execution (enforcement).

import { config } from './config.js';
import type { FunctionDefinition } from '@forge/types';

export interface ResourceLimits {
  timeoutMs: number;
  memoryMb: number;
  cpuShares: number;
  maxSourceSizeBytes: number;
}

export interface LimitCheckResult {
  valid: boolean;
  errors: string[];
}

/**
 * Resolve the effective resource limits for a function definition.
 * Applies the function's timeout if specified, otherwise falls back
 * to the default. Clamps values to the configured maximums.
 */
export function resolveLimits(funcDef: FunctionDefinition): ResourceLimits {
  const timeoutMs = Math.min(
    funcDef.timeout_ms || config.defaultTimeoutMs,
    config.maxTimeoutMs,
  );

  return {
    timeoutMs,
    memoryMb: config.maxMemoryMb,
    cpuShares: config.maxCpuShares,
    maxSourceSizeBytes: config.maxSourceSizeBytes,
  };
}

/**
 * Validate a function definition against resource limits.
 * Returns a list of validation errors (empty = valid).
 */
export function validateFunctionSource(
  source: string,
  entrypoint: string,
): LimitCheckResult {
  const errors: string[] = [];

  if (!source || source.trim().length === 0) {
    errors.push('Function source cannot be empty');
  }

  if (!entrypoint || entrypoint.trim().length === 0) {
    errors.push('Entrypoint cannot be empty');
  }

  const sourceBytes = new TextEncoder().encode(source).length;
  if (sourceBytes > config.maxSourceSizeBytes) {
    errors.push(
      `Source code exceeds maximum size of ${config.maxSourceSizeBytes} bytes ` +
      `(got ${sourceBytes} bytes)`,
    );
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate timeout value against max.
 */
export function validateTimeout(timeoutMs: number): LimitCheckResult {
  const errors: string[] = [];

  if (timeoutMs < 100) {
    errors.push('Timeout must be at least 100ms');
  }

  if (timeoutMs > config.maxTimeoutMs) {
    errors.push(
      `Timeout ${timeoutMs}ms exceeds maximum of ${config.maxTimeoutMs}ms`,
    );
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Create an AbortController that aborts after the specified timeout.
 * Returns the controller and a cleanup function.
 */
export function createTimeoutController(
  timeoutMs: number,
  onTimeout?: () => void,
): { controller: AbortController; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Execution timed out after ${timeoutMs}ms`));
    onTimeout?.();
  }, timeoutMs);

  return {
    controller,
    clear: () => clearTimeout(timer),
  };
}

/**
 * Memory budget calculation.
 * Returns the amount of memory (in MB) that should be allocated
 * for a function container based on its definition.
 */
export function calculateMemoryBudget(
  funcDef: Pick<FunctionDefinition, 'timeout_ms'>,
): number {
  // Base allocation + additional for timeout duration
  const base = 128; // MB
  const timeoutFactor = Math.ceil((funcDef.timeout_ms || 30000) / 30000);
  return Math.min(base * timeoutFactor, config.maxMemoryMb);
}

/**
 * CPU shares calculation.
 * Returns the CPU shares (1024 = 1 core) for a function container.
 */
export function calculateCpuShares(
  _funcDef: Pick<FunctionDefinition, 'timeout_ms'>,
): number {
  // Default to half a core for most functions
  return config.maxCpuShares;
}
