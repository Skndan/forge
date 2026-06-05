// Realtime — WebSocket Connection Manager
// Handles connection lifecycle, reconnection, and message routing

import type { ServerWebSocket } from 'bun';
import { verifyToken, type RealtimeUser } from './auth.js';
import {
  addSubscription,
  removeSubscription,
  removeAllSubscriptions,
  getSubscriptions,
  type Subscription,
} from './subscriptions.js';
import { valkeyPubSub, type PubSubMessage } from './pubsub.js';
import { pgListenManager } from './pglisten.js';

// ============================================================
// Types
// ============================================================

export interface ConnectionState {
  id: string;
  ws: ServerWebSocket<ConnectionState>;
  user: RealtimeUser;
  authenticated: boolean;
  connectedAt: number;
  lastPingAt: number;
}

export interface WsMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'pong';
  table?: string;
  row_id?: string;
  filter?: Record<string, unknown>;
  subscription_id?: string;
}

export interface WsResponse {
  type: 'subscribed' | 'unsubscribed' | 'error' | 'pong' | 'message';
  subscription_id?: string;
  message?: string;
  code?: string;
  data?: PubSubMessage;
}

// ============================================================
// Active Connections
// ============================================================

const connections = new Map<string, ConnectionState>();
let connectionCounter = 0;

// ============================================================
// Connection Lifecycle
// ============================================================

export async function handleOpen(ws: ServerWebSocket<ConnectionState>): Promise<void> {
  connectionCounter++;
  const id = `conn_${connectionCounter}_${Date.now()}`;

  const state: ConnectionState = {
    id,
    ws,
    user: { sub: '', tenant_id: '', plan: 'free', roles: [] },
    authenticated: false,
    connectedAt: Date.now(),
    lastPingAt: Date.now(),
  };

  ws.data = state;
  connections.set(id, state);

  console.log(`[realtime] Connection open: ${id}`);
}

export async function handleMessage(
  ws: ServerWebSocket<ConnectionState>,
  rawMessage: string | Buffer,
): Promise<void> {
  const state = ws.data;
  let message: WsMessage;

  try {
    message = JSON.parse(rawMessage.toString()) as WsMessage;
  } catch {
    sendJson(ws, { type: 'error', code: 'PARSE_ERROR', message: 'Invalid JSON' });
    return;
  }

  switch (message.type) {
    case 'subscribe':
      await handleSubscribe(state, message);
      break;
    case 'unsubscribe':
      await handleUnsubscribe(state, message);
      break;
    case 'ping':
      state.lastPingAt = Date.now();
      sendJson(ws, { type: 'pong' });
      break;
    default:
      sendJson(ws, { type: 'error', code: 'UNKNOWN_TYPE', message: `Unknown message type: ${message.type}` });
  }
}

export async function handleClose(ws: ServerWebSocket<ConnectionState>): Promise<void> {
  const state = ws.data;
  if (!state) return;

  console.log(`[realtime] Connection closed: ${state.id}`);
  removeAllSubscriptions(state.id);
  connections.delete(state.id);
}

export function handleDrain(ws: ServerWebSocket<ConnectionState>): void {
  // Backpressure handling — could implement a write buffer here
  console.log(`[realtime] Backpressure on connection: ${ws.data?.id}`);
}

// ============================================================
// Auth via Token
// ============================================================

export async function authenticateConnection(
  state: ConnectionState,
  token: string,
): Promise<boolean> {
  try {
    const user = await verifyToken(token);
    state.user = user;
    state.authenticated = true;
    sendJson(state.ws, { type: 'authenticated', message: `Authenticated as ${user.sub}` });
    return true;
  } catch (err) {
    sendJson(state.ws, {
      type: 'error',
      code: 'AUTH_FAILED',
      message: `Authentication failed: ${(err as Error).message}`,
    });
    return false;
  }
}

// ============================================================
// Subscribe / Unsubscribe
// ============================================================

async function handleSubscribe(
  state: ConnectionState,
  message: WsMessage,
): Promise<void> {
  if (!state.authenticated) {
    sendJson(state.ws, { type: 'error', code: 'UNAUTHENTICATED', message: 'Not authenticated' });
    return;
  }

  if (!message.table) {
    sendJson(state.ws, { type: 'error', code: 'VALIDATION_ERROR', message: 'table is required' });
    return;
  }

  const sub: Subscription = {
    table: message.table,
    filter: message.filter,
    row_id: message.row_id,
  };

  const key = addSubscription(state.id, state.user.sub, state.user.tenant_id, sub);

  sendJson(state.ws, {
    type: 'subscribed',
    subscription_id: key,
    message: `Subscribed to ${message.table}${message.row_id ? `:${message.row_id}` : ''}`,
  });
}

async function handleUnsubscribe(
  state: ConnectionState,
  message: WsMessage,
): Promise<void> {
  if (!message.table) {
    sendJson(state.ws, { type: 'error', code: 'VALIDATION_ERROR', message: 'table is required' });
    return;
  }

  const removed = removeSubscription(state.id, message.table, message.row_id);

  sendJson(state.ws, {
    type: 'unsubscribed',
    message: removed
      ? `Unsubscribed from ${message.table}${message.row_id ? `:${message.row_id}` : ''}`
      : 'Subscription not found',
  });
}

// ============================================================
// Broadcast to Subscribers
// ============================================================

export function broadcastToSubscribers(message: PubSubMessage): void {
  for (const [, state] of connections) {
    if (!state.authenticated) continue;
    if (state.user.tenant_id !== message.tenant_id) continue;

    const subs = getSubscriptions(state.id);
    for (const sub of subs) {
      if (sub.table !== message.table) continue;
      if (sub.row_id && sub.row_id !== message.id) continue;

      // Send to client
      sendJson(state.ws, {
        type: 'message',
        data: message,
      });
      break; // One message per client per event
    }
  }
}

// ============================================================
// Valkey Pub/Sub Handler
// ============================================================

export function onValkeyMessage(_channel: string, message: PubSubMessage): void {
  broadcastToSubscribers(message);
}

// ============================================================
// Reconnection Support
// ============================================================

export interface ReconnectionInfo {
  connectionId: string;
  token: string;
  lastMessageId?: string;
}

export function getConnection(connectionId: string): ConnectionState | undefined {
  return connections.get(connectionId);
}

// ============================================================
// Helpers
// ============================================================

function sendJson(ws: ServerWebSocket<ConnectionState>, data: WsResponse): void {
  if (ws.readyState === 1) {
    // OPEN
    ws.send(JSON.stringify(data));
  }
}

export function getActiveConnectionCount(): number {
  return connections.size;
}
