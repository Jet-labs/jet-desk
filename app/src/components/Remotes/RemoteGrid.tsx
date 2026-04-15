import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { RemoteButton, RemoteConfig } from '../../constants/remotes';
import { Theme } from '../../constants/theme';
import { ICON_MAP } from '../../constants/icons';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_PADDING = Theme.spacing.md;
const GRID_GAP = Theme.spacing.md;

interface RemoteGridProps {
  remote: RemoteConfig;
  onButtonPress: (button: RemoteButton) => void;
}

function renderIcon(iconName: string | undefined, size: number, color: string, style?: any) {
  if (!iconName) return null;
  const IconComponent = ICON_MAP[iconName];
  if (IconComponent) {
    return <IconComponent size={size} color={color} strokeWidth={2} style={style} />;
  }
  return <Text style={[style, { fontSize: size, color }]}>{iconName}</Text>;
}

export function RemoteGrid({ remote, onButtonPress }: RemoteGridProps) {
  const columns = remote.columns || 3;
  const buttonBase = Math.floor((SCREEN_W - GRID_PADDING * 2 - GRID_GAP * (columns - 1)) / columns);

  return (
    <View style={styles.gridRow}>
      {remote.buttons.map(button => {
        const colSpan = button.size === '2x1' ? 2 : 1;
        const rowSpan = button.size === '1x2' ? 2 : 1;
        const w = buttonBase * colSpan + GRID_GAP * (colSpan - 1);
        const h = Math.max(buttonBase * rowSpan + GRID_GAP * (rowSpan - 1), 72);

        return (
          <TouchableOpacity
            key={button.id}
            style={[
              styles.gridBtn,
              {
                width: w,
                height: h,
                backgroundColor: button.color ? button.color : Theme.colors.background,
                borderColor: button.color ? button.color : Theme.colors.border,
              },
            ]}
            onPress={() => onButtonPress(button)}
            activeOpacity={0.55}
          >
            {renderIcon(button.icon, 24, Theme.colors.textPrimary, styles.gridBtnIcon)}
            <Text style={styles.gridBtnLabel}>{button.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  gridBtn: {
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  gridBtnIcon: {
    fontSize: 24,
  },
  gridBtnLabel: {
    color: '#fafafa',
    fontSize: Theme.fontSize.sm,
    fontWeight: Theme.fontWeight.semiBold,
    textAlign: 'center',
    letterSpacing: -0.16,
  },
});
