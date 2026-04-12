import { initLogger } from './server/logger.js';

// Initialize log capture FIRST so all subsequent console output is recorded
initLogger();

import { config } from './config/index.js';
import { ensureTlsCertificate } from './security/tls.js';
import { startMdns } from './discovery/mdns.js';
import { startHttpServer } from './server/http-server.js';
import { startTlsServer } from './server/tls-server.js';
import { initInput } from './input/index.js';
import { initTray } from './tray/index.js';
import { getLocalIp } from './security/tls.js';
import { exec } from 'child_process';
import { startClipboardWatcher } from './system/clipboard.js';

async function main() {
  console.log('[Daemon] Starting JetDesk Daemon...');

  // 1. Initialize input abstraction (koffi win32)
  initInput();

  // 2. Ensure self-signed TLS cert exists
  const creds = ensureTlsCertificate();

  // 3. Start mDNS broadcast (for phone discovery)
  startMdns(creds.fingerprint);

  // 4. Start HTTP Server (web console + QR code pairing + screen capturing)
  startHttpServer(creds);

  // 5. Start Secure Raw TLS Server (for input & app state)
  const tlsServer = startTlsServer(creds);

  // 6. Start System Tray icon
  await initTray();

  // 7. Start system watchers
  startClipboardWatcher();

  // 8. Auto-open web console in default browser
  const ip = getLocalIp();
  const port = config.get('httpPort');
  const consoleUrl = `https://${ip}:${port}/`;
  console.log(`[Daemon] Opening web console: ${consoleUrl}`);
  exec(`start ${consoleUrl}`);

  console.log('[Daemon] Startup complete!');
}

main().catch(err => {
  console.error('[Daemon] Unhandled startup error:', err);
  process.exit(1);
});
