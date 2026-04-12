import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ConnectionContext } from '../security/auth.js';
import { makeMessage } from '../types/protocol.js';

const execAsync = promisify(exec);

// Helper to calculate CPU load (similar to task manager)
let lastCpus = os.cpus();
function getCpuUsage(): number {
  const cpus = os.cpus();
  let idleDiff = 0;
  let totalDiff = 0;

  for (let i = 0; i < cpus.length; i++) {
    const cpu = cpus[i];
    const lastCpu = lastCpus[i];

    const idle = cpu.times.idle - (lastCpu ? lastCpu.times.idle : 0);
    
    let total = 0;
    for (const type in cpu.times) {
      total += cpu.times[type as keyof typeof cpu.times] - (lastCpu ? lastCpu.times[type as keyof typeof cpu.times] : 0);
    }

    idleDiff += idle;
    totalDiff += total;
  }
  
  lastCpus = cpus;
  
  if (totalDiff === 0) return 0;
  return Math.round(100 - (100 * idleDiff) / totalDiff);
}

// Helper to get basic network stats
function getNetworkInfo() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    const iface = nets[name];
    if (!iface) continue;
    const ipv4 = iface.find(i => i.family === 'IPv4' && !i.internal);
    if (ipv4) {
      return { name, ip: ipv4.address };
    }
  }
  return { name: 'Offline', ip: '127.0.0.1' };
}

// Global cached GPU state (powershell is slow)
let gpuInfo = { name: 'Unknown GPU', usage: 0 };
let fetchingGpu = false;

async function updateGpuInfo() {
  if (fetchingGpu || os.platform() !== 'win32') return;
  fetchingGpu = true;
  try {
    const { stdout } = await execAsync('powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name"', { timeout: 3000 });
    const match = stdout.trim().split('\n')[0];
    if (match) gpuInfo.name = match.trim();
  } catch (e) {
    // Graceful degrade
  } finally {
    fetchingGpu = false;
  }
}
// Initial fetch
updateGpuInfo();

const telemetrySubscribers = new Map<string, { ctx: ConnectionContext, interval: NodeJS.Timeout }>();

export function startTelemetry(ctx: ConnectionContext, intervalMs = 2000): void {
  if (telemetrySubscribers.has(ctx.id)) return;

  const interval = setInterval(async () => {
    if (ctx.socket.destroyed) {
      stopTelemetry(ctx);
      return;
    }

    const cpu = getCpuUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = Math.round((usedMem / totalMem) * 100);
    const net = getNetworkInfo();

    // Occasional GPU update
    if (Math.random() < 0.1) updateGpuInfo();

    const payload = {
      cpu,
      ram: { used: usedMem, total: totalMem, percent: memPercent },
      gpu: gpuInfo,
      network: net,
    };

    const msg = JSON.stringify(makeMessage('system.telemetry.data', payload, ctx.seq++)) + '\n';
    ctx.socket.write(msg);

  }, intervalMs);

  telemetrySubscribers.set(ctx.id, { ctx, interval });
  console.log(`[Telemetry] Started for ${ctx.id}`);
}

export function stopTelemetry(ctx: ConnectionContext): void {
  const sub = telemetrySubscribers.get(ctx.id);
  if (sub) {
    clearInterval(sub.interval);
    telemetrySubscribers.delete(ctx.id);
    console.log(`[Telemetry] Stopped for ${ctx.id}`);
  }
}
