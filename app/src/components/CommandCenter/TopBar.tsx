/**
 * TopBar — Command Center header
 *
 * Shows hamburger menu, connected device name, live status dot,
 * and disconnect control. Follows Supabase design system.
 *
 * Design tokens (from UI_GUIDELINES.md):
 *   - Background: #171717 (page bg)
 *   - Border: #2e2e2e (standard)
 *   - Text: #fafafa primary, #898989 muted
 *   - Label: 12px uppercase, letter-spacing 1.2px (Code Label)
 *   - Buttons: 6px radius (Ghost Button), border #2e2e2e
 *   - No shadows
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Menu, LogOut } from 'lucide-react-native';
import { Theme } from '../../constants/theme';

interface TopBarProps {
  deviceName: string;
  onDisconnect: () => void;
  onMenuPress?: () => void;
  activeModuleLabel?: string;
}

export function TopBar({ deviceName, onDisconnect, onMenuPress, activeModuleLabel }: TopBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.inner}>
        {/* Left: Hamburger + Status + Device */}
        <View style={styles.left}>
          {onMenuPress && (
            <TouchableOpacity
              style={styles.menuBtn}
              onPress={onMenuPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.6}
            >
              <Menu size={20} color="#fafafa" strokeWidth={2} />
            </TouchableOpacity>
          )}
          <View style={styles.statusBadge}>
            <View style={styles.statusPulse} />
            <View style={styles.statusDot} />
          </View>
          <View style={styles.textStack}>
            <Text style={styles.label}>
              {activeModuleLabel ? activeModuleLabel.toUpperCase() : 'CONNECTED TO'}
            </Text>
            <Text style={styles.deviceName} numberOfLines={1}>
              {deviceName}
            </Text>
          </View>
        </View>

        {/* Right: Disconnect */}
        <TouchableOpacity
          style={styles.disconnectBtn}
          onPress={onDisconnect}
          hitSlop={{ top: 12, bottom: 12, left: 16, right: 12 }}
          activeOpacity={0.6}
        >
          <LogOut size={18} color={Theme.colors.textTertiary} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#171717',
    borderBottomWidth: 1,
    borderBottomColor: '#2e2e2e',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm + 2,
    minHeight: 56,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },

  // ── Hamburger ──────────────────────────────────────────────────────
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#1c1c1c',
    borderWidth: 1,
    borderColor: '#2e2e2e',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Status indicator ─────────────────────────────────────────────────
  statusBadge: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusPulse: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(62, 207, 142, 0.12)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3ecf8e',
  },

  // ── Text (Code Label pattern) ────────────────────────────────────────
  textStack: {
    flex: 1,
  },
  label: {
    color: '#898989',
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  deviceName: {
    color: '#fafafa',
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: -0.16,
  },

  // ── Disconnect (Ghost Button pattern) ────────────────────────────────
  disconnectBtn: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#1c1c1c',
    borderWidth: 1,
    borderColor: '#2e2e2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Theme.spacing.md,
  },
});