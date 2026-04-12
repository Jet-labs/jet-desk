import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { ConnectionContext } from '../security/auth.js';
import { makeMessage } from '../types/protocol.js';
import { config } from '../config/index.js';
import { send } from '../server/message-handler.js';

const activeProcesses = new Map<string, ChildProcessWithoutNullStreams>();

export function handleShellExec(ctx: ConnectionContext, cmd: string, args: string[], processId: string): void {
  const allowed = config.get('allowedShellCommands');
  const allowCustom = config.get('allowCustomShellCommands');
  
  // If custom commands are disabled, enforce the allowlist strictly
  if (!allowCustom && !allowed.includes(cmd)) {
    send(ctx, makeMessage('system.shell.output', {
      processId,
      stream: 'stderr',
      data: `[Error] Command not allowed: ${cmd}\nEnable "Allow custom commands" or add it to the allowedShellCommands in Settings.`,
    }));
    send(ctx, makeMessage('system.shell.exit', { processId, code: -1 }));
    return;
  }

  try {
    const p = spawn(cmd, args, { shell: true });
    activeProcesses.set(processId, p);

    p.stdout.on('data', (data: Buffer) => {
      send(ctx, makeMessage('system.shell.output', { processId, stream: 'stdout', data: data.toString() }));
    });

    p.stderr.on('data', (data: Buffer) => {
      send(ctx, makeMessage('system.shell.output', { processId, stream: 'stderr', data: data.toString() }));
    });

    p.on('close', (code: number) => {
      activeProcesses.delete(processId);
      send(ctx, makeMessage('system.shell.exit', { processId, code }));
    });

    p.on('error', (err: Error) => {
      activeProcesses.delete(processId);
      send(ctx, makeMessage('system.shell.output', { processId, stream: 'stderr', data: `[Spawn Error] ${err.message}` }));
      send(ctx, makeMessage('system.shell.exit', { processId, code: -1 }));
    });

  } catch (err: any) {
    send(ctx, makeMessage('system.shell.output', { processId, stream: 'stderr', data: `[Init Error] ${err.message}` }));
    send(ctx, makeMessage('system.shell.exit', { processId, code: -1 }));
  }
}

export function handleShellKill(processId: string): void {
  const p = activeProcesses.get(processId);
  if (p) {
    p.kill();
    activeProcesses.delete(processId);
  }
}

export function getAllowedCommands(): string[] {
  return config.get('allowedShellCommands');
}
