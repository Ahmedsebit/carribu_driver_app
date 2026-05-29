import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { driverAPI } from '../services/api';

const RoutesScreen = () => {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const fetch = useCallback(async () => {
    try {
      const { data } = await driverAPI.getMyRoutes();
      setRoutes(data.routes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      <FlatList
        data={routes}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} />}
        ListHeaderComponent={
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 22, fontWeight: '700' }}>🗺️ My Routes</Text>
            <Text style={{ fontSize: 13, color: '#6b7280' }}>{routes.length} assigned</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12 }}
            onPress={() => setExpanded(expanded === item.id ? null : item.id)}
          >
            <Text style={{ fontSize: 17, fontWeight: '700' }}>{item.name}</Text>
            <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
              🚐 {item.vehicle?.plateNumber || 'No vehicle'} • {item.vehicle?.make} {item.vehicle?.model}
            </Text>
            <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
              🎒 {item.students?.length || 0} students • {item.type === 'both' ? '🔄 Both' : item.type === 'morning' ? '🌅 Morning' : '🌇 Afternoon'}
            </Text>
            {expanded === item.id && item.students?.length > 0 && (
              <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 8 }}>📋 Pickup Order:</Text>
                {item.students.map((s, i) => (
                  <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600' }}>{s.firstName} {s.lastName}</Text>
                      <Text style={{ fontSize: 12, color: '#6b7280' }}>{s.grade} • {s.pickupAddress || 'N/A'}</Text>
                      {s.parent && (
                        <Text style={{ fontSize: 12, color: '#2563eb', marginTop: 2 }}>
                          👤 {s.parent.firstName} {s.parent.lastName} {s.parent.phone ? `📞 ${s.parent.phone}` : ''}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ fontSize: 48 }}>🗺️</Text>
            <Text style={{ color: '#9ca3af', marginTop: 12 }}>No routes assigned.</Text>
          </View>
        }
      />
    </View>
  );
};

export default RoutesScreen;
