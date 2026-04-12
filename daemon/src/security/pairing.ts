import QRCode from 'qrcode';
import crypto from 'crypto';
import os from 'os';
import fs from 'fs';
import { config, KEY_FILE } from '../config/index.js';
import { getLocalIp } from './tls.js';

// ─── Pairing payload (encoded in QR code) ────────────────────────────────────

export interface QrPayload {
  ip: string;
  wsPort: number;
  httpPort: number;
  fingerprint: string;
  hostname: string;
  pin: string; // PIN included in QR for auto-pairing
  v: number;
}

// ─── Active pairing session ───────────────────────────────────────────────────

interface PairingSession {
  nonce: string;
  fingerprint: string;
  createdAt: number;
}

let activeSessions = new Map<string, PairingSession>();

// Clean up expired sessions every minute
setInterval(() => {
  const now = Date.now();
  for (const [nonce, session] of activeSessions) {
    if (now - session.createdAt > 5 * 60 * 1000) activeSessions.delete(nonce);
  }
}, 60_000);

// ─── Session management ───────────────────────────────────────────────────────

export function createPairingSession(fingerprint: string): PairingSession {
  const nonce = crypto.randomBytes(16).toString('hex');
  const session: PairingSession = { nonce, fingerprint, createdAt: Date.now() };
  activeSessions.set(nonce, session);
  return session;
}

export function consumePairingSession(nonce: string): PairingSession | null {
  const session = activeSessions.get(nonce);
  if (!session) return null;
  // Expire after 5 minutes
  if (Date.now() - session.createdAt > 5 * 60 * 1000) {
    activeSessions.delete(nonce);
    return null;
  }
  activeSessions.delete(nonce); // One-time use
  return session;
}

// ─── QR code generation ───────────────────────────────────────────────────────

export async function generateQrCode(fingerprint: string): Promise<{ qr: string; pin: string; payload: QrPayload }> {
  const pin = config.generatePin();
  const ip  = getLocalIp();

  const payload: QrPayload = {
    ip,
    wsPort:    config.get('wsPort'),
    httpPort:  config.get('httpPort'),
    fingerprint,
    hostname:  os.hostname(),
    pin,  // Include PIN in QR so app can auto-pair
    v: 1,
  };

  // Encode as a deep-link URL so the phone app can intercept it
  const qrString = `jetdesk://pair?data=${encodeURIComponent(JSON.stringify(payload))}`;
  const qr = await QRCode.toDataURL(qrString, {
    errorCorrectionLevel: 'H',
    width: 300,
    margin: 2,
  });

  return { qr, pin, payload };
}

// ─── Verify incoming pairing request ─────────────────────────────────────────

export interface PairingResult {
  success: boolean;
  reason?: string;
  sessionToken?: string;
}

export function verifyPairing(opts: {
  deviceId: string;
  deviceName: string;
  pin: string;
  nonce: string;
  fingerprint: string;
}): PairingResult {
  // Validate PIN
  if (!config.validatePin(opts.pin)) {
    return { success: false, reason: 'Invalid or expired PIN' };
  }

  // Validate nonce
  const session = consumePairingSession(opts.nonce);
  if (!session) {
    return { success: false, reason: 'Invalid or expired pairing session' };
  }

  // Fingerprint must match
  if (session.fingerprint !== opts.fingerprint) {
    return { success: false, reason: 'Certificate fingerprint mismatch' };
  }

  // Invalidate PIN after successful use
  config.invalidatePin();

  // Register device
  config.addPairedDevice({
    deviceId: opts.deviceId,
    deviceName: opts.deviceName,
    pairedAt: Date.now(),
    lastSeen: Date.now(),
    certFingerprint: opts.fingerprint,
  });

  const sessionToken = generateSessionToken(opts.deviceId);
  return { success: true, sessionToken };
}

// ─── Session tokens (PERSISTENT across daemon restarts) ────────────────────────

/**
 * Derive a stable secret from the TLS private key.
 * This ensures session tokens remain valid across daemon restarts
 * as long as the same TLS key is used.
 */
function getStableSecret(): string {
  try {
    const keyData = fs.readFileSync(KEY_FILE, 'utf-8');
    return crypto.createHash('sha256').update(keyData).digest('hex');
  } catch {
    // Fallback to random (tokens won't survive restart)
    console.warn('[Pairing] Could not read TLS key for stable secret, using random');
    return crypto.randomBytes(32).toString('hex');
  }
}

const SESSION_SECRET = getStableSecret();

/**
 * Session tokens are deterministic HMACs of deviceId + a per-device salt.
 * This means the SAME token is generated for the same device every time,
 * so even if the in-memory map is cleared (daemon restart), 
 * the token can be re-validated by recomputing the HMAC.
 * 
 * We also keep the active map for fast lookups.
 */
const activeSTs = new Map<string, string>(); // token → deviceId

function generateSessionToken(deviceId: string): string {
  // Use a deterministic salt so the same device always gets the same token
  const token = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`jetdesk:session:${deviceId}`)
    .digest('hex');
  activeSTs.set(token, deviceId);
  return token;
}

export function validateSessionToken(token: string): string | null {
  // Fast path: check in-memory map
  const cached = activeSTs.get(token);
  if (cached) return cached;

  // Slow path: re-validate against all paired devices
  // Since tokens are deterministic, we can recompute them
  const pairedDevices = config.get('pairedDevices');
  for (const device of pairedDevices) {
    const expectedToken = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(`jetdesk:session:${device.deviceId}`)
      .digest('hex');
    if (expectedToken === token) {
      // Cache for future fast lookups
      activeSTs.set(token, device.deviceId);
      return device.deviceId;
    }
  }

  return null;
}

export function revokeSessionToken(token: string): void {
  activeSTs.delete(token);
}