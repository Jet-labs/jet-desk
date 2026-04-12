import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import { Clipboard as ClipboardIcon, Upload, Download, RefreshCw } from 'lucide-react-native';
import * as ExpoClipboard from 'expo-clipboard';

import { useConnectivity } from '../../src/contexts/ConnectivityContext';
import { Theme } from '../../src/constants/theme';

export default function ClipboardModule() {
  const { status, clipboardContent, setRemoteClipboard, getRemoteClipboard } = useConnectivity();
  const [localText, setLocalText] = useState('');
  
  // Refresh data on mount if connected
  useEffect(() => {
    if (status === 'connected') {
      getRemoteClipboard();
    }
  }, [status, getRemoteClipboard]);

  // Handle syncing from remote to local explicitly
  const handleCopyFromRemote = async () => {
    if (!clipboardContent) {
      Alert.alert('Empty', 'The PC clipboard is empty.');
      return;
    }
    await ExpoClipboard.setStringAsync(clipboardContent);
    Alert.alert('Success', 'Copied PC text to this phone!');
  };

  // Handle pushing local text to remote clipboard
  const handlePushToRemote = async () => {
    if (!localText.trim()) {
      Alert.alert('Empty', 'Please type or paste something to send to the PC.');
      return;
    }
    setRemoteClipboard(localText);
    Alert.alert('Sent', 'Text copied to PC clipboard!');
    setTimeout(() => getRemoteClipboard(), 500); // refresh the PC display
  };

  // Pull physical mobile clipboard into the input box
  const pasteFromPhone = async () => {
    const text = await ExpoClipboard.getStringAsync();
    setLocalText(text || '');
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <ClipboardIcon size={24} color={Theme.colors.accent} strokeWidth={1.5} />
        </View>
        <Text style={styles.headerTitle}>Clipboard Sync</Text>
        <Text style={styles.headerSubtitle}>Manually exchange text with your PC</Text>
      </View>

      {/* PC Clipboard View */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Currently on PC</Text>
          <TouchableOpacity onPress={() => getRemoteClipboard()} style={styles.refreshBtn}>
            <RefreshCw size={16} color={Theme.colors.textSecondary} />
            <Text style={styles.refreshTxt}>Refresh</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.textBox}>
          <Text style={clipboardContent ? styles.remoteText : styles.emptyText}>
            {clipboardContent || 'PC clipboard is empty...'}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={[styles.primaryBtn, !clipboardContent && styles.disabledBtn]} 
          onPress={handleCopyFromRemote}
          disabled={!clipboardContent}
        >
          <Download size={20} color={Theme.colors.background} strokeWidth={2.5} />
          <Text style={styles.primaryBtnText}>Copy to Phone</Text>
        </TouchableOpacity>
      </View>

      {/* Mobile Input View */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Send to PC</Text>
          <TouchableOpacity onPress={pasteFromPhone} style={styles.refreshBtn}>
            <Text style={styles.refreshTxt}>Paste from Phone</Text>
          </TouchableOpacity>
        </View>
        
        <TextInput
          style={styles.inputBox}
          placeholder="Type or paste text here..."
          placeholderTextColor={Theme.colors.textTertiary}
          multiline
          value={localText}
          onChangeText={setLocalText}
          textAlignVertical="top"
        />
        
        <TouchableOpacity 
          style={[styles.secondaryBtn, !localText.trim() && { opacity: 0.5 }]} 
          onPress={handlePushToRemote}
          disabled={!localText.trim()}
        >
          <Upload size={20} color={Theme.colors.accent} strokeWidth={2} />
          <Text style={styles.secondaryBtnText}>Send to PC Clipboard</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    padding: Theme.spacing.xl,
    paddingBottom: Theme.spacing.xxxl,
    paddingTop: Theme.spacing.xl + 20,
    gap: Theme.spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: Theme.radius.xl,
    backgroundColor: 'rgba(62, 207, 142, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  headerTitle: {
    color: Theme.colors.textPrimary,
    fontSize: Theme.fontSize.h2,
    fontWeight: Theme.fontWeight.bold,
    marginBottom: 4,
  },
  headerSubtitle: {
    color: Theme.colors.textSecondary,
    fontSize: Theme.fontSize.body,
  },
  section: {
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: Theme.colors.textPrimary,
    fontSize: Theme.fontSize.body,
    fontWeight: Theme.fontWeight.bold,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
    backgroundColor: Theme.colors.surfaceElevated,
    borderRadius: Theme.radius.sm,
  },
  refreshTxt: {
    color: Theme.colors.textSecondary,
    fontSize: Theme.fontSize.caption,
    fontWeight: Theme.fontWeight.semiBold,
  },
  textBox: {
    backgroundColor: Theme.colors.surfaceElevated,
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    minHeight: 100,
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
  },
  inputBox: {
    backgroundColor: Theme.colors.surfaceElevated,
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    minHeight: 120,
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
    color: Theme.colors.textPrimary,
    fontSize: Theme.fontSize.body,
  },
  remoteText: {
    color: Theme.colors.textPrimary,
    fontSize: Theme.fontSize.body,
    lineHeight: 22,
  },
  emptyText: {
    color: Theme.colors.textTertiary,
    fontSize: Theme.fontSize.body,
    fontStyle: 'italic',
  },
  primaryBtn: {
    backgroundColor: Theme.colors.accent,
    borderRadius: Theme.radius.md,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: Theme.spacing.sm,
  },
  disabledBtn: {
    backgroundColor: Theme.colors.surfaceElevated,
  },
  primaryBtnText: {
    color: Theme.colors.background,
    fontSize: Theme.fontSize.body,
    fontWeight: Theme.fontWeight.bold,
  },
  secondaryBtn: {
    backgroundColor: 'rgba(62, 207, 142, 0.1)',
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Theme.colors.accent,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: Theme.spacing.sm,
  },
  secondaryBtnText: {
    color: Theme.colors.accent,
    fontSize: Theme.fontSize.body,
    fontWeight: Theme.fontWeight.bold,
  },
});
