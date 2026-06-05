// Function Runner — Warm Function Pool (FR-005)
// ============================================================
//
// Maintains a pool of pre-warmed function containers for
// frequently-used functions. This reduces cold-start latency
// by keeping containers alive and ready to execute.
//
// The pool:
// 1. Pre-loads frequently used functions
// 2. Keeps them idle but ready
// 3. Rebalances periodically based on usage
// 4. Evicts stale entries after idle timeout

import { config } from './config.js';
import type { FunctionDefinition } from '@forge/types';

interface WarmFunction {
  functionId: string;
  tenantId: string;
  slug: string;
  containerId: string;
  warmedAt: number;
  lastUsedAt: number;
  useCount: number;
}

interface PoolStats {
  totalWarm: number;
  perTenant: Map<string, number>;
  evictions: number;
  hits: number;
  misses: number;
}

/**
 * Warm function pool.
 * Manages a set of pre-loaded function containers for low-latency execution.
 */
export class WarmFunctionPool {
  private pool: Map<string, WarmFunction> = new Map();
  private usageCounts: Map<string, number> = new Map();
  private stats: PoolStats = {
    totalWarm: 0,
    perTenant: new Map(),
    evictions: 0,
    hits: 0,
    misses: 0,
  };

  private rebalanceTimer: ReturnType<typeof setInterval> | null = null;
  private useDocker: boolean;

  constructor(useDocker = true) {
    this.useDocker = useDocker;
  }

  /**
   * Start the pool rebalance interval.
   */
  start(): void {
    if (this.rebalanceTimer) return;
    this.rebalanceTimer = setInterval(() => {
      this.rebalance().catch((err) => {
        console.error('[WarmPool] Rebalance error:', err);
      });
    }, config.warmPool.rebalanceIntervalMs);
  }

  /**
   * Stop the pool rebalance interval and clear all warm functions.
   */
  async stop(): Promise<void> {
    if (this.rebalanceTimer) {
      clearInterval(this.rebalanceTimer);
      this.rebalanceTimer = null;
    }
    await this.evictAll();
  }

  /**
   * Record a function usage. Tracks invocation counts to decide
   * which functions to keep warm.
   */
  recordUsage(functionId: string): void {
    const current = this.usageCounts.get(functionId) || 0;
    this.usageCounts.set(functionId, current + 1);
  }

  /**
   * Check if a function is currently warm in the pool.
   * If found, marks it as used (updates lastUsedAt).
   */
  isWarm(functionId: string): boolean {
    const entry = this.pool.get(functionId);
    if (!entry) {
      this.stats.misses++;
      return false;
    }
    this.stats.hits++;
    entry.lastUsedAt = Date.now();
    entry.useCount++;
    return true;
  }

  /**
   * Warm a function by preparing its container.
   * This is a no-op if the function is already warm.
   */
  async warmFunction(funcDef: FunctionDefinition): Promise<boolean> {
    // Check if already warm
    if (this.pool.has(funcDef.id)) return true;

    // Check tenant limit
    const tenantCount = this.stats.perTenant.get(funcDef.tenant_id) || 0;
    if (tenantCount >= config.warmPool.maxPerTenant) {
      return false;
    }

    // In Docker mode, prepare a container
    let containerId = 'local';

    if (this.useDocker) {
      try {
        const { execSync } = await import('child_process');
        const containerName = `warm-${funcDef.id.slice(0, 12)}`;

        const tmpDir = `/tmp/forge-warm-${funcDef.id}`;
        execSync(`mkdir -p ${tmpDir}`);
        execSync(`echo ${JSON.stringify(funcDef.source)} > ${tmpDir}/${funcDef.entrypoint}`);

        const dockerfile = `
FROM ${config.functionBaseImage}
WORKDIR /app
COPY . .
RUN bun install 2>/dev/null || true
CMD ["sleep", "infinity"]
`;
        execSync(`echo ${JSON.stringify(dockerfile)} > ${tmpDir}/Dockerfile`);

        const imageTag = `forge-warm-${funcDef.id}`;
        execSync(`docker build -t ${imageTag} ${tmpDir}`, { timeout: 60000 });

        containerId = execSync(
          `docker run -d --name ${containerName} --rm ${imageTag}`,
        ).toString().trim();
      } catch (err) {
        console.error(`[WarmPool] Failed to warm function ${funcDef.id}:`, err);
        return false;
      }
    }

    // Add to pool
    const entry: WarmFunction = {
      functionId: funcDef.id,
      tenantId: funcDef.tenant_id,
      slug: funcDef.slug,
      containerId,
      warmedAt: Date.now(),
      lastUsedAt: Date.now(),
      useCount: 0,
    };

    this.pool.set(funcDef.id, entry);
    this.stats.totalWarm = this.pool.size;
    this.stats.perTenant.set(
      funcDef.tenant_id,
      (this.stats.perTenant.get(funcDef.tenant_id) || 0) + 1,
    );

    return true;
  }

