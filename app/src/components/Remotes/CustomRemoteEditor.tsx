import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { LayoutGrid } from 'lucide-react-native';

import { Theme } from '../../constants/theme';
import { IconPicker } from './IconPicker';
import * as Icons from 'lucide-react-native';

export interface RemoteMetadata {
  name: string;
  icon: string;
  columns: number;
}

export interface CustomRemoteEditorProps {
  initialData?: RemoteMetadata;
  onChange: (data: RemoteMetadata) => void;
}

/**
 * Pure presentational form component for modifying remote metadata.
 * Follows Supabase design system:
 * - No shadows, depth via border contrast
 * - Pill primary CTAs (9999px)
 * - Source Code Pro uppercase labels (1.2px letter-spacing)
 * - Near-black surfaces (#0f0f0f, #171717)
 * - Green accent used sparingly
 */
export function CustomRemoteEditor({ initialData, onChange }: CustomRemoteEditorProps) {
  const [name, setName]                       = useState(initialData?.name || '');
  const [columns, setColumns]                 = useState(initialData?.columns || 3);
  const [icon, setIcon]                       = useState(initialData?.icon || 'LayoutGrid');
  const [iconPickerVisible, setIconPickerVisible] = useState(false);

  const update = (updates: Partial<RemoteMetadata>) => {
    const nextName = updates.name    !== undefined ? updates.name    : name;
    const nextIcon = updates.icon    !== undefined ? updates.icon    : icon;
    const nextCols = updates.columns !== undefined ? updates.columns : columns;
    onChange({ name: nextName, icon: nextIcon, columns: nextCols });
  };

  const renderIcon = (iconName: string) => {
    const IconComponent = (Icons as any)[iconName];
    if (IconComponent) return <IconComponent size={20} color='#fafafa' />;
    return <LayoutGrid size={20} color='#fafafa' />;
  };

  return (
    <View style={styles.container}>

      {/* ── Remote Name ─────────────────────────────────────────── */}
      <View style={styles.field}>
        <Text style={styles.label}>Remote Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={(t) => { setName(t); update({ name: t }); }}
          placeholder="e.g. Photoshop Controls"
          placeholderTextColor='#4d4d4d'
          autoCorrect={false}
        />
      </View>

      {/* ── Icon + Columns row ──────────────────────────────────── */}
      <View style={styles.row}>

        {/* Icon selector */}
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Icon</Text>
          <TouchableOpacity
            style={styles.iconSelector}
            onPress={() => setIconPickerVisible(true)}
            activeOpacity={0.7}
          >
            {renderIcon(icon)}
            <Text style={styles.iconSelectorLabel} numberOfLines={1}>
              {icon}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Columns segmented control */}
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Columns</Text>
          <View style={styles.colToggles}>
            {[2, 3, 4].map((c, i) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.colToggle,
                  i < 2 && styles.colToggleDivider,
                  columns === c && styles.colToggleActive,
                ]}
                onPress={() => { setColumns(c); update({ columns: c }); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.colToggleText, columns === c && styles.colToggleTextActive]}>
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Icon picker modal */}
      <IconPicker
        visible={iconPickerVisible}
        onCancel={() => setIconPickerVisible(false)}
        selected={icon}
        onSelect={(newIcon) => {
          setIcon(newIcon);
          update({ icon: newIcon });
          setIconPickerVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    // Developer console marker — Source Code Pro aesthetic
    color: '#898989',
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0f0f0f',
    color: '#fafafa',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontWeight: '400',
    borderWidth: 1,
    borderColor: '#2e2e2e',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  iconSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#2e2e2e',
    borderRadius: 8,
    height: 44,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  iconSelectorLabel: {
    color: '#898989',
    fontSize: 13,
    flex: 1,
  },
  colToggles: {
    flexDirection: 'row',
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2e2e2e',
    overflow: 'hidden',
    height: 44,
  },
  colToggle: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colToggleDivider: {
    borderRightWidth: 1,
    borderRightColor: '#2e2e2e',
  },
  colToggleActive: {
    backgroundColor: 'rgba(62, 207, 142, 0.08)',
  },
  colToggleText: {
    color: '#4d4d4d',
    fontSize: 14,
    fontWeight: '400',
  },
  colToggleTextActive: {
    color: '#3ecf8e',
    fontWeight: '500',
  },
});