/**
 * Media Controls Module
 *
 * Layout (top → bottom):
 *   Volume strip   — compact horizontal row
 *   Transport row  — prev / play / next (hero play button)
 *   Secondary row  — Stop · Fullscreen
 */

import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  Volume1,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Play,
  Square,
  Maximize,
} from 'lucide-react-native';

import { useConnectivity } from '../../src/contexts/ConnectivityContext';
import { MSG }             from '../../src/network/protocol';
import { Theme }           from '../../src/constants/theme';

type KeyName = string;

export default function MediaModule() {
  const { sendEvent } = useConnectivity();

  const sendKey = useCallback((key: KeyName) => {
    sendEvent(MSG.KEY_TAP, { key });
  }, [sendEvent]);

  return (
    <View style={styles.root}>

      {/* ── Volume strip ─────────────────────────────────────────────── */}
      <View style={styles.volumeStrip}>
        <VolumeBtn icon={Volume1} label="Vol −" onPress={() => sendKey('volume_down')} />
        <MuteBtn onPress={() => sendKey('volume_mute')} />
        <VolumeBtn icon={Volume2} label="Vol +" onPress={() => sendKey('volume_up')} />
      </View>

      {/* ── Transport ────────────────────────────────────────────────── */}
      <View style={styles.transport}>
        <SideBtn icon={SkipBack} onPress={() => sendKey('media_prev')} />
        <PlayBtn onPress={() => sendKey('media_play_pause')} />
        <SideBtn icon={SkipForward} onPress={() => sendKey('media_next')} />
      </View>

      {/* ── Secondary row ─────────────────────────────────────────────── */}
      <View style={styles.secondaryRow}>
        <SecondaryBtn icon={Square} label="Stop"       onPress={() => sendKey('media_stop')} />
        <SecondaryBtn icon={Maximize} label="Fullscreen" onPress={() => sendKey('f11')} />
      </View>

    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function VolumeBtn({ icon: Icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={volStyles.btn} onPress={onPress} activeOpacity={0.6}>
      <Icon size={20} color={Theme.colors.textSecondary} strokeWidth={2} />
      <Text style={volStyles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

function MuteBtn({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={[volStyles.btn, volStyles.muteBtn]} onPress={onPress} activeOpacity={0.6}>
      <VolumeX size={20} color={Theme.colors.textSecondary} strokeWidth={2} />
      <Text style={volStyles.label}>Mute</Text>
    </TouchableOpacity>
  );
}

function SideBtn({ icon: Icon, onPress }: { icon: any; onPress: () => void }) {
  return (
    <TouchableOpacity style={transportStyles.sideBtn} onPress={onPress} activeOpacity={0.6}>
      <Icon size={26} color={Theme.colors.textSecondary} strokeWidth={2} />
    </TouchableOpacity>
  );
}

function PlayBtn({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={transportStyles.playBtn} onPress={onPress} activeOpacity={0.7}>
      <Play size={44} color="#171717" fill="#171717" strokeWidth={0} />
    </TouchableOpacity>
  );
}

function SecondaryBtn({ icon: Icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={secStyles.btn} onPress={onPress} activeOpacity={0.6}>
      <Icon size={18} color={Theme.colors.textSecondary} strokeWidth={2} />
      <Text style={secStyles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
    paddingHorizontal: Theme.spacing.lg,
    gap: Theme.spacing.xl,
  },
  volumeStrip: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.lg,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
});

const volStyles = StyleSheet.create({
  btn: {
    flex: 1,
    height: 64,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  muteBtn: {
    flex: 0,
    width: 64,
  },
  label: {
    color: Theme.colors.textTertiary,
    fontSize: Theme.fontSize.micro,
    fontWeight: Theme.fontWeight.semiBold,
    letterSpacing: 0.3,
  },
});

const transportStyles = StyleSheet.create({
  sideBtn: {
    width: 72,
    height: 72,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.full,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBtn: {
    width: 112,
    height: 112,
    backgroundColor: Theme.colors.accent,
    borderRadius: Theme.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadow.accent,
  },
});

const secStyles = StyleSheet.create({
  btn: {
    flex: 1,
    height: 56,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  label: {
    color: Theme.colors.textSecondary,
    fontSize: Theme.fontSize.sm,
    fontWeight: Theme.fontWeight.semiBold,
  },
});