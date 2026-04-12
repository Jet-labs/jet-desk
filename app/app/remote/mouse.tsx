/**
 * Mouse + Keyboard Module — LOW LATENCY
 *
 * Raw Responder system (no GestureHandler/Reanimated bridge hop).
 * 1-finger → mouse move
 * 2-finger → scroll
 * Tap < 250ms, < 10px movement → click
 * Long press > 400ms, < 10px movement → drag mode
 *
 * Gyroscope laser uses an EMA low-pass filter for smooth output
 * and a 16ms flush interval (60Hz) matched to the sensor rate.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  GestureResponderEvent,
  PanResponder,
  Vibration,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Keyboard as KeyboardIcon, Crosshair, Settings, X } from 'lucide-react-native';
import { Gyroscope } from 'expo-sensors';

import { useConnectivity }           from '../../src/contexts/ConnectivityContext';
import { connectionManager }         from '../../src/network/ConnectionManager';
import { ModifierRow }               from '../../src/components/CommandCenter/ModifierRow';
import { MSG }                       from '../../src/network/protocol';
import { Theme }                     from '../../src/constants/theme';
import { storage }                   from '../../src/store/deviceStore';

// ── Persisted settings via MMKV ───────────────────────────────────────────

function loadSensitivity(key: string, fallback: number): number {
  return storage.getNumber(key) ?? fallback;
}

const SCROLL_SENSITIVITY = 0.02;
const { width: SCREEN_W } = Dimensions.get('window');

export default function MouseModule() {
  const { sendEvent } = useConnectivity();
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [laserMode, setLaserMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const keyboardInputRef = useRef<TextInput>(null);

  // ── Configurable sensitivity ────────────────────────────────────────
  const [trackpadSens, setTrackpadSens] = useState(() => loadSensitivity('trackpad', 1.5));
  const [gyroSens, setGyroSens]         = useState(() => loadSensitivity('gyro', 50));

  // Keep refs in sync for hot-path access (no re-render needed)
  const trackpadSensRef = useRef(trackpadSens);
  const gyroSensRef     = useRef(gyroSens);
  useEffect(() => { trackpadSensRef.current = trackpadSens; storage.set('trackpad', trackpadSens); }, [trackpadSens]);
  useEffect(() => { gyroSensRef.current = gyroSens;         storage.set('gyro', gyroSens);         }, [gyroSens]);

  // ── Gyro internals ──────────────────────────────────────────────────
  const gyroSubscription = useRef<any>(null);
  const gyroFlushTimer   = useRef<ReturnType<typeof setInterval> | null>(null);
  const gyroAccum        = useRef({ dx: 0, dy: 0 });

  // ── Touch state (refs = zero re-renders) ────────────────────────────

  const prevTouch      = useRef({ x: 0, y: 0 });
  const touchCount     = useRef(0);
  const touchStartTime = useRef(0);
  const touchStartPos  = useRef({ x: 0, y: 0 });
  const totalMovement  = useRef(0);
  const scrollAccum    = useRef(0);
  const isDragging     = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Raw touch handlers ───────────────────────────────────────────────

  const handleTouchStart = useCallback((e: GestureResponderEvent) => {
    const touches = e.nativeEvent.touches;
    if (!touches || touches.length === 0) return;

    const touch = touches[0];
    touchCount.current     = touches.length;
    prevTouch.current      = { x: touch.pageX, y: touch.pageY };
    touchStartPos.current  = { x: touch.pageX, y: touch.pageY };
    touchStartTime.current = Date.now();
    totalMovement.current  = 0;
    scrollAccum.current    = 0;
    isDragging.current     = false;

    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      if (totalMovement.current < 10) {
        isDragging.current = true;
        Vibration.vibrate(10);
        connectionManager.send(MSG.MOUSE_DOWN, { button: 'left' });
      }
    }, 400);
  }, []);

  const handleTouchMove = useCallback((e: GestureResponderEvent) => {
    const touches = e.nativeEvent.touches;
    if (!touches || touches.length === 0) return;

    const touch = touches[0];
    const dx    = touch.pageX - prevTouch.current.x;
    const dy    = touch.pageY - prevTouch.current.y;
    prevTouch.current = { x: touch.pageX, y: touch.pageY };

    totalMovement.current += Math.abs(dx) + Math.abs(dy);

    if (totalMovement.current > 10 && longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    const numTouches = touches.length;
    touchCount.current = numTouches;

    if (numTouches === 1) {
      const sens = trackpadSensRef.current;
      const rdx = Math.round(dx * sens);
      const rdy = Math.round(dy * sens);
      if (rdx !== 0 || rdy !== 0) {
        connectionManager.send(MSG.MOUSE_MOVE, { dx: rdx, dy: rdy });
      }
    } else if (numTouches >= 2) {
      scrollAccum.current += dy * SCROLL_SENSITIVITY;
      const ticks = Math.trunc(scrollAccum.current);
      if (ticks !== 0) {
        scrollAccum.current -= ticks;
        connectionManager.send(MSG.MOUSE_SCROLL, { dx: 0, dy: -ticks });
      }
    }
  }, []);

  const handleTouchEnd = useCallback((e: GestureResponderEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (isDragging.current) {
      connectionManager.send(MSG.MOUSE_UP, { button: 'left' });
      isDragging.current = false;
      return;
    }

    const duration = Date.now() - touchStartTime.current;
    const moved    = totalMovement.current;

    if (moved < 10 && duration < 250) {
      const button = touchCount.current >= 2 ? 'right' : 'left';
      connectionManager.send(MSG.MOUSE_CLICK, { button });
    }

    touchCount.current = 0;
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant:          (e) => handleTouchStart(e),
      onPanResponderMove:           (e) => handleTouchMove(e),
      onPanResponderRelease:        (e) => handleTouchEnd(e),
      onPanResponderTerminate:      (e) => handleTouchEnd(e),
      onShouldBlockNativeResponder: () => true,
    })
  ).current;

  // ── Click button handlers ────────────────────────────────────────────

  const sendLeftClick  = useCallback(() => connectionManager.send(MSG.MOUSE_CLICK, { button: 'left' }),  []);
  const sendRightClick = useCallback(() => connectionManager.send(MSG.MOUSE_CLICK, { button: 'right' }), []);

  const leftButtonDown = useRef(false);
  const handleLeftPressIn   = useCallback(() => { leftButtonDown.current = true;  }, []);
  const handleLeftPressOut  = useCallback(() => { leftButtonDown.current = false; }, []);
  const handleLeftLongPress = useCallback(() => {
    connectionManager.send(MSG.MOUSE_DOWN, { button: 'left' });
    leftButtonDown.current = true;
  }, []);

  // ── Keyboard ─────────────────────────────────────────────────────────

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

  // ── Gyroscope Laser (Industry-Standard Smoothing Pipeline) ───────────────
  //
  // Matches feel of Sony DualSense / Steam Deck gyro aiming:
  // 1. Bias Drift Correction: dynamically tracks thermal drift at rest
  // 2. Soft Dead Zone: smoothly tapers micro-jitter to zero
  // 3. Per-Axis Adaptive Alpha: fast tilts dodge lag, slow tilts get filtered
  // 4. Power Curve Ballistics: exponential acceleration curve for precise
  //    slow movements and rapid fast swipes

  const toggleLaserMode = useCallback(() => {
    setLaserMode(prev => {
      const next = !prev;
      if (next) {
        gyroAccum.current = { dx: 0, dy: 0 };

        // ── Raw 1:1 Hardware Mapping (PUBG Style) ──────────────────────────────────
        //
        // Game-like gyro feel: NO smoothing, NO mouse acceleration, NO EMA lag.
        // Pure 1:1 translation from hardware sensor to screen.
        
        Gyroscope.setUpdateInterval(16); // 60Hz from hardware (SensorManager.SENSOR_DELAY_GAME)
        gyroSubscription.current = Gyroscope.addListener(({ x, y, z }) => {
          const sens = gyroSensRef.current;

          // Static Noise Floor (~1 deg/s)
          // Kills table vibration/drift without adding software latency.
          const cleanX = Math.abs(x) < 0.02 ? 0 : x;
          const cleanY = Math.abs(y) < 0.02 ? 0 : y;
          const cleanZ = Math.abs(z) < 0.02 ? 0 : z;
          
          // Ergonomic Axis Fusion & Translation
          // CRITICAL SIGN FIX: Yaw Right (-Z) and Roll Right (+Y) are naturally
          // performed together by the human wrist. We must SUBTRACT them so they
          // accumulate into movement instead of canceling each other out.
          const rawDx = (cleanZ - cleanY) * -sens; 
          const rawDy = cleanX * -sens;

          // Pure accumulation (no ballistics/curves)
          gyroAccum.current.dx += rawDx;
          gyroAccum.current.dy += rawDy;
        });

        // 5. V-Sync aligned socket transmission!
        // Android sensor callbacks often batch in heavy bursts (e.g., 3 events in 2ms, then gap).
        // Sending TLS strings instantly on bursts obliterates the React Native Bridge and causes lag.
        // We sync transmission to requestAnimationFrame to perfectly match screen-refresh pacing
        // exactly like how the PanResponder (trackpad) behaves!
        let rAFId: number = 0;
        const flushLoop = () => {
          rAFId = requestAnimationFrame(flushLoop);

          const acc = gyroAccum.current;
          const dx = Math.round(acc.dx);
          const dy = Math.round(acc.dy);

          if (dx !== 0 || dy !== 0) {
            connectionManager.send(MSG.MOUSE_MOVE, { dx, dy });
            acc.dx -= dx; // Keep fractional remainder
            acc.dy -= dy;
          }
        };
        flushLoop();

        // Save rAF id to the timer ref so we can cancel it
        gyroFlushTimer.current = rAFId as any;
      } else {
        gyroSubscription.current?.remove();
        gyroSubscription.current = null;
        if (gyroFlushTimer.current) {
          cancelAnimationFrame(gyroFlushTimer.current as any);
          gyroFlushTimer.current = null;
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      gyroSubscription.current?.remove();
      if (gyroFlushTimer.current) cancelAnimationFrame(gyroFlushTimer.current as any);
    };
  }, []);

  // ── Settings panel animation ────────────────────────────────────────
  const settingsAnim = useRef(new Animated.Value(0)).current;
  const toggleSettings = useCallback(() => {
    setShowSettings(prev => {
      Animated.timing(settingsAnim, {
        toValue: prev ? 0 : 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      return !prev;
    });
  }, [settingsAnim]);

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
    >

      {/* ── Trackpad surface ─────────────────────────────────────────── */}
      <View style={styles.trackpad} {...panResponder.panHandlers}>
        <View style={styles.crosshairH} />
        <View style={styles.crosshairV} />
        <View style={styles.trackpadCorner_TL} />
        <View style={styles.trackpadCorner_TR} />
        <View style={styles.trackpadCorner_BL} />
        <View style={styles.trackpadCorner_BR} />

        {laserMode && (
          <View style={styles.laserIndicator} pointerEvents="none">
            <Crosshair size={32} color={Theme.colors.accent} strokeWidth={1.5} />
            <Text style={styles.laserLabel}>GYRO ACTIVE</Text>
          </View>
        )}

        <View style={styles.gestureHints} pointerEvents="none">
          <View style={styles.gestureHintRow}>
            <Text style={styles.gestureHintText}>1 finger — move</Text>
          </View>
          <View style={styles.gestureHintRow}>
            <Text style={styles.gestureHintText}>2 finger — scroll</Text>
          </View>
        </View>
      </View>

      {/* ── Modifier row (keyboard mode only) ────────────────────────── */}
      {showKeyboard && (
        <ModifierRow
          onKeyTap={handleModKeyTap}
          onKeyDown={handleModKeyDown}
          onKeyUp={handleModKeyUp}
        />
      )}

      {/* ── Click button row ─────────────────────────────────────────── */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.clickBtn}
          onPress={sendLeftClick}
          onPressIn={handleLeftPressIn}
          onPressOut={handleLeftPressOut}
          onLongPress={handleLeftLongPress}
          delayLongPress={400}
          activeOpacity={0.55}
        >
          <View style={styles.clickBtnInner}>
            <View style={styles.clickBar} />
            <Text style={styles.clickLabel}>LEFT</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.btnDivider} />

        <TouchableOpacity
          style={styles.clickBtn}
          onPress={sendRightClick}
          activeOpacity={0.55}
        >
          <View style={styles.clickBtnInner}>
            <View style={styles.clickBar} />
            <Text style={styles.clickLabel}>RIGHT</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── FAB Container ────────────────────────────────────────────── */}
      <View style={styles.fabContainer}>
        {/* Settings FAB */}
        <TouchableOpacity
          style={[styles.fab, showSettings && styles.fabActive]}
          onPress={toggleSettings}
          activeOpacity={0.7}
        >
          {showSettings
            ? <X size={20} color="#FFFFFF" strokeWidth={2} />
            : <Settings size={20} color={Theme.colors.textSecondary} strokeWidth={2} />}
        </TouchableOpacity>

        {/* Laser FAB */}
        <TouchableOpacity
          style={[styles.fab, laserMode && styles.fabActive]}
          onPress={toggleLaserMode}
          activeOpacity={0.7}
        >
          <Crosshair size={22} color={laserMode ? '#FFFFFF' : Theme.colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>

        {/* Keyboard FAB */}
        <TouchableOpacity
          style={[styles.fab, showKeyboard && styles.fabActive]}
          onPress={toggleKeyboard}
          activeOpacity={0.7}
        >
          <KeyboardIcon size={22} color={showKeyboard ? '#FFFFFF' : Theme.colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* ── Settings Panel ───────────────────────────────────────────── */}
      {showSettings && (
        <Animated.View
          style={[
            styles.settingsPanel,
            {
              opacity: settingsAnim,
              transform: [{ translateY: settingsAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            },
          ]}
        >
          <Text style={styles.settingsTitle}>Sensitivity</Text>

          {/* Trackpad slider */}
          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>Trackpad</Text>
            <View style={styles.sliderTrack}>
              <View style={[styles.sliderFill, { width: `${((trackpadSens - 0.5) / 4.5) * 100}%` }]} />
              <View
                style={[styles.sliderThumb, { left: `${((trackpadSens - 0.5) / 4.5) * 100}%` }]}
                {...PanResponder.create({
                  onStartShouldSetPanResponder: () => true,
                  onMoveShouldSetPanResponder: () => true,
                  onPanResponderMove: (_, gs) => {
                    const trackWidth = SCREEN_W - 160; // approx usable width
                    const pct = Math.max(0, Math.min(1, (gs.moveX - 100) / trackWidth));
                    setTrackpadSens(Math.round((0.5 + pct * 4.5) * 10) / 10);
                  },
                }).panHandlers}
              />
            </View>
            <Text style={styles.sliderValue}>{trackpadSens.toFixed(1)}</Text>
          </View>

          {/* Gyro slider */}
          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>Gyroscope</Text>
            <View style={styles.sliderTrack}>
              <View style={[styles.sliderFill, { width: `${((gyroSens - 10) / 90) * 100}%` }]} />
              <View
                style={[styles.sliderThumb, { left: `${((gyroSens - 10) / 90) * 100}%` }]}
                {...PanResponder.create({
                  onStartShouldSetPanResponder: () => true,
                  onMoveShouldSetPanResponder: () => true,
                  onPanResponderMove: (_, gs) => {
                    const trackWidth = SCREEN_W - 160;
                    const pct = Math.max(0, Math.min(1, (gs.moveX - 100) / trackWidth));
                    setGyroSens(Math.round(10 + pct * 90));
                  },
                }).panHandlers}
              />
            </View>
            <Text style={styles.sliderValue}>{gyroSens}</Text>
          </View>
        </Animated.View>
      )}

      {/* ── Hidden text input ────────────────────────────────────────── */}
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

// ── Styles ─────────────────────────────────────────────────────────────────

const CORNER_SIZE   = 16;
const CORNER_WEIGHT = 1.5;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },

  // ── Trackpad ─────────────────────────────────────────────────────────
  trackpad: {
    flex: 1,
    backgroundColor: Theme.colors.surface,
    margin: Theme.spacing.md,
    borderRadius: Theme.radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },

  // Subtle center crosshair
  crosshairH: {
    position: 'absolute',
    left: '25%',
    right: '25%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  crosshairV: {
    position: 'absolute',
    top: '25%',
    bottom: '25%',
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },

  // Corner markers (visual affordance)
  trackpadCorner_TL: { position: 'absolute', top: 16, left: 16, width: CORNER_SIZE, height: CORNER_SIZE, borderTopWidth: CORNER_WEIGHT, borderLeftWidth: CORNER_WEIGHT, borderColor: 'rgba(255,255,255,0.10)', borderTopLeftRadius: 4 },
  trackpadCorner_TR: { position: 'absolute', top: 16, right: 16, width: CORNER_SIZE, height: CORNER_SIZE, borderTopWidth: CORNER_WEIGHT, borderRightWidth: CORNER_WEIGHT, borderColor: 'rgba(255,255,255,0.10)', borderTopRightRadius: 4 },
  trackpadCorner_BL: { position: 'absolute', bottom: 16, left: 16, width: CORNER_SIZE, height: CORNER_SIZE, borderBottomWidth: CORNER_WEIGHT, borderLeftWidth: CORNER_WEIGHT, borderColor: 'rgba(255,255,255,0.10)', borderBottomLeftRadius: 4 },
  trackpadCorner_BR: { position: 'absolute', bottom: 16, right: 16, width: CORNER_SIZE, height: CORNER_SIZE, borderBottomWidth: CORNER_WEIGHT, borderRightWidth: CORNER_WEIGHT, borderColor: 'rgba(255,255,255,0.10)', borderBottomRightRadius: 4 },

  // Laser indicator
  laserIndicator: {
    position: 'absolute',
    alignItems: 'center',
    gap: 8,
    opacity: 0.6,
  },
  laserLabel: {
    color: Theme.colors.accent,
    fontSize: Theme.fontSize.micro,
    fontWeight: Theme.fontWeight.bold,
    letterSpacing: 2,
  },

  // Gesture hints
  gestureHints: {
    position: 'absolute',
    bottom: 24,
    gap: 4,
    alignItems: 'center',
  },
  gestureHintRow: {},
  gestureHintText: {
    color: 'rgba(255,255,255,0.40)',
    fontSize: Theme.fontSize.caption,
    fontWeight: Theme.fontWeight.medium,
    letterSpacing: 0.3,
  },

  // ── Click buttons ─────────────────────────────────────────────────────
  buttonRow: {
    flexDirection: 'row',
    height: 76,
    marginHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.colors.border,
    overflow: 'hidden',
  },
  clickBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clickBtnInner: {
    alignItems: 'center',
    gap: 6,
  },
  clickBar: {
    width: 40,
    height: 3,
    borderRadius: 2,
    backgroundColor: Theme.colors.surfaceHighlight,
  },
  clickLabel: {
    color: 'rgba(255,255,255,0.40)',
    fontSize: Theme.fontSize.micro,
    fontWeight: Theme.fontWeight.bold,
    letterSpacing: 1,
  },
  btnDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: Theme.colors.border,
    marginVertical: 16,
  },

  // ── FAB Container ────────────────────────────────────────────────────
  fabContainer: {
    position: 'absolute',
    right: Theme.spacing.md + Theme.spacing.sm,
    bottom: 76 + Theme.spacing.md + Theme.spacing.sm,
    flexDirection: 'row',
    gap: Theme.spacing.md,
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: Theme.radius.full,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadow.md,
  },
  fabActive: {
    backgroundColor: Theme.colors.accent,
    borderColor: Theme.colors.accent,
    ...Theme.shadow.accent,
  },

  // ── Settings Panel ──────────────────────────────────────────────────
  settingsPanel: {
    position: 'absolute',
    left: Theme.spacing.md,
    right: Theme.spacing.md,
    bottom: 76 + Theme.spacing.md + 48 + Theme.spacing.lg + Theme.spacing.sm,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.lg,
  },
  settingsTitle: {
    color: Theme.colors.textTertiary,
    fontSize: Theme.fontSize.caption,
    fontWeight: Theme.fontWeight.bold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  sliderLabel: {
    width: 80,
    color: Theme.colors.textSecondary,
    fontSize: Theme.fontSize.sm,
    fontWeight: Theme.fontWeight.medium,
  },
  sliderTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Theme.colors.surfaceElevated,
    borderRadius: Theme.radius.full,
    position: 'relative',
    justifyContent: 'center',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    height: '100%',
    backgroundColor: Theme.colors.accent,
    borderRadius: Theme.radius.full,
  },
  sliderThumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Theme.colors.textPrimary,
    borderWidth: 2,
    borderColor: Theme.colors.accent,
    marginLeft: -11,
  },
  sliderValue: {
    width: 36,
    color: Theme.colors.textPrimary,
    fontSize: Theme.fontSize.sm,
    fontWeight: Theme.fontWeight.bold,
    textAlign: 'right',
  },

  // ── Hidden input ──────────────────────────────────────────────────────
  hiddenInput: {
    position: 'absolute',
    top: -100,
    width: 1,
    height: 1,
    opacity: 0,
  },
});