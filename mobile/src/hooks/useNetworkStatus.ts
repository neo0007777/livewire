import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export interface NetworkStatus {
  isOnline: boolean;
  isInternetReachable: boolean | null;
  connectionType: string;
}

export function useNetworkStatus(onReconnect?: () => void): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: true,
    isInternetReachable: true,
    connectionType: 'unknown',
  });

  useEffect(() => {
    // For Web platform fallback
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleOnline = () => {
        setStatus((prev) => ({ ...prev, isOnline: true, isInternetReachable: true }));
        onReconnect?.();
      };
      const handleOffline = () => {
        setStatus((prev) => ({ ...prev, isOnline: false, isInternetReachable: false }));
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      setStatus({
        isOnline: navigator.onLine,
        isInternetReachable: navigator.onLine,
        connectionType: 'browser',
      });

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    // Native platform (Android / iOS) via NetInfo
    let wasOffline = false;

    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);

      setStatus({
        isOnline,
        isInternetReachable: state.isInternetReachable,
        connectionType: state.type || 'unknown',
      });

      if (isOnline && wasOffline) {
        onReconnect?.();
      }
      wasOffline = !isOnline;
    });

    // Check initial state
    NetInfo.fetch().then((state) => {
      const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      setStatus({
        isOnline,
        isInternetReachable: state.isInternetReachable,
        connectionType: state.type || 'unknown',
      });
    });

    return () => {
      unsubscribe();
    };
  }, [onReconnect]);

  return status;
}

