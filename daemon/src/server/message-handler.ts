
import { JetDeskMessage, makeMessage } from '../types/protocol.js';
import { ConnectionContext, requireAuth, authenticateWithToken, authenticateAfterPairing } from '../security/auth.js';
import { createPairingSession, verifyPairing } from '../security/pairing.js';
import {
  inputMouseMove, inputMouseMoveAbsolute, inputMouseClick, inputMouseDown,
  inputMouseUp, inputMouseScroll, inputMouseDrag,
  inputKeyTap, inputKeyDown, inputKeyUp, inputShortcut, inputType,
} from '../input/index.js';
import { executeRemoteAction } from './plugins.js';
import { sendWol } from '../wol/index.js';
import { config } from '../config/index.js';
import { handleClipboardGet, handleClipboardSet } from '../system/clipboard.js';
import { startTelemetry, stopTelemetry } from '../system/telemetry.js';
import { listWindows, focusWindow, minimizeWindow, closeWindow, launchApp } from '../system/windows.js';
import { handleShellExec, handleShellKill, getAllowedCommands } from '../system/shell.js';
import os from 'os';
import { getLocalIp } from '../security/tls.js';

// ─── Main dispatcher ──────────────────────────────────────────────────────────

export async function handleMessage(ctx: ConnectionContext, raw: string, fingerprint: string): Promise<void> {
  let msg: JetDeskMessage;
  try {
    msg = JSON.parse(raw);
  } catch {
    sendError(ctx, 'Invalid JSON');
    return;
  }

  if (!msg.type || msg.v !== 1) {
    sendError(ctx, 'Malformed message');
    return;
  }

  // Log all messages except high-frequency mouse movements
  if (msg.type !== 'input.mouse.move') {
    console.log(`[Message] <- ${msg.type}`, JSON.stringify(msg.payload, null, 2));
  }

  // ── Heartbeat (always allowed) ────────────────────────────────────────────
  if (msg.type === 'ping') {
    send(ctx, makeMessage('pong', {}, msg.seq));
    return;
  }

  // ── Pairing flow (pre-auth) ───────────────────────────────────────────────
  if (msg.type === 'pairing.verify') {
    await handlePairingVerify(ctx, msg, fingerprint);
    return;
  }

  // ── Token re-auth (pre-auth) ──────────────────────────────────────────────
  if (msg.type === 'pairing.challenge') {
    handleTokenAuth(ctx, msg);
    return;
  }

  // ── All other messages require auth ───────────────────────────────────────
  if (!requireAuth(ctx)) {
    sendError(ctx, 'Not authenticated', msg.seq);
    return;
  }

  switch (msg.type) {
    // ── Mouse ──────────────────────────────────────────────────────────────
    case 'input.mouse.move': {
      const { dx, dy } = msg.payload as { dx: number; dy: number };
      inputMouseMove(dx, dy);
      break;
    }
    case 'input.mouse.move.absolute': {
      const { x, y } = msg.payload as { x: number; y: number };
      inputMouseMoveAbsolute(x, y);
      break;
    }
    case 'input.mouse.click': {
      const { button = 'left', double = false } = msg.payload as { button?: 'left'|'right'|'middle'; double?: boolean };
      inputMouseClick(button, double);
      break;
    }
    case 'input.mouse.down': {
      const { button = 'left' } = msg.payload as { button?: 'left'|'right'|'middle' };
      inputMouseDown(button);
      break;
    }
    case 'input.mouse.up': {
      const { button = 'left' } = msg.payload as { button?: 'left'|'right'|'middle' };
      inputMouseUp(button);
      break;
    }
    case 'input.mouse.scroll': {
      const { dx = 0, dy = 0 } = msg.payload as { dx?: number; dy?: number };
      inputMouseScroll(dx, dy);
      break;
    }
    case 'input.mouse.drag': {
      const { fromX, fromY, toX, toY } = msg.payload as { fromX: number; fromY: number; toX: number; toY: number };
      inputMouseDrag(fromX, fromY, toX, toY);
      break;
    }

    // ── Keyboard ───────────────────────────────────────────────────────────
    case 'input.key.tap': {
      const { key, modifiers = [] } = msg.payload as { key: string; modifiers?: string[] };
      inputKeyTap(key, modifiers);
      break;
    }
    case 'input.key.down': {
      const { key } = msg.payload as { key: string };
      inputKeyDown(key);
      break;
    }
    case 'input.key.up': {
      const { key } = msg.payload as { key: string };
      inputKeyUp(key);
      break;
    }
    case 'input.type': {
      const { text } = msg.payload as { text: string };
      if (typeof text === 'string') inputType(text);
      break;
    }
    case 'input.shortcut': {
      const { keys } = msg.payload as { keys: string[] };
      if (Array.isArray(keys)) inputShortcut(keys);
      break;
    }

    // ── Remote plugins ─────────────────────────────────────────────────────
    case 'remote.action': {
      const { remoteId, actionId, value } = msg.payload as { remoteId: string; actionId: string; value?: string | number };
      await executeRemoteAction(remoteId, actionId, value, ctx);
      break;
    }
    case 'remote.config.pull': {
      send(ctx, makeMessage('remote.config.pull.response', { remotes: config.listCustomRemotes() }, msg.seq));
      break;
    }
    case 'remote.config.push': {
      const remoteConfig = msg.payload as any; // CustomRemoteConfig
      const existing = config.getCustomRemote(remoteConfig.id);
      if (existing) {
        config.updateCustomRemote(remoteConfig.id, remoteConfig);
      } else {
        config.addCustomRemote(remoteConfig);
      }
      send(ctx, makeMessage('remote.config.push.response', { ok: true }, msg.seq));
      broadcastRemoteConfigs();
      break;
    }
    case 'remote.config.delete': {
      const { id } = msg.payload as { id: string };
      config.removeCustomRemote(id);
      send(ctx, makeMessage('remote.config.delete.response', { ok: true }, msg.seq));
      broadcastRemoteConfigs();
      break;
    }

    // ── System ─────────────────────────────────────────────────────────────
    case 'system.info': {
      const nets = os.networkInterfaces();
      let mac = '';
      for (const iface of Object.values(nets)) {
        if (!iface) continue;
        const addr = iface.find(a => a.family === 'IPv4' && !a.internal);
        if (addr?.mac && addr.mac !== '00:00:00:00:00:00') { mac = addr.mac; break; }
      }
      send(ctx, makeMessage('system.info.response', {
        hostname:      os.hostname(),
        platform:      os.platform(),
        mac,
        localIp:       getLocalIp(),
        daemonVersion: config.get('daemonVersion'),
      }, msg.seq));
      break;
    }

    case 'system.sleep': {
      // Windows sleep command
      import('child_process').then(({ exec }) => exec('rundll32.exe powrprof.dll,SetSuspendState 0,1,0'));
      break;
    }
    
    case 'system.lock': {
      import('child_process').then(({ exec }) => exec('rundll32.exe user32.dll,LockWorkStation'));
      break;
    }

    case 'system.shutdown': {
      import('child_process').then(({ exec }) => exec('shutdown /s /t 5'));
      break;
    }

    case 'system.restart': {
      import('child_process').then(({ exec }) => exec('shutdown /r /t 5'));
      break;
    }

    case 'system.wol': {
      const { mac, broadcast } = msg.payload as { mac: string; broadcast?: string };
      sendWol(mac, broadcast);
      break;
    }

    // ── Clipboard ──────────────────────────────────────────────────────────
    case 'clipboard.get': {
      handleClipboardGet().then(text => {
        send(ctx, makeMessage('clipboard.data', { text }, msg.seq));
      });
      break;
    }
    case 'clipboard.set': {
      const { text } = msg.payload as { text: string };
      handleClipboardSet(text);
      break;
    }

    // ── Telemetry ──────────────────────────────────────────────────────────
    case 'system.telemetry.start': {
      startTelemetry(ctx, 2000);
      break;
    }
    case 'system.telemetry.stop': {
      stopTelemetry(ctx);
      break;
    }

    // ── Windows & App Switcher ─────────────────────────────────────────────
    case 'system.windows.list': {
      listWindows().then(windows => {
        send(ctx, makeMessage('system.windows.list.response', { windows }, msg.seq));
      });
      break;
    }
    case 'system.windows.focus': {
      const { hwnd } = msg.payload as { hwnd: string };
      focusWindow(hwnd);
      break;
    }
    case 'system.windows.minimize': {
      const { hwnd } = msg.payload as { hwnd: string };
      minimizeWindow(hwnd);
      break;
    }
    case 'system.windows.close': {
      const { hwnd } = msg.payload as { hwnd: string };
      closeWindow(hwnd);
      break;
    }
    case 'system.app.launch': {
      const { path } = msg.payload as { path: string };
      launchApp(path);
      break;
    }

    // ── Remote Terminal ────────────────────────────────────────────────────
    case 'system.shell.get_allowed': {
      const commands = getAllowedCommands();
      send(ctx, makeMessage('system.shell.allowed_commands', { commands }, msg.seq));
      break;
    }
    case 'system.shell.exec': {
      const { cmd, args, processId } = msg.payload as { cmd: string, args: string[], processId: string };
      handleShellExec(ctx, cmd, args || [], processId);
      break;
    }
    case 'system.shell.kill': {
      const { processId } = msg.payload as { processId: string };
      handleShellKill(processId);
      break;
    }

    // ── Screen stream ────────────────────────────────────────────────────────
    case 'screen.start': {
      const { fps = 15, quality = 60, scale = 0.5 } = msg.payload as { fps?: number; quality?: number; scale?: number };
      screenStreamSubscribers.set(ctx.id, { ctx, fps, quality, scale });
      startGlobalScreenLoop();
      break;
    }
    case 'screen.stop': {
      screenStreamSubscribers.delete(ctx.id);
      break;
    }
    case 'system.open_cast': {
      import('child_process').then(cp => {
        // Open the Windows "Projecting to this PC" settings natively
        cp.exec('start ms-settings:project');
      }).catch(e => console.error(e));
      break;
    }

    default:
      console.warn(`[Handler] Unknown message type: ${msg.type}`);
  }
}

