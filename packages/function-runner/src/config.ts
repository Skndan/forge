// Function Runner — Configuration
// ============================================================

export interface FunctionRunnerConfig {
  port: number;
  postgresUrl: string;
  valkeyUrl: string;

  /** Default timeout in milliseconds for function execution */
  defaultTimeoutMs: number;

  /** Max timeout allowed per function (overridable per definition) */
  maxTimeoutMs: number;

  /** Max memory per container in MB */
  maxMemoryMb: number;

  /** Max CPU shares (1024 = 1 core) */
  maxCpuShares: number;

  /** Max function source size in bytes */
  maxSourceSizeBytes: number;

  /** Warm pool configuration */
  warmPool: {
    /** Max warm functions per tenant */
    maxPerTenant: number;
    /** How often the pool rebalances (ms) */
    rebalanceIntervalMs: number;
    /** Maximum idle time before eviction (ms) */
    maxIdleTimeMs: number;
  };

  /** Docker socket path for DinD */
  dockerSocket: string;

  /** Base image for function containers */
  functionBaseImage: string;

  /** JWT signing key for scoped tokens (from env) */
  jwtSecret: string;

  /** JWT issuer claim for scoped tokens */
  jwtIssuer: string;

  /** JWT audience claim for scoped tokens */
  jwtAudience: string;

  /** Admin service token for internal auth */
  adminServiceToken: string;

  /** Log retention in days */
  logRetentionDays: number;
}

export function loadConfig(): FunctionRunnerConfig {
  return {
    port: parseInt(process.env.PORT || '3002', 10),
    postgresUrl: process.env.POSTGRES_URL || 'postgres://forge:forge@localhost:5432/forge',
    valkeyUrl: process.env.VALKEY_URL || 'redis://localhost:6379',

    defaultTimeoutMs: parseInt(process.env.FN_DEFAULT_TIMEOUT_MS || '30000', 10),
    maxTimeoutMs: parseInt(process.env.FN_MAX_TIMEOUT_MS || '300000', 10), // 5 min
    maxMemoryMb: parseInt(process.env.FN_MAX_MEMORY_MB || '512', 10),
    maxCpuShares: parseInt(process.env.FN_MAX_CPU_SHARES || '512', 10),
    maxSourceSizeBytes: parseInt(process.env.FN_MAX_SOURCE_SIZE || '10485760', 10), // 10 MB

    warmPool: {
      maxPerTenant: parseInt(process.env.FN_WARM_POOL_MAX_PER_TENANT || '10', 10),
      rebalanceIntervalMs: parseInt(process.env.FN_WARM_POOL_REBALANCE_MS || '30000', 10),
      maxIdleTimeMs: parseInt(process.env.FN_WARM_POOL_IDLE_MS || '300000', 10), // 5 min
    },

    dockerSocket: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
    functionBaseImage: process.env.FN_BASE_IMAGE || 'oven/bun:1',

    jwtSecret: process.env.FN_JWT_SECRET || 'dev-secret-change-me',
    jwtIssuer: process.env.FN_JWT_ISSUER || 'forge-function-runner',
    jwtAudience: process.env.FN_JWT_AUDIENCE || 'forge-function',

    adminServiceToken: process.env.ADMIN_SERVICE_TOKEN || '',
    logRetentionDays: parseInt(process.env.FN_LOG_RETENTION_DAYS || '30', 10),
  };
}

export const config = loadConfig();
