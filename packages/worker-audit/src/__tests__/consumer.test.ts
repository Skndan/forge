// Audit Worker — Consumer Tests
import { describe, expect, test } from 'bun:test';
import { validateAuditEvent, type AuditEvent } from '../consumer';

describe('validateAuditEvent', () => {
  test('valid event passes validation', () => {
    const event: AuditEvent = {
      tenant_id: 'tenant-1',
      actor_id: 'user-1',
      action: 'file.upload',
      target_type: 'storage',
      target_id: 'file-123',
      metadata: { size: 1024 },
    };
    expect(validateAuditEvent(event)).toBeNull();
  });

  test('missing tenant_id fails validation', () => {
    const event = {
      actor_id: 'user-1',
      action: 'file.upload',
      target_type: 'storage',
      target_id: 'file-123',
    } as AuditEvent;
    expect(validateAuditEvent(event)).toBe('tenant_id is required');
  });

  test('missing actor_id fails validation', () => {
    const event = {
      tenant_id: 'tenant-1',
      action: 'file.upload',
      target_type: 'storage',
      target_id: 'file-123',
    } as AuditEvent;
    expect(validateAuditEvent(event)).toBe('actor_id is required');
  });

  test('missing action fails validation', () => {
    const event = {
      tenant_id: 'tenant-1',
      actor_id: 'user-1',
      target_type: 'storage',
      target_id: 'file-123',
    } as AuditEvent;
    expect(validateAuditEvent(event)).toBe('action is required');
  });

  test('missing target_type fails validation', () => {
    const event = {
      tenant_id: 'tenant-1',
      actor_id: 'user-1',
      action: 'file.upload',
      target_id: 'file-123',
    } as AuditEvent;
    expect(validateAuditEvent(event)).toBe('target_type is required');
  });

  test('missing target_id fails validation', () => {
    const event = {
      tenant_id: 'tenant-1',
      actor_id: 'user-1',
      action: 'file.upload',
      target_type: 'storage',
    } as AuditEvent;
    expect(validateAuditEvent(event)).toBe('target_id is required');
  });

  test('event with all optional fields passes', () => {
    const event: AuditEvent = {
      tenant_id: 't-1',
      actor_id: 'u-1',
      action: 'login',
      target_type: 'auth',
      target_id: 'session-1',
      metadata: { browser: 'Chrome' },
      ip_address: '192.168.1.1',
      source: 'web',
      timestamp: '2026-01-01T00:00:00Z',
    };
    expect(validateAuditEvent(event)).toBeNull();
  });
});
