import koffi from 'koffi';
import os from 'os';
import { resolveVk, normalizeModifier, isExtendedKey } from './vk-codes.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const INPUT_KEYBOARD   = 1;
const KEYEVENTF_EXTENDEDKEY = 0x0001;
const KEYEVENTF_KEYUP  = 0x0002;
const KEYEVENTF_UNICODE = 0x0004;
const INPUT_SIZE = 40;

// ─── Win32 setup ──────────────────────────────────────────────────────────────

let SendInput: ((n: number, buf: Buffer, sz: number) => number) | null = null;

export function initKeyboard(): boolean {
  if (os.platform() !== 'win32') {
    console.warn('[Keyboard] Not on Windows, keyboard control disabled');
    return false;
  }
  try {
    const user32 = koffi.load('user32.dll');
    // Re-use existing binding if mouse already loaded it — koffi caches per process
    SendInput = user32.func('uint32 __stdcall SendInput(uint32 nInputs, uint8 *pInputs, int32 cbSize)');
    console.log('[Keyboard] Win32 keyboard initialized via koffi');
    return true;
  } catch (e) {
    console.error('[Keyboard] Failed to load user32.dll:', e);
    return false;
  }
}

// ─── Buffer builders ──────────────────────────────────────────────────────────

function buildKeyInput(vk: number, flags: number, scan = 0): Buffer {
  const buf = Buffer.alloc(INPUT_SIZE, 0);
  buf.writeUInt32LE(INPUT_KEYBOARD, 0);
  // bytes 4-7: padding
  buf.writeUInt16LE(vk, 8);      // wVk
  buf.writeUInt16LE(scan, 10);   // wScan
  
  // Automatically add EXTENDEDKEY flag if the VK requires it
  let finalFlags = flags;
  if (isExtendedKey(vk)) {
    finalFlags |= KEYEVENTF_EXTENDEDKEY;
  }
  
  buf.writeUInt32LE(finalFlags, 12);  // dwFlags
  buf.writeUInt32LE(0, 16);      // time
  // bytes 20-31: pad + extraInfo = 0
  return buf;
}

function buildUnicodeInput(charCode: number, flags: number): Buffer {
  const buf = Buffer.alloc(INPUT_SIZE, 0);
  buf.writeUInt32LE(INPUT_KEYBOARD, 0);
  buf.writeUInt16LE(0, 8);                          // wVk = 0 for unicode
  buf.writeUInt16LE(charCode, 10);                   // wScan = char code
  buf.writeUInt32LE(flags | KEYEVENTF_UNICODE, 12);  // dwFlags
  return buf;
}

function send(inputs: Buffer[]): void {
  if (!SendInput) throw new Error('Keyboard not initialized');
  
  const combined = Buffer.concat(inputs);
  console.log("ready for sending input",inputs,combined, INPUT_SIZE)
  const result = SendInput(inputs.length, combined, INPUT_SIZE);
  
  if (result !== inputs.length) {
    console.error(`[Keyboard] SendInput failed. Expected ${inputs.length} inputs, got ${result}. Last error: ${process.platform === 'win32' ? 'See Windows event logs or check privileges.' : 'N/A'}`);
  } else {
    // console.log(`[Keyboard] SendInput success: ${result} events dispatched`);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Press and release a key (optionally with modifiers) */
export function keyTap(key: string, modifiers: string[] = []): void {
  const vk = resolveVk(key);
  const mods = modifiers.map(m => resolveVk(normalizeModifier(m)));

  const inputs: Buffer[] = [];

  // Press modifiers
  for (const mod of mods) inputs.push(buildKeyInput(mod, 0));

  // Press + release key
  inputs.push(buildKeyInput(vk, 0));
  inputs.push(buildKeyInput(vk, KEYEVENTF_KEYUP));

  // Release modifiers in reverse
  for (const mod of [...mods].reverse()) inputs.push(buildKeyInput(mod, KEYEVENTF_KEYUP));

  send(inputs);
}

/** Hold a key down */
export function keyDown(key: string): void {
  const vk = resolveVk(key);
  send([buildKeyInput(vk, 0)]);
}

/** Release a held key */
export function keyUp(key: string): void {
  const vk = resolveVk(key);
  send([buildKeyInput(vk, KEYEVENTF_KEYUP)]);
}

/** Send a keyboard shortcut (array of keys pressed simultaneously) */
export function sendShortcut(keys: string[]): void {
  if (keys.length === 0) return;
  const vks = keys.map(k => resolveVk(normalizeModifier(k)));
  const inputs: Buffer[] = [];
  for (const vk of vks) inputs.push(buildKeyInput(vk, 0));
  for (const vk of [...vks].reverse()) inputs.push(buildKeyInput(vk, KEYEVENTF_KEYUP));
  send(inputs);
}

/** Type a string using unicode events (handles all characters including emoji) */
export function typeString(text: string): void {
  const inputs: Buffer[] = [];
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code > 0xFFFF) {
      // Surrogate pair for characters outside BMP (e.g. emoji)
      const cp = char.codePointAt(0)! - 0x10000;
      const hi = 0xD800 + (cp >> 10);
      const lo = 0xDC00 + (cp & 0x3FF);
      inputs.push(buildUnicodeInput(hi, 0));
      inputs.push(buildUnicodeInput(hi, KEYEVENTF_KEYUP));
      inputs.push(buildUnicodeInput(lo, 0));
      inputs.push(buildUnicodeInput(lo, KEYEVENTF_KEYUP));
    } else {
      inputs.push(buildUnicodeInput(code, 0));
      inputs.push(buildUnicodeInput(code, KEYEVENTF_KEYUP));
    }
    // Batch in chunks to avoid oversized SendInput calls
    if (inputs.length >= 100) {
      send(inputs.splice(0, 100));
    }
  }
  if (inputs.length) send(inputs);
}