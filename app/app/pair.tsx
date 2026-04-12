/**
 * Pair Screen — PIN entry for device pairing
 *
 * Modes:
 *   QR scan (PIN included) → auto-pairs immediately
 *   Manual / no PIN        → shows 6-digit PIN input
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Monitor } from 'lucide-react-native';

import { useDeviceStore } from '../src/store/deviceStore';
import { useConnectivity } from '../src/contexts/ConnectivityContext';
import { Theme } from '../src/constants/theme';

export default function PairScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    ip: string;
    fingerprint: string;
    hostname: string;
    pin?: string;
    manual?: string;
  }>();

  const [pin, setPin]             = useState('');
  const [isPairing, setIsPairing] = useState(false);
  const [autoPairing, setAutoPairing] = useState(false);
  const didConnect   = useRef(false);
  const didAutoPair  = useRef(false);

  const { connect, pair, status, challengeReady } = useConnectivity();
  const { addDevice, setActiveDevice }            = useDeviceStore();

  const { ip, fingerprint, hostname } = params;
  const qrPin = params.pin;

  // Auto-connect on mount (once)
  useEffect(() => {
    if (ip && fingerprint && !didConnect.current) {
      didConnect.current = true;
      const deviceId = fingerprint;
      addDevice({ id: deviceId, hostname: hostname || 'Unknown PC', ip, pin: '', certFingerprint: fingerprint });
      setActiveDevice(deviceId);
      setTimeout(() => connect(deviceId), 300);
    }
  }, [ip, fingerprint]);

  // Auto-pair when QR includes PIN and challenge is ready
  useEffect(() => {
    if (qrPin && challengeReady && !didAutoPair.current && !isPairing) {
      didAutoPair.current = true;
      setAutoPairing(true);
      handleAutoPair(qrPin);
    }
  }, [qrPin, challengeReady]);

  // Navigate on success
  useEffect(() => {
    if (status === 'connected') router.replace('/remote' as any);
  }, [status]);

  const handleAutoPair = async (autoPin: string) => {
    setIsPairing(true);
    try {
      await pair({ deviceId: fingerprint, deviceName: `Phone-${Date.now().toString(36)}`, pin: autoPin });
      useDeviceStore.getState().updateDevice(fingerprint, { pin: autoPin });
    } catch (error: any) {
      const reason = typeof error === 'string' ? error : error?.message || 'Pairing failed';
      setAutoPairing(false);
      didAutoPair.current = false;
      Alert.alert('Auto-pair Failed', reason + '\nPlease enter the PIN manually.');
    } finally {
      setIsPairing(false);
    }
  };

  const handlePair = async () => {
    if (pin.length < 6) {
      Alert.alert('Invalid PIN', 'Please enter the 6-digit PIN from your PC screen.');
      return;
    }
    if (!challengeReady) {
      Alert.alert('Not Ready', 'Waiting for connection to PC. Please wait…');
      return;
    }
    setIsPairing(true);
    try {
      await pair({ deviceId: fingerprint, deviceName: `Phone-${Date.now().toString(36)}`, pin });
      useDeviceStore.getState().updateDevice(fingerprint, { pin });
    } catch (error: any) {
      const reason = typeof error === 'string' ? error : error?.message || 'Pairing failed';
      Alert.alert('Pairing Failed', reason);
    } finally {
      setIsPairing(false);
    }
  };

  // ── Auto-pair loading state ─────────────────────────────────────────
  if (autoPairing) {
    return (
      <View style={styles.autoPairRoot}>
        <ActivityIndicator color={Theme.colors.accent} size="large" />
        <Text style={styles.autoPairTitle}>Pairing…</Text>
        <Text style={styles.autoPairSub}>{hostname || ip}</Text>
      </View>
    );
  }

  // ── Status indicator color ─────────────────────────────────────────
  const dotColor =
    challengeReady || status === 'authenticating' ? Theme.colors.success :
    status === 'connecting'                        ? Theme.colors.warning :
    Theme.colors.textTertiary;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.content, { paddingTop: insets.top + 16 }]}>

        {/* Close */}
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <X size={16} color={Theme.colors.textSecondary} strokeWidth={2.5} />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Enter PIN</Text>
          <Text style={styles.subtitle}>Type the 6-digit code shown on your PC screen</Text>
        </View>

        {/* Device card */}
        <View style={styles.deviceCard}>
          <View style={styles.deviceIconCell}>
            <Monitor size={22} color={Theme.colors.textSecondary} strokeWidth={2} />
          </View>
          <View style={styles.deviceTextCol}>
            <Text style={styles.deviceName}>{hostname || 'Unknown PC'}</Text>
            <Text style={styles.deviceIp}>{ip || ''}</Text>
          </View>
          <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
        </View>

        {/* PIN input */}
        <View style={styles.pinWrap}>
          <TextInput
            style={styles.pinInput}
            placeholder="· · · · · ·"
            placeholderTextColor={Theme.colors.textTertiary}
            keyboardType="number-pad"
            maxLength={6}
            value={pin}
            onChangeText={setPin}
            autoFocus
            textAlign="center"
            editable={!isPairing}
            selectionColor={Theme.colors.accent}
          />
        </View>

        {/* Connect button */}
        <TouchableOpacity
          style={[styles.connectBtn, (pin.length < 6 || isPairing) && styles.connectBtnDisabled]}
          onPress={handlePair}
          disabled={pin.length < 6 || isPairing}
          activeOpacity={0.8}
        >
          {isPairing
            ? <ActivityIndicator color="#FFF" />
            : <Text style={styles.connectBtnText}>Connect</Text>
          }
        </TouchableOpacity>

        {/* Status hints */}
        {status === 'connecting'                 && <Text style={styles.hint}>Establishing connection…</Text>}
        {status === 'authenticating' && !challengeReady && <Text style={styles.hint}>Waiting for handshake…</Text>}
        {challengeReady              && <Text style={[styles.hint, styles.hintSuccess]}>Ready — enter the PIN</Text>}
        {status === 'error'          && <Text style={[styles.hint, styles.hintError]}>Connection error. Check IP and try again.</Text>}

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  autoPairRoot: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  autoPairTitle: {
    color: Theme.colors.textPrimary,
    fontSize: Theme.fontSize.h2,
    fontWeight: Theme.fontWeight.bold,
  },
  autoPairSub: {
    color: Theme.colors.textSecondary,
    fontSize: Theme.fontSize.body,
  },

  content: {
    flex: 1,
    paddingHorizontal: Theme.spacing.md,
  },

  // Close
  closeBtn: {
    alignSelf: 'flex-end',
    width: 40,
    height: 40,
    borderRadius: Theme.radius.full,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  closeGlyph: {
    color: Theme.colors.textSecondary,
    fontSize: 16,
    fontWeight: Theme.fontWeight.bold,
  },

  // Header
  header: {
    marginBottom: Theme.spacing.xl,
  },
  title: {
    color: Theme.colors.textPrimary,
    fontSize: Theme.fontSize.h1,
    fontWeight: Theme.fontWeight.extraBold,
    letterSpacing: -0.5,
    marginBottom: Theme.spacing.sm,
  },
  subtitle: {
    color: Theme.colors.textSecondary,
    fontSize: Theme.fontSize.body,
    lineHeight: 22,
  },

  // Device card
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.xl,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    gap: Theme.spacing.md,
  },
  deviceIconCell: {
    width: 44,
    height: 44,
    borderRadius: Theme.radius.sm,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceEmoji: {
    fontSize: 22,
  },
  deviceTextCol: {
    flex: 1,
  },
  deviceName: {
    color: Theme.colors.textPrimary,
    fontSize: Theme.fontSize.body,
    fontWeight: Theme.fontWeight.semiBold,
  },
  deviceIp: {
    color: Theme.colors.textTertiary,
    fontSize: Theme.fontSize.sm,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // PIN
  pinWrap: {
    marginBottom: Theme.spacing.lg,
  },
  pinInput: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    height: 80,
    fontSize: 40,
    fontWeight: Theme.fontWeight.bold,
    letterSpacing: 14,
    color: Theme.colors.accent,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: Theme.spacing.md,
  },

  // Connect button
  connectBtn: {
    backgroundColor: Theme.colors.accent,
    height: 56,
    borderRadius: Theme.radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
    ...Theme.shadow.accent,
  },
  connectBtnDisabled: {
    opacity: 0.3,
    shadowOpacity: 0,
    elevation: 0,
  },
  connectBtnText: {
    color: '#FFF',
    fontSize: Theme.fontSize.body,
    fontWeight: Theme.fontWeight.bold,
  },

  // Status hints
  hint: {
    color: Theme.colors.textSecondary,
    fontSize: Theme.fontSize.sm,
    textAlign: 'center',
    fontWeight: Theme.fontWeight.medium,
  },
  hintSuccess: {
    color: Theme.colors.success,
  },
  hintError: {
    color: Theme.colors.error,
  },
});