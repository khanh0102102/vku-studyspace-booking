import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Alert } from 'react-native';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FilterChip } from '@/src/components/FilterChip';
import { ROOM_CARD_HEIGHT, RoomCard } from '@/src/components/RoomCard';
import { colors } from '@/src/constants/theme';
import { signOut } from '@/src/services/auth';
import { ROOMS } from '@/src/data/rooms';
import { useBookingStore } from '@/src/store/useBookingStore';
import { BookingFilters, Building, Equipment, RootStackParamList, Room } from '@/src/types';
import { isRoomOccupiedNow } from '@/src/utils/booking';

type Props = NativeStackScreenProps<RootStackParamList, 'Discover'>;

const BUILDINGS: Array<Building | 'All'> = ['All', 'A', 'B', 'C', 'V'];
const CAPACITIES: Array<number | null> = [null, 2, 6, 10, 15, 20];
const EQUIPMENT: Array<Equipment | 'All'> = [
  'All',
  'Projector',
  'Whiteboard',
  'High-spec PC',
  'AC',
];

function capacityLabel(capacity: number | null) {
  return capacity === null ? 'Any size' : capacity + '+ seats';
}

function buildingLabel(building: Building | 'All') {
  return building === 'All' ? 'All buildings' : 'Building ' + building;
}

function matchesFilters(room: Room, filters: BookingFilters): boolean {
  const normalizedSearch = filters.query.trim().toLowerCase();
  const textMatches =
    normalizedSearch.length === 0 ||
    room.name.toLowerCase().includes(normalizedSearch) ||
    room.building.toLowerCase().includes(normalizedSearch) ||
    room.floor.toLowerCase().includes(normalizedSearch);
  const buildingMatches = filters.building === 'All' || room.building === filters.building;
  const capacityMatches = filters.minCapacity === null || room.capacity >= filters.minCapacity;
  const equipmentMatches =
    filters.equipment === 'All' || room.equipment.includes(filters.equipment);

  return textMatches && buildingMatches && capacityMatches && equipmentMatches;
}

