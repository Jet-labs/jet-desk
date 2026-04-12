import screenshot from 'screenshot-desktop';

// screenshot-desktop returns a PNG Buffer. We convert to JPEG for streaming
// using the built-in sharp if available, or fall back to raw PNG.

interface CaptureOptions {
  quality?: number;  // JPEG quality 0-100
  scale?:   number;  // downscale factor 0.1-1.0
}

// ─── Dynamic import of sharp (optional) ──────────────────────────────────────

let sharpModule: typeof import('sharp') | null = null;

async function tryLoadSharp(): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sharpModule = require('sharp');
    console.log('[Capture] Using sharp for JPEG conversion');
  } catch {
    console.warn('[Capture] sharp not installed — falling back to PNG. Install sharp for better streaming performance.');
  }
}

let initialized = false;

async function ensureInitialized(): Promise<void> {
  if (!initialized) {
    await tryLoadSharp();
    initialized = true;
  }
}

// ─── Capture a frame ──────────────────────────────────────────────────────────

export async function captureScreen(opts: CaptureOptions = {}): Promise<Buffer> {
  console.log('[Capture] ensureInitialized starting');
  await ensureInitialized();
  console.log('[Capture] ensureInitialized complete');

  const { quality = 60, scale = 0.5 } = opts;

  console.log('[Capture] Calling screenshot(...) native module');
  // screenshot-desktop returns raw PNG
  const png: Buffer = await screenshot({ format: 'png' });
  console.log('[Capture] screenshot(...) success, returned Buffer length:', png?.length);

  if (!sharpModule) {
    console.log('[Capture] No sharp module, returning PNG');
    return png;
  }

  // Convert to JPEG with downscaling
  console.log('[Capture] Casting sharp module');
  const sharp = sharpModule as unknown as (input: Buffer) => {
    resize: (w: null, h: null, opts: object) => { jpeg: (opts: object) => { toBuffer: () => Promise<Buffer> } }
  };

  console.log('[Capture] Fetching metadata via sharp');
  const metadata = await (sharpModule as any)(png).metadata();
  const targetW  = Math.round((metadata.width  || 1920) * scale);
  const targetH  = Math.round((metadata.height || 1080) * scale);

  console.log(`[Capture] Resizing to ${targetW}x${targetH} with quality ${quality}`);
  const result = await (sharpModule as any)(png)
    .resize(targetW, targetH)
    .jpeg({ quality: Math.round(quality), mozjpeg: true })
    .toBuffer();
  
  console.log('[Capture] Complete! Returning JPEG buffer length:', result?.length);
  return result;
}

// ─── Get screen dimensions ────────────────────────────────────────────────────

export async function getScreenSize(): Promise<{ width: number; height: number }> {
  try {
    const img = await screenshot({ format: 'png' });
    // Read PNG dimensions from header (bytes 16-23)
    const width  = img.readUInt32BE(16);
    const height = img.readUInt32BE(20);
    return { width, height };
  } catch {
    return { width: 1920, height: 1080 };
  }
}