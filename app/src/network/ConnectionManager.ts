/**
 * ConnectionManager — Robust TLS connection with auto-reconnect
 * 
 * Handles the full connection lifecycle:
 *   connect → TLS handshake → receive pairing.challenge →
 *     ├─ Has sessionToken? → send token for re-auth
 *     └─ First pair? → handled externally via pair screen
 *   → pairing.accept → AUTHENTICATED
 *   → input events flow
 * 
 * Features:
 *   - Exponential backoff reconnection (only after authenticated once)
 *   - Newline-delimited JSON framing
 *   - Keep-alive ping/pong
 *   - AppState (background/foreground) handling
 */

import TcpSocket from 'react-native-tcp-socket';
import { AppState, AppStateStatus } from 'react-native';
import { useConnectionStore } from '../store/connectionStore';
import { useDeviceStore } from '../store/deviceStore';
import { JetDeskMessage, makeMessage, MSG } from './protocol';

// ─── Types ──────────────────────────────────────────────────────────────────────

type MessageHandler = (msg: JetDeskMessage) => void;

interface PendingPairing {
  resolve: (token: string) => void;
  reject: (reason: string) => void;
}

// ─── ConnectionManager Singleton ────────────────────────────────────────────────

class ConnectionManager {
  private socket: any = null;
  private seq = 0;
  private dataBuffer = '';
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Map<string, MessageHandler[]>();
  private appStateSubscription: any = null;
  private intentionalDisconnect = false;
  private pendingPairing: PendingPairing | null = null;
  private isConnecting = false;
  private wasAuthenticated = false; // Only reconnect if we were previously authenticated

  // ─── Pairing challenge data received from daemon ──────────────────────────
  private challengeNonce: string | null = null;

  // ─── Connect ──────────────────────────────────────────────────────────────

  connect(deviceId?: string): void {
    // Guard: prevent multiple simultaneous connections
    if (this.isConnecting || (this.socket && !this.socket.destroyed)) {
      console.log('[CM] Already connecting or connected, skipping');
      return;
    }

    // Determine which device to connect to
    const store = useDeviceStore.getState();
    const targetId = deviceId || store.activeDeviceId;
    if (!targetId) {
      useConnectionStore.getState().setError('No device selected');
      return;
    }

    const device = store.devices.find(d => d.id === targetId);
    if (!device) {
      useConnectionStore.getState().setError('Device not found');
      return;
    }

    // Ensure active device is set
    store.setActiveDevice(targetId);

    // Cleanup any existing connection
    this.cleanupSocket();
    this.cancelReconnect();
    this.intentionalDisconnect = false;
    this.isConnecting = true;
    this.dataBuffer = '';
    this.challengeNonce = null;

    const connStore = useConnectionStore.getState();
    connStore.setStatus('connecting');

    const port = 57423;
    console.log(`[CM] Connecting to tls://${device.ip}:${port}...`);

    try {
      const options = {
        port,
        host: device.ip,
        rejectUnauthorized: false, // Self-signed cert
      };

      this.socket = TcpSocket.connectTLS(options, () => {
        console.log('[CM] TLS socket connected, waiting for challenge...');
        this.isConnecting = false;
        // Disable Nagle's algorithm — send packets immediately
        // Critical for low-latency mouse input
        try { this.socket?.setNoDelay(true); } catch (e) { /* not all impls support this */ }
        useConnectionStore.getState().setStatus('authenticating');
      });

      this.socket.on('data', (data: Buffer | string) => {
        this.handleData(data);
      });

      this.socket.on('error', (e: any) => {
        const msg = e?.message || String(e);
        console.error('[CM] Socket error:', msg);
        this.isConnecting = false;
        // Don't schedule reconnect here — let 'close' handle it
        // 'close' always fires after 'error'
      });

      this.socket.on('close', () => {
        console.log('[CM] Socket closed');
        this.isConnecting = false;
        this.cleanupTimers();
        this.socket = null;

        if (!this.intentionalDisconnect) {
          useConnectionStore.getState().setStatus('disconnected');
          // Only auto-reconnect if we were previously authenticated
          if (this.wasAuthenticated) {
            this.scheduleReconnect();
          }
        } else {
          useConnectionStore.getState().setStatus('disconnected');
        }
      });

      // Setup AppState listener (only once)
      this.setupAppStateListener();

    } catch (e: any) {
      console.error('[CM] Failed to initiate connection:', e);
      this.isConnecting = false;
      useConnectionStore.getState().setError(e?.message || 'Connection failed');
    }
  }

