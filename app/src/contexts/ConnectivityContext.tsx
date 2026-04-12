/**
 * ConnectivityContext — Provides mDNS discovery and connection controls
 * Wraps the ConnectionManager singleton for React consumption
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import Zeroconf from 'react-native-zeroconf';
import { connectionManager } from '../network/ConnectionManager';
import { useConnectionStore, ConnectionStatus } from '../store/connectionStore';
import { useDeviceStore } from '../store/deviceStore';
import { MSG } from '../network/protocol';
import * as Clipboard from 'expo-clipboard';

// ─── Context value ──────────────────────────────────────────────────────────────

interface ConnectivityContextValue {
  // mDNS discovery
  discoveredDevices: any[];
  isScanning: boolean;
  retryScan: () => void;

  // Connection
  status: ConnectionStatus;
  errorMessage: string | null;
  connect: (deviceId?: string) => void;
  disconnect: () => void;
  sendEvent: (type: string, payload: any) => void;

  // Pairing
  pair: (opts: { deviceId: string; deviceName: string; pin: string }) => Promise<string>;
  challengeReady: boolean;

  // Screen Stream
  currentFrame: string | null;
  startScreenStream: (fps?: number, quality?: number, scale?: number) => void;
  stopScreenStream: () => void;
  castToPc: () => void;

  // Clipboard
  clipboardContent: string | null;
  setRemoteClipboard: (text: string) => void;
  getRemoteClipboard: () => void;
}

const ConnectivityContext = createContext<ConnectivityContextValue>({
  discoveredDevices: [],
  isScanning: false,
  retryScan: () => {},
  status: 'disconnected',
  errorMessage: null,
  connect: () => {},
  disconnect: () => {},
  sendEvent: () => {},
  pair: async () => '',
  challengeReady: false,
  currentFrame: null,
  startScreenStream: () => {},
  stopScreenStream: () => {},
  castToPc: () => {},
  clipboardContent: null,
  setRemoteClipboard: () => {},
  getRemoteClipboard: () => {},
});

// ─── Provider ───────────────────────────────────────────────────────────────────

export const ConnectivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [discoveredDevices, setDiscoveredDevices] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [challengeReady, setChallengeReady] = useState(false);

  // Subscribe to Zustand stores
  const status = useConnectionStore(s => s.status);
  const errorMessage = useConnectionStore(s => s.errorMessage);

  // ─── mDNS Discovery ─────────────────────────────────────────────────────

  useEffect(() => {
    let zeroconf: Zeroconf | null = null;

    try {
      zeroconf = new Zeroconf();

      zeroconf.on('start', () => {
        console.log('[mDNS] Scan started');
        setIsScanning(true);
      });

      zeroconf.on('stop', () => {
        console.log('[mDNS] Scan stopped');
        setIsScanning(false);
      });

      zeroconf.on('error', (err) => {
        console.warn('[mDNS] Error:', err);
        setIsScanning(false);
      });

      zeroconf.on('resolved', (service) => {
        if (service.name?.startsWith('JetDesk-')) {
          console.log('[mDNS] Resolved:', service.name);
          setDiscoveredDevices(curr => {
            if (curr.find(s => s.fullName === service.fullName)) return curr;
            return [...curr, service];
          });

          // Auto-update IP for saved devices
          const txt = service.txt || {};
          const fp = txt.fingerprint || txt.fp;
          const newIp = txt.ip || service.addresses?.[0];
          if (fp && newIp) {
            const deviceStore = useDeviceStore.getState();
            const saved = deviceStore.devices.find(d => d.certFingerprint === fp || d.id === fp);
            if (saved && saved.ip !== newIp) {
              console.log(`[mDNS] Updating IP for ${saved.hostname}: ${saved.ip} → ${newIp}`);
              deviceStore.updateDevice(saved.id, { ip: newIp });
            }
          }
        }
      });

      zeroconf.scan('jetdesk', 'tcp', 'local.');
    } catch (e) {
      console.warn('[mDNS] Failed to initialize:', e);
    }

    return () => {
      try {
        zeroconf?.stop();
        zeroconf?.removeDeviceListeners();
      } catch { /* ignore */ }
    };
  }, []);

  // ─── Listen for pairing challenge ─────────────────────────────────────────

  useEffect(() => {
    const unsub = connectionManager.on(MSG.PAIRING_CHALLENGE, () => {
      setChallengeReady(true);
    });

    return unsub;
  }, []);

  // ─── Screen Stream ────────────────────────────────────────────────────────
  const [currentFrame, setCurrentFrame] = useState<string | null>(null);

  useEffect(() => {
    const unsub = connectionManager.on('screen.frame', (msg: any) => {
      if (msg && msg.payload && msg.payload.data) {
        setCurrentFrame(`data:image/jpeg;base64,${msg.payload.data}`);
      }
    });

    return unsub;
  }, []);

  // ─── Clipboard ────────────────────────────────────────────────────────────
  const [clipboardContent, setClipboardContent] = useState<string | null>(null);

  useEffect(() => {
    const unsubData = connectionManager.on(MSG.CLIPBOARD_DATA, async (msg: any) => {
      const text = msg.payload?.text;
      if (typeof text === 'string') {
        setClipboardContent(text);
      }
    });

    const unsubChanged = connectionManager.on(MSG.CLIPBOARD_CHANGED, async (msg: any) => {
      const text = msg.payload?.text;
      if (typeof text === 'string') {
        setClipboardContent(text);
      }
    });

    return () => {
      unsubData();
      unsubChanged();
    };
  }, []);

  // Clipboard is now fetched on-demand on the Clipboard page
  useEffect(() => {
    // 
  }, [status]);

  // Reset challenge and screen state on disconnect
  useEffect(() => {
    if (status === 'disconnected') {
      setChallengeReady(false);
      setCurrentFrame(null);
      setClipboardContent(null);
    }
  }, [status]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const connect = useCallback((deviceId?: string) => {
    setChallengeReady(false);
    connectionManager.connect(deviceId);
  }, []);

  const disconnect = useCallback(() => {
    connectionManager.disconnect();
  }, []);

  const sendEvent = useCallback((type: string, payload: any) => {
    connectionManager.send(type, payload);
  }, []);

  const pair = useCallback(async (opts: { deviceId: string; deviceName: string; pin: string }) => {
    return connectionManager.pair(opts);
  }, []);

  const retryScan = useCallback(() => {
    setDiscoveredDevices([]);
  }, []);

  const startScreenStream = useCallback((fps = 15, quality = 60, scale = 0.5) => {
    connectionManager.send('screen.start', { fps, quality, scale });
  }, []);

  const stopScreenStream = useCallback(() => {
    connectionManager.send('screen.stop', {});
    setTimeout(() => setCurrentFrame(null), 0);
  }, []);

  const castToPc = useCallback(() => {
    connectionManager.send('system.open_cast', {});
    
    // Automatically open the Cast menu on the Phone
    import('react-native').then(({ Platform, Linking }) => {
      if (Platform.OS === 'android') {
        Linking.sendIntent('android.settings.CAST_SETTINGS').catch(e => {
          console.warn('Cast settings not available', e);
        });
      }
    });
  }, []);

  const setRemoteClipboard = useCallback((text: string) => {
    connectionManager.send(MSG.CLIPBOARD_SET, { text });
  }, []);

  const getRemoteClipboard = useCallback(() => {
    connectionManager.send(MSG.CLIPBOARD_GET, {});
  }, []);

  // ─── Value ────────────────────────────────────────────────────────────────

  const value: ConnectivityContextValue = {
    discoveredDevices,
    isScanning,
    retryScan,
    status,
    errorMessage,
    connect,
    disconnect,
    sendEvent,
    pair,
    challengeReady,
    currentFrame,
    startScreenStream,
    stopScreenStream,
    castToPc,
    clipboardContent,
    setRemoteClipboard,
    getRemoteClipboard,
  };

  return (
    <ConnectivityContext.Provider value={value}>
      {children}
    </ConnectivityContext.Provider>
  );
};

export const useConnectivity = () => useContext(ConnectivityContext);
