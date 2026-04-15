import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Platform, Keyboard } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Square, Play, Send, Keyboard as KeyboardIcon, Bookmark, BookmarkPlus, Trash2, ChevronUp } from 'lucide-react-native';
import { useTerminalStore } from '../../src/store/terminalStore';

import { useConnectivity } from '../../src/contexts/ConnectivityContext';
import { MSG } from '../../src/network/protocol';
import { Theme } from '../../src/constants/theme';
import { connectionManager } from '../../src/network/ConnectionManager';
import { ModifierRow } from '../../src/components/CommandCenter/ModifierRow';

export default function TerminalModule() {
  const { status, sendEvent } = useConnectivity();
  const [commands, setCommands] = useState<string[]>([]);
  const [activeProcessId, setActiveProcessId] = useState<string | null>(null);
  const [output, setOutput] = useState<string>('Select a command or type one below...\n');
  const [customCmd, setCustomCmd] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [showKeyboard, setShowKeyboard] = useState(false);
  
  const presets = useTerminalStore(s => s.presets);
  const addPreset = useTerminalStore(s => s.addPreset);
  const removePreset = useTerminalStore(s => s.removePreset);
  const loadPresets = useTerminalStore(s => s.loadPresets);

  const snapPoints = useMemo(() => {
    if (presets.length === 0) return ['18%']; 
    return ['30%', '95%'];
  }, [presets.length]);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const keyboardInputRef = useRef<TextInput>(null);

  // ── Global Keyboard Handlers ─────────────────────────────────────────
  const handleKeyInput   = useCallback((text: string) => { if (text.length > 0) sendEvent(MSG.KEY_TYPE, { text }); }, [sendEvent]);
  const handleKeySubmit  = useCallback(() => sendEvent(MSG.KEY_TAP, { key: 'enter' }),     [sendEvent]);
  const handleBackspace  = useCallback(() => sendEvent(MSG.KEY_TAP, { key: 'backspace' }), [sendEvent]);
  const handleModKeyTap  = useCallback((key: string, mods?: string[]) => sendEvent(MSG.KEY_TAP,  { key, modifiers: mods || [] }), [sendEvent]);
  const handleModKeyDown = useCallback((key: string) => sendEvent(MSG.KEY_DOWN, { key }), [sendEvent]);
  const handleModKeyUp   = useCallback((key: string) => sendEvent(MSG.KEY_UP,   { key }), [sendEvent]);

  const toggleKeyboard = useCallback(() => {
    if (showKeyboard) {
      Keyboard.dismiss();
      setShowKeyboard(false);
    } else {
      setShowKeyboard(true);
      setTimeout(() => keyboardInputRef.current?.focus(), 100);
    }
  }, [showKeyboard]);

  useEffect(() => {
    loadPresets();
    if (status === 'connected') {
      sendEvent(MSG.SHELL_GET_ALLOWED, {});
    }

    const unsubAllowed = connectionManager.on(MSG.SHELL_ALLOWED_COMMANDS, (msg: any) => {
      setCommands(msg.payload?.commands || []);
    });

    const unsubOutput = connectionManager.on(MSG.SHELL_OUTPUT, (msg: any) => {
      const { processId, data } = msg.payload;
      if (processId === activeProcessId || !activeProcessId) {
        setOutput(prev => prev + data);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      }
    });

    const unsubExit = connectionManager.on(MSG.SHELL_EXIT, (msg: any) => {
      const { processId, code } = msg.payload;
      if (processId === activeProcessId || !activeProcessId) {
        setOutput(prev => prev + `\n[Process exited with code ${code}]\n`);
        setActiveProcessId(null);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      }
    });

    return () => {
      unsubAllowed();
      unsubOutput();
      unsubExit();
    };
  }, [status, sendEvent, activeProcessId]);

  const handleExecute = useCallback((cmd: string) => {
    if (activeProcessId) return;
    if (!cmd.trim()) return;

    // Split command for basic args
    const parts = cmd.trim().split(/\s+/);
    const exe = parts[0];
    const args = parts.slice(1);
    
    const procId = Date.now().toString();
    setActiveProcessId(procId);
    setOutput(prev => prev + `$ ${cmd.trim()}\n`);
    sendEvent(MSG.SHELL_EXEC, { cmd: exe, args, processId: procId });

    // Track history (dedup, keep last 20)
    setHistory(prev => {
      const filtered = prev.filter(h => h !== cmd.trim());
      return [cmd.trim(), ...filtered].slice(0, 20);
    });
  }, [activeProcessId, sendEvent]);

  const handleCustomSubmit = useCallback(() => {
    if (!customCmd.trim() || activeProcessId) return;
    handleExecute(customCmd.trim());
    setCustomCmd('');
  }, [customCmd, activeProcessId, handleExecute]);

  const handleKill = useCallback(() => {
    if (!activeProcessId) return;
    sendEvent(MSG.SHELL_KILL, { processId: activeProcessId });
  }, [activeProcessId, sendEvent]);

  return (
    <View style={styles.root}>
      {/* ── Terminal Output (Background) ── */}
      <View style={styles.terminalWrapper}>
        {/* Kill bar — only when a process is running */}
        {activeProcessId && (
          <View style={styles.killBar}>
            <ActivityIndicator size="small" color={Theme.colors.accent} />
            <Text style={styles.killBarText}>Process running…</Text>
            <TouchableOpacity style={styles.killBtn} onPress={handleKill}>
              <Square size={14} color="#FFF" fill="#FFF" />
              <Text style={styles.killBtnText}>Kill</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView 
          ref={scrollViewRef}
          style={styles.terminalContainer} 
          contentContainerStyle={styles.terminalContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.terminalText}>{output}</Text>
        </ScrollView>
      </View>

      {/* ── Command Interface (BottomSheet) ── */}
      <BottomSheet
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        keyboardBehavior="extend"
        keyboardBlurBehavior="none"
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetIndicator}
      >
        <View style={styles.sheetContent}>
          {/* ── Sticky Top Section ── */}
          <View style={styles.stickyHeader}>
            {/* Input Row */}
            <View style={styles.inputRow}>
              <Text style={styles.prompt}>$</Text>
              <BottomSheetTextInput
                style={styles.input}
                value={customCmd}
                onChangeText={setCustomCmd}
                onSubmitEditing={handleCustomSubmit}
                placeholder="Type command…"
                placeholderTextColor={Theme.colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                editable={!activeProcessId}
                returnKeyType="send"
              />
              <TouchableOpacity
                style={[styles.actionBtn, !customCmd.trim() && styles.actionBtnDisabled]}
                onPress={() => {
                  if (customCmd.trim()) {
                    addPreset(customCmd.trim());
                    setCustomCmd('');
                  }
                }}
                disabled={!customCmd.trim()}
              >
                <BookmarkPlus size={20} color={customCmd.trim() ? Theme.colors.textSecondary : Theme.colors.textTertiary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, (!customCmd.trim() || activeProcessId) && styles.actionBtnDisabled]}
                onPress={handleCustomSubmit}
                disabled={!customCmd.trim() || !!activeProcessId}
              >
                {activeProcessId ? (
                  <ActivityIndicator size="small" color={Theme.colors.textSecondary} />
                ) : (
                  <Send size={20} color={customCmd.trim() ? Theme.colors.accent : Theme.colors.textTertiary} />
                )}
              </TouchableOpacity>
            </View>

            {/* History Row */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
              style={styles.historyScroll}
              keyboardShouldPersistTaps="handled"
            >
              <TouchableOpacity
                style={[styles.cmdBtn, showKeyboard && styles.cmdBtnActive]}
                onPress={toggleKeyboard}
              >
                <KeyboardIcon size={14} color={showKeyboard ? Theme.colors.background : Theme.colors.textPrimary} />
                <Text style={[styles.cmdBtnText, showKeyboard && { color: Theme.colors.background }]}>Keys</Text>
              </TouchableOpacity>

              {activeProcessId && (
                <TouchableOpacity
                  style={[styles.cmdBtn, { borderColor: Theme.colors.error, backgroundColor: 'rgba(229, 72, 77, 0.1)' }]}
                  onPress={handleKill}
                >
                  <Text style={[styles.cmdBtnText, { color: Theme.colors.error }]}>Ctrl+C</Text>
                </TouchableOpacity>
              )}

              {commands.map(cmd => (
                <TouchableOpacity
                  key={cmd}
                  style={[styles.cmdBtn, activeProcessId && styles.cmdBtnDisabled]}
                  disabled={!!activeProcessId}
                  onPress={() => handleExecute(cmd)}
                >
                  <Play size={12} color={Theme.colors.accent} />
                  <Text style={styles.cmdBtnText}>{cmd}</Text>
                </TouchableOpacity>
              ))}

              {history.filter(h => !commands.includes(h) && !presets.includes(h)).map((cmd, i) => (
                <TouchableOpacity
                  key={`h-${i}`}
                  style={[styles.cmdBtn, styles.historyBtn, activeProcessId && styles.cmdBtnDisabled]}
                  disabled={!!activeProcessId}
                  onPress={() => { setCustomCmd(cmd); }}
                >
                  <Text style={[styles.cmdBtnText, { color: Theme.colors.textSecondary }]}>{cmd}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* ── Scrollable Presets Section ── */}
          {presets.length > 0 && (
            <BottomSheetScrollView 
              style={styles.scrollableArea}
              contentContainerStyle={styles.presetsList}
            >
              <View style={styles.presetHeader}>
                <View style={styles.presetTitleWrap}>
                  <Bookmark size={14} color={Theme.colors.accent} fill={Theme.colors.accent} />
                  <Text style={styles.presetTitle}>BOOKMARKED PRESETS</Text>
                </View>
                <Text style={styles.presetHelp}>Long-press to delete</Text>
              </View>

              <View style={styles.presetsGrid}>
                {presets.map((cmd, i) => (
                  <TouchableOpacity
                    key={`p-${i}`}
                    style={[styles.presetItem, activeProcessId && styles.cmdBtnDisabled]}
                    disabled={!!activeProcessId}
                    onLongPress={() => removePreset(i)}
                    onPress={() => handleExecute(cmd)}
                  >
                    <Text style={styles.presetItemText} numberOfLines={1}>{cmd}</Text>
                    <TouchableOpacity onPress={() => removePreset(i)} style={styles.trashBtn}>
                      <Trash2 size={12} color={Theme.colors.textDisabled} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Virtual Keyboard Modifier Row */}
              {showKeyboard && (
                <View style={styles.modifierWrapper}>
                  <ModifierRow
                    onKeyTap={handleModKeyTap}
                    onKeyDown={handleModKeyDown}
                    onKeyUp={handleModKeyUp}
                  />
                </View>
              )}
            </BottomSheetScrollView>
          )}
        </View>
      </BottomSheet>

      {/* Hidden text input for global keystrokes */}
      {showKeyboard && (
        <TextInput
          ref={keyboardInputRef}
          style={styles.hiddenInput}
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
          keyboardType="default"
          onChangeText={(text) => {
            handleKeyInput(text);
            setTimeout(() => keyboardInputRef.current?.clear(), 0);
          }}
          onSubmitEditing={handleKeySubmit}
          onKeyPress={(e) => { if (e.nativeEvent.key === 'Backspace') handleBackspace(); }}
          blurOnSubmit={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  terminalWrapper: {
    flex: 1,
  },
  killBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 10,
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  killBarText: {
    flex: 1,
    color: Theme.colors.textSecondary,
    fontSize: 13,
  },
  killBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Theme.colors.error,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Theme.radius.md,
  },
  killBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: Theme.fontWeight.bold,
  },
  terminalContainer: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  terminalContent: {
    padding: Theme.spacing.md,
  },
  terminalText: {
    color: '#00FF00',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'monospace',
  },

  // ── Bottom Sheet Styles ──
  sheetBackground: {
    backgroundColor: Theme.colors.surface,
  },
  sheetIndicator: {
    backgroundColor: Theme.colors.borderLight,
    width: 40,
  },
  sheetContent: {
    flex: 1,
  },
  stickyHeader: {
    paddingHorizontal: Theme.spacing.md,
    paddingBottom: Theme.spacing.sm,
  },
  scrollableArea: {
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  prompt: {
    color: Theme.colors.accent,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'monospace',
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: Theme.colors.textPrimary,
    fontSize: 15,
    fontFamily: 'monospace',
    paddingVertical: 14,
  },
  actionBtn: {
    padding: 10,
    marginLeft: 4,
  },
  actionBtnDisabled: {
    opacity: 0.3,
  },
  historyScroll: {
    marginTop: Theme.spacing.sm,
  },
  chipsRow: {
    gap: 8,
    paddingBottom: 4,
  },
  cmdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Theme.radius.md,
  },
  cmdBtnDisabled: {
    opacity: 0.5,
  },
  cmdBtnText: {
    color: Theme.colors.textPrimary,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  cmdBtnActive: {
    backgroundColor: Theme.colors.accent,
    borderColor: Theme.colors.accent,
  },
  historyBtn: {
    borderColor: Theme.colors.borderSubtle,
    backgroundColor: 'transparent',
  },

  // ── Presets Section ──
  presetsList: {
    padding: Theme.spacing.md,
    paddingTop: 8,
  },
  presetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.borderSubtle,
  },
  presetTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  presetTitle: {
    color: Theme.colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  presetHelp: {
    color: Theme.colors.textTertiary,
    fontSize: 10,
    fontStyle: 'italic',
  },
  presetsGrid: {
    gap: 8,
  },
  presetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Theme.colors.surfaceElevated,
    paddingVertical: 12,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.radius.md,
    borderLeftWidth: 3,
    borderLeftColor: Theme.colors.accent,
  },
  presetItemText: {
    color: Theme.colors.textPrimary,
    fontSize: 14,
    fontFamily: 'monospace',
    flex: 1,
  },
  trashBtn: {
    padding: 6,
    marginLeft: 12,
  },
  emptyPresets: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: Theme.colors.textTertiary,
    fontSize: 13,
  },
  modifierWrapper: {
    marginTop: Theme.spacing.lg,
    paddingTop: Theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.borderSubtle,
  },
  hiddenInput: {
    position: 'absolute',
    top: -100,
    width: 1,
    height: 1,
    opacity: 0,
  },
});
