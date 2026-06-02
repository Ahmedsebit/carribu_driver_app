import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SOCKET_BASE_URL } from '@env';

const API_BASE = SOCKET_BASE_URL || 'http://10.0.2.2:5000';
let socket = null;

export const connectSocket = async () => {
  const token = await AsyncStorage.getItem('token');
  if (!token) return null;
  if (socket?.connected) return socket;

  socket = io(API_BASE, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => console.log('🔌 Socket connected'));
  socket.on('disconnect', () => console.log('🔌 Socket disconnected'));
  socket.on('connect_error', (err) => console.log('🔌 Socket error:', err.message));

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) { socket.disconnect(); socket = null; }
};

export const joinTrip = (tripId) => {
  if (socket) socket.emit('join-trip', tripId);
};

export const sendLocation = (tripId, lat, lng, speed, heading) => {
  if (socket) socket.emit('driver-location', { tripId, lat, lng, speed, heading });
};

export const sendChatMessage = (tripId, receiverId, message) => {
  if (socket) socket.emit('chat-message', { tripId, receiverId, message });
};
