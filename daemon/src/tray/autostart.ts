import { exec } from 'child_process';
import os from 'os';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);
const REGISTRY_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const APP_NAME = 'JetDeskDaemon';

export async function isAutoStartEnabled(): Promise<boolean> {
  if (os.platform() !== 'win32') return false;
  try {
    const { stdout } = await execAsync(`reg query "${REGISTRY_KEY}" /v "${APP_NAME}"`);
    return stdout.includes(APP_NAME);
  } catch {
    return false;
  }
}

/**
 * Returns the true path of the executable.
 * If running locally with Node, returns the node script launch command.
 * If running inside a `caxa` bundled executable, discovers the parent process path using PowerShell.
 */
async function getExecutableCommand(): Promise<string> {
  const isCaxa = __dirname.includes('caxa');
  if (isCaxa) {
    try {
      const ppid = process.ppid;
      // Use PowerShell to find the actual .exe path of the parent process (the native caxa wrapper)
      const { stdout } = await execAsync(`powershell.exe -NoProfile -Command "(Get-Process -Id ${ppid}).Path"`);
      return `"${stdout.trim()}"`;
    } catch (e) {
      console.warn('[Autostart] Failed to detect outer Caxa executable path:', e);
    }
  }
  
  // Fallback / Development path
  return `"${process.execPath}" "${path.resolve(__dirname, '../index.js')}"`;
}

export async function setAutoStart(enable: boolean): Promise<void> {
  if (os.platform() !== 'win32') return;

  try {
    const isEnabled = await isAutoStartEnabled();
    
    // Do nothing if already in desired state
    if (enable === isEnabled) return;

    if (enable) {
      const command = await getExecutableCommand();
      await execAsync(`reg add "${REGISTRY_KEY}" /v "${APP_NAME}" /t REG_SZ /d "${command}" /f`);
      console.log(`[Autostart] Enabled: ${command}`);
    } else {
      await execAsync(`reg delete "${REGISTRY_KEY}" /v "${APP_NAME}" /f`);
      console.log(`[Autostart] Disabled`);
    }
  } catch (e) {
    console.error(`[Autostart] Failed to set autostart (enable=${enable}):`, e);
  }
}
