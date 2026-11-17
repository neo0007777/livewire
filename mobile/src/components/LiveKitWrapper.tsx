import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LiveKitRoom } from '@livekit/react-native';

interface LiveKitWrapperProps {
  serverUrl: string;
  token: string;
  connect?: boolean;
  audio?: boolean;
  video?: boolean;
  children: React.ReactNode;
}

export function LiveKitWrapper({
  serverUrl,
  token,
  connect,
  audio,
  video,
  children,
}: LiveKitWrapperProps) {
  // If serverUrl is a placeholder, skip LiveKitRoom SFU connection to avoid socket error loops and hardware camera contention
  const isPlaceholder = !serverUrl || serverUrl.includes('placeholder.livekit.cloud');

  if (isPlaceholder) {
    return <View style={styles.container}>{children}</View>;
  }

  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect={connect}
      audio={audio}
      video={video}
    >
      {children}
    </LiveKitRoom>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
