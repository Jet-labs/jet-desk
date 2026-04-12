import { exec } from 'child_process';
import { promisify } from 'util';
import { broadcastToAuthenticated } from '../server/tls-server.js';
import { makeMessage } from '../types/protocol.js';

const execAsync = promisify(exec);

const CLIPBOARD_MAX_SIZE = 10 * 1024; // 10KB limit

let pollInterval: NodeJS.Timeout | null = null;
let lastClipboardText = '';

// Helper to reliably retrieve text clipboard without formatting issues
async function getClipboardText(): Promise<string> {
  try {
    const { stdout } = await execAsync('powershell -NoProfile -Command "Get-Clipboard"');
    // PowerShell adds \r\n, trim it but keep actual content
    return stdout.replace(/\r\n$/, '');
  } catch {
    return '';
  }
}

// Helper to reliably set clipboard text without escaping nightmares
async function setClipboardText(text: string): Promise<void> {
  try {
    const b64 = Buffer.from(text, 'utf-8').toString('base64');
    const psCmd = `[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64}')) | Set-Clipboard`;
    await execAsync(`powershell -NoProfile -Command "${psCmd}"`);
    lastClipboardText = text; // Prevent echoing back to clients
  } catch (e) {
    console.error('[Clipboard] Failed to set:', e);
  }
}

export function startClipboardWatcher(intervalMs = 2000): void {
  if (pollInterval) return;

  // Initial fetch
  getClipboardText().then(t => lastClipboardText = t);

  pollInterval = setInterval(async () => {
    try {
      const text = await getClipboardText();
      
      if (text !== lastClipboardText) {
        lastClipboardText = text;
        
        if (text.length > CLIPBOARD_MAX_SIZE) {
          return; // Skip massive text chunks
        }

        // Broadcast to all connected clients
        const msg = JSON.stringify(makeMessage('clipboard.changed', { text }));
        broadcastToAuthenticated(msg);
      }
    } catch (e) {
      // Ignore polling errors
    }
  }, intervalMs);

  console.log(`[Clipboard] Watcher started (poll every ${intervalMs}ms)`);
}

export function stopClipboardWatcher(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log('[Clipboard] Watcher stopped');
  }
}

export async function handleClipboardSet(text: string): Promise<void> {
  if (typeof text !== 'string' || text.length > CLIPBOARD_MAX_SIZE) return;
  await setClipboardText(text);
}

export async function handleClipboardGet(): Promise<string> {
  return await getClipboardText();
}
