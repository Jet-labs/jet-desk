import { TLSSocket } from 'tls';
import { config } from '../config/index.js';
import { validateSessionToken } from './pairing.js';

// ─── Auth state per connection ────────────────────────────────────────────────

export type AuthState = 'pending' | 'pairing' | 'authenticated';

export interface ConnectionContext {
  socket: TLSSocket;
  id: string;              // internal connection id
  deviceId: string | null;
  deviceName: string | null;
  authState: AuthState;
  sessionToken: string | null;
  remoteIp: string;
  connectedAt: number;
  seq: number;             // outgoing sequence counter
}

const connections = new Map<string, ConnectionContext>();
let connCounter = 0;

// ─── Create a new connection context ─────────────────────────────────────────

export function createConnection(socket: TLSSocket, remoteIp: string): ConnectionContext {
  const id = `conn_${++connCounter}_${Date.now()}`;
  const ctx: ConnectionContext = {
    socket, id,
    deviceId: null,
    deviceName: null,
    authState: 'pending',
    sessionToken: null,
    remoteIp,
    connectedAt: Date.now(),
    seq: 0,
  };
  connections.set(id, ctx);
  console.log(`[Auth] New connection ${id} from ${remoteIp}`);
  return ctx;
}

export function removeConnection(id: string): void {
  connections.delete(id);
}

export function getConnections(): Map<string, ConnectionContext> {
  return connections;
}

export function getConnectionsSummary() {
  return Array.from(connections.values()).map(ctx => ({
    id: ctx.id,
    deviceId: ctx.deviceId,
    deviceName: ctx.deviceName,
    authState: ctx.authState,
    remoteIp: ctx.remoteIp,
    connectedAt: ctx.connectedAt,
  }));
}

// ─── Authenticate with session token (reconnect) ──────────────────────────────

export function authenticateWithToken(ctx: ConnectionContext, token: string): boolean {
  const deviceId = validateSessionToken(token);
  if (!deviceId) return false;

  if (!config.isPaired(deviceId)) return false;

  ctx.authState = 'authenticated';
  ctx.sessionToken = token;
  ctx.deviceId = deviceId;

  const device = config.getPairedDevice(deviceId);
  ctx.deviceName = device?.deviceName ?? 'Unknown';

  config.updateLastSeen(deviceId);
  console.log(`[Auth] Device "${ctx.deviceName}" re-authenticated via token`);
  return true;
}

// ─── Authenticate after successful pairing ────────────────────────────────────

export function authenticateAfterPairing(
  ctx: ConnectionContext,
  deviceId: string,
  deviceName: string,
  sessionToken: string
): void {
  ctx.authState = 'authenticated';
  ctx.deviceId = deviceId;
  ctx.deviceName = deviceName;
  ctx.sessionToken = sessionToken;
  console.log(`[Auth] Device "${deviceName}" fully authenticated after pairing`);
}

// ─── Guard: reject unauthenticated messages ───────────────────────────────────

export function requireAuth(ctx: ConnectionContext): boolean {
  return ctx.authState === 'authenticated';
}

// ─── Rate limiting (simple in-memory per IP) ──────────────────────────────────

const rateLimits = new Map<string, { count: number; resetAt: number }>();
const MAX_MESSAGES_PER_SECOND = 200;

export function checkRateLimit(remoteIp: string): boolean {
  const now = Date.now();
  let rl = rateLimits.get(remoteIp);
  if (!rl || now > rl.resetAt) {
    rl = { count: 0, resetAt: now + 1000 };
    rateLimits.set(remoteIp, rl);
  }
  rl.count++;
  return rl.count <= MAX_MESSAGES_PER_SECOND;
}