export function DiscoverScreen({ navigation }: Props) {
  const filters = useBookingStore((state) => state.filters);
  const reservations = useBookingStore((state) => state.availabilityReservations);
  const session = useBookingStore((state) => state.session);
  const ownReservations = useBookingStore((state) => state.reservations);
  const realtimeStatus = useBookingStore((state) => state.realtimeStatus);
  const syncAvailability = useBookingStore((state) => state.syncAvailability);
  const updateFilters = useBookingStore((state) => state.updateFilters);
  const resetFilters = useBookingStore((state) => state.resetFilters);
  const [now, setNow] = React.useState(() => new Date());
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    const intervalId = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(intervalId);
  }, []);

  const filteredRooms = React.useMemo(
    () => ROOMS.filter((room) => matchesFilters(room, filters)),
    [filters],
  );

  const upcomingBookingCount = React.useMemo(
    () =>
      ownReservations.filter(
        (reservation) =>
          reservation.status !== 'cancelled' &&
          new Date(reservation.endAt).getTime() > now.getTime(),
      ).length,
    [now, ownReservations],
  );

  const refresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await syncAvailability();
      setNow(new Date());
    } catch (error) {
      Alert.alert(
        'Could not refresh availability',
        error instanceof Error ? error.message : 'Please try again in a moment.',
      );
    } finally {
      setRefreshing(false);
    }
  }, [syncAvailability]);

  const openRoom = React.useCallback(
    (roomId: string) => navigation.navigate('RoomDetails', { roomId }),
    [navigation],
  );

  const renderRoom = React.useCallback(
    ({ item }: { item: Room }) => (
      <RoomCard
        occupied={isRoomOccupiedNow(item, reservations, now)}
        onPress={openRoom}
        room={item}
      />
    ),
    [now, openRoom, reservations],
  );

  const header = (
    <View>
      <View style={styles.topBar}>
        <View style={styles.greetingBlock}>
          <Text style={styles.greeting}>
            Good day, {session?.fullName.split(' ').slice(-1)[0] || 'Student'} 👋
          </Text>
          <Text style={styles.subGreeting}>Find your ideal place to study.</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel="Open my bookings"
            onPress={() => navigation.navigate('MyBookings')}
            style={({ pressed }) => [styles.bookingIcon, pressed && styles.pressed]}
          >
            <Ionicons color={colors.primary} name="calendar-outline" size={23} />
            {upcomingBookingCount > 0 && (
              <View style={styles.counter}>
                <Text style={styles.counterText}>{upcomingBookingCount > 9 ? '9+' : upcomingBookingCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            accessibilityLabel="Sign out"
            onPress={() =>
              Alert.alert('Sign out?', 'You will need to sign in again to manage your bookings.', [
                { text: 'Keep signed in', style: 'cancel' },
                { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
              ])
            }
            style={({ pressed }) => [styles.bookingIcon, pressed && styles.pressed]}
          >
            <Ionicons color={colors.ink} name="log-out-outline" size={22} />
          </Pressable>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons color={colors.muted} name="search-outline" size={21} />
        <TextInput
          accessibilityLabel="Search rooms"
          autoCapitalize="none"
          onChangeText={(query) => updateFilters({ query })}
          placeholder="Search room, building or floor"
          placeholderTextColor="#98A1B4"
          returnKeyType="search"
          style={styles.searchInput}
          value={filters.query}
        />
        {filters.query.length > 0 && (
          <Pressable accessibilityLabel="Clear search" onPress={() => updateFilters({ query: '' })}>
            <Ionicons color={colors.muted} name="close-circle" size={18} />
          </Pressable>
        )}
      </View>

      <View style={styles.filterHeading}>
        <Text style={styles.filterTitle}>Filter rooms</Text>
        <Pressable onPress={resetFilters}>
          <Text style={styles.reset}>Reset</Text>
        </Pressable>
      </View>

      <Text style={styles.groupLabel}>BUILDING</Text>
      <ScrollView
        contentContainerStyle={styles.chipList}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {BUILDINGS.map((building) => (
          <FilterChip
            key={building}
            label={buildingLabel(building)}
            onPress={() => updateFilters({ building })}
            selected={filters.building === building}
          />
        ))}
      </ScrollView>

      <Text style={styles.groupLabel}>CAPACITY</Text>
      <ScrollView
        contentContainerStyle={styles.chipList}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {CAPACITIES.map((capacity) => (
          <FilterChip
            key={String(capacity)}
            label={capacityLabel(capacity)}
            onPress={() => updateFilters({ minCapacity: capacity })}
            selected={filters.minCapacity === capacity}
          />
        ))}
      </ScrollView>

      <Text style={styles.groupLabel}>EQUIPMENT</Text>
      <ScrollView
        contentContainerStyle={styles.chipList}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {EQUIPMENT.map((equipment) => (
          <FilterChip
            key={equipment}
            label={equipment}
            onPress={() => updateFilters({ equipment })}
            selected={filters.equipment === equipment}
          />
        ))}
      </ScrollView>

      <View style={styles.resultsLine}>
        <View>
          <Text style={styles.resultsTitle}>Available study rooms</Text>
          <View style={styles.liveRow}>
            <View
              style={[
                styles.liveDot,
                realtimeStatus === 'connected'
                  ? styles.liveDotConnected
                  : realtimeStatus === 'connecting'
                    ? styles.liveDotConnecting
                    : styles.liveDotOffline,
              ]}
            />
            <Text style={styles.liveText}>
              {realtimeStatus === 'connected'
                ? 'Live sync'
                : realtimeStatus === 'connecting'
                  ? 'Connecting…'
                  : realtimeStatus === 'error'
                    ? 'Realtime error'
                    : 'Offline demo mode'}
            </Text>
          </View>
        </View>
        <Text style={styles.resultsCount}>{filteredRooms.length + ' found'}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={filteredRooms}
        getItemLayout={(_, index) => ({
          length: ROOM_CARD_HEIGHT + 14,
          offset: (ROOM_CARD_HEIGHT + 14) * index,
          index,
        })}
        initialNumToRender={5}
        keyExtractor={(room) => room.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons color={colors.muted} name="search-outline" size={35} />
            <Text style={styles.emptyTitle}>No rooms match these filters</Text>
            <Text style={styles.emptyText}>Try a different building, capacity or equipment.</Text>
          </View>
        }
        ListHeaderComponent={header}
        maxToRenderPerBatch={6}
        refreshControl={<RefreshControl onRefresh={() => void refresh()} refreshing={refreshing} tintColor={colors.primary} />}
        removeClippedSubviews
        renderItem={renderRoom}
        showsVerticalScrollIndicator={false}
        updateCellsBatchingPeriod={40}
        windowSize={7}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.page,
    flex: 1,
  },
  listContent: {
    paddingBottom: 28,
    paddingHorizontal: 18,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 21,
    marginTop: 12,
  },
  greetingBlock: {
    flex: 1,
    paddingRight: 12,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  greeting: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: '800',
  },
  subGreeting: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  bookingIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 22,
    height: 45,
    justifyContent: 'center',
    width: 45,
  },
  counter: {
    alignItems: 'center',
    backgroundColor: colors.danger,
    borderColor: colors.surface,
    borderRadius: 10,
    borderWidth: 2,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: -4,
    top: -4,
    width: 20,
  },
  counterText: {
    color: colors.surface,
    fontSize: 9,
    fontWeight: '900',
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    height: 52,
    paddingHorizontal: 14,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  filterHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  filterTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  reset: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  groupLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
    marginTop: 15,
  },
  chipList: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 7,
  },
  resultsLine: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 23,
  },
  resultsTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  liveRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 4,
  },
  liveDot: {
    borderRadius: 4,
    height: 7,
    marginRight: 5,
    width: 7,
  },
  liveDotConnected: {
    backgroundColor: colors.success,
  },
  liveDotConnecting: {
    backgroundColor: colors.primary,
  },
  liveDotOffline: {
    backgroundColor: '#9EA8B9',
  },
  liveText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  resultsCount: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  empty: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginTop: 2,
    padding: 30,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 10,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 5,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
