import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { Square, Play, Send, Keyboard as KeyboardIcon } from 'lucide-react-native';

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

  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
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
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
    >
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

      {/* Terminal output */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.terminalContainer} 
        contentContainerStyle={styles.terminalContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.terminalText}>{output}</Text>
      </ScrollView>

      {/* Modifier Row for pre-defined shortcuts */}
      {showKeyboard && (
        <View style={styles.modifierContainer}>
          <ModifierRow
            onKeyTap={handleModKeyTap}
            onKeyDown={handleModKeyDown}
            onKeyUp={handleModKeyUp}
          />
        </View>
      )}

      {/* Command Input — always visible */}
      <View style={styles.inputSection}>
        <View style={styles.inputRow}>
          <Text style={styles.prompt}>$</Text>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={customCmd}
            onChangeText={setCustomCmd}
            onSubmitEditing={handleCustomSubmit}
            placeholder="Type any command…"
            placeholderTextColor={Theme.colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            editable={!activeProcessId}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!customCmd.trim() || activeProcessId) && styles.sendBtnDisabled]}
            onPress={handleCustomSubmit}
            disabled={!customCmd.trim() || !!activeProcessId}
          >
            {activeProcessId ? (
              <ActivityIndicator size="small" color={Theme.colors.textSecondary} />
            ) : (
              <Send size={18} color={customCmd.trim() ? Theme.colors.accent : Theme.colors.textTertiary} />
            )}
          </TouchableOpacity>
        </View>

        {/* Quick Commands + History — inline below input */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          keyboardShouldPersistTaps="handled"
        >
          {/* Virtual Keyboard Toggle */}
          <TouchableOpacity
            style={[styles.cmdBtn, showKeyboard && styles.cmdBtnActive]}
            onPress={toggleKeyboard}
          >
            <KeyboardIcon size={14} color={showKeyboard ? Theme.colors.background : Theme.colors.textPrimary} />
            <Text style={[styles.cmdBtnText, showKeyboard && { color: Theme.colors.background }]}>Keyboard</Text>
          </TouchableOpacity>

          {/* Interrupt Option */}
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
            {history.filter(h => !commands.includes(h)).map((cmd, i) => (
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background,
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
  inputSection: {
    backgroundColor: Theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    paddingHorizontal: Theme.spacing.md,
    paddingTop: Theme.spacing.sm,
    paddingBottom: Theme.spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 12,
  },
  prompt: {
    color: Theme.colors.accent,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'monospace',
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: Theme.colors.textPrimary,
    fontSize: 14,
    fontFamily: 'monospace',
    paddingVertical: 12,
  },
  sendBtn: {
    padding: 8,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  chipsRow: {
    paddingTop: Theme.spacing.sm,
    gap: Theme.spacing.sm,
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
    borderRadius: Theme.radius.lg,
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
    backgroundColor: Theme.colors.textPrimary,
    borderColor: Theme.colors.textPrimary,
  },
  historyBtn: {
    borderColor: Theme.colors.borderLight,
    backgroundColor: Theme.colors.background,
  },
  modifierContainer: {
    backgroundColor: Theme.colors.surface,
    // paddingTop: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.borderLight,
  },
  hiddenInput: {
    position: 'absolute',
    top: -100,
    width: 1,
    height: 1,
    opacity: 0,
  },
});
