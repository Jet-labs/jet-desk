/**
 * JetDesk Protocol — Message types and helpers
 * Mirrors the daemon's protocol.ts
 */

// ─── Message structure ──────────────────────────────────────────────────────────

export interface JetDeskMessage {
  v: number;
  type: string;
  seq: number;
  payload: any;
}

export function makeMessage(type: string, payload: any, seq = 0): JetDeskMessage {
  return { v: 1, type, payload, seq };
}

// ─── Message types ──────────────────────────────────────────────────────────────

export const MSG = {
  // Heartbeat
  PING: 'ping',
  PONG: 'pong',

  // Pairing lifecycle
  PAIRING_CHALLENGE: 'pairing.challenge',
  PAIRING_VERIFY: 'pairing.verify',
  PAIRING_ACCEPT: 'pairing.accept',
  PAIRING_REJECT: 'pairing.reject',

  // Mouse input
  MOUSE_MOVE: 'input.mouse.move',
  MOUSE_MOVE_ABS: 'input.mouse.move.absolute',
  MOUSE_CLICK: 'input.mouse.click',
  MOUSE_DOWN: 'input.mouse.down',
  MOUSE_UP: 'input.mouse.up',
  MOUSE_SCROLL: 'input.mouse.scroll',
  MOUSE_DRAG: 'input.mouse.drag',

  // Keyboard input
  KEY_TAP: 'input.key.tap',
  KEY_DOWN: 'input.key.down',
  KEY_UP: 'input.key.up',
  KEY_TYPE: 'input.type',
  KEY_SHORTCUT: 'input.shortcut',

  // Remote plugins
  REMOTE_ACTION: 'remote.action',

  // System
  SYSTEM_INFO: 'system.info',
  SYSTEM_INFO_RESPONSE: 'system.info.response',
  SYSTEM_SLEEP: 'system.sleep',
  SYSTEM_WOL: 'system.wol',
  SYSTEM_LOCK: 'system.lock',
  SYSTEM_SHUTDOWN: 'system.shutdown',
  SYSTEM_RESTART: 'system.restart',

  // Clipboard
  CLIPBOARD_SET: 'clipboard.set',
  CLIPBOARD_GET: 'clipboard.get',
  CLIPBOARD_DATA: 'clipboard.data',
  CLIPBOARD_CHANGED: 'clipboard.changed',

  // Telemetry
  TELEMETRY_START: 'system.telemetry.start',
  TELEMETRY_STOP: 'system.telemetry.stop',
  TELEMETRY_DATA: 'system.telemetry.data',

  // Windows & Apps
  WINDOWS_LIST: 'system.windows.list',
  WINDOWS_LIST_RESPONSE: 'system.windows.list.response',
  WINDOWS_FOCUS: 'system.windows.focus',
  WINDOWS_MINIMIZE: 'system.windows.minimize',
  WINDOWS_CLOSE: 'system.windows.close',
  APP_LAUNCH: 'system.app.launch',

  // Shell
  SHELL_GET_ALLOWED: 'system.shell.get_allowed',
  SHELL_ALLOWED_COMMANDS: 'system.shell.allowed_commands',
  SHELL_EXEC: 'system.shell.exec',
  SHELL_OUTPUT: 'system.shell.output',
  SHELL_EXIT: 'system.shell.exit',
  SHELL_KILL: 'system.shell.kill',
} as const;
