import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Alert, ActivityIndicator,
} from 'react-native';
import { Plus } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { Theme } from '../../constants/theme';
import { connectionManager } from '../../network/ConnectionManager';
import { CustomRemoteConfig, RemoteButton } from '../../constants/remotes';
import { CustomRemoteEditor, RemoteMetadata } from './CustomRemoteEditor';
import { ButtonConfigModal } from './ButtonConfigModal';
import * as Icons from 'lucide-react-native';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_PADDING = 16;
const GRID_GAP     = 10;

export interface CustomRemoteUpdationFormProps {
  initialRemote: CustomRemoteConfig;
}

export function CustomRemoteUpdationForm({ initialRemote }: CustomRemoteUpdationFormProps) {
  const router = useRouter();
  const [remote, setRemote]             = useState<CustomRemoteConfig>(initialRemote);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const [formData, setFormData]         = useState<RemoteMetadata>({
    name: initialRemote.name,
    icon: initialRemote.icon,
    columns: initialRemote.columns || 3,
  });
  const [selectedButton, setSelectedButton] = useState<RemoteButton | null | undefined>(undefined);

  // ── Sync helper ───────────────────────────────────────────────
  const persistUpdate = (mutatedConfig: CustomRemoteConfig, metadataOnly = false) => {
    if (metadataOnly) setSavingMetadata(true);

    const unsub = connectionManager.on('remote.config.push.response', () => {
      if (metadataOnly) setSavingMetadata(false);
      unsub();
    });

    connectionManager.send('remote.config.push', mutatedConfig);

    if (metadataOnly) {
      setTimeout(() => { setSavingMetadata(false); unsub(); }, 2000);
    }
  };

  // ── Metadata save ─────────────────────────────────────────────
  const handleSave = () => {
    if (!formData.name.trim()) return;
    const updated = {
      ...remote,
      name: formData.name.trim(),
      icon: formData.icon,
      columns: formData.columns,
      updatedAt: Date.now(),
    };
    setRemote(updated);
    persistUpdate(updated, true);
  };

  // ── Delete ────────────────────────────────────────────────────
  const handleDeleteWithConfirmation = () => {
    Alert.alert(
      'Delete Remote',
      'Are you sure? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setDeleting(true);
            const unsub = connectionManager.on('remote.config.delete.response', () => {
              setDeleting(false); unsub(); router.back();
            });
            connectionManager.send('remote.config.delete', { id: remote.id });
            setTimeout(() => { setDeleting(false); unsub(); router.back(); }, 2000);
          },
        },
      ],
    );
  };

  // ── Button grid ───────────────────────────────────────────────
  const saveButton = (updatedBtn: RemoteButton) => {
    setRemote((prev) => {
      const exists   = prev.buttons.some((b) => b.id === updatedBtn.id);
      const newButtons = exists
        ? prev.buttons.map((b) => (b.id === updatedBtn.id ? updatedBtn : b))
        : [...prev.buttons, updatedBtn];
      const updated = { ...prev, buttons: newButtons, updatedAt: Date.now() };
      persistUpdate(updated, false);
      return updated;
    });
    setSelectedButton(undefined);
  };

  const deleteButton = () => {
    if (!selectedButton) return;
    setRemote(prev => {
      const updated = {
        ...prev,
        buttons: prev.buttons.filter(b => b.id !== selectedButton.id),
        updatedAt: Date.now(),
      };
      persistUpdate(updated, false);
      return updated;
    });
    setSelectedButton(undefined);
  };

  // ── Grid sizing ───────────────────────────────────────────────
  const columns    = remote.columns || 3;
  const buttonBase = Math.floor((SCREEN_W - GRID_PADDING * 2 - GRID_GAP * (columns - 1)) / columns);

  return (
    <View style={styles.container}>

      {/* ── 1. Metadata editor ─────────────────────────────────── */}
      <CustomRemoteEditor
        initialData={{ name: remote.name, icon: remote.icon, columns: remote.columns }}
        onChange={setFormData}
      />

      {/* ── 2. Button layout section ────────────────────────────── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>Button Layout</Text>
        <Text style={styles.sectionCount}>{remote.buttons.length} buttons</Text>
      </View>

      <View style={[styles.gridCanvas, { padding: GRID_PADDING }]}>
        <View style={styles.gridRow}>
          {remote.buttons.map((button) => {
            const colSpan = button.size === '2x1' || button.size === '2x2' ? 2 : 1;
            const rowSpan = button.size === '1x2' || button.size === '2x2' ? 2 : 1;
            const w = buttonBase * colSpan + GRID_GAP * (colSpan - 1);
            const h = Math.max(buttonBase * rowSpan + GRID_GAP * (rowSpan - 1), 64);

            const BtnIcon = button.icon ? (Icons as any)[button.icon] : null;

            return (
              <TouchableOpacity
                key={button.id}
                style={[
                  styles.gridBtn,
                  {
                    width: w,
                    height: h,
                    backgroundColor: button.color || '#0f0f0f',
                    borderColor: button.color
                      ? `${button.color}60`   // 38% opacity border when coloured
                      : '#2e2e2e',
                  },
                ]}
                onPress={() => setSelectedButton(button)}
                activeOpacity={0.6}
              >
                {BtnIcon && React.createElement(BtnIcon, { size: 18, color: '#fafafa', strokeWidth: 1.5 })}
                <Text style={styles.gridBtnLabel} numberOfLines={2}>
                  {button.label}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* ── Add slot ─────────────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.addBtnSlot, { width: buttonBase, height: Math.max(buttonBase, 64) }]}
            onPress={() => setSelectedButton(null)}
            activeOpacity={0.6}
          >
            <Plus size={20} color='#363636' />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 3. Action footer ─────────────────────────────────────── */}
      <View style={styles.actionFooter}>
        <TouchableOpacity
          style={styles.deleteGhostBtn}
          onPress={handleDeleteWithConfirmation}
          disabled={savingMetadata || deleting}
          activeOpacity={0.6}
        >
          {deleting
            ? <ActivityIndicator color='#e5484d' size='small' />
            : <Text style={styles.deleteGhostText}>Delete remote</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveBtn, (isDisabled(formData, savingMetadata, deleting)) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={isDisabled(formData, savingMetadata, deleting)}
          activeOpacity={0.8}
        >
          {savingMetadata
            ? <ActivityIndicator color='#fafafa' size='small' />
            : <Text style={styles.saveBtnText}>Save changes</Text>}
        </TouchableOpacity>
      </View>

      {/* ── Modals ───────────────────────────────────────────────── */}
      <ButtonConfigModal
        visible={selectedButton !== undefined}
        onCancel={() => setSelectedButton(undefined)}
        onSave={saveButton}
        button={selectedButton || null}
      />
    </View>
  );
}

