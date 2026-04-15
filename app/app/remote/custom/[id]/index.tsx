import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Settings, Edit3, Trash2, ArrowLeft, ChevronLeft } from 'lucide-react-native';

import { useConnectivity } from '../../../../src/contexts/ConnectivityContext';
import { useDeviceStore } from '../../../../src/store/deviceStore';
import { RemoteConfig, RemoteButton, CustomRemoteConfig } from '../../../../src/constants/remotes';
import { Theme } from '../../../../src/constants/theme';
import { connectionManager } from '../../../../src/network/ConnectionManager';
import { MSG } from '../../../../src/network/protocol';
import { RemoteGrid } from '../../../../src/components/Remotes/RemoteGrid';

export default function CustomRemoteView() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sendEvent } = useConnectivity();
  
  const devices = useDeviceStore(s => s.devices);
  const activeDeviceId = useDeviceStore(s => s.activeDeviceId);
  const activeDevice = devices.find(d => d.id === activeDeviceId);

  const [remote, setRemote] = useState<RemoteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // Fetch specific remote config
  const fetchRemote = useCallback(() => {
    if (!activeDevice?.ip) return;
    
    const unsub = connectionManager.on('remote.config.pull.response', (msg) => {
      const data = msg.payload;
      if (Array.isArray(data.remotes)) {
        const found = (data.remotes as CustomRemoteConfig[]).find(r => r.id === id);
        if (found) {
          setRemote({
            id: found.id,
            name: found.name,
            icon: found.icon,
            columns: found.columns,
            buttons: found.buttons,
          });
        }
      }
      setLoading(false);
    });

    connectionManager.send('remote.config.pull', {});
    return () => unsub();
  }, [id, activeDevice?.ip]);

  useEffect(() => {
    const unsub = fetchRemote();
    return () => unsub?.();
  }, [fetchRemote]);

  const handleButtonPress = useCallback((button: RemoteButton) => {
    if (!remote) return;
    connectionManager.send(MSG.REMOTE_ACTION, {
      remoteId: remote.id,
      actionId: button.action,
      value: JSON.stringify(button.payload),
    });
  }, [remote]);

  const handleDelete = () => {
    Alert.alert(
      'Delete Remote',
      `Are you sure you want to delete "${remote?.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
             connectionManager.send('remote.config.delete', { id });
             router.back();
          }
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Theme.colors.accent} />
      </View>
    );
  }

  if (!remote) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Remote not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerInner}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={styles.iconBtn}
            activeOpacity={0.6}
          >
            <ChevronLeft size={20} color={Theme.colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
          
          <View style={styles.headerTextStack}>
            <Text style={styles.headerLabel}>CUSTOM REMOTE</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>{remote.name}</Text>
          </View>

          <TouchableOpacity 
              onPress={() => setShowSettings(!showSettings)} 
              style={[styles.iconBtn, showSettings && styles.iconBtnActive]}
              activeOpacity={0.6}
          >
            <Settings size={18} color={showSettings ? Theme.colors.accent : Theme.colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Settings Dropdown/Overlay */}
      {showSettings && (
        <View style={styles.settingsMenu}>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => {
                setShowSettings(false);
                router.push(`/remote/custom/${id}/edit` as any);
            }}
          >
            <Edit3 size={18} color={Theme.colors.textSecondary} />
            <Text style={styles.menuItemText}>Edit Remote</Text>
          </TouchableOpacity>
          <View style={styles.menuDivider} />
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => {
                setShowSettings(false);
                handleDelete();
            }}
          >
            <Trash2 size={18} color={Theme.colors.error} />
            <Text style={[styles.menuItemText, { color: Theme.colors.error }]}>Delete Remote</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <RemoteGrid remote={remote} onButtonPress={handleButtonPress} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
  },
  header: {
    backgroundColor: '#171717',
    borderBottomWidth: 1,
    borderBottomColor: '#2e2e2e',
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm + 2,
    minHeight: 56,
    gap: 12,
  },
  headerTextStack: {
    flex: 1,
  },
  headerLabel: {
    color: '#898989',
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headerTitle: {
    color: '#fafafa',
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: -0.16,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#1c1c1c',
    borderWidth: 1,
    borderColor: '#2e2e2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnActive: {
    borderColor: Theme.colors.accent,
    backgroundColor: Theme.colors.accentDim,
  },
  settingsMenu: {
    position: 'absolute',
    top: 60, // below header
    right: Theme.spacing.md,
    width: 200,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    zIndex: 100,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  menuItemText: {
    color: Theme.colors.textPrimary,
    fontSize: Theme.fontSize.sm,
    fontWeight: Theme.fontWeight.medium,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Theme.colors.borderLight,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: Theme.spacing.md,
    paddingBottom: Theme.spacing.xxxl,
  },
  errorText: {
    color: Theme.colors.textSecondary,
    fontSize: Theme.fontSize.body,
    marginBottom: Theme.spacing.md,
  },
  backBtn: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    backgroundColor: Theme.colors.accent,
    borderRadius: Theme.radius.md,
  },
  backBtnText: {
    color: Theme.colors.background,
    fontWeight: Theme.fontWeight.semiBold,
  },
});
