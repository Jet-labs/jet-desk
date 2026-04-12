import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Dimensions } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { CameraView } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, X } from 'lucide-react-native';

import { usePermissions } from '../src/contexts/PermissionsContext';
import { Theme } from '../src/constants/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ScannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hasCameraPermission, requestCameraPermission } = usePermissions();

  const [scannedData, setScannedData] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      setScannedData(null);
    }, [])
  );

  const handleBarCodeScanned = useCallback(({ data }: { data: string }) => {
    if (scannedData) return;
    try {
      let payload: any;
      if (data.startsWith('jetdesk://pair?data=')) {
        const urlParts = data.split('data=');
        if (urlParts[1]) {
          payload = JSON.parse(decodeURIComponent(urlParts[1]));
        }
      } else if (data.startsWith('jetdesk://')) {
        const rest = data.replace('jetdesk://', '');
        try {
          payload = JSON.parse(decodeURIComponent(rest));
        } catch {
          payload = JSON.parse(rest);
        }
      } else {
        payload = JSON.parse(data);
      }

      const { ip, fingerprint, hostname, pin } = payload || {};
      if (ip && fingerprint) {
        setScannedData({ ip, fingerprint, hostname: hostname || 'Unknown PC', pin });
        router.push({
          pathname: '/pair',
          params: {
            ip,
            fingerprint,
            hostname: hostname || 'Unknown PC',
            ...(pin ? { pin } : {}),
          },
        });
      } else {
        Alert.alert('Invalid QR Code', 'Missing connection parameters.');
      }
    } catch (err) {
      console.warn('[QR] Parse error:', err);
      Alert.alert('Invalid QR Code', 'Please scan a valid JetDesk QR code.');
    }
  }, [router, scannedData]);

  const handleRescan = useCallback(() => {
    setScannedData(null);
  }, []);

  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  if (!hasCameraPermission) {
    return (
      <View style={styles.cameraFallback}>
        <Camera size={56} color={Theme.colors.textSecondary} strokeWidth={1.5} />
        <Text style={styles.cameraFallbackText}>Camera access required for QR scanning</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestCameraPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backButtonFallback} onPress={handleGoBack}>
          <Text style={styles.backButtonTextFallback}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={scannedData ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />
      <View style={styles.viewfinderOverlay} pointerEvents={scannedData ? 'auto' : 'none'}>
        <View style={[styles.viewfinderCorner, styles.topLeft]} />
        <View style={[styles.viewfinderCorner, styles.topRight]} />
        <View style={[styles.viewfinderCorner, styles.bottomLeft]} />
        <View style={[styles.viewfinderCorner, styles.bottomRight]} />
        {scannedData ? (
          <TouchableOpacity style={styles.rescanButton} onPress={handleRescan}>
            <Text style={styles.rescanText}>Tap to Scan Again</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.scanHint}>Point at JetDesk QR code</Text>
        )}
      </View>

      <TouchableOpacity 
        style={[styles.backButton, { top: insets.top + 16 }]} 
        onPress={handleGoBack}
      >
        <X size={20} color="#FFF" strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.xl,
    backgroundColor: Theme.colors.background,
  },
  cameraFallbackIcon: {
    fontSize: 64,
    marginBottom: Theme.spacing.md,
  },
  cameraFallbackText: {
    color: Theme.colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: Theme.spacing.lg,
  },
  permissionButton: {
    backgroundColor: Theme.colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: Theme.radius.full,
    marginBottom: Theme.spacing.lg,
  },
  permissionButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
  },
  backButtonFallback: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backButtonTextFallback: {
    color: Theme.colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  viewfinderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewfinderCorner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: Theme.colors.accent,
    borderWidth: 3,
  },
  topLeft: {
    top: SCREEN_HEIGHT * 0.18,
    left: Dimensions.get('window').width * 0.15,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: SCREEN_HEIGHT * 0.18,
    right: Dimensions.get('window').width * 0.15,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    top: SCREEN_HEIGHT * 0.18 + 200,
    left: Dimensions.get('window').width * 0.15,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    top: SCREEN_HEIGHT * 0.18 + 200,
    right: Dimensions.get('window').width * 0.15,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 12,
  },
  scanHint: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.18 + 220,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  rescanButton: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.18 + 220,
    backgroundColor: Theme.colors.surfaceElevated,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: Theme.radius.full,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  rescanText: {
    color: Theme.colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonIcon: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
