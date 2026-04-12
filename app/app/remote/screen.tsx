/**
 * Screen Mirroring Module
 * Displays PC screen via Base64 frames over TLS
 * Controls auto-hide after 3 seconds
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Monitor, AlertTriangle, Square, Settings, Cast } from 'lucide-react-native';

import { useDeviceStore } from '../../src/store/deviceStore';
import { useConnectivity } from '../../src/contexts/ConnectivityContext';
import { Theme } from '../../src/constants/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function ScreenModule() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [quality, setQuality] = useState(60);
  const [fps, setFps] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const devices = useDeviceStore(s => s.devices);
  const activeDeviceId = useDeviceStore(s => s.activeDeviceId);
  const activeDevice = devices.find(d => d.id === activeDeviceId);
  const sessionToken = activeDevice?.sessionToken;

  const { currentFrame, startScreenStream, stopScreenStream, castToPc } = useConnectivity();
  const [displayedFrame, setDisplayedFrame] = useState<string | null>(null);

  useEffect(() => {
    if (!currentFrame) setDisplayedFrame(null);
  }, [currentFrame]);

  useEffect(() => {
    return () => {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
      stopScreenStream();
    };
  }, [stopScreenStream]);

  const handleTap = useCallback(() => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  const toggleStream = useCallback(() => {
    setIsStreaming(prev => {
      if (!prev) {
        startScreenStream(fps, quality, 0.5);
      } else {
        stopScreenStream();
      }
      return !prev;
    });
    setError(null);
  }, [fps, quality, startScreenStream, stopScreenStream]);

  const cycleQuality = useCallback(() => {
    setQuality(prev => {
      const nextQ = prev === 60 ? 80 : (prev === 80 ? 40 : 60);
      if (isStreaming) {
        startScreenStream(fps, nextQ, 0.5);
      }
      return nextQ;
    });
  }, [fps, isStreaming, startScreenStream]);

  return (
    <View style={styles.container}>
      {!isStreaming ? (
        <View style={styles.idleContainer}>
          <View style={styles.idleIconWrap}>
            <Monitor size={48} color={Theme.colors.textSecondary} strokeWidth={1.5} />
          </View>
          <Text style={styles.idleTitle}>Screen Mirror</Text>
          <Text style={styles.idleSubtitle}>
            View your PC screen in real-time
          </Text>
          {!sessionToken && (
            <View style={styles.warnRow}>
              <AlertTriangle size={14} color={Theme.colors.warning} strokeWidth={2} />
              <Text style={styles.warnText}>
                Session token required. Connect via Mouse tab first.
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.startButton, !sessionToken && styles.startButtonDisabled]}
            onPress={toggleStream}
            disabled={!sessionToken}
          >
            <Monitor size={18} color="#0f0f0f" strokeWidth={2.5} />
            <Text style={styles.startButtonText}>Start Stream</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.castButton, !sessionToken && styles.startButtonDisabled]}
            onPress={castToPc}
            disabled={!sessionToken}
          >
            <Cast size={16} color={Theme.colors.textSecondary} strokeWidth={2} />
            <Text style={styles.castButtonText}>Cast Phone to PC</Text>
          </TouchableOpacity>
          <Text style={styles.hintText}>
            Uses base64 over TLS
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.streamContainer}
          activeOpacity={1}
          onPress={handleTap}
        >
          {/* Double Buffer Background (Persists the last loaded frame) */}
          {displayedFrame && (
            <ExpoImage
              source={{ uri: displayedFrame }}
              style={[styles.streamImage, { position: 'absolute' }]}
              contentFit="contain"
              transition={0}
              cachePolicy="none"
              recyclingKey="buffer-bg"
            />
          )}

          {/* Double Buffer Foreground (Loads the newest frame) */}
          {currentFrame && (
            <ExpoImage
              source={{ uri: currentFrame }}
              style={[styles.streamImage, { position: 'absolute' }]}
              contentFit="contain"
              transition={0}
              cachePolicy="none"
              recyclingKey="buffer-fg"
              onLoad={() => setDisplayedFrame(currentFrame)}
            />
          )}

          {error && (
            <View style={styles.errorOverlay}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Auto-hiding controls overlay */}
          {showControls && (
            <View style={styles.controlsOverlay}>
              <TouchableOpacity style={styles.controlPill} onPress={toggleStream}>
                <Square size={14} color="#FFF" strokeWidth={2.5} />
                <Text style={styles.controlPillText}>Stop</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.controlPill} onPress={cycleQuality}>
                <Settings size={14} color="#FFF" strokeWidth={2} />
                <Text style={styles.controlPillText}>Q: {quality}%</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Idle
  idleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.xl,
  },
  idleIconWrap: {
    width: 88,
    height: 88,
    borderRadius: Theme.radius.xxl,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  idleTitle: {
    color: Theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  idleSubtitle: {
    color: Theme.colors.textSecondary,
    fontSize: 15,
    marginBottom: 32,
    textAlign: 'center',
  },
  warnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  warnText: {
    color: Theme.colors.warning,
    fontSize: 13,
    textAlign: 'center',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Theme.colors.accent,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: Theme.radius.full,
    marginBottom: 16,
  },
  startButtonDisabled: {
    opacity: 0.4,
  },
  startButtonText: {
    color: '#0f0f0f',
    fontSize: 17,
    fontWeight: '500',
  },
  castButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: Theme.radius.full,
    marginBottom: 24,
  },
  castButtonText: {
    color: Theme.colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  hintText: {
    color: Theme.colors.textTertiary,
    fontSize: 13,
  },

  // Stream
  streamContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  streamImage: {
    width: SCREEN_W,
    height: SCREEN_H,
  },

  // Controls
  controlsOverlay: {
    position: 'absolute',
    bottom: 40,
    flexDirection: 'row',
    gap: 12,
  },
  controlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: Theme.radius.full,
  },
  controlPillText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Error
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  errorText: {
    color: Theme.colors.error,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
