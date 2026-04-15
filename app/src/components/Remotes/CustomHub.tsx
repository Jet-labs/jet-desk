import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LayoutGrid, ChevronRight, Plus, Power } from 'lucide-react-native';
import { RemoteConfig } from '../../constants/remotes';
import { Theme } from '../../constants/theme';
import { ICON_MAP } from '../../constants/icons';

interface CustomHubProps {
  customRemotes: RemoteConfig[];
  onToggleEnabled: (remote: RemoteConfig) => void;
  onCreateNew: () => void;
}

function renderIcon(iconName: string | undefined, size: number, color: string) {
  if (!iconName) return <LayoutGrid size={size} color={color} />;
  const IconComponent = ICON_MAP[iconName];
  if (IconComponent) {
    return <IconComponent size={size} color={color} strokeWidth={2} />;
  }
  return <Text style={{ fontSize: size, color }}>{iconName}</Text>;
}

export function CustomHub({ customRemotes, onToggleEnabled, onCreateNew }: CustomHubProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {customRemotes.length === 0 ? (
        <View style={styles.empty}>
          <LayoutGrid size={48} color={Theme.colors.textTertiary} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>No Custom Remotes</Text>
          <Text style={styles.emptySub}>Create your own layouts for specific apps or workflows.</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {customRemotes.map(remote => (
            <View key={remote.id} style={[styles.card, !remote.enabled && styles.cardDisabled]}>
              <TouchableOpacity
                style={styles.cardContent}
                onPress={() => router.push(`/remote/custom/${remote.id}` as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.cardIconWrap, !remote.enabled && styles.cardIconWrapDisabled]}>
                  {renderIcon(remote.icon, 20, remote.enabled ? Theme.colors.accent : Theme.colors.textTertiary)}
                </View>
                <View style={styles.cardTextCol}>
                  <Text style={[styles.cardName, !remote.enabled && styles.cardNameDisabled]}>{remote.name}</Text>
                  <Text style={styles.cardInfo}>{remote.buttons.length} buttons · {remote.columns} cols</Text>
                </View>
                <ChevronRight size={18} color={Theme.colors.textTertiary} />
              </TouchableOpacity>

              <View style={styles.cardDivider} />

              <TouchableOpacity
                style={styles.powerBtn}
                onPress={() => onToggleEnabled(remote)}
                activeOpacity={0.6}
              >
                <Power size={18} color={remote.enabled ? Theme.colors.success : Theme.colors.textTertiary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={onCreateNew}
      >
        <Plus size={24} color={Theme.colors.background} strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  grid: {
    paddingHorizontal: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    overflow: 'hidden',
  },
  cardDisabled: {
    opacity: 0.6,
    borderColor: Theme.colors.borderLight,
    backgroundColor: 'transparent',
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.accentDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIconWrapDisabled: {
    backgroundColor: Theme.colors.surface,
  },
  cardTextCol: {
    flex: 1,
  },
  cardName: {
    color: Theme.colors.textPrimary,
    fontSize: Theme.fontSize.body,
    fontWeight: Theme.fontWeight.semiBold,
  },
  cardNameDisabled: {
    color: Theme.colors.textTertiary,
  },
  cardInfo: {
    color: Theme.colors.textTertiary,
    fontSize: Theme.fontSize.sm,
    marginTop: 2,
  },
  cardDivider: {
    width: 1,
    height: '60%',
    backgroundColor: Theme.colors.borderLight,
  },
  powerBtn: {
    padding: Theme.spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.xxxl,
    gap: Theme.spacing.md,
  },
  emptyTitle: {
    color: Theme.colors.textSecondary,
    fontSize: Theme.fontSize.h3,
    fontWeight: Theme.fontWeight.semiBold,
  },
  emptySub: {
    color: Theme.colors.textTertiary,
    fontSize: Theme.fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    bottom: Theme.spacing.lg,
    right: Theme.spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
