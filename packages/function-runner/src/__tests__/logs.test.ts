// Function Runner — Logs Collection Tests (FR-007)
import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { LogCollector, parseLogOutput, truncateLogMessage } from '../logs.js';

describe('LogCollector', () => {
  let collector: LogCollector;

  beforeEach(() => {
    collector = new LogCollector(100, 10); // flush every 100ms, max 10 items
  });

  afterEach(() => {
    collector.stop();
  });

  test('starts with empty buffer', () => {
    expect(collector.bufferSize).toBe(0);
  });

  test('adds stdout entries', () => {
    collector.addStdout('fn-001', 'tenant-001', 'inv-001', 'Hello');
    expect(collector.bufferSize).toBe(1);
  });

  test('adds stderr entries', () => {
    collector.addStderr('fn-001', 'tenant-001', 'inv-001', 'Error');
    expect(collector.bufferSize).toBe(1);
  });

  test('supports generic add method', () => {
    collector.add({
      function_id: 'fn-001',
      tenant_id: 'tenant-001',
      invocation_id: 'inv-001',
      log_type: 'stdout',
      message: 'test',
      timestamp: Date.now(),
    });
    expect(collector.bufferSize).toBe(1);
  });

  test('auto-flushes when buffer exceeds max size', () => {
    for (let i = 0; i < 15; i++) {
      collector.addStdout('fn-001', 'tenant-001', 'inv-001', `Line ${i}`);
    }
    // Buffer should have been flushed at 10, remaining 5
    expect(collector.bufferSize).toBeLessThanOrEqual(10);
  });

  test('flush empties the buffer', async () => {
    collector.addStdout('fn-001', 'tenant-001', 'inv-001', 'Hello');
    collector.addStdout('fn-001', 'tenant-001', 'inv-001', 'World');
    expect(collector.bufferSize).toBe(2);

    await collector.flush();
    expect(collector.bufferSize).toBe(0);
  });

  test('flush on empty buffer is a no-op', async () => {
    expect(collector.bufferSize).toBe(0);
    await collector.flush();
    expect(collector.bufferSize).toBe(0);
  });

  test('start and stop work without errors', () => {
    collector = new LogCollector();
    collector.start();
    collector.stop();
  });
});

describe('parseLogOutput', () => {
  test('splits output into lines', () => {
    const lines = parseLogOutput('line1\nline2\nline3');
    expect(lines).toEqual(['line1', 'line2', 'line3']);
  });

  test('removes empty lines', () => {
    const lines = parseLogOutput('line1\n\n\nline2\n');
    expect(lines).toEqual(['line1', 'line2']);
  });

  test('strips ANSI escape codes', () => {
    const lines = parseLogOutput('\x1b[32mgreen\x1b[0m\n\x1b[31mred\x1b[0m');
    expect(lines).toEqual(['green', 'red']);
  });

  test('handles empty output', () => {
    const lines = parseLogOutput('');
    expect(lines).toEqual([]);
  });

  test('handles single line without newline', () => {
    const lines = parseLogOutput('just one line');
    expect(lines).toEqual(['just one line']);
  });
});

describe('truncateLogMessage', () => {
  test('returns short messages as-is', () => {
    const result = truncateLogMessage('short message');
    expect(result).toBe('short message');
  });

  test('truncates long messages', () => {
    const longMsg = 'a'.repeat(100);
    const result = truncateLogMessage(longMsg, 20);
    expect(result.length).toBeLessThanOrEqual(20 + '... [truncated]'.length);
    expect(result).toContain('[truncated]');
  });

  test('uses default max length', () => {
    const longMsg = 'a'.repeat(70000);
    const result = truncateLogMessage(longMsg);
    expect(result).toContain('[truncated]');
  });
});
