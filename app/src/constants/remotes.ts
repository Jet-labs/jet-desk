/**
 * Built-in Remote Configurations
 * These are hardcoded defaults. Custom remotes can be fetched from daemon.
 */

export interface RemoteButton {
  id: string;
  label: string;
  icon?: string;       // Emoji or icon name
  action: string;      // Protocol message type
  payload: any;        // Message payload
  size?: '1x1' | '2x1' | '1x2' | '2x2';
  color?: string;      // Optional accent color override
}

export interface RemoteConfig {
  id: string;
  name: string;
  icon: string;
  columns: number;
  buttons: RemoteButton[];
}

// ─── Media Remote ────────────────────────────────────────────────────────────

export const MEDIA_REMOTE: RemoteConfig = {
  id: 'media',
  name: 'Media',
  icon: 'Music',
  columns: 3,
  buttons: [
    {
      id: 'vol-up',
      label: 'Vol +',
      icon: 'Volume2',
      action: 'input.key.tap',
      payload: { key: 'volume_up' },
    },
    {
      id: 'mute',
      label: 'Mute',
      icon: 'VolumeX',
      action: 'input.key.tap',
      payload: { key: 'volume_mute' },
    },
    {
      id: 'vol-down',
      label: 'Vol −',
      icon: 'Volume1',
      action: 'input.key.tap',
      payload: { key: 'volume_down' },
    },
    {
      id: 'prev',
      label: 'Prev',
      icon: 'SkipBack',
      action: 'input.key.tap',
      payload: { key: 'media_prev' },
    },
    {
      id: 'play-pause',
      label: 'Play/Pause',
      icon: 'Play',
      action: 'input.key.tap',
      payload: { key: 'media_play_pause' },
      size: '1x1',
    },
    {
      id: 'next',
      label: 'Next',
      icon: 'SkipForward',
      action: 'input.key.tap',
      payload: { key: 'media_next' },
    },
    {
      id: 'stop',
      label: 'Stop',
      icon: 'Square',
      action: 'input.key.tap',
      payload: { key: 'media_stop' },
    },
    {
      id: 'fullscreen',
      label: 'Fullscreen',
      icon: 'Maximize',
      action: 'input.key.tap',
      payload: { key: 'f11' },
    },
    {
      id: 'screenshots',
      label: 'Screenshot',
      icon: 'Camera',
      action: 'input.key.tap',
      payload: { key: 'printscreen' },
    },
  ],
};

// ─── Presentation Remote ────────────────────────────────────────────────────

export const PRESENTATION_REMOTE: RemoteConfig = {
  id: 'presentation',
  name: 'Presentation',
  icon: 'Presentation',
  columns: 2,
  buttons: [
    {
      id: 'prev-slide',
      label: 'Previous',
      icon: 'ArrowLeft',
      action: 'input.key.tap',
      payload: { key: 'left' },
      size: '1x1',
    },
    {
      id: 'next-slide',
      label: 'Next',
      icon: 'ArrowRight',
      action: 'input.key.tap',
      payload: { key: 'right' },
      size: '1x1',
    },
    {
      id: 'start-show',
      label: 'Start Show',
      icon: 'PlaySquare',
      action: 'input.key.tap',
      payload: { key: 'f5' },
      size: '2x1',
    },
    {
      id: 'end-show',
      label: 'End Show',
      icon: 'Square',
      action: 'input.key.tap',
      payload: { key: 'escape' },
      size: '2x1',
    },
    {
      id: 'blank-screen',
      label: 'Black Screen',
      icon: 'MonitorX',
      action: 'input.key.tap',
      payload: { key: 'b' },
    },
    {
      id: 'white-screen',
      label: 'White Screen',
      icon: 'Monitor',
      action: 'input.key.tap',
      payload: { key: 'w' },
    },
  ],
};

// ─── System Shortcuts Remote ────────────────────────────────────────────────

export const SYSTEM_REMOTE: RemoteConfig = {
  id: 'system',
  name: 'System',
  icon: 'Settings',
  columns: 3,
  buttons: [
    {
      id: 'lock',
      label: 'Lock',
      icon: 'Lock',
      action: 'input.shortcut',
      payload: { keys: ['lwin', 'l'] },
    },
    {
      id: 'task-view',
      label: 'Tasks',
      icon: 'AppWindow',
      action: 'input.shortcut',
      payload: { keys: ['lwin', 'tab'] },
    },
    {
      id: 'desktop',
      label: 'Desktop',
      icon: 'Monitor',
      action: 'input.shortcut',
      payload: { keys: ['lwin', 'd'] },
    },
    {
      id: 'file-explorer',
      label: 'Files',
      icon: 'Folder',
      action: 'input.shortcut',
      payload: { keys: ['lwin', 'e'] },
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: 'Settings',
      action: 'input.shortcut',
      payload: { keys: ['lwin', 'i'] },
    },
    {
      id: 'sleep',
      label: 'Sleep',
      icon: 'Moon',
      action: 'system.sleep',
      payload: {},
      color: '#e5484d',
    },
  ],
};

// ─── All built-in remotes ────────────────────────────────────────────────────

export const BUILTIN_REMOTES: RemoteConfig[] = [
  MEDIA_REMOTE,
  PRESENTATION_REMOTE,
  SYSTEM_REMOTE,
];
