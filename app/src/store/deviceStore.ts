/**
 * Device Store — Persisted device registry with session tokens
 * Uses MMKV for fast synchronous persistence
 */

import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';

export const storage = createMMKV({ id: 'jetdesk-storage' });

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface SavedDevice {
  id: string;            // Typically the cert fingerprint
  hostname: string;
  ip: string;
  pin: string;
  certFingerprint: string;
  sessionToken?: string; // Persisted for reconnection
  mac?: string;          // For WOL
  lastConnected?: number;
}

interface DeviceStoreState {
  devices: SavedDevice[];
  activeDeviceId: string | null;

  // Actions
  loadDevices: () => void;
  addDevice: (device: SavedDevice) => void;
  removeDevice: (id: string) => void;
  updateDevice: (id: string, patch: Partial<SavedDevice>) => void;
  setActiveDevice: (id: string | null) => void;
  getActiveDevice: () => SavedDevice | undefined;
  storeSessionToken: (deviceId: string, token: string) => void;
  getSessionToken: (deviceId: string) => string | undefined;
  clearSessionToken: (deviceId: string) => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'pc.devices';

function persistDevices(devices: SavedDevice[]): void {
  try {
    storage.set(STORAGE_KEY, JSON.stringify(devices));
  } catch (e) {
    console.error('[DeviceStore] Failed to persist devices:', e);
  }
}

function loadDevicesFromStorage(): SavedDevice[] {
  try {
    const raw = storage.getString(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('[DeviceStore] Failed to load devices:', e);
  }
  return [];
}

export const useDeviceStore = create<DeviceStoreState>((set, get) => ({
  devices: [],
  activeDeviceId: null,

  loadDevices: () => {
    const devices = loadDevicesFromStorage();
    set({ devices });
  },

  addDevice: (device: SavedDevice) => {
    const { devices } = get();
    const filtered = devices.filter(d => d.id !== device.id);
    const updated = [...filtered, device];
    persistDevices(updated);
    set({ devices: updated });
  },

  removeDevice: (id: string) => {
    const { devices, activeDeviceId } = get();
    const updated = devices.filter(d => d.id !== id);
    persistDevices(updated);
    set({
      devices: updated,
      activeDeviceId: activeDeviceId === id ? null : activeDeviceId,
    });
  },

  updateDevice: (id: string, patch: Partial<SavedDevice>) => {
    const { devices } = get();
    const updated = devices.map(d => d.id === id ? { ...d, ...patch } : d);
    persistDevices(updated);
    set({ devices: updated });
  },

  setActiveDevice: (id: string | null) => {
    set({ activeDeviceId: id });
  },

  getActiveDevice: () => {
    const { devices, activeDeviceId } = get();
    return devices.find(d => d.id === activeDeviceId);
  },

  storeSessionToken: (deviceId: string, token: string) => {
    const { devices } = get();
    const updated = devices.map(d =>
      d.id === deviceId ? { ...d, sessionToken: token, lastConnected: Date.now() } : d
    );
    persistDevices(updated);
    set({ devices: updated });
  },

  getSessionToken: (deviceId: string) => {
    const { devices } = get();
    return devices.find(d => d.id === deviceId)?.sessionToken;
  },

  clearSessionToken: (deviceId: string) => {
    const { devices } = get();
    const updated = devices.map(d =>
      d.id === deviceId ? { ...d, sessionToken: undefined } : d
    );
    persistDevices(updated);
    set({ devices: updated });
  },
}));