// ─── Global Screen Loop ───────────────────────────────────────────────────────
const screenStreamSubscribers = new Map<string, { ctx: ConnectionContext, fps: number, quality: number, scale: number }>();
let globalScreenLoopRunning = false;

async function startGlobalScreenLoop() {
  if (globalScreenLoopRunning) return;
  globalScreenLoopRunning = true;
  
  let { captureScreen } = await import('../capture/screen.js');

  const loop = async () => {
    // Clean up dead sockets
    for (const [id, sub] of screenStreamSubscribers.entries()) {
      if (sub.ctx.socket.destroyed) {
        screenStreamSubscribers.delete(id);
      }
    }

    if (screenStreamSubscribers.size === 0) {
      globalScreenLoopRunning = false;
      return;
    }

    const start = Date.now();
    try {
      // For simplicity, take the max requested fps, max quality, and max scale, or just defaults.
      let maxFps = 10, maxQuality = 60, maxScale = 0.5;
      for (const sub of screenStreamSubscribers.values()) {
        if (sub.fps > maxFps) maxFps = sub.fps;
        if (sub.quality > maxQuality) maxQuality = sub.quality;
        if (sub.scale > maxScale) maxScale = sub.scale;
      }
      
      const frameBuffer = await captureScreen({ quality: maxQuality, scale: maxScale });
      const b64 = frameBuffer.toString('base64');
      
      // Dispatch to all subscribers
      for (const sub of screenStreamSubscribers.values()) {
        send(sub.ctx, makeMessage('screen.frame', { data: b64 }));
      }

      const elapsed = Date.now() - start;
      const delay = Math.max(0, (1000 / maxFps) - elapsed);
      setTimeout(loop, delay);
    } catch (e) {
      console.error(`[Screen] Global capture error:`, e);
      // Wait a bit before retrying to prevent error spam
      setTimeout(loop, 1000);
    }
  };

  setTimeout(loop, 0);
}

