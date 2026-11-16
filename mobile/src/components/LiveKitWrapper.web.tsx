import React from 'react';
import { View, StyleSheet } from 'react-native';

interface LiveKitWrapperProps {
  serverUrl: string;
  token: string;
  connect?: boolean;
  audio?: boolean;
  video?: boolean;
  children: React.ReactNode;
}

export function LiveKitWrapper({ children }: LiveKitWrapperProps) {
  return <View style={styles.container}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
