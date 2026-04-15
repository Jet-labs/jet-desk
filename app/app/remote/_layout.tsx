/**
 * Command Center Layout — Hidden Tabs + Hamburger Drawer
 *
 * Uses expo-router <Tabs> for correct route resolution and flat
 * peer navigation, but renders NO bottom tab bar. Instead, a
 * hamburger drawer in the TopBar handles module switching.
 *
 * Why Tabs and not Stack?
 *   - Tabs treats modules as peers (no push/pop stacking)
 *   - Auto-selects the first screen (no blank screen)
 *   - Handles route resolution and history correctly
 *   - Back button returns to discovery, not through module history
 *
 * Design: Supabase dark mode (UI_GUIDELINES.md)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConnectivity } from '../../src/contexts/ConnectivityContext';
import { useDeviceStore } from '../../src/store/deviceStore';
import { TopBar } from '../../src/components/CommandCenter/TopBar';
import { NavigationDrawer, MODULES } from '../../src/components/CommandCenter/NavigationDrawer';
import { Theme } from '../../src/constants/theme';

export default function CommandCenterLayout() {
  const router   = useRouter();
  const pathname = usePathname();
  const insets   = useSafeAreaInsets();
  const { status, disconnect } = useConnectivity();
  const devices        = useDeviceStore(s => s.devices);
  const activeDeviceId = useDeviceStore(s => s.activeDeviceId);
  const activeDevice   = devices.find(d => d.id === activeDeviceId);

  const [drawerOpen, setDrawerOpen] = useState(false);

  // Derive active module from current pathname
  const activeModule = MODULES.find(m => pathname.includes(m.key))?.key || 'mouse';
  const activeLabel  = MODULES.find(m => m.key === activeModule)?.label || 'Mouse & Keyboard';

  // Auto-redirect on disconnect
  useEffect(() => {
    if (status === 'disconnected' || status === 'error') {
      const t = setTimeout(() => router.replace('/'), 500);
      return () => clearTimeout(t);
    }
  }, [status]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    router.replace('/');
  }, [disconnect, router]);

  const handleModuleSelect = useCallback((key: string) => {
    setDrawerOpen(false);
    if (key !== activeModule) {
      // Small delay to let drawer close animation start before navigation
      setTimeout(() => router.replace(`/remote/${key}` as any), 50);
    }
  }, [activeModule, router]);

  const openDrawer  = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const isIndividualRemote = pathname.split('/').length > 3 && pathname.includes('/remote/custom/');

  return (
    <View style={styles.root}>
      {!isIndividualRemote && (
        <TopBar
          deviceName={activeDevice?.hostname || 'Connected'}
          onDisconnect={handleDisconnect}
          onMenuPress={openDrawer}
          activeModuleLabel={activeLabel}
        />
      )}

      {/* Tabs navigator with hidden tab bar — expo-router handles
          route resolution, initial screen, and flat peer nav. */}
      <Tabs
        tabBar={() => null}
        screenOptions={{
          headerShown: false,
          sceneStyle: {
            backgroundColor: Theme.colors.background,
            paddingBottom: insets.bottom,
          },
        }}
      >
        <Tabs.Screen name="mouse"  options={{ title: 'Mouse' }} />
        <Tabs.Screen name="media"  options={{ title: 'Media' }} />
        <Tabs.Screen name="screen" options={{ title: 'Screen' }} />
        <Tabs.Screen name="telemetry" options={{ title: 'Telemetry' }} />
        <Tabs.Screen name="apps" options={{ title: 'Apps' }} />
        <Tabs.Screen name="clipboard" options={{ title: 'Clipboard' }} />
        <Tabs.Screen name="terminal" options={{ title: 'Terminal' }} />
        <Tabs.Screen name="custom" options={{ title: 'Custom' }} />
        <Tabs.Screen name="power"  options={{ title: 'Power' }} />
      </Tabs>

      {/* Drawer overlay — renders above Tabs content */}
      <NavigationDrawer
        visible={drawerOpen}
        activeModule={activeModule}
        onSelect={handleModuleSelect}
        onClose={closeDrawer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
});