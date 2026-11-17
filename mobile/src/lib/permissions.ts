import { PermissionsAndroid, Platform, Alert, Linking } from 'react-native';

/**
 * Requests camera and microphone permissions required for live broadcasting on Android.
 * Returns true if both permissions are granted, false otherwise.
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
      granted[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
    const audioGranted =
      granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;

    if (!cameraGranted || !audioGranted) {
      Alert.alert(
        'Camera & Mic Permissions Required',
        'LiveWire requires Camera and Microphone access to broadcast live video. Please grant permissions in your device settings to begin streaming.',
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
