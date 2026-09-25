import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, shadows } from '@/src/constants/theme';
import { Room } from '@/src/types';

interface RoomCardProps {
  room: Room;
  occupied: boolean;
  onPress: (roomId: string) => void;
}

function RoomCardComponent({ room, occupied, onPress }: RoomCardProps) {
  const handlePress = React.useCallback(() => onPress(room.id), [onPress, room.id]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={'Open booking details for ' + room.name}
      onPress={handlePress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Image
        accessibilityIgnoresInvertColors
        source={{ uri: room.imageUrl }}
        style={styles.image}
      />
      <View style={styles.statusRow}>
        <View style={[styles.status, occupied ? styles.occupied : styles.available]}>
          <View style={[styles.dot, occupied ? styles.occupiedDot : styles.availableDot]} />
          <Text style={[styles.statusText, occupied ? styles.occupiedText : styles.availableText]}>
            {occupied ? 'Occupied' : 'Available now'}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.titleLine}>
          <Text numberOfLines={1} style={styles.roomName}>{room.name}</Text>
          <Ionicons color={colors.primary} name="arrow-forward-circle" size={23} />
        </View>
        <View style={styles.metaLine}>
          <Ionicons color={colors.muted} name="location-outline" size={15} />
          <Text style={styles.meta}>{'Building ' + room.building + ' · ' + room.floor}</Text>
          <View style={styles.metaSpacer} />
          <Ionicons color={colors.muted} name="people-outline" size={16} />
          <Text style={styles.meta}>{room.capacity + ' seats'}</Text>
        </View>
        <View style={styles.equipmentRow}>
          {room.equipment.slice(0, 3).map((item) => (
            <View key={item} style={styles.equipment}>
              <Text numberOfLines={1} style={styles.equipmentText}>{item}</Text>
            </View>
          ))}
          {room.equipment.length > 3 && (
            <Text style={styles.moreText}>{'+' + (room.equipment.length - 3)}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export const RoomCard = React.memo(
  RoomCardComponent,
  (previous, next) =>
    previous.room === next.room &&
    previous.occupied === next.occupied &&
    previous.onPress === next.onPress,
);

export const ROOM_CARD_HEIGHT = 238;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    height: ROOM_CARD_HEIGHT,
    marginBottom: 14,
    overflow: 'hidden',
    ...shadows.card,
  },
  image: {
    backgroundColor: '#DDE5F3',
    height: 112,
    width: '100%',
  },
  statusRow: {
    alignItems: 'flex-end',
    left: 0,
    padding: 10,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  status: {
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  available: {
    backgroundColor: colors.successSoft,
  },
  occupied: {
    backgroundColor: colors.dangerSoft,
  },
  dot: {
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  availableDot: {
    backgroundColor: colors.success,
  },
  occupiedDot: {
    backgroundColor: colors.danger,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  availableText: {
    color: colors.success,
  },
  occupiedText: {
    color: colors.danger,
  },
  body: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 11,
  },
  titleLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  roomName: {
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  metaLine: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 7,
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
    marginLeft: 3,
  },
  metaSpacer: {
    flex: 1,
  },
  equipmentRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  equipment: {
    backgroundColor: colors.chip,
    borderRadius: 8,
    maxWidth: 104,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  equipmentText: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: '700',
  },
  moreText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
});
