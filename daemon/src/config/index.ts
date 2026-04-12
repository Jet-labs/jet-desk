import fs from 'fs';
import path from 'path';
import os from 'os';


// ─── Config schema ────────────────────────────────────────────────────────────

export interface DaemonConfig {
    wsPort: number;
    httpPort: number;
    daemonVersion: string;
    pairedDevices: PairedDevice[];
    certPath: string;
    keyPath: string;
    currentPin: string | null;
    pinExpiresAt: number | null;   // unix ms
    screenCaptureFps: number;
    screenCaptureQuality: number;  // 0–100
    screenCaptureScale: number;    // 0.1–1.0
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    autoStartOnBoot: boolean;
    allowedShellCommands: string[];
    allowCustomShellCommands: boolean;
}

export interface PairedDevice {
    deviceId: string;
    deviceName: string;
    pairedAt: number;  // unix ms
    lastSeen: number;
    certFingerprint: string;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const CONFIG_DIR = path.join(os.homedir(), '.jetdesk');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const CERT_FILE = path.join(CONFIG_DIR, 'server.crt');
const KEY_FILE = path.join(CONFIG_DIR, 'server.key');

const DEFAULTS: DaemonConfig = {
    wsPort: 57423,
    httpPort: 57424,
    daemonVersion: '1.0.0',
    pairedDevices: [],
    certPath: CERT_FILE,
    keyPath: KEY_FILE,
    currentPin: null,
    pinExpiresAt: null,
    screenCaptureFps: 15,
    screenCaptureQuality: 60,
    screenCaptureScale: 0.5,
    logLevel: 'info',
    autoStartOnBoot: false,
    allowedShellCommands: [],
    allowCustomShellCommands: true,
};

// ─── Config manager ───────────────────────────────────────────────────────────

class ConfigManager {
    private data: DaemonConfig;

    constructor() {
        this.data = this.load();
    }

    private load(): DaemonConfig {
        try {
            if (!fs.existsSync(CONFIG_DIR)) {
                fs.mkdirSync(CONFIG_DIR, { recursive: true });
            }
            if (!fs.existsSync(CONFIG_FILE)) {
                return { ...DEFAULTS };
            }
            const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
            return { ...DEFAULTS, ...JSON.parse(raw) };
        } catch {
            return { ...DEFAULTS };
        }
    }

    save(): void {
        try {
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.data, null, 2));
        } catch (e) {
            console.error('[Config] Failed to save config:', e);
        }
    }

    get<K extends keyof DaemonConfig>(key: K): DaemonConfig[K] {
        return this.data[key];
    }

    set<K extends keyof DaemonConfig>(key: K, value: DaemonConfig[K]): void {
        this.data[key] = value;
        this.save();
    }

    getAll(): Readonly<DaemonConfig> {
        return this.data;
    }

    // ── Device whitelist ──────────────────────────────────────────────────────

    addPairedDevice(device: PairedDevice): void {
        const existing = this.data.pairedDevices.findIndex(d => d.deviceId === device.deviceId);
        if (existing >= 0) {
            this.data.pairedDevices[existing] = device;
        } else {
            this.data.pairedDevices.push(device);
        }
        this.save();
    }

    removePairedDevice(deviceId: string): void {
        this.data.pairedDevices = this.data.pairedDevices.filter(d => d.deviceId !== deviceId);
        this.save();
    }

    getPairedDevice(deviceId: string): PairedDevice | undefined {
        return this.data.pairedDevices.find(d => d.deviceId === deviceId);
    }

    isPaired(deviceId: string): boolean {
        return !!this.getPairedDevice(deviceId);
    }

    updateLastSeen(deviceId: string): void {
        const device = this.getPairedDevice(deviceId);
        if (device) {
            device.lastSeen = Date.now();
            this.save();
        }
    }

    // ── PIN management ────────────────────────────────────────────────────────

    generatePin(): string {
        const pin = Math.floor(100000 + Math.random() * 900000).toString();
        this.data.currentPin = pin;
        this.data.pinExpiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
        this.save();
        return pin;
    }

    validatePin(pin: string): boolean {
        if (!this.data.currentPin || !this.data.pinExpiresAt) return false;
        if (Date.now() > this.data.pinExpiresAt) {
            this.invalidatePin();
            return false;
        }
        return this.data.currentPin === pin;
    }

    invalidatePin(): void {
        this.data.currentPin = null;
        this.data.pinExpiresAt = null;
        this.save();
    }
}

export const config = new ConfigManager();
export { CONFIG_DIR, CERT_FILE, KEY_FILE };