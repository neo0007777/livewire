import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/session';
import { AppNotification } from '../hooks/useInbox';

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

  return (
    <Animated.View style={[styles.bannerContainer, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity style={styles.banner} activeOpacity={0.9} onPress={handlePress}>
        <View style={styles.iconBox}>
          <Text style={styles.icon}>
            {currentNotif.type === 'stream_live'
              ? '🔴'
              : currentNotif.type === 'new_follower'
              ? '👤'
              : currentNotif.type === 'viewer_milestone'
              ? '🎉'
              : '🔔'}
          </Text>
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
          <Text style={styles.closeText}>✕</Text>
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
  },
  banner: {
    backgroundColor: '#1E1B4B',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4338CA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#312E81',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 18,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  body: {
    color: '#C7D2FE',
    fontSize: 12,
    lineHeight: 16,
  },
  closeButton: {
    padding: 6,
    marginLeft: 8,
  },
  closeText: {
    color: '#A5B4FC',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

