import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronLeft } from 'lucide-react-native';

import { Theme } from '../../../../src/constants/theme';
import { useDeviceStore } from '../../../../src/store/deviceStore';
import { CustomRemoteConfig } from '../../../../src/constants/remotes';
import { connectionManager } from '../../../../src/network/ConnectionManager';
import { CustomRemoteUpdationForm } from '../../../../src/components/Remotes/CustomRemoteUpdationForm';

export default function RemoteEditor() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const devices = useDeviceStore((s) => s.devices);
  const activeDeviceId = useDeviceStore((s) => s.activeDeviceId);
  const activeDevice = devices.find((d) => d.id === activeDeviceId);

  const [remote, setRemote] = useState<CustomRemoteConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = connectionManager.on('remote.config.pull.response', (msg) => {
      const data = msg.payload;
      const found = data.remotes?.find((r: CustomRemoteConfig) => r.id === id);
      if (found) setRemote(found);
      setLoading(false);
    });

    const fetchRemote = () => {
      if (!activeDevice?.ip || !activeDevice?.sessionToken) return;
      setLoading(true);
      connectionManager.send('remote.config.pull', {});
    };

    fetchRemote();

    return () => unsub();
  }, [id, activeDevice?.sessionToken]);

  if (loading || !remote) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Theme.colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerInner}>
          <TouchableOpacity 
            style={styles.iconBtn} 
            onPress={() => router.back()} 
            activeOpacity={0.6}
          >
            <ChevronLeft size={20} color={Theme.colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
          
          <View style={styles.headerTextStack}>
            <Text style={styles.headerLabel}>EDITOR</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>Edit "{remote.name}"</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        
        {/* Core Update Form encapsulating metadata and canvas */}
        <CustomRemoteUpdationForm initialRemote={remote} />

        {/* Destructive Action Zone */}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  root: {
    flex: 1,
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
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingBottom: 100,
  },
});
