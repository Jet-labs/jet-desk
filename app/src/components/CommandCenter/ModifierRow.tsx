/**
 * ModifierRow — Physical-feel modifier key strip
 * Renders Esc, Tab, Ctrl, Alt, Win, Shift above the system keyboard.
 * Modifier keys toggle (sticky); action keys fire immediately.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Theme } from '../../constants/theme';

interface ModifierRowProps {
  onKeyTap:  (key: string, modifiers?: string[]) => void;
  onKeyDown: (key: string) => void;
  onKeyUp:   (key: string) => void;
}

const MODIFIER_KEYS = [
  { label: 'esc',   key: 'escape', isModifier: false },
  { label: 'tab',   key: 'tab',    isModifier: false },
  { label: 'ctrl',  key: 'ctrl',   isModifier: true  },
  { label: 'alt',   key: 'alt',    isModifier: true  },
  { label: 'win',   key: 'lwin',   isModifier: true  },
  { label: '⇧',     key: 'shift',  isModifier: true  },
] as const;

export function ModifierRow({ onKeyTap, onKeyDown, onKeyUp }: ModifierRowProps) {
  const [activeModifiers, setActiveModifiers] = useState<Set<string>>(new Set());

  const handlePress = useCallback((item: typeof MODIFIER_KEYS[number]) => {
    if (item.isModifier) {
      setActiveModifiers(prev => {
        const next = new Set(prev);
        if (next.has(item.key)) {
          next.delete(item.key);
          onKeyUp(item.key);
        } else {
          next.add(item.key);
          onKeyDown(item.key);
        }
        return next;
      });
    } else {
      onKeyTap(item.key, Array.from(activeModifiers));
    }
  }, [activeModifiers, onKeyTap, onKeyDown, onKeyUp]);

  return (
    <View style={styles.container}>
      {MODIFIER_KEYS.map(item => {
        const isActive = activeModifiers.has(item.key);
        return (
          <TouchableOpacity
            key={item.key}
            style={[styles.key, isActive && styles.keyActive]}
            onPress={() => handlePress(item)}
            activeOpacity={0.55}
          >
            {/* Top edge highlight — mimics physical keycap */}
            <View style={[styles.keyTopEdge, isActive && styles.keyTopEdgeActive]} />
            <Text style={[styles.keyLabel, isActive && styles.keyLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.surface,
    padding: Theme.spacing.sm,
    gap: Theme.spacing.xs,
    // borderTopWidth: StyleSheet.hairlineWidth,
    // borderTopColor: Theme.colors.border,
  },
  key: {
    flex: 1,
    height: 40,
    backgroundColor: Theme.colors.surfaceElevated,
    borderRadius: Theme.radius.sm,
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
    // Bottom shadow for keycap depth
    borderBottomWidth: 2,
    borderBottomColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  keyActive: {
    backgroundColor: Theme.colors.accent,
    borderColor: Theme.colors.accent,
    borderBottomColor: '#1a8f5a',
  },

  // Subtle top-edge highlight (light catching keycap rim)
  keyTopEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  keyTopEdgeActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  keyLabel: {
    color: Theme.colors.textSecondary,
    fontSize: Theme.fontSize.micro,
    fontWeight: Theme.fontWeight.semiBold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  keyLabelActive: {
    color: '#FFFFFF',
  },
});