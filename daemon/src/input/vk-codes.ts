// Windows Virtual Key Codes
// https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes

export const VK: Record<string, number> = {
  // ── Mouse ──────────────────────────────────────────────────────────────────
  lbutton:      0x01,
  rbutton:      0x02,
  mbutton:      0x04,

  // ── Control keys ──────────────────────────────────────────────────────────
  backspace:    0x08,
  tab:          0x09,
  enter:        0x0D,
  shift:        0x10,
  ctrl:         0x11,
  alt:          0x12,
  pause:        0x13,
  capslock:     0x14,
  escape:       0x1B,
  space:        0x20,
  pageup:       0x21,
  pagedown:     0x22,
  end:          0x23,
  home:         0x24,
  left:         0x25,
  up:           0x26,
  right:        0x27,
  down:         0x28,
  printscreen:  0x2C,
  insert:       0x2D,
  delete:       0x2E,

  // ── Numbers (main keyboard) ───────────────────────────────────────────────
  '0': 0x30, '1': 0x31, '2': 0x32, '3': 0x33, '4': 0x34,
  '5': 0x35, '6': 0x36, '7': 0x37, '8': 0x38, '9': 0x39,

  // ── Letters ───────────────────────────────────────────────────────────────
  a: 0x41, b: 0x42, c: 0x43, d: 0x44, e: 0x45,
  f: 0x46, g: 0x47, h: 0x48, i: 0x49, j: 0x4A,
  k: 0x4B, l: 0x4C, m: 0x4D, n: 0x4E, o: 0x4F,
  p: 0x50, q: 0x51, r: 0x52, s: 0x53, t: 0x54,
  u: 0x55, v: 0x56, w: 0x57, x: 0x58, y: 0x59, z: 0x5A,

  // ── Win / Super key ───────────────────────────────────────────────────────
  lwin:         0x5B,
  rwin:         0x5C,
  apps:         0x5D,  // context menu key

  // ── Numpad ────────────────────────────────────────────────────────────────
  num0: 0x60, num1: 0x61, num2: 0x62, num3: 0x63, num4: 0x64,
  num5: 0x65, num6: 0x66, num7: 0x67, num8: 0x68, num9: 0x69,
  multiply:     0x6A,
  add:          0x6B,
  separator:    0x6C,
  subtract:     0x6D,
  decimal:      0x6E,
  divide:       0x6F,

  // ── Function keys ─────────────────────────────────────────────────────────
  f1:  0x70, f2:  0x71, f3:  0x72, f4:  0x73,
  f5:  0x74, f6:  0x75, f7:  0x76, f8:  0x77,
  f9:  0x78, f10: 0x79, f11: 0x7A, f12: 0x7B,
  f13: 0x7C, f14: 0x7D, f15: 0x7E, f16: 0x7F,
  f17: 0x80, f18: 0x81, f19: 0x82, f20: 0x83,
  f21: 0x84, f22: 0x85, f23: 0x86, f24: 0x87,

  // ── Lock keys ─────────────────────────────────────────────────────────────
  numlock:      0x90,
  scrolllock:   0x91,

  // ── Left/Right modifier variants ──────────────────────────────────────────
  lshift:       0xA0,
  rshift:       0xA1,
  lctrl:        0xA2,
  rctrl:        0xA3,
  lalt:         0xA4,
  ralt:         0xA5,

  // ── Browser / media keys ──────────────────────────────────────────────────
  browser_back:      0xA6,
  browser_forward:   0xA7,
  browser_refresh:   0xA8,
  browser_stop:      0xA9,
  browser_search:    0xAA,
  browser_favorites: 0xAB,
  browser_home:      0xAC,
  volume_mute:       0xAD,
  volume_down:       0xAE,
  volume_up:         0xAF,
  media_next:        0xB0,
  media_prev:        0xB1,
  media_stop:        0xB2,
  media_play_pause:  0xB3,

  // ── OEM / punctuation ────────────────────────────────────────────────────
  semicolon:    0xBA,  // ;:
  equals:       0xBB,  // =+
  comma:        0xBC,  // ,<
  minus:        0xBD,  // -_
  period:       0xBE,  // .>
  slash:        0xBF,  // /?
  backtick:     0xC0,  // `~
  lbracket:     0xDB,  // [{
  backslash:    0xDC,  // \|
  rbracket:     0xDD,  // ]}
  quote:        0xDE,  // '"
};

// Resolve a key string (case-insensitive) to a VK code
export function resolveVk(key: string): number {
  const normalized = key.toLowerCase().trim();
  const vk = VK[normalized];
  if (vk !== undefined) return vk;

  // Single char fallback (letters A-Z become 0x41-0x5A)
  if (normalized.length === 1) {
    const code = normalized.charCodeAt(0);
    if (code >= 97 && code <= 122) return code - 32; // a-z → A-Z vk
    if (code >= 48 && code <= 57)  return code;       // 0-9
  }

  throw new Error(`Unknown key: "${key}"`);
}

// Modifier aliases
export const MODIFIER_ALIASES: Record<string, string> = {
  control:   'ctrl',
  command:   'lwin',
  cmd:       'lwin',
  super:     'lwin',
  option:    'alt',
  meta:      'lwin',
  windows:   'lwin',
  win:       'lwin',
};

export function isExtendedKey(vk: number): boolean {
  // https://learn.microsoft.com/en-us/windows/win32/inputdev/about-keyboard-input#extended-key-flag
  const extended = [
    0x21, 0x22, 0x23, 0x24, // PageUp, PageDown, End, Home
    0x25, 0x26, 0x27, 0x28, // Left, Up, Right, Down
    0x2C, 0x2D, 0x2E,       // PrintScreen, Insert, Delete
    0x5B, 0x5C, 0x5D,       // LWin, RWin, Apps
    0xA1, 0xA3, 0xA5,       // RShift, RCtrl, RAlt
    0x6F, 0x90, 0x91,       // Divide, NumLock, ScrollLock
  ];
  return extended.includes(vk);
}

export function normalizeModifier(mod: string): string {
  return MODIFIER_ALIASES[mod.toLowerCase()] ?? mod.toLowerCase();
}