  /**
   * Evict a single function from the warm pool.
   */
  async evict(functionId: string): Promise<boolean> {
    const entry = this.pool.get(functionId);
    if (!entry) return false;

    if (this.useDocker && entry.containerId !== 'local') {
      try {
        const { execSync } = await import('child_process');
        execSync(`docker kill ${entry.containerId} 2>/dev/null || true`);
      } catch {
        // ignore
      }
    }

    this.pool.delete(functionId);
    this.stats.totalWarm = this.pool.size;

    const tenantCount = this.stats.perTenant.get(entry.tenantId) || 0;
    if (tenantCount > 0) {
      this.stats.perTenant.set(entry.tenantId, tenantCount - 1);
    }

    this.stats.evictions++;
    return true;
  }

  /**
   * Evict all warm functions.
   */
  async evictAll(): Promise<void> {
    const ids = Array.from(this.pool.keys());
    await Promise.all(ids.map((id) => this.evict(id)));
  }

  /**
   * Rebalance the pool based on:
   * 1. Evict stale entries (idle > maxIdleTimeMs)
   * 2. Evict least-used entries if over per-tenant limit
   * 3. Keep frequently-used functions warm
   */
  async rebalance(): Promise<void> {
    const now = Date.now();

    // Evict stale entries
    for (const [id, entry] of this.pool) {
      if (now - entry.lastUsedAt > config.warmPool.maxIdleTimeMs) {
        await this.evict(id);
      }
    }

    // Enforce per-tenant limits
    const tenantFunctions = new Map<string, WarmFunction[]>();
    for (const entry of this.pool.values()) {
      const list = tenantFunctions.get(entry.tenantId) || [];
      list.push(entry);
      tenantFunctions.set(entry.tenantId, list);
    }

    for (const [, functions] of tenantFunctions) {
      if (functions.length <= config.warmPool.maxPerTenant) continue;

      // Sort by last used (oldest first) and evict excess
      functions.sort((a, b) => a.lastUsedAt - b.lastUsedAt);
      const toEvict = functions.slice(0, functions.length - config.warmPool.maxPerTenant);
      for (const entry of toEvict) {
        await this.evict(entry.functionId);
      }
    }
  }

  /**
   * Get a warm function entry.
   */
  get(functionId: string): WarmFunction | undefined {
    return this.pool.get(functionId);
  }

  /**
   * Get pool statistics.
   */
  getStats(): PoolStats & { topFunctions: Array<{ id: string; count: number }> } {
    const topFunctions = Array.from(this.usageCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => ({ id, count }));

    return {
      ...this.stats,
      topFunctions,
    };
  }

  /**
   * Get the current pool size.
   */
  get size(): number {
    return this.pool.size;
  }
}

let _pool: WarmFunctionPool | null = null;

export function getWarmPool(): WarmFunctionPool {
  if (!_pool) {
    const useDocker = process.env.FORGE_SANDBOX_MODE !== 'file-based';
    _pool = new WarmFunctionPool(useDocker);
    _pool.start();
  }
  return _pool;
}

export function resetWarmPool(): void {
  if (_pool) {
    _pool.stop();
    _pool = null;
  }
}
