import { Platform } from 'react-native';
import * as RN from 'react-native';

if (Platform.OS === 'web' && !(RN as any).requireNativeComponent) {
  (RN as any).requireNativeComponent = () => 'div';
}
