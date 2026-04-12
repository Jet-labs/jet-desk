import koffi from 'koffi';
import os from 'os';

// ─── Win32 types & constants ──────────────────────────────────────────────────

const INPUT_MOUSE = 0;

const MOUSEEVENTF = {
  MOVE:        0x0001,
  LEFTDOWN:    0x0002,
  LEFTUP:      0x0004,
  RIGHTDOWN:   0x0008,
  RIGHTUP:     0x0010,
  MIDDLEDOWN:  0x0020,
  MIDDLEUP:    0x0040,
  WHEEL:       0x0800,
  HWHEEL:      0x1000,
  ABSOLUTE:    0x8000,
} as const;

// On x64 Windows, sizeof(INPUT) = 40 bytes
// Layout: [0-3] type | [4-7] pad | [8..] union
// MOUSEINPUT: dx(4) dy(4) mouseData(4) dwFlags(4) time(4) pad(4) extraInfo(8)
const INPUT_SIZE = 40;

// ─── Load user32.dll via koffi ────────────────────────────────────────────────

let user32: ReturnType<typeof koffi.load> | null = null;
let SendInput:    ((n: number, buf: Buffer, sz: number) => number) | null = null;
let GetCursorPos: ((buf: Buffer) => boolean) | null = null;
let SetCursorPos: ((x: number, y: number) => boolean) | null = null;
let GetSystemMetrics: ((index: number) => number) | null = null;

export function initMouse(): boolean {
  if (os.platform() !== 'win32') {
    console.warn('[Mouse] Not on Windows, mouse control disabled');
    return false;
  }
  try {
    user32 = koffi.load('user32.dll');
    SendInput    = user32.func('uint32 __stdcall SendInput(uint32 nInputs, uint8 *pInputs, int32 cbSize)');
    GetCursorPos = user32.func('bool __stdcall GetCursorPos(uint8 *lpPoint)');
    SetCursorPos = user32.func('bool __stdcall SetCursorPos(int32 X, int32 Y)');

    const kernel32 = koffi.load('user32.dll');
    GetSystemMetrics = kernel32.func('int32 __stdcall GetSystemMetrics(int32 nIndex)');

    console.log('[Mouse] Win32 mouse initialized via koffi');
    return true;
  } catch (e) {
    console.error('[Mouse] Failed to load user32.dll:', e);
    return false;
  }
}

// ─── Buffer builders ──────────────────────────────────────────────────────────

function buildMouseInput(dx: number, dy: number, flags: number, mouseData = 0): Buffer {
  const buf = Buffer.alloc(INPUT_SIZE, 0);
  buf.writeUInt32LE(INPUT_MOUSE, 0);
  // bytes 4-7: implicit padding
  buf.writeInt32LE(dx, 8);
  buf.writeInt32LE(dy, 12);
  buf.writeUInt32LE(mouseData, 16);
  buf.writeUInt32LE(flags, 20);
  buf.writeUInt32LE(0, 24); // time: 0 = system timestamp
  // bytes 28-31: pad; 32-39: dwExtraInfo = 0 (already zeroed)
  return buf;
}

function sendInputs(inputs: Buffer[]): void {
  if (!SendInput) throw new Error('Mouse not initialized');
  const combined = Buffer.concat(inputs);
  SendInput(inputs.length, combined, INPUT_SIZE);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Move mouse relative to current position */
export function moveMouse(dx: number, dy: number): void {
  sendInputs([buildMouseInput(dx, dy, MOUSEEVENTF.MOVE)]);
}

/** Move mouse to absolute screen coordinates */
export function moveMouseAbsolute(x: number, y: number): void {
  const SM_CXSCREEN = 0, SM_CYSCREEN = 1;
  const screenW = GetSystemMetrics!(SM_CXSCREEN) || 1920;
  const screenH = GetSystemMetrics!(SM_CYSCREEN) || 1080;
  const nx = Math.round((x / screenW) * 65535);
  const ny = Math.round((y / screenH) * 65535);
  sendInputs([buildMouseInput(nx, ny, MOUSEEVENTF.MOVE | MOUSEEVENTF.ABSOLUTE)]);
}

export type MouseButton = 'left' | 'right' | 'middle';

const DOWN_FLAGS: Record<MouseButton, number> = {
  left:   MOUSEEVENTF.LEFTDOWN,
  right:  MOUSEEVENTF.RIGHTDOWN,
  middle: MOUSEEVENTF.MIDDLEDOWN,
};
const UP_FLAGS: Record<MouseButton, number> = {
  left:   MOUSEEVENTF.LEFTUP,
  right:  MOUSEEVENTF.RIGHTUP,
  middle: MOUSEEVENTF.MIDDLEUP,
};

/** Press and release a mouse button */
export function clickMouse(button: MouseButton = 'left', double = false): void {
  const down = buildMouseInput(0, 0, DOWN_FLAGS[button]);
  const up   = buildMouseInput(0, 0, UP_FLAGS[button]);
  sendInputs([down, up]);
  if (double) {
    setTimeout(() => sendInputs([down, up]), 50);
  }
}

/** Hold a mouse button down */
export function mouseDown(button: MouseButton = 'left'): void {
  sendInputs([buildMouseInput(0, 0, DOWN_FLAGS[button])]);
}

/** Release a mouse button */
export function mouseUp(button: MouseButton = 'left'): void {
  sendInputs([buildMouseInput(0, 0, UP_FLAGS[button])]);
}

/** Scroll the mouse wheel
 *  dy > 0 = scroll up (away from user), dy < 0 = scroll down
 *  dx > 0 = scroll right, dx < 0 = scroll left
 */
export function scrollMouse(dx: number, dy: number): void {
  const WHEEL_DELTA = 120;
  const inputs: Buffer[] = [];
  if (dy !== 0) inputs.push(buildMouseInput(0, 0, MOUSEEVENTF.WHEEL, dy * WHEEL_DELTA));
  if (dx !== 0) inputs.push(buildMouseInput(0, 0, MOUSEEVENTF.HWHEEL, dx * WHEEL_DELTA));
  if (inputs.length) sendInputs(inputs);
}

/** Drag from one point to another (absolute coords) */
export function dragMouse(fromX: number, fromY: number, toX: number, toY: number): void {
  moveMouseAbsolute(fromX, fromY);
  mouseDown('left');
  setTimeout(() => {
    moveMouseAbsolute(toX, toY);
    setTimeout(() => mouseUp('left'), 50);
  }, 50);
}

/** Get current cursor position */
export function getMousePos(): { x: number; y: number } {
  if (!GetCursorPos) return { x: 0, y: 0 };
  const buf = Buffer.alloc(8, 0); // POINT: x(4) y(4)
  GetCursorPos(buf);
  return { x: buf.readInt32LE(0), y: buf.readInt32LE(4) };
}