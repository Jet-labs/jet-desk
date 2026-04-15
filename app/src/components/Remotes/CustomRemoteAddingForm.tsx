import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

import { Theme } from '../../constants/theme';
import { useDeviceStore } from '../../store/deviceStore';
import { CustomRemoteConfig } from '../../constants/remotes';
import { connectionManager } from '../../network/ConnectionManager';
import { CustomRemoteEditor, RemoteMetadata } from './CustomRemoteEditor';

export function CustomRemoteAddingForm() {
  const router          = useRouter();
  const devices         = useDeviceStore((s) => s.devices);
  const activeDeviceId  = useDeviceStore((s) => s.activeDeviceId);
  const activeDevice    = devices.find((d) => d.id === activeDeviceId);

  const [saving, setSaving]     = useState(false);
  const [formData, setFormData] = useState<RemoteMetadata>({ name: '', icon: 'LayoutGrid', columns: 3 });

  const handleCreate = () => {
    if (!activeDevice?.ip || !activeDevice?.sessionToken) return;
    if (!formData.name.trim()) return;

    setSaving(true);
    const newId = `remote-${Date.now()}`;
    const newRemote: CustomRemoteConfig = {
      id: newId,
      name: formData.name.trim(),
      icon: formData.icon,
      columns: formData.columns,
      enabled: true,
      buttons: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const unsub = connectionManager.on('remote.config.push.response', () => {
      setSaving(false);
      unsub();
      router.replace(`/remote-editor/${newId}` as any);
    });

    connectionManager.send('remote.config.push', newRemote);

    // Timeout fallback
    setTimeout(() => {
      setSaving(false);
      unsub();
      router.replace(`/remote-editor/${newId}` as any);
    }, 2000);
  };

  const isDisabled = !formData.name.trim() || saving;

  return (
    <View style={styles.container}>

      {/* ── Info banner ──────────────────────────────────────────── */}
      <View style={styles.infoBanner}>
        <View style={styles.infoDot} />
        <Text style={styles.infoText}>
          Set up the basic details first. You'll add buttons on the Canvas editor.
        </Text>
      </View>

      {/* ── Form ─────────────────────────────────────────────────── */}
      <CustomRemoteEditor onChange={setFormData} />

      {/* ── Submit ───────────────────────────────────────────────── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitBtn, isDisabled && styles.submitBtnDisabled]}
          onPress={handleCreate}
          disabled={isDisabled}
          activeOpacity={0.8}
        >
          <Text style={styles.submitBtnText}>
            {saving ? 'Creating…' : 'Create Remote'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 12,
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2e2e2e',
  },
  infoDot: {
    width: 6,
    height: 6,
    borderRadius: 9999,
    backgroundColor: '#363636',
    marginTop: 5,
    flexShrink: 0,
  },
  infoText: {
    flex: 1,
    color: '#898989',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  submitBtn: {
    paddingVertical: 14,
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#fafafa',
    borderRadius: 9999, // pill CTA
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.35,
    borderColor: '#363636',
  },
  submitBtnText: {
    color: '#fafafa',
    fontSize: 14,
    fontWeight: '500',
  },
});