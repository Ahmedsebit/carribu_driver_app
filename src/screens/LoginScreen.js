import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Error', 'Enter email and password.');
    setLoading(true);
    try {
      await login(email, password);
    } catch (e) {
      Alert.alert('Login Failed', e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.card}>
        <Text style={{ fontSize: 48 }}>🚐</Text>
        <Text style={s.title}>Driver App</Text>
        <Text style={s.sub}>School Transport Management</Text>
        <TextInput
          style={s.input}
          placeholder="Email"
          placeholderTextColor="#9ca3af"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={s.input}
          placeholder="Password"
          placeholderTextColor="#9ca3af"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Sign In</Text>}
        </TouchableOpacity>
        <View style={s.demo}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#1d4ed8' }}>Demo: driver1@nairobiacademy.co.ke / driver123</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e3a5f', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 32, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: '#111827' },
  sub: { fontSize: 14, color: '#6b7280', marginBottom: 24 },
  input: { width: '100%', backgroundColor: '#f3f4f6', borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb', color: '#111827' },
  btn: { width: '100%', backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  demo: { marginTop: 20, backgroundColor: '#eff6ff', borderRadius: 12, padding: 12, width: '100%' },
});

export default LoginScreen;
