// Realtime — Subscription Management
// Maintains per-connection subscription state

export interface Subscription {
  table: string;
  filter?: Record<string, unknown>;
  row_id?: string;
}

export interface ClientSubscription {
  userId: string;
  tenantId: string;
  subscriptions: Map<string, Subscription>; // key = `${table}:${row_id ?? '*'}`
}

const clientSubscriptions = new Map<string, ClientSubscription>();

// ============================================================
// Manage Subscriptions
// ============================================================

export function addSubscription(
  connectionId: string,
  userId: string,
  tenantId: string,
  sub: Subscription,
): string {
  let client = clientSubscriptions.get(connectionId);
  if (!client) {
    client = { userId, tenantId, subscriptions: new Map() };
    clientSubscriptions.set(connectionId, client);
  }

  const key = `${sub.table}:${sub.row_id ?? '*'}`;
  client.subscriptions.set(key, sub);
  return key;
}

export function removeSubscription(
  connectionId: string,
  table: string,
  rowId?: string,
): boolean {
  const client = clientSubscriptions.get(connectionId);
  if (!client) return false;
  const key = `${table}:${rowId ?? '*'}`;
  return client.subscriptions.delete(key);
}

export function removeAllSubscriptions(connectionId: string): void {
  clientSubscriptions.delete(connectionId);
}

export function getSubscriptionsForTable(
  table: string,
  tenantId: string,
): Map<string, { connectionId: string; sub: Subscription }> {
  const matches = new Map<string, { connectionId: string; sub: Subscription }>();

  for (const [connId, client] of clientSubscriptions) {
    if (client.tenantId !== tenantId) continue;
    for (const [, sub] of client.subscriptions) {
      if (sub.table === table) {
        matches.set(connId, { connectionId: connId, sub });
      }
    }
  }

  return matches;
}

export function hasSubscription(
  connectionId: string,
  table: string,
  rowId?: string,
): boolean {
  const client = clientSubscriptions.get(connectionId);
  if (!client) return false;
  const key = `${table}:${rowId ?? '*'}`;
  return client.subscriptions.has(key);
}

export function getSubscriptions(connectionId: string): Subscription[] {
  const client = clientSubscriptions.get(connectionId);
  if (!client) return [];
  return Array.from(client.subscriptions.values());
}

// ============================================================
// Channel Filtering
// ============================================================

export interface ChangeEvent {
  table: string;
  op: 'INSERT' | 'UPDATE' | 'DELETE';
  id: string;
  tenant_id: string;
}

export function matchesSubscription(event: ChangeEvent, sub: Subscription): boolean {
  // Table must match
  if (sub.table !== event.table) return false;

  // If row_id is specified, match only that row
  if (sub.row_id && sub.row_id !== event.id) return false;

  // Filter evaluation (simple key-value matching for now)
  if (sub.filter) {
    for (const [key, value] of Object.entries(sub.filter)) {
      // Basic filter: event must have a payload with matching field
      // Extended in real scenarios with full payload matching
      if (key === 'op' && value !== event.op) return false;
    }
  }

  return true;
}

// ============================================================
// Diagnostics
// ============================================================

export function getActiveConnectionCount(): number {
  return clientSubscriptions.size;
}

export function getActiveSubscriptionsCount(): number {
  let count = 0;
  for (const client of clientSubscriptions.values()) {
    count += client.subscriptions.size;
  }
  return count;
}
