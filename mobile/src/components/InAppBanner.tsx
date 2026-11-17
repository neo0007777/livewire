import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/session';
import { AppNotification } from '../hooks/useInbox';
import { BroadcastIcon, UserIcon, EyeIcon, BellIcon, CloseIcon } from './Icons';

export function InAppBanner() {
  const router = useRouter();
  const { session } = useSessionStore();
  const [currentNotif, setCurrentNotif] = useState<AppNotification | null>(null);
  const [slideAnim] = useState(new Animated.Value(-100));

  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase
      .channel(`inapp_banner:${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${session.user.id}`,
        },
        (payload) => {
          const notif = payload.new as AppNotification;
          setCurrentNotif(notif);

          // Animate slide down
          Animated.spring(slideAnim, {
            toValue: 50,
            useNativeDriver: true,
            tension: 50,
            friction: 8,
          }).start();

          // Auto dismiss after 5 seconds
          const timer = setTimeout(() => {
            Animated.timing(slideAnim, {
              toValue: -100,
              duration: 250,
              useNativeDriver: true,
            }).start(() => setCurrentNotif(null));
          }, 5000);

          return () => clearTimeout(timer);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  if (!currentNotif) return null;

  const handlePress = () => {
    if (currentNotif.data?.stream_id) {
      if (currentNotif.type === 'stream_live') {
        router.push(`/(app)/watch/${currentNotif.data.stream_id}`);
      } else {
        router.push(`/(app)/summary/${currentNotif.data.stream_id}`);
      }
    }
    setCurrentNotif(null);
  };

  const renderIcon = () => {
    switch (currentNotif.type) {
      case 'stream_live':
        return <BroadcastIcon size={16} color="#EF4444" />;
      case 'new_follower':
        return <UserIcon size={16} color="#818CF8" />;
      case 'viewer_milestone':
        return <EyeIcon size={16} color="#F59E0B" />;
      default:
        return <BellIcon size={16} color="#CBD5E1" />;
    }
  };

  return (
    <Animated.View style={[styles.bannerContainer, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity style={styles.banner} activeOpacity={0.9} onPress={handlePress}>
        <View style={styles.iconBox}>
          {renderIcon()}
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {currentNotif.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {currentNotif.body}
          </Text>
        </View>

        <TouchableOpacity style={styles.closeButton} onPress={() => setCurrentNotif(null)}>
          <CloseIcon size={12} color="#94A3B8" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    maxWidth: 500,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 12,
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  body: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 16,
  },
  closeButton: {
    padding: 6,
  },
});
