import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { Activity, Cpu, Server, Monitor, Globe } from 'lucide-react-native';
import { useConnectivity } from '../../src/contexts/ConnectivityContext';
import { MSG } from '../../src/network/protocol';
import { Theme } from '../../src/constants/theme';
import { connectionManager } from '../../src/network/ConnectionManager';

const { width: SCREEN_W } = Dimensions.get('window');

interface TelemetryData {
  cpu: number;
  ram: { used: number; total: number; percent: number };
  gpu: { name: string; usage?: number };
  network: { name: string; ip: string };
}

export default function TelemetryModule() {
  const { status, sendEvent } = useConnectivity();
  const [data, setData] = useState<TelemetryData | null>(null);

  useEffect(() => {
    if (status !== 'connected') return;

    // Start telemetry polling at 2s interval
    sendEvent(MSG.TELEMETRY_START, {});

    const unsub = connectionManager.on(MSG.TELEMETRY_DATA, (msg: any) => {
      setData(msg.payload);
    });

    return () => {
      unsub();
      // Stop telemetry when leaving screen
      sendEvent(MSG.TELEMETRY_STOP, {});
    };
  }, [status, sendEvent]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Activity size={24} color={Theme.colors.accent} strokeWidth={2} />
        <Text style={styles.headerTitle}>System Telemetry</Text>
        <Text style={styles.headerSubtitle}>Live performance metrics</Text>
      </View>

      <View style={styles.grid}>
        {/* CPU Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Cpu size={18} color={Theme.colors.textSecondary} />
            <Text style={styles.cardTitle}>CPU</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricValue}>{data?.cpu ?? '--'}%</Text>
          </View>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${data?.cpu || 0}%` }]} />
          </View>
        </View>

        {/* RAM Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Server size={18} color={Theme.colors.textSecondary} />
            <Text style={styles.cardTitle}>Memory</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricValue}>{data?.ram?.percent ?? '--'}%</Text>
          </View>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${data?.ram?.percent || 0}%` }]} />
          </View>
          <Text style={styles.metricSub}>
            {data ? `${(data.ram.used / 1e9).toFixed(1)} / ${(data.ram.total / 1e9).toFixed(1)} GB` : '-- / -- GB'}
          </Text>
        </View>

        {/* GPU Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Monitor size={18} color={Theme.colors.textSecondary} />
            <Text style={styles.cardTitle}>GPU</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricTextLg} numberOfLines={2}>
              {data ? data.gpu.name : '--'}
            </Text>
          </View>
        </View>

        {/* Network Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Globe size={18} color={Theme.colors.textSecondary} />
            <Text style={styles.cardTitle}>Network</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricTextLg} numberOfLines={1}>{data?.network?.ip || '--'}</Text>
          </View>
          <Text style={styles.metricSub} numberOfLines={1}>{data?.network?.name || '--'}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.colors.background },
  content: { padding: Theme.spacing.lg, paddingTop: Theme.spacing.xl + 20 },
  header: { alignItems: 'center', marginBottom: Theme.spacing.xl, gap: Theme.spacing.sm },
  headerTitle: { color: Theme.colors.textPrimary, fontSize: Theme.fontSize.h2, fontWeight: Theme.fontWeight.bold },
  headerSubtitle: { color: Theme.colors.textSecondary, fontSize: Theme.fontSize.body },
  
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.md,
  },
  card: {
    width: (SCREEN_W - Theme.spacing.lg * 2 - Theme.spacing.md) / 2,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
    marginBottom: Theme.spacing.md,
  },
  cardTitle: {
    color: Theme.colors.textSecondary,
    fontSize: Theme.fontSize.sm,
    fontWeight: Theme.fontWeight.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  metricRow: {
    marginBottom: Theme.spacing.sm,
  },
  metricValue: {
    color: Theme.colors.textPrimary,
    fontSize: 32,
    fontWeight: Theme.fontWeight.bold,
  },
  metricTextLg: {
    color: Theme.colors.textPrimary,
    fontSize: Theme.fontSize.body,
    fontWeight: Theme.fontWeight.medium,
  },
  metricSub: {
    color: Theme.colors.textTertiary,
    fontSize: Theme.fontSize.caption,
    marginTop: Theme.spacing.sm,
  },
  barBg: {
    height: 6,
    backgroundColor: Theme.colors.surfaceElevated,
    borderRadius: Theme.radius.full,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: Theme.colors.accent,
    borderRadius: Theme.radius.full,
  },
});
