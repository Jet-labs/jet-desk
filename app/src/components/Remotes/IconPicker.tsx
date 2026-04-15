/**
 * Icon Picker — grid of lucide-react-native icons for remote/button selection
 *
 * Usage:
 *   <IconPicker
 *     selected="Music"
 *     onSelect={(name) => ...}
 *     onCancel={() => ...}
 *   />
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  TextInput,
} from 'react-native';
import {
  Music, Volume2, VolumeX, Volume1, SkipBack, Play, SkipForward, Square,
  Maximize, Camera, Presentation, ArrowLeft, ArrowRight, PlaySquare,
  MonitorX, Monitor, Settings, Lock, AppWindow, Folder, Moon, Sun,
  Power, RotateCw, Trash2, Edit, Plus, Minus, Search, FileText,
  Terminal, Clipboard, Cpu, Wifi, Battery, Bell, Eye, EyeOff,
  PlayCircle, Pause, StopCircle, Forward, Rewind, ChevronsUp,
  ChevronDown, ChevronLeft, ChevronRight, Home, MonitorPlay,
  LucideIcon,
} from 'lucide-react-native';
import { Theme } from '../../constants/theme';

const ICONS: Record<string, LucideIcon> = {
  Music, Volume2, VolumeX, Volume1, SkipBack, Play, SkipForward, Square,
  Maximize, Camera, Presentation, ArrowLeft, ArrowRight, PlaySquare,
  MonitorX, Monitor, Settings, Lock, AppWindow, Folder, Moon, Sun,
  Power, RotateCw, Trash2, Edit, Plus, Minus, Search, FileText,
  Terminal, Clipboard, Cpu, Wifi, Battery, Bell, Eye, EyeOff,
  PlayCircle, Pause, StopCircle, Forward, Rewind, ChevronsUp,
  ChevronDown, ChevronLeft, ChevronRight, Home, MonitorPlay,
};

const ICON_NAMES = Object.keys(ICONS);

interface IconPickerProps {
  visible: boolean;
  selected: string | undefined;
  onSelect: (name: string) => void;
  onCancel: () => void;
}

export function IconPicker({ visible, selected, onSelect, onCancel }: IconPickerProps) {
  const [search, setSearch] = useState('');

  const filtered = search
    ? ICON_NAMES.filter(n => n.toLowerCase().includes(search.toLowerCase()))
    : ICON_NAMES;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>

          {/* Drag handle */}
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Choose Icon</Text>
            {selected && (
              <View style={styles.selectedBadge}>
                <View style={styles.selectedDot} />
                <Text style={styles.selectedBadgeText}>{selected}</Text>
              </View>
            )}
          </View>

          {/* Search input */}
          <View style={styles.searchBar}>
            <Search size={14} color='#4d4d4d' />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search icons…"
              placeholderTextColor='#4d4d4d'
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Count */}
          <Text style={styles.countLabel}>{filtered.length} icons</Text>

          {/* Grid */}
          <ScrollView
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
          >
            {filtered.map(name => {
              const Icon = ICONS[name];
              const isActive = name === selected;
              return (
                <TouchableOpacity
                  key={name}
                  style={[styles.gridItem, isActive && styles.gridItemActive]}
                  onPress={() => onSelect(name)}
                  activeOpacity={0.6}
                >
                  <Icon
                    size={20}
                    color={isActive ? '#3ecf8e' : '#898989'}
                    strokeWidth={isActive ? 2 : 1.5}
                  />
                  <Text
                    style={[styles.gridLabel, isActive && styles.gridLabelActive]}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Cancel */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
              <Text style={styles.cancelLabel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#171717',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#2e2e2e',
    maxHeight: '78%',
  },
  dragHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#363636',
    borderRadius: 9999,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2e2e2e',
  },
  title: {
    color: '#fafafa',
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.16,
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(62, 207, 142, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(62, 207, 142, 0.3)',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  selectedDot: {
    width: 6,
    height: 6,
    borderRadius: 9999,
    backgroundColor: '#3ecf8e',
  },
  selectedBadgeText: {
    color: '#3ecf8e',
    fontSize: 11,
    fontWeight: '500',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2e2e2e',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fafafa',
    fontSize: 14,
    fontWeight: '400',
  },
  countLabel: {
    // Source Code Pro developer label style
    color: '#4d4d4d',
    fontSize: 11,
    fontWeight: '400',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 6,
  },
  gridItem: {
    width: '18%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2e2e2e',
    backgroundColor: '#0f0f0f',
    gap: 4,
  },
  gridItemActive: {
    borderColor: 'rgba(62, 207, 142, 0.5)',
    backgroundColor: 'rgba(62, 207, 142, 0.07)',
  },
  gridLabel: {
    color: '#4d4d4d',
    fontSize: 9,
    fontWeight: '400',
    textAlign: 'center',
  },
  gridLabelActive: {
    color: '#3ecf8e',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: '#2e2e2e',
  },
  cancelBtn: {
    paddingVertical: 13,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#2e2e2e',
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
  },
  cancelLabel: {
    color: '#898989',
    fontSize: 14,
    fontWeight: '500',
  },
});