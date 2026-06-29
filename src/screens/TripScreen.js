import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, RefreshControl, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { driverAPI, tripAPI, locationAPI } from '../services/api';
import { connectSocket, joinTrip, sendLocation, getSocket } from '../services/socket';

const TripScreen = () => {
  const [activeTrip, setActiveTrip] = useState(null);
  const [todayTrips, setTodayTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [locationStatus, setLocationStatus] = useState('waiting');
  const [broadcasting, setBroadcasting] = useState(false);
  const [skippedStops, setSkippedStops] = useState([]);
  const locationSubscription = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const [a, t] = await Promise.all([
        driverAPI.getActiveTrip(),
        driverAPI.getMyTrips(),
      ]);
      setActiveTrip(a.data.activeTrip);
      setTodayTrips(t.data.trips);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Compute the next stop locally based on trip type:
  // - Pickup trips: navigate to next pending student's pickup location
  // - Dropoff trips: navigate to next on_bus student's dropoff location
  // After "Arrived" is pressed, skip that student for navigation
  const getNextStop = () => {
    if (!activeTrip?.pickupList) return null;
    const isDropoff = activeTrip.type === 'afternoon_dropoff';

    if (isDropoff) {
      // For drop-off: find next on_bus student not yet arrived at
      const next = activeTrip.pickupList.find(
        (s) => s.status === 'on_bus' && !skippedStops.includes(s.studentId)
      );
      if (!next) return null;
      return {
        ...next,
        address: next.dropoffAddress || next.pickupAddress,
        lat: next.dropoffLat || next.pickupLat,
        lng: next.dropoffLng || next.pickupLng,
        phase: 'dropoff',
      };
    } else {
      // For pickup: find next pending student not yet arrived at
      const next = activeTrip.pickupList.find(
        (s) => s.status === 'pending' && !skippedStops.includes(s.studentId)
      );
      if (next) {
        return {
          ...next,
          address: next.pickupAddress,
          lat: next.pickupLat,
          lng: next.pickupLng,
          phase: 'pickup',
        };
      }
      // If no more pending, switch to drop-off phase for on_bus students
      const nextDropoff = activeTrip.pickupList.find(
        (s) => s.status === 'on_bus' && !skippedStops.includes(s.studentId)
      );
      if (!nextDropoff) return null;
      return {
        ...nextDropoff,
        address: nextDropoff.dropoffAddress || nextDropoff.pickupAddress,
        lat: nextDropoff.dropoffLat || nextDropoff.pickupLat,
        lng: nextDropoff.dropoffLng || nextDropoff.pickupLng,
        phase: 'dropoff',
      };
    }
  };

  const nextStop = activeTrip ? getNextStop() : null;

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset skipped stops when active trip changes
  useEffect(() => {
    setSkippedStops([]);
  }, [activeTrip?.id]);

  useEffect(() => {
    if (activeTrip) {
      const i = setInterval(fetchData, 30000);
      return () => clearInterval(i);
    }
  }, [activeTrip, fetchData]);

  useEffect(() => {
    let isMounted = true;

    const cleanup = async () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
      if (isMounted) {
        setBroadcasting(false);
        setLocationStatus('stopped');
      }
    };

    const startLocationBroadcast = async () => {
      if (!activeTrip) return;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!isMounted) return;
      if (status !== 'granted') {
        setLocationStatus('permission_denied');
        return;
      }
      setLocationStatus('granted');
      setBroadcasting(true);

      // Connect socket and join trip room
      await connectSocket();
      joinTrip(activeTrip.id);

      try {
        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Highest,
            timeInterval: 5000,
            distanceInterval: 10,
          },
          async (position) => {
            const { latitude, longitude, speed, heading } = position.coords;
            setLocationStatus('sending');
            try {
              // Send via socket (real-time) and REST (persistence)
              sendLocation(activeTrip.id, latitude, longitude, speed, heading);
              await locationAPI.updateLocation({ tripId: activeTrip.id, lat: latitude, lng: longitude, speed, heading });
              setLocationStatus('live');
            } catch (err) {
              console.warn('Location update failed', err?.response?.data || err.message || err);
              setLocationStatus('error');
            }
          }
        );
      } catch (err) {
        console.warn('Location subscription failed', err?.message || err);
        setLocationStatus('error');
      }
    };

    startLocationBroadcast();
    return () => {
      isMounted = false;
      cleanup();
    };
  }, [activeTrip]);

  const handleStart = (id) =>
    Alert.alert('Start Trip', 'Ready?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start',
        onPress: async () => {
          try {
            await tripAPI.startTrip(id);
            Alert.alert('✅', 'Trip started!');
            fetchData();
          } catch (e) {
            Alert.alert('Error', e.response?.data?.error || 'Failed');
          }
        },
      },
    ]);

  const handleEnd = (id) =>
    Alert.alert('End Trip', 'End this trip?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End',
        style: 'destructive',
        onPress: async () => {
          try {
            await tripAPI.endTrip(id);
            Alert.alert('✅', 'Trip completed!');
            fetchData();
          } catch (e) {
            Alert.alert('Error', e.response?.data?.error || 'Failed');
          }
        },
      },
    ]);

  const handleAction = async (tripId, studentId, action, name) => {
    setActionLoading(`${studentId}-${action}`);
    try {
      await tripAPI.logAction(tripId, { studentId, action });
      // When driver arrives at a stop, move to next student immediately
      if (action === 'arrived') {
        setSkippedStops((prev) => [...prev, studentId]);
      }
      // When status actually changes, remove from skipped list
      if (action === 'check_in' || action === 'absent' || action === 'check_out') {
        setSkippedStops((prev) => prev.filter((id) => id !== studentId));
      }
      Alert.alert('✅', `${name}: ${action}`);
      fetchData();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading)
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ marginTop: 12, color: '#6b7280' }}>Loading...</Text>
      </View>
    );

  return (
    <View style={st.container}>
      {activeTrip ? (
        <View style={st.banner}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={{ color: '#93c5fd', fontSize: 13, fontWeight: '600' }}>🚌 Active Trip</Text>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>{activeTrip.route?.name}</Text>
              <Text style={{ color: '#bfdbfe', fontSize: 13 }}>
                {activeTrip.vehicle?.plateNumber} • {activeTrip.type === 'morning_pickup' ? '🌅 Morning' : '🌇 Afternoon'}
              </Text>
            </View>
            <TouchableOpacity style={{ backgroundColor: '#dc2626', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 }} onPress={() => handleEnd(activeTrip.id)}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>⏹ End</Text>
            </TouchableOpacity>
          </View>
          {activeTrip.stats && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              {[
                ['Total', activeTrip.stats.total, '#dbeafe', '#2563eb'],
                ['On Bus', activeTrip.stats.onBus, '#dbeafe', '#2563eb'],
                ['Done', activeTrip.stats.droppedOff, '#dcfce7', '#16a34a'],
                ['Absent', activeTrip.stats.absent, '#fee2e2', '#dc2626'],
              ].map(([l, n, bg, c]) => (
                <View key={l} style={{ flex: 1, backgroundColor: bg, borderRadius: 10, padding: 10, alignItems: 'center' }}>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: c }}>{n}</Text>
                  <Text style={{ fontSize: 11, color: '#374151' }}>{l}</Text>
                </View>
              ))}
            </View>
          )}
          {nextStop && (
            <View style={{ backgroundColor: nextStop.phase === 'dropoff' ? '#dbeafe' : '#fef3c7', borderRadius: 10, padding: 12, marginTop: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: nextStop.phase === 'dropoff' ? '#1e40af' : '#92400e' }}>
                {nextStop.phase === 'dropoff' ? '📤 NEXT DROP-OFF' : '📍 NEXT PICKUP'}
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: nextStop.phase === 'dropoff' ? '#1e3a8a' : '#78350f' }}>
                #{nextStop.stopNumber} {nextStop.studentName}
              </Text>
              <Text style={{ fontSize: 13, color: nextStop.phase === 'dropoff' ? '#1e40af' : '#92400e', marginBottom: 8 }}>{nextStop.address || 'No address'}</Text>
              {nextStop.lat && nextStop.lng ? (
                <View style={{ borderRadius: 10, overflow: 'hidden', height: 160 }}>
                  <MapView
                    style={{ flex: 1 }}
                    initialRegion={{
                      latitude: nextStop.lat,
                      longitude: nextStop.lng,
                      latitudeDelta: 0.005,
                      longitudeDelta: 0.005,
                    }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                  >
                    <Marker
                      coordinate={{
                        latitude: nextStop.lat,
                        longitude: nextStop.lng,
                      }}
                      title={nextStop.studentName}
                      description={nextStop.address}
                    />
                  </MapView>
                  <TouchableOpacity
                    style={{ position: 'absolute', bottom: 8, right: 8, backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
                    onPress={() => {
                      const url = Platform.select({
                        android: `google.navigation:q=${nextStop.lat},${nextStop.lng}`,
                        ios: `maps://app?daddr=${nextStop.lat},${nextStop.lng}`,
                      });
                      Linking.openURL(url);
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>🧭 Navigate</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          )}
          <View style={{ backgroundColor: '#e0f2fe', borderRadius: 10, padding: 12, marginTop: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#0c4a6e' }}>📡 Location Broadcast</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#075985' }}>
              {broadcasting ? 'Sending GPS updates to parents.' : 'Waiting for active trip...'}
            </Text>
            <Text style={{ fontSize: 12, color: '#0c4a6e', marginTop: 4 }}>
              {locationStatus === 'permission_denied'
                ? 'Location permission required.'
                : locationStatus === 'sending'
                ? 'Updating...'
                : locationStatus === 'live'
                ? 'Live location active.'
                : locationStatus === 'error'
                ? 'Unable to send location.'
                : 'Permission status: ' + locationStatus}
            </Text>
          </View>
        </View>
      ) : (
        <View style={{ backgroundColor: '#fff', padding: 20, margin: 16, borderRadius: 12, alignItems: 'center' }}>
          <Text style={{ color: '#6b7280' }}>No active trip. Select a scheduled trip to start.</Text>
        </View>
      )}
      {activeTrip ? (
        <FlatList
          data={activeTrip.pickupList}
          keyExtractor={(i) => String(i.studentId)}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
          ListHeaderComponent={<Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 12 }}>🎒 Pickup List ({activeTrip.pickupList?.length || 0})</Text>}
          renderItem={({ item }) => {
            const colors = { pending: '#f59e0b', arrived: '#f97316', on_bus: '#2563eb', dropped_off: '#16a34a', absent: '#dc2626' };
            const labels = { pending: '⏳ Pending', arrived: '📍 Arrived', on_bus: '🚌 On Bus', dropped_off: '✅ Done', absent: '❌ Absent' };
            return (
              <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: colors[item.status] }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ backgroundColor: '#e5e7eb', borderRadius: 8, width: 36, height: 36, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontWeight: '700', fontSize: 13 }}>#{item.stopNumber}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600' }}>{item.studentName}</Text>
                    <Text style={{ fontSize: 12, color: '#6b7280' }}>{item.grade} • {item.pickupAddress || 'N/A'}</Text>
                    {item.parentName && (
                      <TouchableOpacity onPress={() => item.parentPhone && Linking.openURL(`tel:${item.parentPhone}`)}>
                        <Text style={{ fontSize: 12, color: '#2563eb', marginTop: 4 }}>👤 {item.parentName} {item.parentPhone ? `📞 ${item.parentPhone}` : ''}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={{ backgroundColor: colors[item.status] + '20', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors[item.status] }}>{labels[item.status]}</Text>
                  </View>
                </View>
                {item.status === 'pending' && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <TouchableOpacity style={{ flex: 1, backgroundColor: '#f59e0b', borderRadius: 10, padding: 12, alignItems: 'center' }} onPress={() => handleAction(activeTrip.id, item.studentId, 'arrived', item.studentName)}>
                      <Text style={{ color: '#fff', fontWeight: '600' }}>📍 Arrived</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ flex: 1, backgroundColor: '#2563eb', borderRadius: 10, padding: 12, alignItems: 'center' }} onPress={() => handleAction(activeTrip.id, item.studentId, 'check_in', item.studentName)}>
                      <Text style={{ color: '#fff', fontWeight: '600' }}>📥 Pick Up</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ flex: 1, backgroundColor: '#dc2626', borderRadius: 10, padding: 12, alignItems: 'center' }} onPress={() => handleAction(activeTrip.id, item.studentId, 'absent', item.studentName)}>
                      <Text style={{ color: '#fff', fontWeight: '600' }}>❌ Absent</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {item.status === 'arrived' && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <TouchableOpacity style={{ flex: 1, backgroundColor: '#2563eb', borderRadius: 10, padding: 12, alignItems: 'center' }} onPress={() => handleAction(activeTrip.id, item.studentId, 'check_in', item.studentName)}>
                      <Text style={{ color: '#fff', fontWeight: '600' }}>📥 Pick Up</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ flex: 1, backgroundColor: '#dc2626', borderRadius: 10, padding: 12, alignItems: 'center' }} onPress={() => handleAction(activeTrip.id, item.studentId, 'absent', item.studentName)}>
                      <Text style={{ color: '#fff', fontWeight: '600' }}>❌ Absent</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {item.status === 'on_bus' && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <TouchableOpacity style={{ flex: 1, backgroundColor: '#f59e0b', borderRadius: 10, padding: 12, alignItems: 'center' }} onPress={() => handleAction(activeTrip.id, item.studentId, 'arrived', item.studentName)}>
                      <Text style={{ color: '#fff', fontWeight: '600' }}>📍 Arrived</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ flex: 1, backgroundColor: '#16a34a', borderRadius: 10, padding: 12, alignItems: 'center' }} onPress={() => handleAction(activeTrip.id, item.studentId, 'check_out', item.studentName)}>
                      <Text style={{ color: '#fff', fontWeight: '600' }}>📤 Drop Off</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
        />
      ) : (
        <FlatList
          data={todayTrips}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
          ListHeaderComponent={<Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 12 }}>📅 Scheduled Trips</Text>}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600' }}>{item.route?.name}</Text>
                <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{item.vehicle?.plateNumber} • {item.type === 'morning_pickup' ? '🌅 Morning' : '🌇 Afternoon'} • {item.pickupList?.length || 0} students</Text>
                {item.scheduledDate ? <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>🗓 {item.scheduledDate}</Text> : null}
                <Text style={{ fontSize: 12, fontWeight: '600', color: item.status === 'completed' ? '#16a34a' : item.status === 'scheduled' ? '#f59e0b' : '#2563eb', marginTop: 4 }}>{item.status.replace('_', ' ').toUpperCase()}</Text>
              </View>
              {item.status === 'scheduled' && (
                <TouchableOpacity style={{ backgroundColor: '#16a34a', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 }} onPress={() => handleStart(item.id)}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>▶ Start</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 40 }}>
              <Text style={{ fontSize: 48 }}>📅</Text>
              <Text style={{ color: '#9ca3af', marginTop: 8 }}>No trips today.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  banner: { backgroundColor: '#1e3a5f', padding: 16, paddingTop: 8 },
});

export default TripScreen;