// Exported for tls-server to clean up properly
export const screenStreams = {
  has: (id: string) => screenStreamSubscribers.has(id),
  delete: (id: string) => screenStreamSubscribers.delete(id),
};

// ─── Pairing handlers ─────────────────────────────────────────────────────────

async function handlePairingVerify(ctx: ConnectionContext, msg: JetDeskMessage, fingerprint: string): Promise<void> {
  const { deviceId, deviceName, pin, nonce } = msg.payload as {
    deviceId: string; deviceName: string; pin: string; nonce: string;
  };

  if (!deviceId || !deviceName || !pin || !nonce) {
    send(ctx, makeMessage('pairing.reject', { reason: 'Missing fields' }, msg.seq));
    return;
  }

  const result = verifyPairing({ deviceId, deviceName, pin, nonce, fingerprint });

  if (!result.success || !result.sessionToken) {
    send(ctx, makeMessage('pairing.reject', { reason: result.reason ?? 'Rejected' }, msg.seq));
    return;
  }

  authenticateAfterPairing(ctx, deviceId, deviceName, result.sessionToken);
  send(ctx, makeMessage('pairing.accept', { sessionToken: result.sessionToken, deviceId }, msg.seq));
  console.log(`[Handler] Pairing accepted for "${deviceName}"`);
}

function handleTokenAuth(ctx: ConnectionContext, msg: JetDeskMessage): void {
  const { nonce } = msg.payload as { nonce: string };
  // nonce here is reused as the session token for reconnect
  if (authenticateWithToken(ctx, nonce)) {
    const session = createPairingSession(''); // just to return nonce for compat
    send(ctx, makeMessage('pairing.accept', { sessionToken: nonce, deviceId: ctx.deviceId! }, msg.seq));
  } else {
    send(ctx, makeMessage('pairing.reject', { reason: 'Invalid session token' }, msg.seq));
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function send(ctx: ConnectionContext, msg: JetDeskMessage): void {
  if (ctx.socket.destroyed) return;
  ctx.seq++;
  msg.seq = ctx.seq;
  ctx.socket.write(JSON.stringify(msg) + '\n');
}

function sendError(ctx: ConnectionContext, reason: string, seq = 0): void {
  send(ctx, { v: 1, seq, type: 'pairing.reject', payload: { reason } });
}

function broadcastRemoteConfigs(): void {
  import('./tls-server.js').then(({ broadcastToAuthenticated }) => {
    const msg = makeMessage('remote.config.pull.response', { remotes: config.listCustomRemotes() });
    broadcastToAuthenticated(JSON.stringify(msg));
  }).catch(e => console.error('[Handler] Broadcast error:', e));
}