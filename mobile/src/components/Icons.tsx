import React from 'react';
import { View, StyleSheet, Text } from 'react-native';

interface IconProps {
  size?: number;
  color?: string;
}

// Minimalist Microphone Icon
export function MicIcon({ size = 16, color = '#F8FAFC' }: IconProps) {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View
        style={{
          width: size * 0.44,
          height: size * 0.62,
          borderRadius: size * 0.22,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          width: size * 0.72,
          height: size * 0.36,
          borderBottomLeftRadius: size * 0.36,
          borderBottomRightRadius: size * 0.36,
          borderWidth: 1.5,
          borderColor: color,
          borderTopWidth: 0,
          marginTop: -size * 0.16,
        }}
      />
      <View style={{ width: 1.5, height: size * 0.16, backgroundColor: color }} />
      <View style={{ width: size * 0.45, height: 1.5, backgroundColor: color }} />
    </View>
  );
}

// Minimalist Muted Microphone Icon (with diagonal slash)
export function MicMutedIcon({ size = 16, color = '#EF4444' }: IconProps) {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
      <MicIcon size={size} color={color} />
      <View
        style={{
          position: 'absolute',
          width: size * 1.1,
          height: 1.8,
          backgroundColor: color,
          transform: [{ rotate: '-45deg' }],
          borderRadius: 1,
        }}
      />
    </View>
  );
}

// Minimalist Video Camera Icon
export function VideoCameraIcon({ size = 16, color = '#F8FAFC' }: IconProps) {
  return (
    <View style={{ width: size, height: size * 0.75, flexDirection: 'row', alignItems: 'center' }}>
      <View
        style={{
          flex: 1,
          height: '100%',
          backgroundColor: color,
          borderRadius: 3,
        }}
      />
      <View
        style={{
          width: 0,
          height: 0,
          borderTopWidth: size * 0.25,
          borderTopColor: 'transparent',
          borderBottomWidth: size * 0.25,
          borderBottomColor: 'transparent',
          borderRightWidth: size * 0.35,
          borderRightColor: color,
          marginLeft: 2,
        }}
      />
    </View>
  );
}

// Minimalist Video Camera Off Icon
export function VideoCameraOffIcon({ size = 16, color = '#EF4444' }: IconProps) {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
      <VideoCameraIcon size={size} color={color} />
      <View
        style={{
          position: 'absolute',
          width: size * 1.1,
          height: 1.8,
          backgroundColor: color,
          transform: [{ rotate: '-45deg' }],
          borderRadius: 1,
        }}
      />
    </View>
  );
}

// Minimalist Camera Flip / Switch Icon
export function FlipCameraIcon({ size = 16, color = '#F8FAFC' }: IconProps) {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View
        style={{
          width: size * 0.85,
          height: size * 0.85,
          borderRadius: size * 0.425,
          borderWidth: 1.5,
          borderColor: color,
          borderTopColor: 'transparent',
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 0,
          right: size * 0.15,
          width: 0,
          height: 0,
          borderLeftWidth: size * 0.18,
          borderLeftColor: 'transparent',
          borderRightWidth: size * 0.18,
          borderRightColor: 'transparent',
          borderBottomWidth: size * 0.25,
          borderBottomColor: color,
        }}
      />
    </View>
  );
}

// Minimalist Eye / Viewer Icon
export function EyeIcon({ size = 14, color = '#94A3B8' }: IconProps) {
  return (
    <View
      style={{
        width: size,
        height: size * 0.65,
        borderRadius: size * 0.35,
        borderWidth: 1.5,
        borderColor: color,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: size * 0.32,
          height: size * 0.32,
          borderRadius: size * 0.16,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

// Minimalist Screen / Monitor Icon
export function MonitorIcon({ size = 18, color = '#64748B' }: IconProps) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size * 0.9,
          height: size * 0.65,
          borderRadius: 3,
          borderWidth: 1.5,
          borderColor: color,
        }}
      />
      <View style={{ width: 2, height: size * 0.15, backgroundColor: color }} />
      <View style={{ width: size * 0.5, height: 1.5, backgroundColor: color }} />
    </View>
  );
}

// Minimalist Bell Icon
export function BellIcon({ size = 18, color = '#64748B' }: IconProps) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size * 0.75,
          height: size * 0.65,
          borderTopLeftRadius: size * 0.4,
          borderTopRightRadius: size * 0.4,
          borderBottomLeftRadius: 2,
          borderBottomRightRadius: 2,
          borderWidth: 1.5,
          borderColor: color,
        }}
      />
      <View
        style={{
          width: size * 0.28,
          height: size * 0.15,
          borderBottomLeftRadius: size * 0.15,
          borderBottomRightRadius: size * 0.15,
          backgroundColor: color,
          marginTop: 1,
        }}
      />
    </View>
  );
}

// Minimalist User Icon
export function UserIcon({ size = 18, color = '#64748B' }: IconProps) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size * 0.45,
          height: size * 0.45,
          borderRadius: size * 0.23,
          borderWidth: 1.5,
          borderColor: color,
          marginBottom: 1,
        }}
      />
      <View
        style={{
          width: size * 0.8,
          height: size * 0.35,
          borderTopLeftRadius: size * 0.35,
          borderTopRightRadius: size * 0.35,
          borderWidth: 1.5,
          borderColor: color,
        }}
      />
    </View>
  );
}

// Minimalist Broadcast Target / Radio Pulse
export function BroadcastIcon({ size = 20, color = '#EF4444' }: IconProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: color,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: size * 0.4,
          height: size * 0.4,
          borderRadius: size * 0.2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

// Minimalist Send Arrow Icon
export function SendIcon({ size = 16, color = '#FFF' }: IconProps) {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View
        style={{
          width: 0,
          height: 0,
          borderTopWidth: size * 0.32,
          borderTopColor: 'transparent',
          borderBottomWidth: size * 0.32,
          borderBottomColor: 'transparent',
          borderLeftWidth: size * 0.6,
          borderLeftColor: color,
          marginLeft: 2,
        }}
      />
    </View>
  );
}

// Minimalist Close / Cross Icon
export function CloseIcon({ size = 14, color = '#94A3B8' }: IconProps) {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: size * 0.9,
          height: 1.6,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
          borderRadius: 1,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: size * 0.9,
          height: 1.6,
          backgroundColor: color,
          transform: [{ rotate: '-45deg' }],
          borderRadius: 1,
        }}
      />
    </View>
  );
}

// Minimalist Checkmark Icon
export function CheckIcon({ size = 14, color = '#22C55E' }: IconProps) {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View
        style={{
          width: size * 0.35,
          height: size * 0.65,
          borderColor: color,
          borderBottomWidth: 1.8,
          borderRightWidth: 1.8,
          transform: [{ rotate: '45deg' }],
          marginBottom: size * 0.15,
        }}
      />
    </View>
  );
}