  // ─── Disconnect ───────────────────────────────────────────────────────────

  disconnect(): void {
    console.log('[CM] Intentional disconnect');
    this.intentionalDisconnect = true;
    this.wasAuthenticated = false;
    this.isConnecting = false;
    this.cleanupSocket();
    this.cleanupTimers();
    this.cancelReconnect();
    useConnectionStore.getState().setStatus('disconnected');
    useConnectionStore.getState().resetReconnect();
    this.removeAppStateListener();
  }

  // ─── Send ─────────────────────────────────────────────────────────────────

  send(type: string, payload: any): void {
    if (!this.socket || this.socket.destroyed) return;

    const msg = JSON.stringify({
      v: 1,
      type,
      seq: ++this.seq,
      payload,
    });

    try {
      this.socket.write(msg + '\n');
    } catch (e) {
      console.warn('[CM] Failed to write:', e);
    }
  }

  // ─── Pair (called from pair screen after PIN entry) ───────────────────────

  /**
   * Initiates pairing verification with the daemon.
   * Must be called AFTER connect() and after the challenge is received.
   * Returns a Promise that resolves with the session token on success.
   */
  pair(opts: {
    deviceId: string;
    deviceName: string;
    pin: string;
  }): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.challengeNonce) {
        reject('No pairing challenge received. Try reconnecting.');
        return;
      }

      const device = useDeviceStore.getState().devices.find(d => d.id === opts.deviceId);
      if (!device) {
        reject('Device not found');
        return;
      }

      this.pendingPairing = { resolve, reject };

      this.send(MSG.PAIRING_VERIFY, {
        deviceId: opts.deviceId,
        deviceName: opts.deviceName,
        pin: opts.pin,
        nonce: this.challengeNonce,
        fingerprint: device.certFingerprint,
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingPairing) {
          this.pendingPairing.reject('Pairing timed out');
          this.pendingPairing = null;
        }
      }, 10000);
    });
  }

  // ─── Event listeners ──────────────────────────────────────────────────────

  on(type: string, handler: MessageHandler): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.listeners.get(type);
      if (handlers) {
        const idx = handlers.indexOf(handler);
        if (idx >= 0) handlers.splice(idx, 1);
      }
    };
  }

  isConnected(): boolean {
    return useConnectionStore.getState().status === 'connected';
  }

  getStatus() {
    return useConnectionStore.getState().status;
  }

  getChallengeNonce(): string | null {
    return this.challengeNonce;
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private handleData(data: Buffer | string): void {
    try {
      this.dataBuffer += data.toString();
      const lines = this.dataBuffer.split('\n');
      this.dataBuffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const msg: JetDeskMessage = JSON.parse(line);
          this.handleMessage(msg);
        } catch (parseErr) {
          console.warn('[CM] Failed to parse message:', line.substring(0, 100));
        }
      }
    } catch (err) {
      console.warn('[CM] Data handling error:', err);
    }
  }

  private handleMessage(msg: JetDeskMessage): void {
    switch (msg.type) {
      case MSG.PAIRING_CHALLENGE:
        this.handlePairingChallenge(msg);
        break;

      case MSG.PAIRING_ACCEPT:
        this.handlePairingAccept(msg);
        break;

      case MSG.PAIRING_REJECT:
        this.handlePairingReject(msg);
        break;

      case MSG.PONG:
        // Keep-alive confirmed
        break;

      default:
        // Dispatch to registered listeners
        this.emit(msg.type, msg);
        break;
    }
  }

  private handlePairingChallenge(msg: JetDeskMessage): void {
    const { nonce, certFingerprint } = msg.payload;
    this.challengeNonce = nonce;
    console.log('[CM] Received pairing challenge, nonce:', nonce?.substring(0, 8) + '...');

    // Try to auto-authenticate with stored session token
    const deviceStore = useDeviceStore.getState();
    const activeDevice = deviceStore.getActiveDevice();

    if (activeDevice?.sessionToken) {
      console.log('[CM] Attempting re-auth with stored session token...');
      // The daemon's handleTokenAuth expects the session token in the nonce field
      // of a pairing.challenge message from the client
      this.send(MSG.PAIRING_CHALLENGE, {
        nonce: activeDevice.sessionToken,
      });
    } else {
      console.log('[CM] No session token — waiting for manual pairing');
      // The pair screen will call connectionManager.pair() after PIN entry
      this.emit(MSG.PAIRING_CHALLENGE, msg);
    }
  }

  private handlePairingAccept(msg: JetDeskMessage): void {
    const { sessionToken, deviceId } = msg.payload;
    console.log('[CM] Pairing accepted!');

    // Mark that we've been authenticated (enables auto-reconnect)
    this.wasAuthenticated = true;

    // Store the session token for future reconnections
    if (sessionToken && deviceId) {
      useDeviceStore.getState().storeSessionToken(deviceId, sessionToken);
    }

    // Mark as connected
    useConnectionStore.getState().setStatus('connected');
    useConnectionStore.getState().resetReconnect();

    // Start keep-alive
    this.startPing();

    // Resolve pending pairing promise if any
    if (this.pendingPairing) {
      this.pendingPairing.resolve(sessionToken);
      this.pendingPairing = null;
    }

    this.emit(MSG.PAIRING_ACCEPT, msg);
  }

  private handlePairingReject(msg: JetDeskMessage): void {
    const reason = msg.payload?.reason || 'Rejected';
    console.warn('[CM] Pairing rejected:', reason);

    // Clear stored token if re-auth failed
    const activeDevice = useDeviceStore.getState().getActiveDevice();
    if (activeDevice) {
      useDeviceStore.getState().clearSessionToken(activeDevice.id);
    }

    useConnectionStore.getState().setError(reason);

    // Resolve pending pairing promise if any
    if (this.pendingPairing) {
      this.pendingPairing.reject(reason);
      this.pendingPairing = null;
    }

    this.emit(MSG.PAIRING_REJECT, msg);
  }

  private emit(type: string, msg: JetDeskMessage): void {
    const handlers = this.listeners.get(type);
    if (handlers) {
      handlers.forEach(h => {
        try {
          h(msg);
        } catch (e) {
          console.warn('[CM] Handler error for', type, ':', e);
        }
      });
    }
  }

  // ─── Keep-alive ───────────────────────────────────────────────────────────

  private startPing(): void {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.socket && !this.socket.destroyed) {
        this.send(MSG.PING, {});
      }
    }, 10000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // ─── Auto-reconnect with exponential backoff ──────────────────────────────

  private scheduleReconnect(): void {
    if (this.intentionalDisconnect) return;
    if (this.reconnectTimeout) return; // Already scheduled

    const connStore = useConnectionStore.getState();
    if (!connStore.canReconnect()) {
      console.warn('[CM] Max reconnect attempts reached');
      connStore.setError('Unable to connect after multiple attempts');
      return;
    }

    const attempt = connStore.incrementReconnect();
    const baseDelay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
    const jitter = Math.random() * 1000;
    const delay = baseDelay + jitter;

    console.log(`[CM] Reconnecting in ${Math.round(delay)}ms (attempt ${attempt})...`);
    connStore.setStatus('reconnecting');

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  // ─── AppState handling ────────────────────────────────────────────────────

  private setupAppStateListener(): void {
    // Only set up once
    if (this.appStateSubscription) return;
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );
  }

  private removeAppStateListener(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  private handleAppStateChange(state: AppStateStatus): void {
    if (state === 'background') {
      // Don't disconnect immediately — just stop pings to save battery
      console.log('[CM] App backgrounded, pausing pings');
      this.stopPing();
    } else if (state === 'active') {
      console.log('[CM] App foregrounded');
      // If still connected, just restart pings
      if (this.socket && !this.socket.destroyed && this.wasAuthenticated) {
        this.startPing();
      } else if (this.wasAuthenticated && !this.socket) {
        // Socket died while backgrounded — reconnect
        console.log('[CM] Reconnecting after background...');
        this.intentionalDisconnect = false;
        useConnectionStore.getState().resetReconnect();
        this.connect();
      }
    }
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  private cleanupSocket(): void {
    if (this.socket) {
      try {
        this.socket.destroy();
      } catch (e) {
        // Ignore destroy errors
      }
      this.socket = null;
    }
  }

  private cleanupTimers(): void {
    this.stopPing();
  }
}

// ─── Export singleton ───────────────────────────────────────────────────────────

export const connectionManager = new ConnectionManager();
