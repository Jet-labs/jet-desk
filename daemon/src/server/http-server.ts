import express, { Request, Response } from 'express';
import https from 'https';
import { TlsCredentials } from '../security/tls.js';
import { generateQrCode, validateSessionToken } from '../security/pairing.js';
import { getConnectionsSummary } from '../security/auth.js';
import { config } from '../config/index.js';
import { captureScreen } from '../capture/screen.js';
import { renderConsole } from './console.js';
import { getLogEntries, getUptime } from './logger.js';
import os from 'os';
import { getLocalIp } from '../security/tls.js';
import { setAutoStart } from '../tray/autostart.js';

// ─── HTTP server ──────────────────────────────────────────────────────────────

export function startHttpServer(creds: TlsCredentials): https.Server {
  const app  = express();
  const port = config.get('httpPort');

  app.use(express.json());

  // ── Web Console (root) ──────────────────────────────────────────────────────
  app.get('/', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderConsole());
  });

  // Legacy redirect — old /pair URL still works
  app.get('/console', (_req: Request, res: Response) => {
    res.redirect('/');
  });

  // ── API: Full status ──────────────────────────────────────────────────────
  app.get('/api/status', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      hostname: os.hostname(),
      daemonVersion: config.get('daemonVersion'),
      pairedDevices: config.get('pairedDevices').length,
      activeConnections: getConnectionsSummary().length,
      localIp: getLocalIp(),
      wsPort: config.get('wsPort'),
      httpPort: config.get('httpPort'),
      uptime: getUptime(),
    });
  });

  // ── API: Active connections ────────────────────────────────────────────────
  app.get('/api/connections', (_req: Request, res: Response) => {
    res.json({ connections: getConnectionsSummary() });
  });

  // ── API: Paired devices ───────────────────────────────────────────────────
  app.get('/api/devices', (_req: Request, res: Response) => {
    res.json({ devices: config.get('pairedDevices') });
  });

  app.delete('/api/devices/:id', (req: Request<{ id: string }>, res: Response) => {
    config.removePairedDevice(req.params.id);
    res.json({ ok: true });
  });

  // ── API: Generate QR + PIN ────────────────────────────────────────────────
  app.get('/api/pair/generate', async (_req: Request, res: Response) => {
    try {
      const { qr, pin, payload } = await generateQrCode(creds.fingerprint);

      console.log('\n' + '='.repeat(50));
      console.log(`  PAIRING PIN:  ${pin.split('').join(' ')}`);
      console.log(`  Expires in 5 minutes`);
      console.log('='.repeat(50) + '\n');

      res.json({ qr, pin, payload });
    } catch (e) {
      console.error('[HTTP] /api/pair/generate error:', e);
      res.status(500).json({ error: 'Failed to generate QR code' });
    }
  });

  // ── API: Config CRUD ──────────────────────────────────────────────────────
  app.get('/api/config', (_req: Request, res: Response) => {
    const all = config.getAll();
    // Strip internal/sensitive fields
    res.json({
      screenCaptureFps: all.screenCaptureFps,
      screenCaptureQuality: all.screenCaptureQuality,
      screenCaptureScale: all.screenCaptureScale,
      logLevel: all.logLevel,
      autoStartOnBoot: all.autoStartOnBoot,
      allowedShellCommands: all.allowedShellCommands,
      allowCustomShellCommands: all.allowCustomShellCommands,
    });
  });

  app.patch('/api/config', async (req: Request, res: Response) => {
    const body = req.body;
    const allowed = ['screenCaptureFps', 'screenCaptureQuality', 'screenCaptureScale', 'logLevel', 'autoStartOnBoot', 'allowedShellCommands', 'allowCustomShellCommands'] as const;
    for (const key of allowed) {
      if (body[key] !== undefined) {
        config.set(key as any, body[key]);
        if (key === 'autoStartOnBoot') {
          await setAutoStart(body[key]);
        }
      }
    }
    res.json({ ok: true });
  });

  // ── API: Logs ─────────────────────────────────────────────────────────────
  app.get('/api/logs', (_req: Request, res: Response) => {
    res.json({ logs: getLogEntries() });
  });

  // ── Legacy: Status endpoint (mobile app compat) ───────────────────────────
  app.get('/status', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      hostname: os.hostname(),
      daemonVersion: config.get('daemonVersion'),
      pairedDevices: config.get('pairedDevices').length,
      localIp: getLocalIp(),
      wsPort: config.get('wsPort'),
    });
  });

  // ── Legacy: QR code pairing page (inline HTML) ────────────────────────────
  app.get('/pair', async (_req: Request, res: Response) => {
    try {
      const { qr, pin } = await generateQrCode(creds.fingerprint);
      const wsPort = config.get('wsPort');
      const ip = getLocalIp();

      console.log('\n' + '='.repeat(50));
      console.log(`  PAIRING PIN:  ${pin.split('').join(' ')}`);
      console.log(`  Expires in 5 minutes`);
      console.log('='.repeat(50) + '\n');

      res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JetDesk — Pair Device</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #0f0f10; color: #e2e2e2; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: #1a1a1c; border: 1px solid #2a2a2e; border-radius: 16px; padding: 2rem; text-align: center; max-width: 380px; width: 100%; }
    h1 { font-size: 1.3rem; font-weight: 600; margin-bottom: 0.25rem; }
    p { color: #888; font-size: 0.875rem; margin-bottom: 1.5rem; }
    img { border-radius: 12px; margin-bottom: 1.5rem; background: white; padding: 12px; }
    .pin { font-size: 2rem; font-weight: 700; letter-spacing: 0.3em; color: #a78bfa; background: #1e1b2e; border-radius: 10px; padding: 0.75rem 1.5rem; display: inline-block; margin-bottom: 1rem; }
    .meta { font-size: 0.75rem; color: #555; margin-top: 1rem; }
    .expire { color: #ef4444; font-size: 0.8rem; margin-top: 0.5rem; }
    #timer { display: inline; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Pair with JetDesk</h1>
    <p>Scan QR code with the JetDesk phone app, then enter the PIN</p>
    <img src="${qr}" width="200" height="200" alt="QR Code">
    <div class="pin">${pin.split('').join(' ')}</div>
    <p class="expire">PIN expires in <span id="timer">5:00</span></p>
    <div class="meta">${os.hostname()} &bull; ${ip}:${wsPort}</div>
  </div>
  <script>
    let s = 300;
    const t = document.getElementById('timer');
    const iv = setInterval(() => {
      s--;
      const m = Math.floor(s / 60), sec = s % 60;
      t.textContent = m + ':' + String(sec).padStart(2, '0');
      if (s <= 0) { clearInterval(iv); t.textContent = 'expired — refresh page'; }
    }, 1000);
  </script>
</body>
</html>`);
    } catch (e) {
      console.error('[HTTP] /pair error:', e);
      res.status(500).json({ error: 'Failed to generate QR code' });
    }
  });

  // ── Screen capture stream (MJPEG) ─────────────────────────────────────────
  app.get('/screen', async (req: Request, res: Response) => {
    const token = req.headers['x-session-token'] as string;
    if (!token) {
      res.status(401).json({ error: 'Missing session token' });
      return;
    }
    const deviceId = validateSessionToken(token);
    if (!deviceId) {
      res.status(403).json({ error: 'Invalid or expired session token' });
      return;
    }

    const fps     = Math.min(Number(req.query.fps)     || config.get('screenCaptureFps'),    30);
    const quality = Math.min(Number(req.query.quality) || config.get('screenCaptureQuality'), 95);
    const scale   = Math.min(Number(req.query.scale)   || config.get('screenCaptureScale'),   1.0);

    res.setHeader('Content-Type', 'multipart/x-mixed-replace; boundary=jetdesk_frame');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    console.log(`[HTTP] Screen stream started — ${fps}fps q=${quality} scale=${scale}`);

    let running = true;
    req.on('close', () => { running = false; });

    while (running) {
      const start = Date.now();
      try {
        const frame = await captureScreen({ quality, scale });
        if (!running) break;

        res.write(
          `--jetdesk_frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`
        );
        res.write(frame);
        res.write('\r\n');

        const elapsed = Date.now() - start;
        const delay   = Math.max(0, (1000 / fps) - elapsed);
        if (delay > 0) await sleep(delay);
      } catch (e) {
        if (running) console.error('[HTTP] Screen capture error:', e);
        break;
      }
    }

    res.end();
    console.log('[HTTP] Screen stream ended');
  });

  // ── Legacy: Paired devices list (mobile app compat) ───────────────────────
  app.get('/devices', (_req: Request, res: Response) => {
    res.json({ devices: config.get('pairedDevices') });
  });

  app.delete('/devices/:id', (req: Request<{ id: string }>, res: Response) => {
    config.removePairedDevice(req.params.id);
    res.json({ ok: true });
  });

  // ── Custom remotes endpoint ───────────────────────────────────────────────
  app.get('/remotes', (req: Request, res: Response) => {
    const token = req.headers['x-session-token'] as string;
    if (!token || !validateSessionToken(token)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const customRemotes = config.get('customRemotes' as any) || [];
    res.json({ remotes: customRemotes });
  });

  // ── Start ─────────────────────────────────────────────────────────────────
  const server = https.createServer({ cert: creds.cert, key: creds.key }, app);
  server.listen(port, '0.0.0.0', () => {
    console.log(`[HTTP] Server listening on https://0.0.0.0:${port}`);
    console.log(`[HTTP] Web Console: https://${getLocalIp()}:${port}/`);
    console.log(`[HTTP] Pairing page: https://${getLocalIp()}:${port}/pair`);
  });

  return server;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}