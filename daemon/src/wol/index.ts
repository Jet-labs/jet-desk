import dgram from 'dgram';

// ─── WOL Magic Packet ─────────────────────────────────────────────────────────
// 6 bytes of 0xFF followed by 16 repetitions of the 6-byte MAC address

export function sendWol(mac: string, broadcast = '255.255.255.255', port = 9): void {
  const macBytes = parseMac(mac);
  if (!macBytes) {
    console.error(`[WOL] Invalid MAC address: ${mac}`);
    return;
  }

  const magic = buildMagicPacket(macBytes);
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

  socket.once('listening', () => {
    socket.setBroadcast(true);
    socket.send(magic, 0, magic.length, port, broadcast, (err) => {
      if (err) {
        console.error('[WOL] Send error:', err);
      } else {
        console.log(`[WOL] Magic packet sent to ${mac} via ${broadcast}:${port}`);
      }
      socket.close();
    });
  });

  socket.bind(() => {
    // Force listening event
  });
}

function parseMac(mac: string): number[] | null {
  const clean = mac.replace(/[^0-9a-fA-F]/g, '');
  if (clean.length !== 12) return null;
  const bytes: number[] = [];
  for (let i = 0; i < 12; i += 2) {
    bytes.push(parseInt(clean.slice(i, i + 2), 16));
  }
  return bytes;
}

function buildMagicPacket(macBytes: number[]): Buffer {
  const buf = Buffer.alloc(6 + 16 * 6);
  buf.fill(0xff, 0, 6);
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 6; j++) {
      buf[6 + i * 6 + j] = macBytes[j];
    }
  }
  return buf;
}