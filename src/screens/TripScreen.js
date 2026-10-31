import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, RefreshControl, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { driverAPI, tripAPI, locationAPI } from '../services/api';
import { connectSocket } from '../services/socket';
import {
  startBackgroundLocationAsync,
  stopBackgroundLocationAsync,
} from '../services/backgroundLocation';

const TripScreen = () => {
  const [activeTrip, setActiveTrip] = useState(null);
  const [todayTrips, setTodayTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [locationStatus, setLocationStatus] = useState('waiting');
  const [broadcasting, setBroadcasting] = useState(false);
  const locationSubscription = useRef(null);
  const dataRequest = useRef(0);
  const usesTraccar = activeTrip?.locationSource === 'traccar' || Boolean(activeTrip?.vehicle?.trackerUniqueId);
  const validCoordinate = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng);

  const fetchData = useCallback(async () => {
    const requestId = ++dataRequest.current;
    try {
      const [a, t] = await Promise.all([
        driverAPI.getActiveTrip(),
        driverAPI.getMyTrips(),
      ]);
      if (requestId !== dataRequest.current) return;
      setActiveTrip(a.data.activeTrip);
      setTodayTrips(t.data.trips);
    } catch (e) {
      console.error(e);
    } finally {
      if (requestId === dataRequest.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const nextStop = activeTrip?.currentStop || null;

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for server-pushed trip lifecycle events so the driver is prompted in
  // real time: a reminder shortly before the scheduled start, a delayed alert
  // once the start time passes unacknowledged, and a missed alert once the
  // start window lapses. Refresh the list on each so statuses/buttons update.
  useEffect(() => {
    let mounted = true;
    let sockRef = null;
    const onReminder = (d) => { Alert.alert('⏰ Trip Starting Soon', d?.message || 'A trip is about to start. Acknowledge it to begin.'); fetchData(); };
    const onDelayed = (d) => { Alert.alert('⏱️ Trip Delayed', d?.message || 'A trip is past its start time. Acknowledge it as soon as possible.'); fetchData(); };
    const onMissed = (d) => { Alert.alert('⚠️ Trip Not Started', d?.message || 'A trip was not started in time and is now marked as missed.'); fetchData(); };
    (async () => {
      const sock = await connectSocket();
      if (!sock || !mounted) return;
      sockRef = sock;
      sock.on('trip-reminder', onReminder);
      sock.on('trip-delayed', onDelayed);
      sock.on('trip-missed', onMissed);
    })();
    return () => {
      mounted = false;
      if (sockRef) {
        sockRef.off('trip-reminder', onReminder);
        sockRef.off('trip-delayed', onDelayed);
        sockRef.off('trip-missed', onMissed);
      }
    };
  }, [fetchData]);

  useEffect(() => {
    if (activeTrip) {
      const i = setInterval(fetchData, 30000);
      return () => clearInterval(i);
    }
  }, [activeTrip?.id, fetchData]);

  useEffect(() => {
    let isMounted = true;

    const cleanupForegroundFallback = () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
    };

    const startForegroundFallback = async () => {
      setBroadcasting(true);
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        async (position) => {
          if (!isMounted) return;
          const { latitude, longitude, speed, heading } = position.coords;
          setLocationStatus('sending');
          try {
            await locationAPI.updateLocation({
              tripId: activeTrip.id,
              lat: latitude,
              lng: longitude,
              speed: speed == null || speed < 0 ? null : speed * 3.6,
              heading,
            });
            if (isMounted) setLocationStatus('foreground_only');
          } catch (err) {
            if (err?.response?.data?.code === 'TRACCAR_LOCATION_REQUIRED') {
              cleanupForegroundFallback();
              if (isMounted) {
                setBroadcasting(false);
                setLocationStatus('traccar');
              }
              fetchData();
              return;
            }
            console.warn('Location update failed', err?.response?.data || err.message || err);
            if (isMounted) setLocationStatus('error');
          }
        }
      );
      if (!isMounted) {
        subscription.remove();
        return;
      }
      locationSubscription.current = subscription;
    };

    const startLocationBroadcast = async () => {
      if (!activeTrip || usesTraccar) {
        try {
          await stopBackgroundLocationAsync();
        } catch (err) {
          console.warn('Unable to stop background location:', err?.message || err);
          if (isMounted) setLocationStatus('error');
          return;
        }
        if (isMounted) {
          setBroadcasting(false);
          setLocationStatus(usesTraccar ? 'traccar' : 'stopped');
        }
        return;
      }

      try {
        const result = await startBackgroundLocationAsync(activeTrip.id);
        if (!isMounted) return;

        if (result.started) {
          setBroadcasting(true);
          setLocationStatus('background_live');
        } else if (result.reason === 'background_permission_denied') {
          setLocationStatus('background_permission_denied');
          await startForegroundFallback();
        } else {
          setBroadcasting(false);
          setLocationStatus('permission_denied');
        }
      } catch (err) {
        console.warn('Location broadcast failed', err?.message || err);
        if (isMounted) setLocationStatus('error');
      }
    };

    startLocationBroadcast();
    return () => {
      isMounted = false;
      cleanupForegroundFallback();
    };
  }, [activeTrip?.id, usesTraccar, fetchData]);

  const handleAcknowledge = (id) =>
    Alert.alert('Acknowledge & Start Trip', 'Acknowledge this trip? It will officially start and parent notifications will be queued.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Acknowledge & Start',
        onPress: async () => {
          try {
            await tripAPI.acknowledgeTrip(id);
            Alert.alert('✅', 'Trip acknowledged and started!');
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
          } catch (e) {
            Alert.alert('Error', e.response?.data?.error || 'Failed');
            return;
          }
          ++dataRequest.current;
          setActiveTrip(null);
          try {
            await stopBackgroundLocationAsync();
            Alert.alert('✅', 'Trip completed!');
          } catch (error) {
            console.warn('Trip ended, but phone GPS cleanup failed:', error.message);
            Alert.alert('Trip completed - GPS warning', 'The trip ended successfully, but phone location sharing could not be stopped.');
          }
          fetchData();
        },
      },
    ]);

  const handleAction = async (tripId, studentId, action, name) => {
    setActionLoading(`${studentId}-${action}`);
    try {
      const student = activeTrip.pickupList.find(s => s.studentId === studentId);
      const phase = action === 'check_out' || (action === 'arrived' && ['on_bus', 'arrived_dropoff'].includes(student?.status))
        ? 'dropoff' : 'pickup';
      const { data } = await tripAPI.logAction(tripId, {
        studentId, action, phase, idempotencyKey: `${tripId}:${studentId}:${phase}:${action}`,
      });
      setActiveTrip(previous => previous?.id === tripId ? {
        ...previous, pickupList: data.pickupList, currentStop: data.currentStop,
        nextStop: data.nextStop, phase: data.phase, canEnd: data.canEnd, stats: data.stats,
      } : previous);
      Alert.alert('✅', `${name}: ${action}`);
      fetchData();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || e.message);
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
            <TouchableOpacity disabled={!activeTrip.canEnd || Boolean(actionLoading)} style={{ backgroundColor: activeTrip.canEnd ? '#dc2626' : '#64748b', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 }} onPress={() => handleEnd(activeTrip.id)}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>⏹ End</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ color: '#bfdbfe', marginTop: 8 }}>
            Phase: {activeTrip.phase?.replace(/_/g, ' ')}.
            {!activeTrip.canEnd ? ' Record every student as dropped off or absent before ending.' : ' All students accounted for.'}
          </Text>
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
              {validCoordinate(nextStop.lat, nextStop.lng) ? (
                <View style={{ borderRadius: 10, overflow: 'hidden', height: 160 }}>
                  <MapView
                    key={`${nextStop.studentId}-${nextStop.phase}-${nextStop.lat}-${nextStop.lng}`}
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
              {usesTraccar || locationStatus === 'traccar'
                ? 'Location source: linked Traccar device.'
                : broadcasting ? 'Sending GPS updates to parents.' : 'Waiting for active trip...'}
            </Text>
            <Text style={{ fontSize: 12, color: '#0c4a6e', marginTop: 4 }}>
              {usesTraccar || locationStatus === 'traccar'
                ? locationStatus === 'error'
                  ? 'Traccar is authoritative, but phone GPS could not be stopped. Restart the app.'
                  : 'Phone GPS sharing is off. The backend receives device locations during this trip.'
                : locationStatus === 'permission_denied'
                ? 'Location permission required.'
                : locationStatus === 'background_permission_denied'
                ? 'Allow background location to keep sharing when the app is minimized.'
                : locationStatus === 'sending'
                ? 'Updating...'
                : locationStatus === 'background_live'
                ? 'Live location remains active in the background.'
                : locationStatus === 'foreground_only'
                ? 'Live only while the app is open. Allow background location in Settings.'
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
            const colors = { pending: '#f59e0b', arrived_pickup: '#f97316', arrived_dropoff: '#f97316', on_bus: '#2563eb', dropped_off: '#16a34a', absent: '#dc2626' };
            const labels = { pending: '⏳ Pending', arrived_pickup: 'At pickup', arrived_dropoff: 'At drop-off', on_bus: '🚌 On Bus', dropped_off: '✅ Done', absent: '❌ Absent' };
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
                {item.status === 'arrived_pickup' && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <TouchableOpacity style={{ flex: 1, backgroundColor: '#2563eb', borderRadius: 10, padding: 12, alignItems: 'center' }} onPress={() => handleAction(activeTrip.id, item.studentId, 'check_in', item.studentName)}>
                      <Text style={{ color: '#fff', fontWeight: '600' }}>📥 Pick Up</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ flex: 1, backgroundColor: '#dc2626', borderRadius: 10, padding: 12, alignItems: 'center' }} onPress={() => handleAction(activeTrip.id, item.studentId, 'absent', item.studentName)}>
                      <Text style={{ color: '#fff', fontWeight: '600' }}>❌ Absent</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {['on_bus', 'arrived_dropoff'].includes(item.status) && ['dropoff', 'school_dropoff'].includes(activeTrip.phase) && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <TouchableOpacity disabled={item.status === 'arrived_dropoff'} style={{ flex: 1, backgroundColor: '#f59e0b', borderRadius: 10, padding: 12, alignItems: 'center' }} onPress={() => handleAction(activeTrip.id, item.studentId, 'arrived', item.studentName)}>
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
                <Text style={{ fontSize: 12, fontWeight: '600', color: item.status === 'completed' ? '#16a34a' : item.status === 'scheduled' ? '#f59e0b' : item.status === 'delayed' ? '#ea580c' : item.status === 'missed' ? '#dc2626' : '#2563eb', marginTop: 4 }}>{item.status === 'missed' ? '⚠️ NOT STARTED' : item.status === 'delayed' ? '⏱️ DELAYED' : item.status.replace('_', ' ').toUpperCase()}</Text>
              </View>
              {(item.status === 'scheduled' || item.status === 'delayed') && (
                <TouchableOpacity style={{ backgroundColor: item.status === 'delayed' ? '#ea580c' : '#16a34a', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 }} onPress={() => handleAcknowledge(item.id)}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>✔ Acknowledge & Start</Text>
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
