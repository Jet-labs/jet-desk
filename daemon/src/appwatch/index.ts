import { broadcastToAuthenticated } from '../server/tls-server.js';
import { makeMessage } from '../types/protocol.js';
import { getPluginByAppTrigger } from '../server/plugins.js';
import os from 'os';

// ─── State ────────────────────────────────────────────────────────────────────

let pollInterval: NodeJS.Timeout | null = null;
let lastExeName = '';

// ─── Platform-specific active window detection ────────────────────────────────

interface ActiveWindow {
  name:  string;
  title: string;
  path:  string;
}

async function getActiveWindow(): Promise<ActiveWindow | null> {
  if (os.platform() !== 'win32') return null;

  try {
    // Lazy import — node-active-window may not install cleanly on all envs
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { activeWindow } = require('node-active-window');
    const win = await activeWindow();
    if (!win) return null;
    return {
      name:  win.application?.name    ?? '',
      title: win.title                ?? '',
      path:  win.application?.path    ?? '',
    };
  } catch {
    // Fallback: use PowerShell to get foreground process
    return await getActiveWindowPowerShell();
  }
}

async function getActiveWindowPowerShell(): Promise<ActiveWindow | null> {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const ps = `Add-Type @'
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, System.Text.StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr h, out int pid);
}
'@
$h = [Win32]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 256
[Win32]::GetWindowText($h, $sb, 256) | Out-Null
$pid = 0
[Win32]::GetWindowThreadProcessId($h, [ref]$pid) | Out-Null
$proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
if ($proc) { "$($proc.Name)|$($sb.ToString())|$($proc.Path)" } else { "||" }`;

    const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -Command "${ps.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { timeout: 2000 });
    const [name, title, path] = stdout.trim().split('|');
    return { name: name ?? '', title: title ?? '', path: path ?? '' };
  } catch {
    return null;
  }
}

// ─── Watcher ──────────────────────────────────────────────────────────────────

export function startAppWatcher(intervalMs = 2000): void {
  pollInterval = setInterval(async () => {
    try {
      const win = await getActiveWindow();
      if (!win) return;

      const exeName = win.name.replace(/\.exe$/i, '').toLowerCase();
      if (exeName === lastExeName) return;

      lastExeName = exeName;

      const msg = JSON.stringify(makeMessage('app.active', {
        name:  win.name,
        title: win.title,
        path:  win.path,
      }));

      broadcastToAuthenticated(msg);

      // Log which plugin would be auto-activated
      const plugin = getPluginByAppTrigger(win.name);
      if (plugin) {
        console.log(`[AppWatch] Detected "${win.name}" → plugin registered`);
      }
    } catch (e) {
      // Non-fatal — poll failure is OK
    }
  }, intervalMs);

  console.log(`[AppWatch] Polling for active window every ${intervalMs}ms`);
}

export function stopAppWatcher(): void {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}