/**
 * Mouse + Keyboard Module — LOW LATENCY
 *
 * Raw Responder system (no GestureHandler/Reanimated bridge hop).
 * 1-finger → mouse move
 * 2-finger → scroll
 * Tap < 250ms, < 10px movement → click
 * Long press > 400ms, < 10px movement → drag mode
 *
 * Gyroscope laser sends directly from the sensor callback (no rAF delay),
 * matching the trackpad's immediate dispatch behavior.
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
  Switch,
} from 'react-native';
import { Keyboard as KeyboardIcon, Crosshair, Settings, X } from 'lucide-react-native';
import { Gyroscope, Accelerometer } from 'expo-sensors';

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
  const [invertScroll, setInvertScroll] = useState(() => storage.getBoolean('invertScroll') ?? false);

  // Keep refs in sync for hot-path access (no re-render needed)
  const trackpadSensRef = useRef(trackpadSens);
  const gyroSensRef     = useRef(gyroSens);
  const invertScrollRef = useRef(invertScroll);
  useEffect(() => { trackpadSensRef.current = trackpadSens; storage.set('trackpad', trackpadSens); }, [trackpadSens]);
  useEffect(() => { gyroSensRef.current = gyroSens;         storage.set('gyro', gyroSens);         }, [gyroSens]);
  useEffect(() => { invertScrollRef.current = invertScroll; storage.set('invertScroll', invertScroll); }, [invertScroll]);

  // ── Gyro internals (complementary filter fusion) ────────────────────
  const gyroSubscription  = useRef<any>(null);
  const accelSubscription = useRef<any>(null);
  const gyroAccum         = useRef({ dx: 0, dy: 0 });

  // ── Touch state (refs = zero re-renders) ────────────────────────────

  const prevTouch      = useRef({ x: 0, y: 0, id: '' as any });
  const touchCount     = useRef(0);
  const touchStartTime = useRef(0);
  const touchStartPos  = useRef({ x: 0, y: 0 });
  const totalMovement  = useRef(0);
  const scrollAccum    = useRef(0);
  const isDragging     = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isButtonDown   = useRef(false);
  const buttonHeld     = useRef<'left' | 'right' | null>(null);

  // Pinch-to-zoom state
  const prevPinchDist     = useRef(-1);
  const pinchAccum        = useRef(0);
  const isCtrlHeldForZoom = useRef(false);
  const prevTouchCount    = useRef(0);

  // ── PanResponder trackpad (proper multi-touch on Android) ───────────
  //
  // Raw onTouchStart/Move/End do NOT reliably populate nativeEvent.touches
  // for multi-touch on Android. PanResponder properly claims the gesture
  // via the Responder system, ensuring Android dispatches all pointer data.

  const trackpadResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onShouldBlockNativeResponder: () => true,

    onPanResponderGrant: (e, _gs) => {
      const touches = e.nativeEvent.touches;
      if (!touches || touches.length === 0) return;

      const touch = e.nativeEvent.changedTouches?.[0] || touches[0];
      touchCount.current     = touches.length;
      prevTouch.current      = { x: touch.pageX, y: touch.pageY, id: touch.identifier };
      touchStartPos.current  = { x: touch.pageX, y: touch.pageY };
      touchStartTime.current = Date.now();
      totalMovement.current  = 0;
      scrollAccum.current    = 0;
      isDragging.current     = false;
      prevPinchDist.current  = -1;
      prevTouchCount.current = touches.length;

      // Long-press → drag (only for single finger, not during button-hold)
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      if (!isButtonDown.current && touches.length === 1) {
        longPressTimer.current = setTimeout(() => {
          if (totalMovement.current < 10) {
            isDragging.current = true;
            Vibration.vibrate(10);
            connectionManager.send(MSG.MOUSE_DOWN, { button: 'left' });
          }
        }, 400);
      }
    },

    onPanResponderMove: (e, gs) => {
      const touches = e.nativeEvent.touches;
      if (!touches || touches.length === 0) return;

      const numTouches = gs.numberActiveTouches;

      // Detect 1→2+ finger transition: initialize pinch baseline
      if (numTouches >= 2 && prevTouchCount.current < 2 && touches.length >= 2) {
        const t0 = touches[0];
        const t1 = touches[1];
        prevPinchDist.current = Math.hypot(t1.pageX - t0.pageX, t1.pageY - t0.pageY);
        pinchAccum.current    = 0;
        scrollAccum.current   = 0;

        // Cancel long-press when second finger appears
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }
      prevTouchCount.current = numTouches;

      // Find the tracked primary finger for deltas
      let targetTouch = touches.find((t: any) => t.identifier === prevTouch.current.id);
      if (!targetTouch) {
        targetTouch = e.nativeEvent.changedTouches?.[0] || touches[0];
        prevTouch.current = { x: targetTouch.pageX, y: targetTouch.pageY, id: targetTouch.identifier };
        return; // Skip this frame (new baseline)
      }

      const dx = targetTouch.pageX - prevTouch.current.x;
      const dy = targetTouch.pageY - prevTouch.current.y;
      prevTouch.current = { x: targetTouch.pageX, y: targetTouch.pageY, id: targetTouch.identifier };

      totalMovement.current += Math.abs(dx) + Math.abs(dy);

      if (totalMovement.current > 10 && longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      touchCount.current = numTouches;

      if (numTouches === 1) {
        // Single finger → mouse move (drag works automatically if button is toggled)
        const sens = trackpadSensRef.current;
        const rdx = Math.round(dx * sens);
        const rdy = Math.round(dy * sens);
        if (rdx !== 0 || rdy !== 0) {
          connectionManager.send(MSG.MOUSE_MOVE, { dx: rdx, dy: rdy });
        }
      } else if (numTouches >= 2 && touches.length >= 2) {
        // ── Pinch-to-zoom detection ──────────────────────────────────
        const t0 = touches[0];
        const t1 = touches[1];
        const curDist = Math.hypot(t1.pageX - t0.pageX, t1.pageY - t0.pageY);

        if (prevPinchDist.current < 0) {
          // First frame with 2 fingers — just set baseline
          prevPinchDist.current = curDist;
          return;
        }

        const deltaDist = curDist - prevPinchDist.current;
        prevPinchDist.current = curDist;

        // If fingers are spreading/pinching significantly → zoom
        const PINCH_THRESHOLD = 2; // px per frame
        if (Math.abs(deltaDist) > PINCH_THRESHOLD) {
          // Hold Ctrl on first zoom frame
          if (!isCtrlHeldForZoom.current) {
            isCtrlHeldForZoom.current = true;
            connectionManager.send(MSG.KEY_DOWN, { key: 'control' });
          }
          // Translate pinch delta into scroll ticks
          pinchAccum.current += deltaDist * 0.03;
          const zoomTicks = Math.trunc(pinchAccum.current);
          if (zoomTicks !== 0) {
            pinchAccum.current -= zoomTicks;
            connectionManager.send(MSG.MOUSE_SCROLL, { dx: 0, dy: zoomTicks });
          }
        } else {
          // ── Normal 2-finger scroll ────────────────────────────────
          scrollAccum.current += dy * SCROLL_SENSITIVITY;
          const ticks = Math.trunc(scrollAccum.current);
          if (ticks !== 0) {
            scrollAccum.current -= ticks;
            const dir = invertScrollRef.current ? 1 : -1;
            connectionManager.send(MSG.MOUSE_SCROLL, { dx: 0, dy: ticks * dir });
          }
        }
      }
    },

    onPanResponderRelease: (_e, _gs) => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      // Release Ctrl if we were zooming
      if (isCtrlHeldForZoom.current) {
        connectionManager.send(MSG.KEY_UP, { key: 'control' });
        isCtrlHeldForZoom.current = false;
        pinchAccum.current = 0;
      }

      if (isDragging.current) {
        connectionManager.send(MSG.MOUSE_UP, { button: 'left' });
        isDragging.current = false;
        touchCount.current = 0;
        prevPinchDist.current = -1;
        prevTouchCount.current = 0;
        return;
      }

      const duration = Date.now() - touchStartTime.current;
      const moved    = totalMovement.current;

      // Tap detection — skip if a button is toggled (avoids spurious clicks)
      if (moved < 10 && duration < 250 && !isButtonDown.current) {
        const button = touchCount.current >= 2 ? 'right' : 'left';
        connectionManager.send(MSG.MOUSE_CLICK, { button });
      }

      touchCount.current = 0;
      prevPinchDist.current = -1;
      prevTouchCount.current = 0;
    },

    onPanResponderTerminate: (_e, _gs) => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      if (isCtrlHeldForZoom.current) {
        connectionManager.send(MSG.KEY_UP, { key: 'control' });
        isCtrlHeldForZoom.current = false;
      }
      if (isDragging.current) {
        connectionManager.send(MSG.MOUSE_UP, { button: 'left' });
        isDragging.current = false;
      }
      touchCount.current = 0;
      prevPinchDist.current = -1;
      prevTouchCount.current = 0;
    },
  })).current;

  // ── Click button handlers (TOGGLE mode) ──────────────────────────────
  //
  // Android cannot handle simultaneous touches across separate Views.
  // Buttons use tap-to-lock / tap-to-unlock instead of press-and-hold.
  // Workflow: tap LEFT → button locks MOUSE_DOWN → drag on trackpad →
  //           tap LEFT again → releases MOUSE_UP.

  const [leftActive, setLeftActive] = useState(false);
  const [rightActive, setRightActive] = useState(false);

  const handleLeftToggle = useCallback(() => {
    if (buttonHeld.current === 'left') {
      // Release left
      connectionManager.send(MSG.MOUSE_UP, { button: 'left' });
      buttonHeld.current = null;
      isButtonDown.current = false;
      setLeftActive(false);
    } else {
      // Release whatever was held first
      if (buttonHeld.current === 'right') {
        connectionManager.send(MSG.MOUSE_UP, { button: 'right' });
        setRightActive(false);
      }
      // Hold left
      connectionManager.send(MSG.MOUSE_DOWN, { button: 'left' });
      buttonHeld.current = 'left';
      isButtonDown.current = true;
      setLeftActive(true);
      Vibration.vibrate(5);
    }
  }, []);

  const handleRightToggle = useCallback(() => {
    if (buttonHeld.current === 'right') {
      // Release right
      connectionManager.send(MSG.MOUSE_UP, { button: 'right' });
      buttonHeld.current = null;
      isButtonDown.current = false;
      setRightActive(false);
    } else {
      // Release whatever was held first
      if (buttonHeld.current === 'left') {
        connectionManager.send(MSG.MOUSE_UP, { button: 'left' });
        setLeftActive(false);
      }
      // Hold right
      connectionManager.send(MSG.MOUSE_DOWN, { button: 'right' });
      buttonHeld.current = 'right';
      isButtonDown.current = true;
      setRightActive(true);
      Vibration.vibrate(5);
    }
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

  // ── Gyroscope Laser — Complementary Filter Fusion ────────────────────────
  //
  // Fuses gyro + accelerometer to produce world-space (screen-aligned) motion.
  // Matches the industry standard (DualSense, Steam Deck, Wiimote, Switch Pro):
  //   • Gyro = high-frequency angular rate, but drifts and body-frame only
  //   • Accelerometer = gravity vector = absolute roll/pitch, noisy at high freq
  //   • Complementary filter: 98 % gyro (fast response) + 2 % accel (drift lock)
  //
  // Pipeline:
  // 1. Bias Drift Correction: dynamically tracks thermal drift at rest
  // 2. World-Frame Projection: uses complementary-filter orientation to
  //    rotate body-frame gyro rates into screen-aligned axes
  // 3. Soft Dead Zone: smoothly tapers micro-jitter to zero
  // 4. Per-Axis Adaptive EMA: fast tilts dodge lag, slow tilts get filtered
  // 5. Power Curve Ballistics: exponential acceleration curve

  const toggleLaserMode = useCallback(() => {
    setLaserMode(prev => {
      const next = !prev;
      if (next) {
        gyroAccum.current = { dx: 0, dy: 0 };

        let biasX = 0, biasY = 0, biasZ = 0;
        let restFrames = 0;
        let smoothDx = 0, smoothDy = 0;

        // Complementary filter state
        let worldPitch = 0; // radians, tilt forward/back
        let worldRoll  = 0; // radians, tilt left/right
        let lastTimestamp = 0; // hardware timestamp (ms)
        const COMP_ALPHA = 0.98; // trust gyro 98%, accel 2%
        const DT_FALLBACK = 0.016;

        // Cached trig values — only recompute when orientation changes > 0.5°
        let cachedCosRoll = 1, cachedSinRoll = 0, cachedCosPitch = 1;
        let lastTrigPitch = 0, lastTrigRoll = 0;
        const TRIG_THRESH = 0.009; // ~0.5° in radians

        const softDeadZone = (v: number, inner: number, outer: number) => {
          const abs = Math.abs(v);
          if (abs < inner) return 0;
          if (abs > outer) return v;
          const t = (abs - inner) / (outer - inner);
          return (v / abs) * abs * t;
        };

        // ── Gravity ref: accel writes at 30Hz, gyro reads atomically ──
        const gravityRef = { pitch: 0, roll: 0 };

        Accelerometer.setUpdateInterval(33); // 30Hz — enough for drift correction
        accelSubscription.current = Accelerometer.addListener(({ x, y, z }) => {
          gravityRef.pitch = Math.atan2(-x, Math.sqrt(y * y + z * z));
          gravityRef.roll  = Math.atan2(y, z);
        });

        // ── Gyroscope: integrate into world frame, project to screen ──
        Gyroscope.setUpdateInterval(4); // request 250Hz, get hardware max (~100–200Hz)
        gyroSubscription.current = Gyroscope.addListener(({ x, y, z, timestamp }) => {
          // timestamp: nanoseconds on Android, milliseconds on iOS
          const tsMs = Platform.OS === 'android' ? timestamp / 1_000_000 : timestamp;
          const dt = lastTimestamp
            ? Math.min((tsMs - lastTimestamp) / 1000, 0.05)
            : DT_FALLBACK;
          lastTimestamp = tsMs;

          const sens = gyroSensRef.current;

          // 1. Bias drift correction (body frame)
          const speed = Math.sqrt(x * x + y * y + z * z);
          if (speed < 0.5) {
            restFrames++;
            if (restFrames > 10) {
              biasX = 0.98 * biasX + 0.02 * x;
              biasY = 0.98 * biasY + 0.02 * y;
              biasZ = 0.98 * biasZ + 0.02 * z;
            }
          } else {
            restFrames = 0;
          }

          const cx = x - biasX;
          const cy = y - biasY;
          const cz = z - biasZ;

          // 2. Complementary filter: gyro integrates fast, accel anchors slow drift
          worldPitch = COMP_ALPHA * (worldPitch + cx * dt) + (1 - COMP_ALPHA) * gravityRef.pitch;
          worldRoll  = COMP_ALPHA * (worldRoll  + cz * dt) + (1 - COMP_ALPHA) * gravityRef.roll;

          // 3. Cached trig — only recompute when orientation shifts > 0.5°
          if (Math.abs(worldRoll - lastTrigRoll) > TRIG_THRESH || Math.abs(worldPitch - lastTrigPitch) > TRIG_THRESH) {
            cachedCosRoll  = Math.cos(worldRoll);
            cachedSinRoll  = Math.sin(worldRoll);
            cachedCosPitch = Math.cos(worldPitch);
            lastTrigRoll   = worldRoll;
            lastTrigPitch  = worldPitch;
          }

          // 4. Project body-frame rates into screen-aligned axes
          const screenDx = (cz * cachedCosRoll + cx * cachedSinRoll) * -sens;
          const screenDy = cx * cachedCosPitch * -sens;

          // 5. Soft dead zone
          const rawDx = softDeadZone(screenDx, 0.3, 1.2);
          const rawDy = softDeadZone(screenDy, 0.3, 1.2);

          // 6. Per-axis adaptive EMA (raised floor: 0.40 → ~25ms on slow tilts)
          const absX = Math.abs(rawDx);
          const absY = Math.abs(rawDy);

          const alphaX = absX < 0.4 ? 0 : 0.40 + Math.min(1, (absX - 0.4) / 5) * 0.50;
          const alphaY = absY < 0.4 ? 0 : 0.40 + Math.min(1, (absY - 0.4) / 5) * 0.50;

          smoothDx = alphaX * rawDx + (1 - alphaX) * smoothDx;
          smoothDy = alphaY * rawDy + (1 - alphaY) * smoothDy;

          // 7. Light ballistics — linear below 1.0, lighter curve above
          const applyBallistics = (v: number) => {
            if (v === 0) return 0;
            const sign = v < 0 ? -1 : 1;
            const abs = Math.abs(v);
            return sign * (abs < 1 ? abs * 0.6 : Math.pow(abs, 1.3) * 0.28);
          };

          gyroAccum.current.dx += applyBallistics(smoothDx);
          gyroAccum.current.dy += applyBallistics(smoothDy);

          // Send directly — NO rAF, same as trackpad
          const acc = gyroAccum.current;
          const ddx = Math.round(acc.dx);
          const ddy = Math.round(acc.dy);
          if (ddx !== 0 || ddy !== 0) {
            connectionManager.send(MSG.MOUSE_MOVE, { dx: ddx, dy: ddy });
            acc.dx -= ddx;
            acc.dy -= ddy;
          }
        });
      } else {
        gyroSubscription.current?.remove();
        gyroSubscription.current = null;
        accelSubscription.current?.remove();
        accelSubscription.current = null;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      gyroSubscription.current?.remove();
      accelSubscription.current?.remove();
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
      <View 
        style={styles.trackpad}
        {...trackpadResponder.panHandlers}
      >
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
            <Text style={styles.gestureHintText}>2 finger — scroll · pinch — zoom</Text>
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

      {/* ── Click button row (TOGGLE: tap to lock/unlock) ────────────── */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.clickBtn, leftActive && styles.clickBtnActive]}
          onPress={handleLeftToggle}
          activeOpacity={0.7}
        >
          <View style={styles.clickBtnInner}>
            <View style={[styles.clickBar, leftActive && styles.clickBarActive]} />
            <Text style={[styles.clickLabel, leftActive && styles.clickLabelActive]}>
              {leftActive ? 'LEFT  ●' : 'LEFT'}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.btnDivider} />

        <TouchableOpacity
          style={[styles.clickBtn, rightActive && styles.clickBtnActive]}
          onPress={handleRightToggle}
          activeOpacity={0.7}
        >
          <View style={styles.clickBtnInner}>
            <View style={[styles.clickBar, rightActive && styles.clickBarActive]} />
            <Text style={[styles.clickLabel, rightActive && styles.clickLabelActive]}>
              {rightActive ? 'RIGHT  ●' : 'RIGHT'}
            </Text>
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

          {/* Invert Scroll toggle */}
          <View style={styles.switchRow}>
            <Text style={styles.sliderLabel}>Invert Scroll</Text>
            <Switch
              value={invertScroll}
              onValueChange={setInvertScroll}
              trackColor={{ false: Theme.colors.surfaceElevated, true: Theme.colors.accent }}
              thumbColor={Theme.colors.textPrimary}
            />
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
  clickBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  clickBarActive: {
    backgroundColor: Theme.colors.accent,
  },
  clickLabelActive: {
    color: Theme.colors.accent,
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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