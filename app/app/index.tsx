/**
 * Discovery Hub — Home screen
 *
 * Visual hierarchy:
 *   1. Wordmark + tagline (brand anchor)
 *   2. QR scan — primary hero action
 *   3. Manual IP — secondary input
 *   4. Nearby / Saved device lists
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Keyboard,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Command, QrCode, Radio, Monitor, CircleDot, ChevronRight, ArrowRight } from 'lucide-react-native';

import { useDeviceStore, SavedDevice } from '../src/store/deviceStore';
import { useConnectivity } from '../src/contexts/ConnectivityContext';
import { Theme } from '../src/constants/theme';

export default function DiscoveryHub() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();

  const [manualIp, setManualIp]               = useState('');
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [refreshing, setRefreshing]           = useState(false);

  const { discoveredDevices, status, connect, retryScan } = useConnectivity();
  const { devices, loadDevices, setActiveDevice, removeDevice } = useDeviceStore();

  useEffect(() => { loadDevices(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    retryScan();
    loadDevices();
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, [retryScan, loadDevices]);

  useFocusEffect(useCallback(() => {
    setConnectingDeviceId(null);
  }, []));

  useEffect(() => {
    if (status === 'connected') {
      setConnectingDeviceId(null);
      router.push('/remote' as any);
    }
    if (status === 'error') setConnectingDeviceId(null);
  }, [status]);

  const handleSavedDeviceTap = useCallback((device: SavedDevice) => {
    setActiveDevice(device.id);
    setConnectingDeviceId(device.id);
    connect(device.id);
  }, [connect, setActiveDevice]);

  const handleSavedDeviceLongPress = useCallback((device: SavedDevice) => {
    Alert.alert(
      'Remove Device',
      `Forget "${device.hostname}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeDevice(device.id) },
      ]
    );
  }, [removeDevice]);

  const handleDiscoveredDeviceTap = useCallback((service: any) => {
    const txt         = service.txt || {};
    const fingerprint = txt.fingerprint || txt.fp;
    const ip          = txt.ip || service.addresses?.[0];
    const hostname    = txt.hostname || service.name;

    if (ip && fingerprint) {
      router.push({ pathname: '/pair', params: { ip, fingerprint, hostname: hostname || 'Unknown PC' } });
    } else {
      Alert.alert('Connection Error', 'Device did not broadcast valid parameters.');
    }
  }, [router]);

  const handleManualConnect = useCallback(() => {
    const ip = manualIp.trim();
    if (!ip) return;
    Keyboard.dismiss();
    router.push({ pathname: '/pair', params: { ip, fingerprint: '', hostname: ip, manual: 'true' } });
  }, [manualIp, router]);

  const isConnecting = status === 'connecting' || status === 'authenticating' || status === 'reconnecting';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* ── Global connection status banner ─────────────────────────── */}
      {isConnecting && (
        <View style={styles.statusBanner}>
          <ActivityIndicator size="small" color={Theme.colors.accent} />
          <Text style={styles.statusBannerText}>
            {status === 'connecting'    ? 'Connecting…'    :
             status === 'authenticating'? 'Authenticating…' :
             'Reconnecting…'}
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Theme.spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Theme.colors.accent}
            colors={[Theme.colors.accent]}
          />
        }
      >

        {/* ── Wordmark ───────────────────────────────────────────────── */}
        <View style={styles.wordmarkRow}>
          <View style={styles.logoMark}>
            <Command size={22} color="#FFFFFF" strokeWidth={2.5} />
          </View>
          <View>
            <Text style={styles.appName}>JetDesk</Text>
            <Text style={styles.appTagline}>Remote control for your PC</Text>
          </View>
        </View>

        {/* ── QR hero action ─────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.scanHero}
          onPress={() => router.push('/scanner')}
          activeOpacity={0.7}
        >
          <View style={styles.scanHeroContent}>
            <View style={styles.scanIconWrap}>
              <QrCode size={26} color={Theme.colors.accent} strokeWidth={2} />
            </View>
            <View style={styles.scanTextCol}>
              <Text style={styles.scanTitle}>Scan QR Code</Text>
              <Text style={styles.scanSub}>Fastest way to connect</Text>
            </View>
            <ChevronRight size={22} color={Theme.colors.accent} strokeWidth={2} />
          </View>
          {/* Accent line at top */}
          <View style={styles.scanAccentLine} />
        </TouchableOpacity>

        {/* ── Manual IP row ──────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MANUAL IP</Text>
          <View style={styles.ipRow}>
            <TextInput
              style={styles.ipInput}
              placeholder="192.168.1.x"
              placeholderTextColor={Theme.colors.textTertiary}
              value={manualIp}
              onChangeText={setManualIp}
              keyboardType="numeric"
              returnKeyType="go"
              onSubmitEditing={handleManualConnect}
              autoCorrect={false}
              selectionColor={Theme.colors.accent}
            />
            <TouchableOpacity
              style={[styles.goBtn, !manualIp.trim() && styles.goBtnDisabled]}
              onPress={handleManualConnect}
              disabled={!manualIp.trim()}
              activeOpacity={0.7}
            >
              <ArrowRight size={20} color="#FFF" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Nearby devices ─────────────────────────────────────────── */}
        {discoveredDevices.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>NEARBY</Text>
            <View style={styles.deviceList}>
              {discoveredDevices.map((service, idx) => (
                <TouchableOpacity
                  key={service.fullName || idx}
                  style={styles.deviceCard}
                  onPress={() => handleDiscoveredDeviceTap(service)}
                  activeOpacity={0.65}
                >
                  <View style={styles.deviceIconCell}>
                    <Radio size={18} color={Theme.colors.textSecondary} strokeWidth={2} />
                  </View>
                  <View style={styles.deviceTextCol}>
                    <Text style={styles.deviceName}>{service.name || 'JetDesk PC'}</Text>
                    <Text style={styles.deviceIp}>{service.addresses?.[0] || ''}</Text>
                  </View>
                  <View style={styles.nearbyBadge}>
                    <Text style={styles.nearbyBadgeText}>nearby</Text>
                  </View>
                  <ChevronRight size={18} color={Theme.colors.textTertiary} strokeWidth={2} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Saved devices ──────────────────────────────────────────── */}
        {devices.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SAVED</Text>
            <View style={styles.deviceList}>
              {devices.map(device => (
                <TouchableOpacity
                  key={device.id}
                  style={styles.deviceCard}
                  onPress={() => handleSavedDeviceTap(device)}
                  onLongPress={() => handleSavedDeviceLongPress(device)}
                  disabled={connectingDeviceId === device.id}
                  activeOpacity={0.65}
                >
                  <View style={styles.deviceIconCell}>
                    <Monitor size={18} color={Theme.colors.textSecondary} strokeWidth={2} />
                  </View>
                  <View style={styles.deviceTextCol}>
                    <Text style={styles.deviceName}>{device.hostname}</Text>
                    <Text style={styles.deviceIp}>{device.ip}</Text>
                  </View>
                  {connectingDeviceId === device.id ? (
                    <ActivityIndicator size="small" color={Theme.colors.accent} />
                  ) : (
                    <ChevronRight size={18} color={Theme.colors.textTertiary} strokeWidth={2} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Empty state ─────────────────────────────────────────────── */}
        {devices.length === 0 && discoveredDevices.length === 0 && (
          <View style={styles.emptyState}>
            <CircleDot size={48} color={Theme.colors.textTertiary} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No devices found</Text>
            <Text style={styles.emptyBody}>
              Scan a QR code from the JetDesk desktop app,{'\n'}
              enter an IP address, or wait for nearby PCs.
            </Text>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },

  // ── Status banner ───────────────────────────────────────────────────
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    paddingVertical: Theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.colors.border,
    backgroundColor: Theme.colors.surface,
  },
  statusBannerText: {
    color: Theme.colors.accent,
    fontSize: Theme.fontSize.sm,
    fontWeight: Theme.fontWeight.semiBold,
  },

  // ── Scroll ──────────────────────────────────────────────────────────
  scroll: {
    paddingHorizontal: Theme.spacing.md,
  },

  // ── Wordmark ─────────────────────────────────────────────────────────
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm + 4,
    marginTop: Theme.spacing.xl,
    marginBottom: Theme.spacing.xl,
  },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: Theme.radius.sm + 2,
    backgroundColor: Theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoGlyph: {
    color: '#FFFFFF',
    fontSize: 22,
  },
  appName: {
    color: Theme.colors.textPrimary,
    fontSize: Theme.fontSize.h2,
    fontWeight: Theme.fontWeight.bold,
    letterSpacing: -0.5,
  },
  appTagline: {
    color: Theme.colors.textTertiary,
    fontSize: Theme.fontSize.caption,
    fontWeight: Theme.fontWeight.medium,
    marginTop: 1,
  },

  // ── QR hero ──────────────────────────────────────────────────────────
  scanHero: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.xl,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: Theme.spacing.lg,
    overflow: 'hidden',
  },
  scanAccentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Theme.colors.accent,
  },
  scanHeroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md + 4,
    gap: Theme.spacing.md,
  },
  scanIconWrap: {
    width: 52,
    height: 52,
    borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.accentDim,
    borderWidth: 1,
    borderColor: Theme.colors.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanIconGlyph: {
    fontSize: 26,
    color: Theme.colors.accent,
  },
  scanTextCol: {
    flex: 1,
  },
  scanTitle: {
    color: Theme.colors.textPrimary,
    fontSize: Theme.fontSize.body,
    fontWeight: Theme.fontWeight.semiBold,
  },
  scanSub: {
    color: Theme.colors.textTertiary,
    fontSize: Theme.fontSize.sm,
    marginTop: 2,
  },
  scanChevron: {
    color: Theme.colors.accent,
    fontSize: 22,
    fontWeight: Theme.fontWeight.regular,
  },

  // ── Section ──────────────────────────────────────────────────────────
  section: {
    marginBottom: Theme.spacing.lg,
  },
  sectionLabel: {
    color: Theme.colors.textTertiary,
    fontSize: Theme.fontSize.micro,
    fontWeight: Theme.fontWeight.bold,
    letterSpacing: 1.5,
    marginBottom: Theme.spacing.sm,
  },

  // ── IP input ─────────────────────────────────────────────────────────
  ipRow: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  ipInput: {
    flex: 1,
    height: 52,
    backgroundColor: Theme.colors.surfaceElevated,
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
    color: Theme.colors.textPrimary,
    fontSize: Theme.fontSize.body,
    fontWeight: Theme.fontWeight.medium,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  goBtn: {
    width: 52,
    height: 52,
    borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadow.accent,
  },
  goBtnDisabled: {
    opacity: 0.3,
    shadowOpacity: 0,
    elevation: 0,
  },
  goBtnText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: Theme.fontWeight.bold,
  },

  // ── Device list ───────────────────────────────────────────────────────
  deviceList: {
    gap: Theme.spacing.xs,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm + 4,
    gap: Theme.spacing.sm + 4,
  },
  deviceIconCell: {
    width: 40,
    height: 40,
    borderRadius: Theme.radius.sm,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceIconGlyph: {
    fontSize: 18,
  },
  deviceTextCol: {
    flex: 1,
  },
  deviceName: {
    color: Theme.colors.textPrimary,
    fontSize: Theme.fontSize.body,
    fontWeight: Theme.fontWeight.semiBold,
    letterSpacing: -0.1,
  },
  deviceIp: {
    color: Theme.colors.textTertiary,
    fontSize: Theme.fontSize.sm,
    fontWeight: Theme.fontWeight.regular,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  nearbyBadge: {
    backgroundColor: Theme.colors.successDim,
    borderRadius: Theme.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(5, 163, 87, 0.25)',
  },
  nearbyBadgeText: {
    color: Theme.colors.success,
    fontSize: Theme.fontSize.micro,
    fontWeight: Theme.fontWeight.bold,
    letterSpacing: 0.5,
  },
  chevron: {
    color: Theme.colors.textTertiary,
    fontSize: 22,
    fontWeight: Theme.fontWeight.regular,
  },

  // ── Empty state ──────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.xxl + Theme.spacing.lg,
  },
  emptyGlyph: {
    color: Theme.colors.textTertiary,
    fontSize: 48,
    marginBottom: Theme.spacing.md,
  },
  emptyTitle: {
    color: Theme.colors.textSecondary,
    fontSize: Theme.fontSize.h3,
    fontWeight: Theme.fontWeight.semiBold,
    marginBottom: Theme.spacing.sm,
  },
  emptyBody: {
    color: Theme.colors.textTertiary,
    fontSize: Theme.fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
});