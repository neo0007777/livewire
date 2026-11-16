import React from 'react';
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
