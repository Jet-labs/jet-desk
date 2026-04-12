import React, { createContext, useContext, useEffect } from 'react';
import { useCameraPermissions, PermissionResponse } from 'expo-camera';

interface PermissionsContextValue {
  cameraPermission: PermissionResponse | null;
  requestCameraPermission: () => Promise<PermissionResponse | null>;
  hasCameraPermission: boolean;
}

const PermissionsContext = createContext<PermissionsContextValue>({
  cameraPermission: null,
  requestCameraPermission: async () => null,
  hasCameraPermission: false,
});

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  useEffect(() => {
    if (cameraPermission && !cameraPermission.granted && cameraPermission.canAskAgain) {
      // Background passive request or just leave it up to the UI to trigger
    }
  }, [cameraPermission]);

  const value: PermissionsContextValue = {
    cameraPermission,
    requestCameraPermission: async () => {
      if (!cameraPermission?.granted) {
        return await requestCameraPermission();
      }
      return cameraPermission;
    },
    hasCameraPermission: !!cameraPermission?.granted,
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => useContext(PermissionsContext);
