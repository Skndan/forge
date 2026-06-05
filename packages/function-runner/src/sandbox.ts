// Function Runner — Docker-in-Docker Isolation (FR-003)
// ============================================================
//
// Manages Docker containers for secure function execution using
// Docker-in-Docker (DinD). Each function invocation runs in an
// isolated container with resource constraints.
//
// Architecture:
//   function-runner container  ───►  DinD daemon (inside container)
//         │                               │
//         └── docker socket ──────────────┘
//                    │
//         ┌──────────┴──────────┐
//         ▼                     ▼
//   fn-abc-xxx              fn-def-yyy
//   (temporary)             (temporary)
//
// This approach allows the function-runner to:
// 1. Run inside a container itself
// 2. Create sibling containers for function execution
// 3. Enforce resource limits per container
// 4. Clean up containers after execution

import { config } from './config.js';
import type { ResourceLimits } from './limits.js';

export interface SandboxOptions {
  functionId: string;
  tenantId: string;
  invocationId: string;
  source: string;
  entrypoint: string;
  envVars: Record<string, string>;
  limits: ResourceLimits;
  scopedJwt: string;
}

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export interface ContainerStatus {
  id: string;
  name: string;
  status: 'created' | 'running' | 'exited' | 'removed';
  createdAt: string;
}

/**
 * Docker-in-Docker sandbox manager.
 * In production, this executes Docker commands via the Docker socket.
 * The implementation supports both real Docker and a file-based simulation
 * for development/testing.
 */
export class DinDSandbox {
  private containers: Map<string, ContainerStatus> = new Map();
  private useDocker: boolean;

  constructor(useDocker = true) {
    this.useDocker = useDocker;
  }

  /**
   * Execute a function in a sandboxed Docker container.
   * Creates a container, copies the function source, runs it,
   * captures output, and cleans up.
   */
  async execute(options: SandboxOptions): Promise<SandboxResult> {
    const startTime = Date.now();
    const containerName = `fn-${options.functionId.slice(0, 8)}-${options.invocationId.slice(0, 8)}`;

    try {
      if (this.useDocker) {
        return await this.executeDocker(containerName, options, startTime);
      }
      return await this.executeFileBased(containerName, options, startTime);
    } finally {
      this.containers.delete(containerName);
    }
  }

  private async executeDocker(
    containerName: string,
    options: SandboxOptions,
    startTime: number,
  ): Promise<SandboxResult> {
    const { execSync } = await import('child_process');

    // 1. Create a temp directory with the function source
    const tmpDir = `/tmp/forge-fn-${options.invocationId}`;
    execSync(`mkdir -p ${tmpDir}`);
    execSync(`echo ${JSON.stringify(options.source)} > ${tmpDir}/${options.entrypoint}`);

    try {
      // 2. Build a Dockerfile for this function
      const dockerfile = `
FROM ${config.functionBaseImage}
WORKDIR /app
COPY . .
RUN bun install 2>/dev/null || true
ENV FORGE_INVOCATION_ID=${options.invocationId}
ENV FORGE_FUNCTION_ID=${options.functionId}
ENV FORGE_TENANT_ID=${options.tenantId}
ENV FORGE_SCOPED_JWT=${options.scopedJwt}
${Object.entries(options.envVars)
  .map(([k, v]) => `ENV ${k}=${v}`)
  .join('\n')}
CMD ["bun", "run", "${options.entrypoint}"]
`;

      execSync(`echo ${JSON.stringify(dockerfile)} > ${tmpDir}/Dockerfile`);

      // 3. Build the image
      const imageTag = `forge-fn-${options.invocationId}`;
      execSync(`docker build -t ${imageTag} ${tmpDir}`, {
        timeout: options.limits.timeoutMs,
      });

      // 4. Run the container with resource limits
      const memLimit = `${options.limits.memoryMb}m`;
      const cpuPeriod = 100000;
      const cpuQuota = options.limits.cpuShares * (cpuPeriod / 1024);

      const runCmd = [
        'docker run',
        `--name ${containerName}`,
        `--memory ${memLimit}`,
        `--memory-swap ${memLimit}`,
        `--cpu-period ${cpuPeriod}`,
        `--cpu-quota ${Math.round(cpuQuota)}`,
        '--network none',
        '--read-only',
        `--stop-timeout ${Math.ceil(options.limits.timeoutMs / 1000)}`,
        '-d',
        imageTag,
      ].join(' ');

      const containerId = execSync(runCmd).toString().trim();
      this.containers.set(containerName, {
        id: containerId,
        name: containerName,
        status: 'running',
        createdAt: new Date().toISOString(),
      });

      // 5. Wait for the container to finish
      const waitCmd = `docker wait ${containerName}`;
      const exitCodeStr = execSync(waitCmd, {
        timeout: options.limits.timeoutMs + 5000,
      }).toString().trim();
      const exitCode = parseInt(exitCodeStr, 10);

      // 6. Get logs
      let stdout = '';
      let stderr = '';
      try {
        stdout = execSync(`docker logs ${containerName} 2>/dev/null`).toString();
      } catch {
        // logs might be empty
      }

      this.containers.set(containerName, {
        ...this.containers.get(containerName)!,
        status: 'exited',
      });

      const durationMs = Date.now() - startTime;

      // 7. Cleanup
      await this.cleanupContainer(containerName, imageTag, tmpDir);

      return { stdout, stderr, exitCode, durationMs };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      await this.cleanupContainer(containerName, '', tmpDir);

      return {
        stdout: '',
        stderr: err instanceof Error ? err.message : String(err),
        exitCode: -1,
        durationMs,
      };
    }
  }

