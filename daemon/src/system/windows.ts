import os from 'os';
import koffi from 'koffi';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Basic cross-platform shim
const isWin = os.platform() === 'win32';

let SetForegroundWindow: any;
let ShowWindow: any;
let PostMessageA: any;
let SwitchToThisWindow: any;
let IsIconic: any;

const SW_MINIMIZE = 6;
const WM_CLOSE = 0x0010;

if (isWin) {
  try {
    const user32 = koffi.load('user32.dll');
    
    // Simple void* equivalent for handles
    const HWND = koffi.pointer('HWND', koffi.opaque());
    
    SetForegroundWindow = user32.func('int SetForegroundWindow(HWND)');
    ShowWindow = user32.func('int ShowWindow(HWND, int)');
    PostMessageA = user32.func('int PostMessageA(HWND, uint, uint, uint)'); // simplified signature
    SwitchToThisWindow = user32.func('void SwitchToThisWindow(HWND, int)');
    IsIconic = user32.func('int IsIconic(HWND)');
    
  } catch (e) {
    console.warn('[Windows] Failed to initialize user32 FFI:', e);
  }
}

export interface AppWindow {
  id: string;      // Used as handle
  title: string;
  name: string;    // Executable name
}

// Listing windows purely via FFI + C callbacks in Node gets brittle with memory handling in Koffi.
// We'll use a fast PowerShell one-liner to get the list, since it returns nice process names effortlessly.
// For actions (focus/minimize/close) we use fast FFI by casting the handle.
export async function listWindows(): Promise<AppWindow[]> {
  if (!isWin) return [];
  try {
    const ps = `
      Get-Process | Where-Object { $_.MainWindowTitle } | ForEach-Object {
        $hwnd = $_.MainWindowHandle.ToString()
        $title = $_.MainWindowTitle
        $name = $_.Name
        $hwnd + '|' + $title + '|' + $name
      }
    `;
    
    // Use EncodedCommand to perfectly bypass all cmd.exe quote/newline escaping issues
    const b64 = Buffer.from(ps, 'utf16le').toString('base64');
    const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -EncodedCommand ${b64}`, { timeout: 3000 });
    
    return stdout.trim().split(/\r?\n/).filter(Boolean).map(line => {
      const parts = line.trim().split('|');
      return {
        id: parts[0] || '', // HWND as string
        title: parts[1] || '',
        name: parts[2] || '',
      };
    });
  } catch {
    return [];
  }
}

export function focusWindow(hwndStr: string): void {
  if (!isWin) return;
  try {
    // Koffi allows passing BigInt/numbers to pointer args if they represent addresses
    const hwnd = BigInt(hwndStr);
    
    // 1. If minimized, restore it
    if (IsIconic && IsIconic(hwnd) !== 0) {
      if (ShowWindow) ShowWindow(hwnd, 9); // SW_RESTORE = 9
    }
    
    // 2. Set to foreground
    if (SetForegroundWindow) {
      SetForegroundWindow(hwnd);
    }
    
    // 3. Force focus bypass via SwitchToThisWindow (acts like Alt-Tab)
    if (SwitchToThisWindow) {
      SwitchToThisWindow(hwnd, 1);
    }
  } catch (e) {
    console.error('[Windows] focus error:', e);
  }
}

export function minimizeWindow(hwndStr: string): void {
  if (!isWin || !ShowWindow) return;
  try {
    const hwnd = BigInt(hwndStr);
    ShowWindow(hwnd, SW_MINIMIZE);
  } catch (e) {
    console.error('[Windows] minimize error:', e);
  }
}

export function closeWindow(hwndStr: string): void {
  if (!isWin || !PostMessageA) return;
  try {
    const hwnd = BigInt(hwndStr);
    PostMessageA(hwnd, WM_CLOSE, 0, 0);
  } catch (e) {
    console.error('[Windows] close error:', e);
  }
}

export function launchApp(cmd: string): void {
  exec(cmd, (err) => {
    if (err) console.error('[Windows] launch error:', err);
  });
}
