import { initMouse, moveMouse, moveMouseAbsolute, clickMouse, mouseDown, mouseUp, scrollMouse, dragMouse, getMousePos, MouseButton } from './mouse.js';
import { initKeyboard, keyTap, keyDown, keyUp, sendShortcut, typeString } from './keyboard.js';

export { MouseButton };

let mouseReady    = false;
let keyboardReady = false;

export function initInput(): void {
  mouseReady    = initMouse();
  keyboardReady = initKeyboard();

  if (!mouseReady || !keyboardReady) {
    console.warn('[Input] Running in limited mode (non-Windows or init failed)');
  }
}

// ─── Mouse ────────────────────────────────────────────────────────────────────

export function inputMouseMove(dx: number, dy: number): void {
  if (!mouseReady) return;
  moveMouse(Math.round(dx), Math.round(dy));
}

export function inputMouseMoveAbsolute(x: number, y: number): void {
  if (!mouseReady) return;
  moveMouseAbsolute(Math.round(x), Math.round(y));
}

export function inputMouseClick(button: MouseButton = 'left', double = false): void {
  if (!mouseReady) return;
  clickMouse(button, double);
}

export function inputMouseDown(button: MouseButton = 'left'): void {
  if (!mouseReady) return;
  mouseDown(button);
}

export function inputMouseUp(button: MouseButton = 'left'): void {
  if (!mouseReady) return;
  mouseUp(button);
}

export function inputMouseScroll(dx: number, dy: number): void {
  if (!mouseReady) return;
  scrollMouse(dx, dy);
}

export function inputMouseDrag(fx: number, fy: number, tx: number, ty: number): void {
  if (!mouseReady) return;
  dragMouse(fx, fy, tx, ty);
}

export function inputMouseGetPos() {
  return mouseReady ? getMousePos() : { x: 0, y: 0 };
}

// ─── Keyboard ─────────────────────────────────────────────────────────────────

export function inputKeyTap(key: string, modifiers: string[] = []): void {
  if (!keyboardReady) return;
  try { keyTap(key, modifiers); } catch (e) { console.warn('[Input] keyTap error:', e); }
}

export function inputKeyDown(key: string): void {
  if (!keyboardReady) return;
  try { keyDown(key); } catch (e) { console.warn('[Input] keyDown error:', e); }
}

export function inputKeyUp(key: string): void {
  if (!keyboardReady) return;
  try { keyUp(key); } catch (e) { console.warn('[Input] keyUp error:', e); }
}

export function inputShortcut(keys: string[]): void {
  if (!keyboardReady) return;
  try { sendShortcut(keys); } catch (e) { console.warn('[Input] shortcut error:', e); }
}

export function inputType(text: string): void {
  if (!keyboardReady) return;
  try { typeString(text); } catch (e) { console.warn('[Input] type error:', e); }
}