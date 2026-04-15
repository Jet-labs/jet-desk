/**
 * Remote Action Plugin System
 *
 * Decodes `remote.action` messages from the phone and dispatches
 * them to the correct input handler on the daemon.
 *
 * Architecture:
 *   Phone sends  →  { type: 'remote.action', payload: { remoteId, actionId, value } }
 *   Daemon parses →  looks up actionId in registry → executes with value
 *
 * Built-in actions cover all protocol-level operations:
 *   key.tap, key.down, key.up, shortcut, type
 *   mouse.click, mouse.down, mouse.up, mouse.scroll
 *   system.lock, system.shutdown, system.restart, system.sleep
 *   app.launch
 *   shell.exec
 */

import {
  keyTap, keyDown, keyUp, sendShortcut, typeString,
} from '../input/keyboard.js';
import {
  clickMouse, mouseDown, mouseUp, scrollMouse, MouseButton,
} from '../input/mouse.js';
import { focusWindow, launchApp } from '../system/windows.js';
import { handleShellExec } from '../system/shell.js';
import os from 'os';
import { ConnectionContext } from '../security/auth.js';
import { send } from './message-handler.js';

// ─── Action handler interface ─────────────────────────────────────────────────

interface ActionHandler {
  execute: (value: Record<string, any>, ctx?: ConnectionContext) => Promise<void>;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const actionRegistry = new Map<string, ActionHandler>();

function register(actionId: string, handler: ActionHandler) {
  actionRegistry.set(actionId, handler);
}

// ─── Built-in action handlers ─────────────────────────────────────────────────

function registerBuiltinActions() {
  // ── Keyboard ────────────────────────────────────────────────────────────
  register('input.key.tap', {
    execute: async (value) => {
      const { key, modifiers = [] } = value as { key: string; modifiers?: string[] };
      keyTap(key, modifiers);
    },
  });

  register('input.key.down', {
    execute: async (value) => {
      const { key } = value as { key: string };
      keyDown(key);
    },
  });

  register('input.key.up', {
    execute: async (value) => {
      const { key } = value as { key: string };
      keyUp(key);
    },
  });

  register('input.shortcut', {
    execute: async (value) => {
      const { keys } = value as { keys: string[] };
      sendShortcut(keys);
    },
  });

  register('input.type', {
    execute: async (value) => {
      const { text } = value as { text: string };
      if (typeof text === 'string') typeString(text);
    },
  });

  // ── Mouse ───────────────────────────────────────────────────────────────
  register('input.mouse.click', {
    execute: async (value) => {
      const { button = 'left', double = false } = value as { button?: MouseButton; double?: boolean };
      clickMouse(button, double);
    },
  });

  register('input.mouse.down', {
    execute: async (value) => {
      const { button = 'left' } = value as { button?: MouseButton };
      mouseDown(button);
    },
  });

  register('input.mouse.up', {
    execute: async (value) => {
      const { button = 'left' } = value as { button?: MouseButton };
      mouseUp(button);
    },
  });

  register('input.mouse.scroll', {
    execute: async (value) => {
      const { dx = 0, dy = 0 } = value as { dx?: number; dy?: number };
      scrollMouse(dx, dy);
    },
  });

  // ── System ──────────────────────────────────────────────────────────────
  register('system.sleep', {
    execute: async () => {
      import('child_process').then(({ exec }) =>
        exec('rundll32.exe powrprof.dll,SetSuspendState 0,1,0'),
      );
    },
  });

  register('system.lock', {
    execute: async () => {
      import('child_process').then(({ exec }) =>
        exec('rundll32.exe user32.dll,LockWorkStation'),
      );
    },
  });

  register('system.shutdown', {
    execute: async () => {
      import('child_process').then(({ exec }) => exec('shutdown /s /t 5'));
    },
  });

  register('system.restart', {
    execute: async () => {
      import('child_process').then(({ exec }) => exec('shutdown /r /t 5'));
    },
  });

  // ── App & Window ────────────────────────────────────────────────────────
  register('system.app.launch', {
    execute: async (value) => {
      const { path } = value as { path: string };
      launchApp(path);
    },
  });

  register('system.windows.focus', {
    execute: async (value) => {
      const { hwnd } = value as { hwnd: string };
      focusWindow(hwnd);
    },
  });

  // ── Shell ───────────────────────────────────────────────────────────────
  register('system.shell.exec', {
    execute: async (value, ctx) => {
      const { cmd, args = [] } = value as { cmd: string; args?: string[] };
      if (!ctx) {
        console.warn('[Plugin] shell.exec requires connection context');
        return;
      }
      handleShellExec(ctx, cmd, args, `remote-${Date.now()}`);
    },
  });
}

// Initialize registry once
let initialized = false;
function ensureInitialized() {
  if (!initialized) {
    registerBuiltinActions();
    initialized = true;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────────

export async function executeRemoteAction(
  remoteId: string,
  actionId: string,
  value?: string | number,
  ctx?: ConnectionContext,
): Promise<void> {
  ensureInitialized();

  const parsedValue: Record<string, any> = typeof value === 'string'
    ? JSON.parse(value)
    : typeof value === 'number'
      ? { value }
      : {};

  const handler = actionRegistry.get(actionId);
  if (!handler) {
    console.warn(`[Plugin] Unknown action: ${actionId} (remote: ${remoteId})`);
    return;
  }

  try {
    await handler.execute(parsedValue, ctx);
  } catch (e) {
    console.error(`[Plugin] Action ${actionId} failed:`, e);
  }
}

export function getPluginByAppTrigger(exeName: string): ActionHandler | null {
  ensureInitialized();
  // Future: map running exe name to a registered action
  return null;
}

export function listRegisteredActions(): { id: string }[] {
  ensureInitialized();
  return Array.from(actionRegistry.keys()).map(id => ({ id }));
}
