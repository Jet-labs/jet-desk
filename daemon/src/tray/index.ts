import SysTray from 'systray2';
import { config } from '../config/index.js';
import { getLocalIp } from '../security/tls.js';
import { exec } from 'child_process';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { isAutoStartEnabled, setAutoStart } from './autostart.js';

let systray: any = null;

// A simple empty transparent icon placeholder or 1x1 base64 png
// Normally this would be a proper `.ico` or `.png` encoded in base64.
const placeholderIcon = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

export async function initTray(): Promise<void> {
  if (os.platform() !== 'win32') {
    console.warn('[Tray] Desktop tray is mostly targeted for Windows.');
  }

  const autostart = await isAutoStartEnabled();
  config.set('autoStartOnBoot', autostart);

  const port = config.get('httpPort');

  systray = new SysTray({
    menu: {
      icon: placeholderIcon,
      title: 'JetDesk',
      tooltip: 'JetDesk Local Remote',
      items: [
        {
          title: 'JetDesk Daemon Running',
          tooltip: 'Status',
          checked: false,
          enabled: false,
        },
        SysTray.separator,
        {
          title: 'Pair New Device (QR)',
          tooltip: 'Open the QR code pairing screen',
          checked: false,
          enabled: true,
        },
        {
          title: 'Start on Windows Login',
          tooltip: 'Toggle auto-start',
          checked: autostart,
          enabled: true,
        },
        SysTray.separator,
        {
          title: 'Exit',
          tooltip: 'Shutdown JetDesk',
          checked: false,
          enabled: true,
        },
      ],
    },
    debug: false,
    copyDir: true // copies systray2 executable to temp dir
  });

  systray.onClick(async (action: any) => {
    switch (action.item.title) {
      case 'Pair New Device (QR)':
        const ip = getLocalIp();
        const url = `https://${ip}:${port}/pair`;
        console.log(`[Tray] Opening pairing UI: ${url}`);
        exec(`start ${url}`); // Windows open URL command
        break;

      case 'Start on Windows Login':
        const newState = !action.item.checked;
        action.item.checked = newState;
        await setAutoStart(newState);
        config.set('autoStartOnBoot', newState);
        systray.sendAction({
          type: 'update-item',
          item: action.item,
          seq_id: action.seq_id
        });
        break;

      case 'Exit':
        systray.kill();
        console.log('[Tray] Exiting daemon...');
        process.exit(0);
        break;
    }
  });

  systray.ready().then(() => {
    console.log('[Tray] SysTray initialized');
  }).catch((e: any) => {
    console.error('[Tray] SysTray failed to start:', e);
  });
}
