import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';

import { connectionManager } from '../../network/ConnectionManager';

export interface CustomRemoteDeletionFormProps {
  remoteId: string;
}

/**
 * Handles the destructive action of deleting a custom remote.
 * Danger Zone pattern per Supabase design guidelines:
 * - Top border divider in subtle gray
 * - Source Code Pro uppercase "DANGER ZONE" label
 * - Two-step confirmation (tap once to arm, tap again to confirm)
 * - Error red only for the destructive state
 */
export function CustomRemoteDeletionForm({ remoteId }: CustomRemoteDeletionFormProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting]     = useState(false);

  const handleDelete = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setDeleting(true);

    const unsub = connectionManager.on('remote.config.delete.response', () => {
      setDeleting(false);
      unsub();
      router.back();
    });

    connectionManager.send('remote.config.delete', { id: remoteId });

    // Safety fallback
    setTimeout(() => {
      setDeleting(false);
      unsub();
      router.back();
    }, 2000);
  };

  return (
    <View style={styles.container}>

      {/* ── Section divider ─────────────────────────────────────── */}
      <View style={styles.divider} />

      {/* ── Danger label ────────────────────────────────────────── */}
      <Text style={styles.dangerLabel}>Danger Zone</Text>

      {/* ── Content row ─────────────────────────────────────────── */}
      <View style={styles.contentRow}>
        <View style={styles.textStack}>
          <Text style={styles.title}>Delete this remote</Text>
          <Text style={styles.subtext}>
            {confirming
              ? 'This cannot be undone. All buttons will be permanently lost.'
              : 'Once deleted, there is no going back.'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.deleteBtn, confirming && styles.confirmBtn]}
          onPress={handleDelete}
          disabled={deleting}
          activeOpacity={0.8}
        >
          {deleting ? (
            <ActivityIndicator color={confirming ? '#fafafa' : '#e5484d'} size="small" />
          ) : (
            <Text style={[styles.deleteBtnText, confirming && styles.confirmBtnText]}>
              {confirming ? 'Confirm' : 'Delete'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Dismiss confirmation ─────────────────────────────────── */}
      {confirming && !deleting && (
        <TouchableOpacity onPress={() => setConfirming(false)} activeOpacity={0.7} style={styles.cancelLink}>
          <Text style={styles.cancelLinkText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 40,
    marginTop: 32,
  },
  divider: {
    height: 1,
    backgroundColor: '#2e2e2e',
    marginBottom: 20,
  },
  dangerLabel: {
    // Source Code Pro developer console marker
    color: '#e5484d',
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 14,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  textStack: {
    flex: 1,
  },
  title: {
    color: '#fafafa',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 3,
  },
  subtext: {
    color: '#4d4d4d',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
  },
  deleteBtn: {
    flexShrink: 0,
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: 'rgba(229, 72, 77, 0.4)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 9999,
    minWidth: 72,
    alignItems: 'center',
  },
  deleteBtnText: {
    color: '#e5484d',
    fontSize: 13,
    fontWeight: '500',
  },
  confirmBtn: {
    backgroundColor: '#e5484d',
    borderColor: '#e5484d',
  },
  confirmBtnText: {
    color: '#fafafa',
    fontWeight: '500',
  },
  cancelLink: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  cancelLinkText: {
    color: '#4d4d4d',
    fontSize: 12,
    fontWeight: '400',
    textDecorationLine: 'underline',
  },
});