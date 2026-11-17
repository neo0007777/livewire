import { PermissionsAndroid, Platform, Alert, Linking } from 'react-native';

/**
 * Requests camera and microphone permissions required for live broadcasting on Android.
 * Returns true if camera permission is granted (with best-effort microphone access).
 */
export async function requestBroadcastPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const hasCamera = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
    const hasAudio = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);

    if (hasCamera && hasAudio) {
      return true;
    }

    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ]);

    const cameraGranted =
      hasCamera || granted[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;

    if (!cameraGranted) {
      Alert.alert(
        'Camera Permission Required',
        'LiveWire requires Camera access to broadcast live video. Please grant permission in your device settings to begin streaming.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }

    return true;
  } catch (err) {
    console.warn('Failed to check/request media permissions:', err);
    return false;
  }
}