function isDisabled(formData: RemoteMetadata, savingMetadata: boolean, deleting: boolean) {
  return !formData.name.trim() || savingMetadata || deleting;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ── Section header ─────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#2e2e2e',
    marginTop: 8,
  },
  sectionLabel: {
    // Source Code Pro developer console style
    color: '#898989',
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  sectionCount: {
    color: '#4d4d4d',
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 0.4,
  },

  // ── Grid canvas ────────────────────────────────────────────────
  gridCanvas: {
    minHeight: 120,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  gridBtn: {
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    gap: 6,
  },
  gridBtnLabel: {
    color: '#fafafa',
    fontSize: 11,
    fontWeight: '400',
    textAlign: 'center',
    letterSpacing: -0.16,
    lineHeight: 15,
  },
  addBtnSlot: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#242424',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },

  // ── Action footer ──────────────────────────────────────────────
  actionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 48,
    borderTopWidth: 1,
    borderTopColor: '#2e2e2e',
    marginTop: 16,
  },
  deleteGhostBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 44,
    alignItems: 'center',
  },
  deleteGhostText: {
    color: '#e5484d',
    fontSize: 13,
    fontWeight: '400',
  },
  saveBtn: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#fafafa',
    borderRadius: 9999, // pill
    paddingVertical: 11,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 130,
  },
  saveBtnDisabled: {
    opacity: 0.35,
    borderColor: '#363636',
  },
  saveBtnText: {
    color: '#fafafa',
    fontSize: 14,
    fontWeight: '500',
  },
});