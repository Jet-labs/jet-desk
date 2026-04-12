/**
 * Power & Session Module
 * 
 * Provides quick actions to lock, sleep, restart, or shutdown the connected PC.
 * UI follows the Supabase dark mode aesthetic with red-tinted borders for destructive actions.
 */

import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { Lock, Moon, RotateCcw, Power as PowerIcon, ShieldAlert } from 'lucide-react-native';

import { useConnectivity } from '../../src/contexts/ConnectivityContext';
import { MSG } from '../../src/network/protocol';
import { Theme } from '../../src/constants/theme';

export default function PowerModule() {
  const { sendEvent } = useConnectivity();

  const handleAction = useCallback((action: string, prompt?: string) => {
    if (prompt) {
      Alert.alert(
        'Confirm Action',
        prompt,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Confirm', 
            style: 'destructive',
            onPress: () => sendEvent(action, {}) 
          }
        ],
        { cancelable: true }
      );
    } else {
      sendEvent(action, {});
    }
  }, [sendEvent]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ShieldAlert size={24} color={Theme.colors.textSecondary} strokeWidth={1.5} />
        <Text style={styles.headerTitle}>System Power</Text>
        <Text style={styles.headerSubtitle}>Manage PC session state</Text>
      </View>

      <View style={styles.cardList}>
        {/* Lock Workstation */}
        <TouchableOpacity 
          style={styles.card} 
          onPress={() => handleAction(MSG.SYSTEM_LOCK)}
          activeOpacity={0.6}
        >
          <View style={[styles.iconWrap, { backgroundColor: Theme.colors.surfaceElevated }]}>
            <Lock size={20} color={Theme.colors.textPrimary} strokeWidth={1.5} />
          </View>
          <View style={styles.cardTextStack}>
            <Text style={styles.cardTitle}>Lock Workstation</Text>
            <Text style={styles.cardSubtitle}>Return to Windows login screen</Text>
          </View>
        </TouchableOpacity>

        {/* Sleep */}
        <TouchableOpacity 
          style={styles.card} 
          onPress={() => handleAction(MSG.SYSTEM_SLEEP)}
          activeOpacity={0.6}
        >
          <View style={[styles.iconWrap, { backgroundColor: Theme.colors.surfaceElevated }]}>
            <Moon size={20} color={Theme.colors.textPrimary} strokeWidth={1.5} />
          </View>
          <View style={styles.cardTextStack}>
            <Text style={styles.cardTitle}>Sleep</Text>
            <Text style={styles.cardSubtitle}>Put PC into low-power mode</Text>
          </View>
        </TouchableOpacity>

        {/* Restart (Destructive) */}
        <TouchableOpacity 
          style={[styles.card, styles.cardDestructive]} 
          onPress={() => handleAction(MSG.SYSTEM_RESTART, 'Are you sure you want to restart your PC? Unsaved work may be lost.')}
          activeOpacity={0.6}
        >
          <View style={[styles.iconWrap, { backgroundColor: Theme.colors.errorDim }]}>
            <RotateCcw size={20} color={Theme.colors.error} strokeWidth={1.5} />
          </View>
          <View style={styles.cardTextStack}>
            <Text style={[styles.cardTitle, { color: Theme.colors.error }]}>Restart PC</Text>
            <Text style={styles.cardSubtitle}>Close all apps and restart</Text>
          </View>
        </TouchableOpacity>

        {/* Shutdown (Destructive) */}
        <TouchableOpacity 
          style={[styles.card, styles.cardDestructive]} 
          onPress={() => handleAction(MSG.SYSTEM_SHUTDOWN, 'Are you sure you want to shut down your PC? Unsaved work may be lost.')}
          activeOpacity={0.6}
        >
          <View style={[styles.iconWrap, { backgroundColor: Theme.colors.errorDim }]}>
            <PowerIcon size={20} color={Theme.colors.error} strokeWidth={1.5} />
          </View>
          <View style={styles.cardTextStack}>
            <Text style={[styles.cardTitle, { color: Theme.colors.error }]}>Shut Down PC</Text>
            <Text style={styles.cardSubtitle}>Power off immediately</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    padding: Theme.spacing.lg,
    paddingTop: Theme.spacing.xl + 20, // Extra top padding for the header
  },
  header: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
    gap: Theme.spacing.sm,
  },
  headerTitle: {
    color: Theme.colors.textPrimary,
    fontSize: Theme.fontSize.h2,
    fontWeight: Theme.fontWeight.bold,
  },
  headerSubtitle: {
    color: Theme.colors.textSecondary,
    fontSize: Theme.fontSize.body,
  },
  cardList: {
    gap: Theme.spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  cardDestructive: {
    borderColor: 'rgba(229, 72, 77, 0.3)', // Theme.colors.error at 30%
    backgroundColor: 'rgba(229, 72, 77, 0.05)',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: Theme.radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTextStack: {
    flex: 1,
  },
  cardTitle: {
    color: Theme.colors.textPrimary,
    fontSize: Theme.fontSize.body,
    fontWeight: Theme.fontWeight.semiBold,
    marginBottom: 2,
  },
  cardSubtitle: {
    color: Theme.colors.textTertiary,
    fontSize: Theme.fontSize.sm,
  },
});
