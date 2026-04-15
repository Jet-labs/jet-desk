import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';

import { useConnectivity }   from '../../../src/contexts/ConnectivityContext';
import { useDeviceStore }    from '../../../src/store/deviceStore';
import { BUILTIN_REMOTES, RemoteConfig, RemoteButton, CustomRemoteConfig } from '../../../src/constants/remotes';
import { Theme }             from '../../../src/constants/theme';
import { connectionManager } from '../../../src/network/ConnectionManager';
import { MSG }               from '../../../src/network/protocol';
import { ICON_MAP }          from '../../../src/constants/icons';

import { RemoteGrid }        from '../../../src/components/Remotes/RemoteGrid';
import { CustomHub }         from '../../../src/components/Remotes/CustomHub';

function renderIcon(iconName: string | undefined, size: number, color: string, style?: any) {
  if (!iconName) return null;
  const IconComponent = ICON_MAP[iconName];
  if (IconComponent) {
    return <IconComponent size={size} color={color} strokeWidth={2} style={style} />;
  }
  return <Text style={[style, { fontSize: size, color }]}>{iconName}</Text>;
}

const PRIMARY_TABS = [
  { id: 'media',        name: 'Media',        icon: 'Music' },
  { id: 'presentation', name: 'Presentation', icon: 'Presentation' },
  { id: 'system',       name: 'System',       icon: 'Settings' },
  { id: 'custom',       name: 'Custom',       icon: 'LayoutGrid' },
];

export default function CustomModule() {
  const router         = useRouter();
  const { sendEvent }  = useConnectivity();
  const devices        = useDeviceStore(s => s.devices);
  const activeDeviceId = useDeviceStore(s => s.activeDeviceId);
  const activeDevice   = devices.find(d => d.id === activeDeviceId);

  const [activeTabId, setActiveTabId]         = useState<string>(PRIMARY_TABS[0].id);
  const [customRemotes, setCustomRemotes]     = useState<RemoteConfig[]>([]);

  // Fetch custom remotes from daemon over TLS socket
  useEffect(() => {
    if (!activeDevice?.sessionToken || !activeDevice?.ip) return;
    
    const unsub = connectionManager.on('remote.config.pull.response', (msg) => {
      const data = msg.payload;
      if (Array.isArray(data.remotes)) {
        const mapped: RemoteConfig[] = (data.remotes as CustomRemoteConfig[])
          .map(r => ({ 
            id: r.id, 
            name: r.name, 
            icon: r.icon, 
            columns: r.columns, 
            buttons: r.buttons,
            enabled: r.enabled 
          }));
        setCustomRemotes(mapped);
      }
    });

    connectionManager.send('remote.config.pull', {});

    return () => unsub();
  }, [activeDevice?.ip, activeDevice?.sessionToken]);

  const handleButtonPress = useCallback((button: RemoteButton, remote: RemoteConfig) => {
    const isCustom = customRemotes.some(cr => cr.id === remote.id);
    if (isCustom) {
      connectionManager.send(MSG.REMOTE_ACTION, {
        remoteId: remote.id,
        actionId: button.action,
        value: JSON.stringify(button.payload),
      });
    } else {
      sendEvent(button.action, button.payload);
    }
  }, [sendEvent, customRemotes]);

  const handleToggleEnabled = useCallback((remote: RemoteConfig) => {
    // Optimistic UI could be done here, but let's just push and wait for refresh
    const updated = { ...remote, enabled: !remote.enabled };
    connectionManager.send('remote.config.push', updated);
  }, []);

  const activeRemote = useMemo(() => {
    if (activeTabId !== 'custom') {
      return BUILTIN_REMOTES.find(r => r.id === activeTabId);
    }
    return null;
  }, [activeTabId]);

  return (
    <View style={styles.root}>

      {/* ── Tab Bar ─────────────────────────────────────────────────── */}
      <View style={styles.tabBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabBar}
          contentContainerStyle={styles.tabBarContent}
        >
          {PRIMARY_TABS.map(tab => {
            const isActive = activeTabId === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => {
                  setActiveTabId(tab.id);
                }}
                activeOpacity={0.7}
              >
                {renderIcon(tab.icon, 16, isActive ? Theme.colors.accent : Theme.colors.textTertiary, styles.tabIcon)}
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Content View ────────────────────────────────────────────── */}
      <View style={styles.content}>
        {activeTabId === 'custom' ? (
          <CustomHub
            customRemotes={customRemotes}
            onToggleEnabled={handleToggleEnabled}
            onCreateNew={() => router.push('/remote/custom/new' as any)}
          />
        ) : activeRemote ? (
          <ScrollView
            style={styles.gridContainer}
            contentContainerStyle={styles.gridContent}
            showsVerticalScrollIndicator={false}
          >
            <RemoteGrid 
              remote={activeRemote}
              onButtonPress={(btn) => handleButtonPress(btn, activeRemote)}
            />
          </ScrollView>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyGlyph}>◈</Text>
            <Text style={styles.emptyText}>Select a category</Text>
          </View>
        )}
      </View>
      
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  tabBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabBar: {
    flex: 1,
  },
  tabBarContent: {
    paddingHorizontal: Theme.spacing.md,
    paddingTop: Theme.spacing.md,
    alignItems: 'center',
    gap: Theme.spacing.sm,
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
  content: {
    flex: 1,
    marginTop: Theme.spacing.md,
  },
  gridContainer: {
    flex: 1,
  },
  gridContent: {
    padding: Theme.spacing.md,
    paddingBottom: Theme.spacing.xxxl,
  },
  backBtn: {
    marginBottom: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
  },
  backBtnText: {
    color: Theme.colors.accent,
    fontSize: Theme.fontSize.sm,
    fontWeight: Theme.fontWeight.medium,
  },
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