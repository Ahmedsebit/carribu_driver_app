import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@env';

const API_BASE = API_BASE_URL || 'http://10.0.2.2:5000/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  const t = await AsyncStorage.getItem('token');
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

export const authAPI = { login: (d) => api.post('/auth/login', d), getMe: () => api.get('/auth/me'), changePassword: (d) => api.put('/auth/change-password', d) };
export const driverAPI = {
  getMyRoutes: () => api.get('/driver/my-routes'),
  getMyTrips: (d) => api.get('/driver/my-trips', { params: { date: d } }),
  getActiveTrip: () => api.get('/driver/active-trip'),
};
export const tripAPI = {
  startTrip: (id) => api.put(`/trips/${id}/start`),
  endTrip: (id) => api.put(`/trips/${id}/end`),
  logAction: (id, d) => api.post(`/trips/${id}/log`, d),
};
export const locationAPI = { updateLocation: (d) => api.post('/location/update', d) };
export const messageAPI = {
  getConversations: () => api.get('/messages/conversations'),
  getThread: (id) => api.get(`/messages/thread/${id}`),
  send: (d) => api.post('/messages', d),
  getUnreadCount: () => api.get('/messages/unread-count'),
  getRouteParents: (id) => api.get(`/messages/route-parents/${id}`),
};

export default api;
