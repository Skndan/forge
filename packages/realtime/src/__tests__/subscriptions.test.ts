// Realtime — Subscription Management Tests
import { describe, expect, test, beforeEach } from 'bun:test';
import {
  addSubscription,
  removeSubscription,
  removeAllSubscriptions,
  getSubscriptions,
  hasSubscription,
  matchesSubscription,
  getSubscriptionsForTable,
  getActiveConnectionCount,
  getActiveSubscriptionsCount,
  type Subscription,
  type ChangeEvent,
} from '../subscriptions';

describe('Subscription Management', () => {
  const connId = 'test-conn-1';
  const userId = 'user-1';
  const tenantId = 'tenant-1';

  beforeEach(() => {
    // Clean up
    removeAllSubscriptions(connId);
    removeAllSubscriptions('other-conn');
  });

  test('addSubscription creates a subscription', () => {
    const sub: Subscription = { table: 'storage_metadata' };
    const key = addSubscription(connId, userId, tenantId, sub);
    expect(key).toBe('storage_metadata:*');
    expect(hasSubscription(connId, 'storage_metadata')).toBe(true);
  });

  test('addSubscription with row_id creates unique key', () => {
    const sub: Subscription = { table: 'storage_metadata', row_id: 'row-123' };
    const key = addSubscription(connId, userId, tenantId, sub);
    expect(key).toBe('storage_metadata:row-123');
    expect(hasSubscription(connId, 'storage_metadata', 'row-123')).toBe(true);
  });

  test('addSubscription returns existing subscriptions', () => {
    addSubscription(connId, userId, tenantId, { table: 'storage_metadata' });
    addSubscription(connId, userId, tenantId, { table: 'functions' });
    const subs = getSubscriptions(connId);
    expect(subs).toHaveLength(2);
  });

  test('removeSubscription removes a subscription', () => {
    addSubscription(connId, userId, tenantId, { table: 'storage_metadata' });
    const removed = removeSubscription(connId, 'storage_metadata');
    expect(removed).toBe(true);
    expect(hasSubscription(connId, 'storage_metadata')).toBe(false);
  });

  test('removeSubscription returns false for nonexistent subscription', () => {
    const removed = removeSubscription(connId, 'nonexistent');
    expect(removed).toBe(false);
  });

  test('removeAllSubscriptions clears all subscriptions for a connection', () => {
    addSubscription(connId, userId, tenantId, { table: 'storage_metadata' });
    addSubscription(connId, userId, tenantId, { table: 'functions' });
    removeAllSubscriptions(connId);
    expect(getSubscriptions(connId)).toHaveLength(0);
  });

  test('getSubscriptionsForTable returns matching subscriptions', () => {
    addSubscription(connId, userId, tenantId, { table: 'storage_metadata' });
    addSubscription('other-conn', 'user-2', tenantId, { table: 'storage_metadata' });
    addSubscription('other-conn', 'user-2', tenantId, { table: 'functions' });

    const matches = getSubscriptionsForTable('storage_metadata', tenantId);
    expect(matches.size).toBe(2);
  });

  test('getSubscriptionsForTable filters by tenant', () => {
    addSubscription(connId, userId, tenantId, { table: 'storage_metadata' });
    addSubscription('other-conn', 'user-2', 'other-tenant', { table: 'storage_metadata' });

    const matches = getSubscriptionsForTable('storage_metadata', tenantId);
    expect(matches.size).toBe(1);
  });

  test('hasSubscription returns false for unknown connection', () => {
    expect(hasSubscription('unknown', 'storage_metadata')).toBe(false);
  });

  test('getSubscriptions returns empty for unknown connection', () => {
    expect(getSubscriptions('unknown')).toHaveLength(0);
  });

  test('metrics return correct counts', () => {
    expect(getActiveConnectionCount()).toBe(0);
    expect(getActiveSubscriptionsCount()).toBe(0);

    addSubscription(connId, userId, tenantId, { table: 'a' });
    addSubscription(connId, userId, tenantId, { table: 'b' });

    expect(getActiveConnectionCount()).toBe(1);
    expect(getActiveSubscriptionsCount()).toBe(2);
  });
});

describe('Channel Filtering', () => {
  const event: ChangeEvent = {
    table: 'storage_metadata',
    op: 'INSERT',
    id: 'row-123',
    tenant_id: 'tenant-1',
  };

  test('matchesSubscription matches same table', () => {
    const sub: Subscription = { table: 'storage_metadata' };
    expect(matchesSubscription(event, sub)).toBe(true);
  });

  test('matchesSubscription rejects different table', () => {
    const sub: Subscription = { table: 'functions' };
    expect(matchesSubscription(event, sub)).toBe(false);
  });

  test('matchesSubscription filters by row_id', () => {
    const sub: Subscription = { table: 'storage_metadata', row_id: 'row-123' };
    expect(matchesSubscription(event, sub)).toBe(true);
  });

  test('matchesSubscription rejects mismatched row_id', () => {
    const sub: Subscription = { table: 'storage_metadata', row_id: 'row-999' };
    expect(matchesSubscription(event, sub)).toBe(false);
  });

  test('matchesSubscription filters by op', () => {
    const sub: Subscription = { table: 'storage_metadata', filter: { op: 'INSERT' } };
    expect(matchesSubscription(event, sub)).toBe(true);
  });

  test('matchesSubscription rejects mismatched op filter', () => {
    const sub: Subscription = { table: 'storage_metadata', filter: { op: 'DELETE' } };
    expect(matchesSubscription(event, sub)).toBe(false);
  });
});
