import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  RefreshControl, ActivityIndicator 
} from 'react-native';
import { AppWindow, Minus, X, Maximize2, TerminalSquare } from 'lucide-react-native';

import { useConnectivity } from '../../src/contexts/ConnectivityContext';
import { MSG } from '../../src/network/protocol';
import { Theme } from '../../src/constants/theme';
import { connectionManager } from '../../src/network/ConnectionManager';

interface PCWindow {
  id: string;
  title: string;
  name: string;
}

export default function AppsModule() {
  const { status, sendEvent } = useConnectivity();
  const [windows, setWindows] = useState<PCWindow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWindows = useCallback(() => {
    if (status !== 'connected') return;
    setRefreshing(true);
    sendEvent(MSG.WINDOWS_LIST, {});
  }, [status, sendEvent]);

  useEffect(() => {
    fetchWindows();
    
    const unsub = connectionManager.on(MSG.WINDOWS_LIST_RESPONSE, (msg: any) => {
      if (msg.payload?.windows) {
        setWindows(msg.payload.windows);
      }
      setRefreshing(false);
    });

    return unsub;
  }, [fetchWindows]);

  const handleAction = useCallback((action: string, hwnd: string) => {
    sendEvent(action, { hwnd });
    
    if (action === MSG.WINDOWS_CLOSE) {
      // Optimistically remove it from UI instantly
      setWindows(prev => prev.filter(w => w.id !== hwnd));
      
      // Silently refresh backend state after a delay without spinning UI
      setTimeout(() => {
        sendEvent(MSG.WINDOWS_LIST, {});
      }, 500);
    }
  }, [sendEvent]);

  const renderItem = ({ item }: { item: PCWindow }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconWrap}>
          <TerminalSquare size={20} color={Theme.colors.textPrimary} strokeWidth={1.5} />
        </View>
        <View style={styles.cardTextStack}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardSubtitle} numberOfLines={1}>{item.name}.exe</Text>
        </View>
      </View>
      <View style={styles.actionRow}>
        <TouchableOpacity 
          style={styles.actionBtn} 
          onPress={() => handleAction(MSG.WINDOWS_FOCUS, item.id)}
          activeOpacity={0.6}
        >
          <Maximize2 size={16} color={Theme.colors.accent} strokeWidth={2} />
          <Text style={[styles.actionLbl, { color: Theme.colors.accent }]}>Focus</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionBtn} 
          onPress={() => handleAction(MSG.WINDOWS_MINIMIZE, item.id)}
          activeOpacity={0.6}
        >
          <Minus size={16} color={Theme.colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionBtn} 
          onPress={() => handleAction(MSG.WINDOWS_CLOSE, item.id)}
          activeOpacity={0.6}
        >
          <X size={16} color={Theme.colors.error} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <AppWindow size={24} color={Theme.colors.accent} strokeWidth={1.5} />
        <Text style={styles.headerTitle}>App Switcher</Text>
        <Text style={styles.headerSubtitle}>Manage open windows</Text>
      </View>

      <FlatList
        data={windows}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={fetchWindows} 
            tintColor={Theme.colors.accent}
          />
        }
        ListEmptyComponent={
          !refreshing ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No windows found.</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  header: {
    alignItems: 'center',
    paddingTop: Theme.spacing.xl + 20,
    paddingBottom: Theme.spacing.lg,
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
  listContent: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
    paddingBottom: Theme.spacing.xxxl,
  },
  card: {
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.surfaceElevated,
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
    fontSize: Theme.fontSize.caption,
  },
  actionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Theme.colors.borderLight,
    paddingTop: Theme.spacing.sm,
    gap: Theme.spacing.sm,
    justifyContent: 'flex-end',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.surfaceElevated,
    gap: Theme.spacing.xs,
  },
  actionLbl: {
    fontSize: Theme.fontSize.sm,
    fontWeight: Theme.fontWeight.semiBold,
  },
  empty: {
    padding: Theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: Theme.colors.textTertiary,
  },
});
