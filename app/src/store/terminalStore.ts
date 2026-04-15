import { create } from 'zustand';
import { storage } from './deviceStore'; // Reuse the same MMKV instance

interface TerminalStoreState {
  presets: string[];
  
  // Actions
  loadPresets: () => void;
  addPreset: (cmd: string) => void;
  removePreset: (index: number) => void;
  reorderPresets: (newPresets: string[]) => void;
}

const STORAGE_KEY = 'terminal.presets';

function persistPresets(presets: string[]): void {
  try {
    storage.set(STORAGE_KEY, JSON.stringify(presets));
  } catch (e) {
    console.error('[TerminalStore] Persistence failed:', e);
  }
}

function loadPresetsFromStorage(): string[] {
  try {
    const raw = storage.getString(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('[TerminalStore] Load failed:', e);
  }
  return [];
}

export const useTerminalStore = create<TerminalStoreState>((set, get) => ({
  presets: [],

  loadPresets: () => {
    const presets = loadPresetsFromStorage();
    set({ presets });
  },

  addPreset: (cmd: string) => {
    if (!cmd.trim()) return;
    const { presets } = get();
    // Dedup
    if (presets.includes(cmd.trim())) return;
    
    const updated = [...presets, cmd.trim()];
    persistPresets(updated);
    set({ presets: updated });
  },

  removePreset: (index: number) => {
    const { presets } = get();
    const updated = presets.filter((_, i) => i !== index);
    persistPresets(updated);
    set({ presets: updated });
  },

  reorderPresets: (newPresets: string[]) => {
    persistPresets(newPresets);
    set({ presets: newPresets });
  },
}));
