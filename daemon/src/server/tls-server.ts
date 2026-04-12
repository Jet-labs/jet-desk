import tls from 'tls';
import { TlsCredentials } from '../security/tls.js';
import { createConnection, removeConnection, checkRateLimit, getConnections } from '../security/auth.js';
import { createPairingSession } from '../security/pairing.js';
import { handleMessage, send } from './message-handler.js';
import { makeMessage } from '../types/protocol.js';
import { config } from '../config/index.js';

// ─── TLS server ───────────────────────────────────────────────────────────────

export function startTlsServer(creds: TlsCredentials): tls.Server {
  const port = config.get('wsPort'); // Reusing the same port parameter

  const server = tls.createServer({
    cert: creds.cert,
    key:  creds.key,
  });

  server.on('secureConnection', (socket: tls.TLSSocket) => {
    const remoteIp = socket.remoteAddress || 'unknown';
    const ctx = createConnection(socket, remoteIp);

    // Disable Nagle — send packets immediately for low-latency input
    socket.setNoDelay(true);

    console.log(`[TLS] Connection from ${remoteIp} (${ctx.id})`);

    // Send pairing challenge immediately on connect
    const session = createPairingSession(creds.fingerprint);
    send(ctx, makeMessage('pairing.challenge', {
      nonce:           session.nonce,
      certFingerprint: creds.fingerprint,
    }));

    let buffer = '';

    socket.on('data', async (data) => {
      // Chunk incoming lines
      buffer += data.toString('utf-8');
      const lines = buffer.split('\n');
      
      // Last element is either the incomplete chunk or an empty string, keep it in buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        // Rate limiting
        if (!checkRateLimit(remoteIp)) {
          console.warn(`[TLS] Rate limit exceeded for ${remoteIp}`);
          socket.destroy();
          return;
        }

        try {
          await handleMessage(ctx, line, creds.fingerprint);
        } catch (e) {
          console.error(`[TLS] Error handling message from ${ctx.id}:`, e);
        }
      }
    });

    socket.on('close', () => {
      console.log(`[TLS] Connection closed: ${ctx.id}`);
      removeConnection(ctx.id);
      import('./message-handler.js').then(({ screenStreams }) => {
        if (screenStreams && screenStreams.has(ctx.id)) {
          screenStreams.delete(ctx.id);
        }
      }).catch(() => {});
    });

    socket.on('error', (err) => {
      // Expecting ECONNRESET sometimes when phones forcefully disconnect
      console.error(`[TLS] Error on ${ctx.id}:`, err.message);
    });

    // Simple Heartbeat / Keep-alive config natively for TCP
    socket.setKeepAlive(true, 30_000);
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`[TLS] Secure Raw TLS server listening on tls://0.0.0.0:${port}`);
  });

  return server;
}

// ─── Broadcast to all authenticated connections ───────────────────────────────

export function broadcastToAuthenticated(msgJson: string): void {
  const connections = getConnections();
  const payload = msgJson + '\n';
  
  connections.forEach(ctx => {
    if (ctx.authState === 'authenticated' && !ctx.socket.destroyed) {
      ctx.socket.write(payload);
    }
  });
}
