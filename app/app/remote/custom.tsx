/**
 * Custom Remotes Module
 *
 * Masonry-style button grid rendered from JSON config.
 * Built-in remotes are merged with any custom ones fetched from the daemon.
 *
 * Extensibility notes:
 *   - Add new built-in remotes in src/constants/remotes.ts
 *   - Custom remotes are fetched live from the daemon's /remotes endpoint
 *   - Button sizes: '1x1' (default) | '2x1' (wide) | '1x2' (tall)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';

import {
  LayoutGrid, Music, Volume2, VolumeX, Volume1, SkipBack, Play, SkipForward, Square,
  Maximize, Camera, Presentation, ArrowLeft, ArrowRight, PlaySquare, MonitorX, Monitor,
  Settings, Lock, AppWindow, Folder, Moon, LucideIcon
} from 'lucide-react-native';

import { useConnectivity }   from '../../src/contexts/ConnectivityContext';
import { useDeviceStore }    from '../../src/store/deviceStore';
import { BUILTIN_REMOTES, RemoteConfig, RemoteButton } from '../../src/constants/remotes';
import { Theme }             from '../../src/constants/theme';

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutGrid, Music, Volume2, VolumeX, Volume1, SkipBack, Play, SkipForward, Square,
  Maximize, Camera, Presentation, ArrowLeft, ArrowRight, PlaySquare, MonitorX, Monitor,
  Settings, Lock, AppWindow, Folder, Moon,
};

function renderIcon(iconName: string | undefined, size: number, color: string, style?: any) {
  if (!iconName) return null;
  const IconComponent = ICON_MAP[iconName];
  if (IconComponent) {
    return <IconComponent size={size} color={color} strokeWidth={2} style={style} />;
  }
  // Fallback for custom text/emojis from daemon
  return <Text style={[style, { fontSize: size, color }]}>{iconName}</Text>;
}

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_PADDING        = Theme.spacing.md;
const GRID_GAP            = Theme.spacing.sm;

export default function CustomModule() {
  const { sendEvent }    = useConnectivity();
  const devices          = useDeviceStore(s => s.devices);
  const activeDeviceId   = useDeviceStore(s => s.activeDeviceId);
  const activeDevice     = devices.find(d => d.id === activeDeviceId);

  const [remotes, setRemotes]           = useState<RemoteConfig[]>(BUILTIN_REMOTES);
  const [activeRemoteId, setActiveRemoteId] = useState<string>(BUILTIN_REMOTES[0]?.id || '');
  const [customRemotes, setCustomRemotes]   = useState<RemoteConfig[]>([]);

  // Fetch custom remotes from daemon
  useEffect(() => {
    if (!activeDevice?.sessionToken || !activeDevice?.ip) return;
    (async () => {
      try {
        const res = await fetch(`https://${activeDevice.ip}:57424/remotes`, {
          headers: { 'X-Session-Token': activeDevice.sessionToken || '' },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.remotes)) setCustomRemotes(data.remotes);
        }
      } catch {
        // Custom remotes endpoint optional — fail silently
      }
    })();
  }, [activeDevice?.ip, activeDevice?.sessionToken]);

  useEffect(() => {
    setRemotes([...BUILTIN_REMOTES, ...customRemotes]);
  }, [customRemotes]);

  const activeRemote = remotes.find(r => r.id === activeRemoteId) || remotes[0];

  const handleButtonPress = useCallback((button: RemoteButton) => {
    sendEvent(button.action, button.payload);
  }, [sendEvent]);

  if (!activeRemote) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyGlyph}>◈</Text>
        <Text style={styles.emptyText}>No remotes configured</Text>
      </View>
    );
  }

  const columns    = activeRemote.columns || 3;
  const buttonBase = (SCREEN_W - GRID_PADDING * 2 - GRID_GAP * (columns - 1)) / columns;

  return (
    <View style={styles.root}>

      {/* ── Remote selector ───────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {remotes.map(remote => {
          const isActive = activeRemoteId === remote.id;
          return (
            <TouchableOpacity
              key={remote.id}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveRemoteId(remote.id)}
              activeOpacity={0.7}
            >
              {renderIcon(remote.icon, 16, isActive ? Theme.colors.accent : Theme.colors.textTertiary, styles.tabIcon)}
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {remote.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Button grid ───────────────────────────────────────────────── */}
      <ScrollView
        style={styles.grid}
        contentContainerStyle={[styles.gridContent, { padding: GRID_PADDING }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.gridRow}>
          {activeRemote.buttons.map(button => {
            const colSpan = button.size === '2x1' ? 2 : 1;
            const rowSpan = button.size === '1x2' ? 2 : 1;
            const w = buttonBase * colSpan + GRID_GAP * (colSpan - 1);
            const h = Math.max(buttonBase * rowSpan + GRID_GAP * (rowSpan - 1), 72);

            return (
              <TouchableOpacity
                key={button.id}
                style={[
                  styles.gridBtn,
                  {
                    width:  w,
                    height: h,
                    backgroundColor: button.color || Theme.colors.surface,
                  },
                ]}
                onPress={() => handleButtonPress(button)}
                activeOpacity={0.55}
              >
                {renderIcon(button.icon, 24, Theme.colors.textPrimary, styles.gridBtnIcon)}
                <Text style={styles.gridBtnLabel}>{button.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },

  // ── Tab bar ──────────────────────────────────────────────────────────
  tabBar: {
    maxHeight: 52,
    paddingHorizontal:Theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.colors.border,
  },
  tabBarContent: {
    paddingHorizontal: Theme.spacing.sm,
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.radius.full,
    gap: Theme.spacing.xs,
  },
  tabActive: {
    backgroundColor: Theme.colors.accentDim,
  },
  tabIcon: {
    fontSize: 15,
  },
  tabLabel: {
    color: Theme.colors.textTertiary,
    fontSize: Theme.fontSize.sm,
    fontWeight: Theme.fontWeight.semiBold,
  },
  tabLabelActive: {
    color: Theme.colors.accent,
  },

  // ── Grid ─────────────────────────────────────────────────────────────
  grid: {
    flex: 1,
  },
  gridContent: {
    paddingBottom: Theme.spacing.xxxl,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  gridBtn: {
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.sm,
    gap: Theme.spacing.xs,
  },
  gridBtnIcon: {
    fontSize: 22,
  },
  gridBtnLabel: {
    color: Theme.colors.textPrimary,
    fontSize: Theme.fontSize.caption,
    fontWeight: Theme.fontWeight.semiBold,
    textAlign: 'center',
  },

  // ── Empty ─────────────────────────────────────────────────────────────
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  emptyGlyph: {
    fontSize: 40,
    color: Theme.colors.textTertiary,
  },
  emptyText: {
    color: Theme.colors.textSecondary,
    fontSize: Theme.fontSize.body,
    fontWeight: Theme.fontWeight.medium,
  },
});