  private async executeFileBased(
    containerName: string,
    options: SandboxOptions,
    startTime: number,
  ): Promise<SandboxResult> {
    // File-based simulation for development/testing without Docker.
    // Writes the source to a temp file and executes it with Bun directly.
    const tmpDir = `/tmp/forge-fn-${options.invocationId}`;
    const { mkdirSync, writeFileSync, rmSync } = await import('fs');
    const { spawnSync } = await import('child_process');

    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(`${tmpDir}/${options.entrypoint}`, options.source);

    this.containers.set(containerName, {
      id: 'local',
      name: containerName,
      status: 'running',
      createdAt: new Date().toISOString(),
    });

    try {
      // Set environment variables
      const env: Record<string, string> = {
        ...options.envVars,
        FORGE_INVOCATION_ID: options.invocationId,
        FORGE_FUNCTION_ID: options.functionId,
        FORGE_TENANT_ID: options.tenantId,
        FORGE_SCOPED_JWT: options.scopedJwt,
        FORGE_SANDBOX_MODE: 'file-based',
      };

      const result = spawnSync('bun', ['run', `${tmpDir}/${options.entrypoint}`], {
        env: { ...process.env as Record<string, string>, ...env },
        timeout: options.limits.timeoutMs,
        maxBuffer: 1024 * 1024,
        encoding: 'utf-8',
      });

      const durationMs = Date.now() - startTime;

      return {
        stdout: result.stdout?.toString() || '',
        stderr: result.stderr?.toString() || '',
        exitCode: result.status ?? -1,
        durationMs,
      };
    } finally {
      this.containers.set(containerName, {
        id: 'local',
        name: containerName,
        status: 'exited',
        createdAt: new Date().toISOString(),
      });

      // Cleanup temp files
      try {
        rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  }

  private async cleanupContainer(
    containerName: string,
    imageTag: string,
    tmpDir: string,
  ): Promise<void> {
    try {
      const { execSync } = await import('child_process');
      // Remove container
      execSync(`docker rm -f ${containerName} 2>/dev/null || true`);
      // Remove image
      if (imageTag) {
        execSync(`docker rmi -f ${imageTag} 2>/dev/null || true`);
      }
      // Remove temp dir
      execSync(`rm -rf ${tmpDir} 2>/dev/null || true`);
    } catch {
      // cleanup errors are non-fatal
    }
  }

  getContainerStatus(name: string): ContainerStatus | undefined {
    return this.containers.get(name);
  }

  getActiveContainers(): ContainerStatus[] {
    return Array.from(this.containers.values()).filter(
      (c) => c.status === 'running',
    );
  }

  getContainerCount(): number {
    return this.containers.size;
  }

  async cleanupAll(): Promise<void> {
    for (const [name] of this.containers) {
      try {
        const { execSync } = await import('child_process');
        execSync(`docker rm -f ${name} 2>/dev/null || true`);
      } catch {
        // ignore
      }
    }
    this.containers.clear();
  }
}

let _sandbox: DinDSandbox | null = null;

export function getSandbox(): DinDSandbox {
  if (!_sandbox) {
    const useDocker = process.env.FORGE_SANDBOX_MODE !== 'file-based';
    _sandbox = new DinDSandbox(useDocker);
  }
  return _sandbox;
}

export function resetSandbox(): void {
  _sandbox = null;
}
