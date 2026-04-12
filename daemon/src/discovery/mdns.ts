import { Bonjour, Service } from 'bonjour-service';
import { config } from '../config/index.js';
import { getLocalIp } from '../security/tls.js';
import os from 'os';

let bonjour: Bonjour | null = null;
let service: Service | null = null;

// ─── Broadcast presence on local network ──────────────────────────────────────

export function startMdns(fingerprint: string): void {
  try {
    bonjour = new Bonjour();

    const port = config.get('wsPort');

    service = bonjour.publish({
      name:     `JetDesk-${os.hostname()}`,
      type:     'jetdesk',
      port,
      txt: {
        v:           '1',
        hostname:    os.hostname(),
        ip:          getLocalIp(),
        wsPort:      String(port),
        httpPort:    String(config.get('httpPort')),
        fingerprint: fingerprint,
        // Truncate fingerprint for TXT record size limits
        fp:          fingerprint.replace(/:/g, '').substring(0, 32),
      },
    });

    service.on('up', () => {
      console.log(`[mDNS] Service advertised: _jetdesk._tcp.local on port ${port}`);
    });

    service.on('error', (err: Error) => {
      console.error('[mDNS] Advertising error:', err.message);
    });
  } catch (e) {
    // mDNS is best-effort — VPN or firewall may block UDP multicast
    console.warn('[mDNS] Failed to start (VPN may be blocking UDP multicast). Use manual IP instead:', e);
  }
}

export function stopMdns(): void {
  try {
    service?.stop?.();
    bonjour?.destroy?.();
    console.log('[mDNS] Stopped');
  } catch { /* ignore */ }
}