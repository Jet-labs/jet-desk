/**
 * Button Config Modal — form for editing a single remote button
 *
 * Fields:
 *   - Label (text input)
 *   - Icon (opens IconPicker)
 *   - Action type (picker from ACTION_TYPES)
 *   - Payload builder (contextual: key selector, shortcut combo, text, etc.)
 *   - Size (1×1, 2×1, 1×2, 2×2)
 *   - Color preset (none, danger, success, accent, neutral)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Platform,
} from 'react-native';
import { Plus, X } from 'lucide-react-native';

import { Theme } from '../../constants/theme';
import { ACTION_TYPES, RemoteButton } from '../../constants/remotes';
import { IconPicker } from './IconPicker';
import { useTerminalStore } from '../../store/terminalStore';

// ─── Color presets ──────────────────────────────────────────────────────────

const COLOR_PRESETS = [
  { label: 'None',    value: '' },
  { label: 'Danger',  value: '#e5484d' },
  { label: 'Success', value: '#30a46c' },
  { label: 'Accent',  value: '#10b981' },
  { label: 'Neutral', value: '#52525b' },
] as const;

const SIZE_OPTIONS = [
  { label: '1×1', value: '1x1' as const },
  { label: '2×1', value: '2x1' as const },
  { label: '1×2', value: '1x2' as const },
  { label: '2×2', value: '2x2' as const },
] as const;

// ─── Available keys (subset of VK codes user-facing) ────────────────────────

const KEY_OPTIONS = [
  'ctrl', 'alt', 'shift', 'win',
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'enter', 'escape', 'tab', 'backspace', 'space', 'delete', 'insert',
  'pageup', 'pagedown', 'home', 'end',
  'left', 'right', 'up', 'down',
  'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
  'printscreen', 'capslock', 'numlock', 'scrolllock',
  'volume_up', 'volume_down', 'volume_mute',
  'media_play_pause', 'media_prev', 'media_next', 'media_stop',
  'browser_back', 'browser_forward', 'browser_refresh', 'browser_home',
] as const;

const MODIFIER_KEYS = ['lctrl', 'lshift', 'lalt', 'lwin'] as const;

interface ButtonConfigModalProps {
  visible: boolean;
  button: RemoteButton | null;
  onSave: (button: RemoteButton) => void;
  onCancel: () => void;
}

export function ButtonConfigModal({ visible, button, onSave, onCancel }: ButtonConfigModalProps) {
  const [label, setLabel]           = useState('');
  const [icon, setIcon]             = useState('');
  const [actionId, setActionId]     = useState<string>(ACTION_TYPES[0].id);
  const [size, setSize]             = useState<'1x1' | '2x1' | '1x2' | '2x2'>('1x1');
  const [color, setColor]           = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Payload fields
  const [key, setKey]               = useState('');
  const [modifiers, setModifiers]   = useState<string[]>([]);
  const [keys, setKeys]             = useState<string[]>([]);
  const [text, setText]             = useState('');
  const [mouseButton, setMouseButton] = useState('left');
  const [scrollDx, setScrollDx]    = useState('0');
  const [scrollDy, setScrollDy]    = useState('1');
  const [appPath, setAppPath]       = useState('');
  const [shellCmd, setShellCmd]     = useState('');

  const presets = useTerminalStore(s => s.presets);

  // Reset form when button changes
  useEffect(() => {
    if (!button) {
      setLabel(''); setIcon(''); setActionId(ACTION_TYPES[0].id);
      setSize('1x1'); setColor(''); setShowIconPicker(false);
      setKey(''); setModifiers([]); setKeys([]); setText('');
      setMouseButton('left'); setScrollDx('0'); setScrollDy('1'); setAppPath('');
      return;
    }
    setLabel(button.label || '');
    setIcon(button.icon || '');
    setActionId(button.action || ACTION_TYPES[0].id);
    setSize(button.size || '1x1');
    setColor(button.color || '');
    setShowIconPicker(false);
    const p = button.payload || {};
    setKey(p.key || '');
    setModifiers(p.modifiers || []);
    setKeys(p.keys || []);
    setText(p.text || '');
    setMouseButton(p.button || 'left');
    setScrollDx(String(p.dx ?? 0));
    setScrollDy(String(p.dy ?? 1));
    setAppPath(p.path || '');
    setShellCmd(p.cmd ? [p.cmd, ...(p.args || [])].join(' ') : '');
  }, [button]);

  const currentAction = (ACTION_TYPES.find(a => a.id === actionId) || ACTION_TYPES[0]) as any;

  const toggleModifier = (mod: string) => {
    setModifiers(prev => prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]);
  };
  const addKeyToCombo    = (k: string) => { setKeys(prev => [...prev, k]); };
  const removeKeyFromCombo = (index: number) => { setKeys(prev => prev.filter((_, i) => i !== index)); };

  const buildPayload = (): Record<string, any> => {
    if (currentAction.needsKey)    return { key, modifiers };
    if (currentAction.needsKeys)   return { keys };
    if (currentAction.needsText)   return { text };
    if (currentAction.needsButton) return { button: mouseButton };
    if (currentAction.needsScroll) return { dx: Number(scrollDx), dy: Number(scrollDy) };
    if (currentAction.needsPath)   return { path: appPath };
    if (currentAction.needsCmd) {
      const parts = shellCmd.trim().split(/\s+/);
      return { cmd: parts[0], args: parts.slice(1) };
    }
    return {};
  };

  const handleSave = () => {
    if (!label.trim()) return;
    onSave({
      id: button?.id || `btn-${Date.now()}`,
      label: label.trim(),
      icon: icon || undefined,
      action: actionId,
      payload: buildPayload(),
      size,
      color: color || undefined,
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>

          {/* ── Drag Handle ── */}
          <View style={styles.dragHandle} />

          {/* ── Header ── */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {button ? 'Edit Button' : 'New Button'}
            </Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onCancel} activeOpacity={0.6}>
              <X size={16} color={Theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>

            {/* ── Label ── */}
            <FieldLabel>Label</FieldLabel>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder="Button label"
              placeholderTextColor='#4d4d4d'
            />

            {/* ── Icon ── */}
            <FieldLabel>Icon</FieldLabel>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowIconPicker(true)} activeOpacity={0.7}>
              <Text style={styles.pickerBtnText}>{icon || 'Choose icon'}</Text>
              {icon ? (
                <View style={styles.iconDot} />
              ) : null}
            </TouchableOpacity>

            {/* ── Action type ── */}
            <FieldLabel>Action</FieldLabel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              <View style={styles.chipRow}>
                {ACTION_TYPES.map(at => (
                  <TouchableOpacity
                    key={at.id}
                    style={[styles.chip, actionId === at.id && styles.chipActive]}
                    onPress={() => setActionId(at.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, actionId === at.id && styles.chipTextActive]}>
                      {at.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* ── Payload builder ── */}
            {currentAction.needsKey && (
              <>
                <FieldLabel>Key</FieldLabel>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  <View style={styles.chipRow}>
                    {KEY_OPTIONS.map(k => (
                      <TouchableOpacity
                        key={k}
                        style={[styles.chip, key === k && styles.chipActive]}
                        onPress={() => setKey(k)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, styles.monoChipText, key === k && styles.chipTextActive]}>
                          {k}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                <FieldLabel>Modifiers</FieldLabel>
                <View style={styles.chipRow}>
                  {MODIFIER_KEYS.map(m => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.chip, modifiers.includes(m) && styles.chipActive]}
                      onPress={() => toggleModifier(m)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, styles.monoChipText, modifiers.includes(m) && styles.chipTextActive]}>
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {currentAction.needsKeys && (
              <>
                <FieldLabel>Key Sequence</FieldLabel>
                <View style={styles.comboContainer}>
                  {keys.map((k, index) => (
                    <TouchableOpacity
                      key={`${k}-${index}`}
                      style={styles.comboChip}
                      onPress={() => removeKeyFromCombo(index)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.comboChipText}>{k}</Text>
                      <X size={10} color={Theme.colors.textTertiary} />
                    </TouchableOpacity>
                  ))}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chipRow}>
                      {KEY_OPTIONS.map(k => (
                        <TouchableOpacity
                          key={k}
                          style={styles.chip}
                          onPress={() => addKeyToCombo(k)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.chipText, styles.monoChipText]}>{k}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </>
            )}

            {currentAction.needsText && (
              <>
                <FieldLabel>Text</FieldLabel>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={text}
                  onChangeText={setText}
                  placeholder="Text to type…"
                  placeholderTextColor='#4d4d4d'
                  multiline
                />
              </>
            )}

            {currentAction.needsButton && (
              <>
                <FieldLabel>Mouse Button</FieldLabel>
                <View style={styles.chipRow}>
                  {['left', 'right', 'middle'].map(b => (
                    <TouchableOpacity
                      key={b}
                      style={[styles.chip, mouseButton === b && styles.chipActive]}
                      onPress={() => setMouseButton(b)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, mouseButton === b && styles.chipTextActive]}>{b}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {currentAction.needsScroll && (
              <>
                <FieldLabel>Scroll Delta</FieldLabel>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subLabel}>DX</Text>
                    <TextInput
                      style={[styles.input, styles.inputSmall]}
                      value={scrollDx}
                      onChangeText={setScrollDx}
                      keyboardType="numeric"
                      placeholderTextColor='#4d4d4d'
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subLabel}>DY</Text>
                    <TextInput
                      style={[styles.input, styles.inputSmall]}
                      value={scrollDy}
                      onChangeText={setScrollDy}
                      keyboardType="numeric"
                      placeholderTextColor='#4d4d4d'
                    />
                  </View>
                </View>
              </>
            )}

            {currentAction.needsCmd && (
              <>
                <FieldLabel>Command</FieldLabel>
                <TextInput
                  style={styles.input}
                  value={shellCmd}
                  onChangeText={setShellCmd}
                  placeholder="e.g. shutdown /s /t 0"
                  placeholderTextColor='#4d4d4d'
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                
                {presets.length > 0 && (
                  <>
                    <FieldLabel>Use Preset</FieldLabel>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                      <View style={styles.chipRow}>
                        {presets.map((p, i) => (
                          <TouchableOpacity
                            key={`p-${i}`}
                            style={[styles.chip, shellCmd === p && styles.chipActive]}
                            onPress={() => setShellCmd(p)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.chipText, styles.monoChipText, shellCmd === p && styles.chipTextActive]}>
                              {p}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </>
                )}
              </>
            )}

            {currentAction.needsPath && (
              <>
                <FieldLabel>App Path</FieldLabel>
                <TextInput
                  style={styles.input}
                  value={appPath}
                  onChangeText={setAppPath}
                  placeholder="/Applications/Finder.app"
                  placeholderTextColor='#4d4d4d'
                  autoCapitalize="none"
                />
              </>
            )}

            {/* ── Size ── */}
            <FieldLabel>Size</FieldLabel>
            <View style={styles.segmentedRow}>
              {SIZE_OPTIONS.map((s, i) => (
                <TouchableOpacity
                  key={s.value}
                  style={[
                    styles.segmentBtn,
                    i === 0 && styles.segmentBtnFirst,
                    i === SIZE_OPTIONS.length - 1 && styles.segmentBtnLast,
                    size === s.value && styles.segmentBtnActive,
                  ]}
                  onPress={() => setSize(s.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.segmentBtnText, size === s.value && styles.segmentBtnTextActive]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Color ── */}
            <FieldLabel>Color</FieldLabel>
            <View style={styles.colorRow}>
              {COLOR_PRESETS.map(c => (
                <TouchableOpacity
                  key={c.value}
                  style={[
                    styles.colorSwatch,
                    color === c.value && styles.colorSwatchActive,
                  ]}
                  onPress={() => setColor(c.value)}
                  activeOpacity={0.7}
                >
                  {c.value ? (
                    <View style={[styles.colorDot, { backgroundColor: c.value }]} />
                  ) : (
                    <View style={styles.colorDotNone}>
                      <Text style={styles.colorDotNoneText}>–</Text>
                    </View>
                  )}
                  <Text style={[styles.colorSwatchLabel, color === c.value && styles.colorSwatchLabelActive]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

          </ScrollView>

          {/* ── Footer ── */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelFooterBtn} onPress={onCancel} activeOpacity={0.7}>
              <Text style={styles.cancelFooterText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, !label.trim() && styles.saveBtnDisabled]}
              onPress={handleSave}
              activeOpacity={0.8}
              disabled={!label.trim()}
            >
              <Text style={styles.saveText}>Save Button</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Icon picker sub-modal */}
        <IconPicker
          visible={showIconPicker}
          selected={icon}
          onSelect={(name) => { setIcon(name); setShowIconPicker(false); }}
          onCancel={() => setShowIconPicker(false)}
        />
      </View>
    </Modal>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
    maxHeight: '88%',
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2e2e2e',
  },
  headerTitle: {
    color: '#fafafa',
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.16,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 9999,
    backgroundColor: '#242424',
    borderWidth: 1,
    borderColor: '#363636',
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 6,
  },
  fieldLabel: {
    // Source Code Pro / developer console aesthetic
    color: '#898989',
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 12,
    marginBottom: 6,
  },
  subLabel: {
    color: '#4d4d4d',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#0f0f0f',
    color: '#fafafa',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2e2e2e',
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
    paddingTop: 11,
  },
  inputSmall: {
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#2e2e2e',
  },
  pickerBtnText: {
    color: '#898989',
    fontSize: 15,
  },
  iconDot: {
    width: 6,
    height: 6,
    borderRadius: 9999,
    backgroundColor: '#3ecf8e',
  },
  chipScroll: {
    marginVertical: 2,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#2e2e2e',
    backgroundColor: '#0f0f0f',
  },
  chipActive: {
    borderColor: 'rgba(62, 207, 142, 0.6)',
    backgroundColor: 'rgba(62, 207, 142, 0.08)',
  },
  chipText: {
    color: '#898989',
    fontSize: 12,
    fontWeight: '400',
  },
  monoChipText: {
    letterSpacing: 0.4,
  },
  chipTextActive: {
    color: '#3ecf8e',
    fontWeight: '500',
  },
  comboContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  comboChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#242424',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#363636',
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 5,
  },
  comboChipText: {
    color: '#fafafa',
    fontSize: 12,
  },
  // ── Segmented Control ──────────────────────────────────────────
  segmentedRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#2e2e2e',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#0f0f0f',
    height: 42,
  },
  segmentBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#2e2e2e',
  },
  segmentBtnFirst: {},
  segmentBtnLast: {
    borderRightWidth: 0,
  },
  segmentBtnActive: {
    backgroundColor: 'rgba(62, 207, 142, 0.08)',
  },
  segmentBtnText: {
    color: '#4d4d4d',
    fontSize: 13,
    fontWeight: '400',
  },
  segmentBtnTextActive: {
    color: '#3ecf8e',
    fontWeight: '500',
  },
  // ── Color Swatches ─────────────────────────────────────────────
  colorRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  colorSwatch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#2e2e2e',
    backgroundColor: '#0f0f0f',
  },
  colorSwatchActive: {
    borderColor: '#363636',
    backgroundColor: '#1a1a1a',
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 9999,
  },
  colorDotNone: {
    width: 10,
    height: 10,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#363636',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotNoneText: {
    color: '#4d4d4d',
    fontSize: 8,
    lineHeight: 10,
  },
  colorSwatchLabel: {
    color: '#898989',
    fontSize: 12,
    fontWeight: '400',
  },
  colorSwatchLabelActive: {
    color: '#fafafa',
    fontWeight: '500',
  },
  // ── Footer ────────────────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#2e2e2e',
  },
  cancelFooterBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#2e2e2e',
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
  },
  cancelFooterText: {
    color: '#898989',
    fontSize: 14,
    fontWeight: '500',
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 9999,
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#fafafa',
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.35,
  },
  saveText: {
    color: '#fafafa',
    fontSize: 14,
    fontWeight: '500',
  },
});