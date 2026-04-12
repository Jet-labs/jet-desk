/**
 * NavigationDrawer — Slide-out module selector for the Command Center.
 *
 * Supabase-styled dark overlay drawer with emerald-green active indicator.
 * Slides in from left, dimming the background. Handles back-press to close.
 *
 * Design tokens (from UI_GUIDELINES.md):
 *   - Overlay background: rgba(15, 15, 15, 0.60) (Glass Dark)
 *   - Drawer surface: #171717 (page bg)
 *   - Border: #2e2e2e (standard)
 *   - Active: green accent border rgba(62, 207, 142, 0.3)
 *   - Nav text: 14px, weight 500 (Nav Link rule)
 *   - No shadows — border-defined depth
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Pressable,
  StyleSheet,
  BackHandler,
  AccessibilityInfo,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Mouse, Music, Monitor, LayoutGrid, X, Power, Activity, AppWindow, Clipboard, Terminal as TerminalIcon, LucideIcon,
} from 'lucide-react-native';
import { Theme } from '../../constants/theme';

// ── Module definitions ───────────────────────────────────────────────────────

export interface NavModule {
  key: string;
  label: string;
  Icon: LucideIcon;
  description: string;
}

export const MODULES: NavModule[] = [
  { key: 'mouse',  label: 'Mouse & Keyboard', Icon: Mouse,      description: 'Trackpad, clicks, keyboard input' },
  { key: 'media',  label: 'Media Controls',   Icon: Music,      description: 'Volume, playback, transport' },
  { key: 'screen', label: 'Screen Mirror',    Icon: Monitor,    description: 'Live screen stream & cast' },
  { key: 'telemetry', label: 'System Monitor', Icon: Activity,  description: 'CPU, RAM, GPU, Network stats' },
  { key: 'apps',      label: 'App Switcher',   Icon: AppWindow, description: 'Windows, focus, minimize, close' },
  { key: 'clipboard', label: 'Clipboard Sync', Icon: Clipboard, description: 'Copy and paste text seamlessly' },
  { key: 'terminal',  label: 'Terminal',        Icon: TerminalIcon,  description: 'Run predefined commands' },
  { key: 'custom', label: 'Custom Remotes',   Icon: LayoutGrid, description: 'Shortcuts, presentations, system' },
  { key: 'power',  label: 'Power & Session',  Icon: Power,      description: 'Lock, Sleep, Restart, Shutdown' },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface NavigationDrawerProps {
  visible: boolean;
  activeModule: string;
  onSelect: (key: string) => void;
  onClose: () => void;
}

const DRAWER_WIDTH = 280;

export function NavigationDrawer({
  visible,
  activeModule,
  onSelect,
  onClose,
}: NavigationDrawerProps) {
  const insets    = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const isOpen    = useRef(false);

  // Animate open/close
  useEffect(() => {
    if (visible) {
      isOpen.current = true;
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 70,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: -DRAWER_WIDTH,
          tension: 70,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Mark as fully closed AFTER animation completes
        isOpen.current = false;
      });
    }
  }, [visible, slideAnim, fadeAnim]);

  // Handle Android back button — close drawer instead of navigating back
  useEffect(() => {
    if (!visible) return;

    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true; // Prevent default back behavior
    });

    return () => handler.remove();
  }, [visible, onClose]);

  // Announce drawer state for screen readers
  useEffect(() => {
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(
        visible ? 'Navigation drawer opened' : 'Navigation drawer closed'
      );
    }
  }, [visible]);

  const handleSelect = useCallback((key: string) => {
    onSelect(key);
    // onClose is called by the parent after navigation
  }, [onSelect]);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityViewIsModal={visible}
      importantForAccessibility={visible ? 'yes' : 'no-hide-descendants'}
    >
      {/* Scrim — tap to dismiss */}
      <Animated.View style={[styles.scrim, { opacity: fadeAnim }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close navigation"
        />
      </Animated.View>

      {/* Drawer panel */}
      <Animated.View
        style={[
          styles.drawer,
          {
            width: DRAWER_WIDTH,
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 12,
            transform: [{ translateX: slideAnim }],
          },
        ]}
        accessibilityRole="menu"
      >
        {/* Header */}
        <View style={styles.drawerHeader}>
          <View style={styles.drawerBrand}>
            <View style={styles.brandDot} />
            <Text style={styles.brandText}>JetDesk</Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
          >
            <X size={18} color={Theme.colors.textTertiary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Code label — Source Code Pro uppercase per design system */}
        <Text style={styles.sectionLabel}>MODULES</Text>

        {/* Nav items */}
        <ScrollView 
          style={{ flex: 1 }} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {MODULES.map(mod => {
            const isActive = activeModule === mod.key;
            return (
              <TouchableOpacity
                key={mod.key}
                style={[styles.navItem, isActive && styles.navItemActive]}
                onPress={() => handleSelect(mod.key)}
                activeOpacity={0.6}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`${mod.label}: ${mod.description}`}
              >
                <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
                  <mod.Icon
                    size={18}
                    color={isActive ? Theme.colors.accent : Theme.colors.textTertiary}
                    strokeWidth={isActive ? 2.2 : 1.8}
                  />
                </View>
                <View style={styles.navTextStack}>
                  <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                    {mod.label}
                  </Text>
                  <Text style={styles.navDesc}>{mod.description}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Footer */}
        <View style={styles.drawerFooter}>
          <Text style={styles.footerText}>v1.0.0</Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 15, 15, 0.60)',
  },

  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: '#171717',
    borderRightWidth: 1,
    borderRightColor: '#2e2e2e',
    paddingHorizontal: 12,
  },

  // ── Header ───────────────────────────────────────────────────────────
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2e2e2e',
    marginBottom: 16,
  },
  drawerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3ecf8e',
  },
  brandText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#fafafa',
    lineHeight: 18,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,    // Standard (6px) per border radius scale
    borderWidth: 1,
    borderColor: '#2e2e2e',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Section label (Code Label from design system) ────────────────────
  // Source Code Pro 12px, uppercase, letter-spacing 1.2px
  sectionLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#898989',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    marginBottom: 8,
  },

  // ── Nav items ────────────────────────────────────────────────────────
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,    // Comfortable (8px) per border radius scale
    marginBottom: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  navItemActive: {
    backgroundColor: 'rgba(62, 207, 142, 0.08)',   // accentDim
    borderColor: 'rgba(62, 207, 142, 0.3)',          // Green Accent (Level 3)
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1c1c1c',
    borderWidth: 1,
    borderColor: '#2e2e2e',     // Border Dark
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(62, 207, 142, 0.08)',
    borderColor: 'rgba(62, 207, 142, 0.3)',
  },
  navTextStack: {
    flex: 1,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '500',     // Weight 500 for nav links per typography rules
    color: '#b4b4b4',      // Light Gray (secondary)
    lineHeight: 20,
  },
  navLabelActive: {
    color: '#fafafa',      // Off White (primary)
  },
  navDesc: {
    fontSize: 12,
    fontWeight: '400',     // Weight 400 for body text
    color: '#4d4d4d',      // Dark Gray
    lineHeight: 16,
    marginTop: 1,
  },

  // ── Footer ──────────────────────────────────────────────────────────
  drawerFooter: {
    marginTop: 'auto',
    paddingHorizontal: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#242424',  // Dark Border (subtle)
  },
  footerText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#4d4d4d',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
