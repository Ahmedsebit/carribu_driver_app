import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, KeyboardAvoidingView, Platform } from 'react-native';
import { messageAPI, driverAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { connectSocket, sendChatMessage, getSocket } from '../services/socket';

const ChatScreen = () => {
  const { user } = useAuth();
  const [convos, setConvos] = useState([]);
  const [partner, setPartner] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [routeParents, setRouteParents] = useState([]);
  const ref = useRef(null);

  const fetchConvos = useCallback(async () => {
    try {
      const { data } = await messageAPI.getConversations();
      setConvos(data.conversations);
      // Also fetch parents from driver's routes
      try {
        const routesData = await driverAPI.getMyRoutes();
        const routes = routesData.data.routes || [];
        const allParents = [];
        for (const r of routes) {
          try {
            const { data: pd } = await messageAPI.getRouteParents(r.id);
            pd.parents.forEach(p => {
              if (!allParents.some(ap => ap.id === p.id)) {
                allParents.push({ ...p, routeName: r.name });
              }
            });
          } catch (e) {}
        }
        setRouteParents(allParents);
      } catch (e) {}
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConvos();
  }, [fetchConvos]);

  const openThread = async (p) => {
    setPartner(p);
    try {
      const { data } = await messageAPI.getThread(p.partnerId);
      setMsgs(data.messages);
      setTimeout(() => ref.current?.scrollToEnd({ animated: true }), 300);
    } catch (e) {
      console.error(e);
    }
  };

  const send = async () => {
    if (!text.trim() || !partner) return;
    setSending(true);
    try {
      const { data } = await messageAPI.send({ receiverId: partner.partnerId, content: text.trim() });
      setMsgs((p) => [...p, data.message]);
      sendChatMessage(null, partner.partnerId, text.trim());
      setText('');
      setTimeout(() => ref.current?.scrollToEnd({ animated: true }), 200);
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (partner) {
      let handler;
      const setup = async () => {
        await connectSocket();
        const sock = getSocket();
        if (!sock) return;
        handler = (data) => {
          if (data.senderId === partner.partnerId || data.senderId === user.id) {
            setMsgs(prev => [...prev, { id: Date.now(), senderId: data.senderId, content: data.message, createdAt: new Date(data.timestamp).toISOString() }]);
            setTimeout(() => ref.current?.scrollToEnd({ animated: true }), 200);
          }
        };
        sock.on('new-message', handler);
      };
      setup();
      // Fallback polling at reduced frequency
      const i = setInterval(async () => {
        try {
          const { data } = await messageAPI.getThread(partner.partnerId);
          setMsgs(data.messages);
        } catch (e) {}
      }, 30000);
      return () => {
        clearInterval(i);
        const sock = getSocket();
        if (sock && handler) sock.off('new-message', handler);
      };
    }
  }, [partner]);

  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );

  if (partner)
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#f3f4f6' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ backgroundColor: '#1e3a5f', flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
          <TouchableOpacity onPress={() => { setPartner(null); fetchConvos(); }}>
            <Text style={{ color: '#93c5fd', fontWeight: '600' }}>← Back</Text>
          </TouchableOpacity>
          <View>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{partner.partnerName}</Text>
            <Text style={{ color: '#bfdbfe', fontSize: 12, textTransform: 'capitalize' }}>{partner.partnerRole}</Text>
          </View>
        </View>
        <FlatList
          ref={ref}
          data={msgs}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={{ padding: 16 }}
          onContentSizeChange={() => ref.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mine = item.senderId === user.id;
            return (
              <View style={{ maxWidth: '80%', borderRadius: 16, padding: 12, marginBottom: 8, backgroundColor: mine ? '#2563eb' : '#fff', alignSelf: mine ? 'flex-end' : 'flex-start' }}>
                {item.messageType === 'absence' && <Text style={{ fontSize: 11, fontWeight: '600', color: '#fbbf24', marginBottom: 4 }}>⚠️ Absence Alert</Text>}
                <Text style={{ fontSize: 14, color: mine ? '#fff' : '#111827' }}>{item.content}</Text>
                <Text style={{ fontSize: 10, marginTop: 4, color: mine ? '#bfdbfe' : '#9ca3af' }}>
                  {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Text style={{ fontSize: 40 }}>💬</Text>
              <Text style={{ color: '#9ca3af' }}>No messages yet</Text>
            </View>
          }
        />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', gap: 8 }}>
          <TextInput
            style={{ flex: 1, backgroundColor: '#f3f4f6', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 100, color: '#111827' }}
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            placeholderTextColor="#9ca3af"
            multiline
          />
          <TouchableOpacity
            style={{ backgroundColor: '#2563eb', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', opacity: text.trim() ? 1 : 0.5 }}
            onPress={send}
            disabled={!text.trim() || sending}
          >
            <Text style={{ color: '#fff', fontSize: 20 }}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );

  return (
    <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      <FlatList
        data={convos}
        keyExtractor={(i) => String(i.partnerId)}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={fetchConvos} />}
        ListHeaderComponent={
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 22, fontWeight: '700' }}>💬 Messages</Text>
            <Text style={{ fontSize: 13, color: '#6b7280' }}>Chat with parents</Text>
            {routeParents.filter(p => !convos.some(c => c.partnerId === p.id)).length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 8 }}>Start new chat:</Text>
                {routeParents.filter(p => !convos.some(c => c.partnerId === p.id)).slice(0, 5).map(p => (
                  <TouchableOpacity key={p.id} style={{ backgroundColor: '#eff6ff', borderRadius: 10, padding: 12, marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 10 }} onPress={() => openThread({ partnerId: p.id, partnerName: `${p.firstName} ${p.lastName}`, partnerRole: 'parent' })}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>{p.firstName[0]}{p.lastName[0]}</Text></View>
                    <View style={{ flex: 1 }}><Text style={{ fontSize: 14, fontWeight: '600' }}>{p.firstName} {p.lastName}</Text><Text style={{ fontSize: 11, color: '#6b7280' }}>{p.routeName} • {p.children?.map(c => c.firstName).join(', ')}</Text></View>
                    <Text style={{ fontSize: 16 }}>💬</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{ backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}
            onPress={() => openThread(item)}
          >
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{item.partnerName.split(' ').map((n) => n[0]).join('')}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600' }}>{item.partnerName}</Text>
              <Text style={{ fontSize: 12, color: '#6b7280', textTransform: 'capitalize' }}>{item.partnerRole}</Text>
              <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }} numberOfLines={1}>{item.lastMessage}</Text>
            </View>
            {item.unreadCount > 0 && (
              <View style={{ backgroundColor: '#dc2626', borderRadius: 12, minWidth: 24, height: 24, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{item.unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ fontSize: 48 }}>💬</Text>
            <Text style={{ color: '#9ca3af', marginTop: 12 }}>No conversations yet.</Text>
          </View>
        }
      />
    </View>
  );
};

export default ChatScreen;
