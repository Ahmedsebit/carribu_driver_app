import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';

const ProfileScreen = () => {
  const { user, logout } = useAuth();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) return Alert.alert('Error', 'All fields are required');
    if (newPassword.length < 6) return Alert.alert('Error', 'New password must be at least 6 characters');
    if (newPassword !== confirmPassword) return Alert.alert('Error', 'Passwords do not match');
    setSaving(true);
    try {
      await authAPI.changePassword({ currentPassword, newPassword });
      Alert.alert('Success', 'Password changed successfully');
      setShowPasswordForm(false);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to change password');
    } finally { setSaving(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f3f4f6' }} contentContainerStyle={{ padding: 20 }}>
      <View style={{ backgroundColor: '#1e3a5f', borderRadius: 20, padding: 28, alignItems: 'center', marginBottom: 16 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ color: '#fff', fontSize: 26, fontWeight: '700' }}>{user?.firstName?.[0]}{user?.lastName?.[0]}</Text>
        </View>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>{user?.firstName} {user?.lastName}</Text>
        <Text style={{ color: '#93c5fd', fontSize: 13, fontWeight: '600', marginTop: 4 }}>{user?.role?.toUpperCase()}</Text>
        <Text style={{ color: '#bfdbfe', fontSize: 13, marginTop: 2 }}>{user?.school?.name || 'School'}</Text>
      </View>

      <View style={{ backgroundColor: '#fff', borderRadius: 14, marginBottom: 16 }}>
        {[
          ['📧 Email', user?.email],
          ['📞 Phone', user?.phone || 'Not set'],
          ['🏫 School', user?.school?.name || 'N/A'],
          ['👤 Role', user?.role],
        ].map(([l, v]) => (
          <View key={l} style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
            <Text style={{ color: '#6b7280' }}>{l}</Text>
            <Text style={{ fontWeight: '500' }}>{v}</Text>
          </View>
        ))}
      </View>

      {/* Password Change Section */}
      <TouchableOpacity
        style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        onPress={() => setShowPasswordForm(!showPasswordForm)}
      >
        <Text style={{ fontSize: 15, fontWeight: '600', color: '#1f2937' }}>🔒 Change Password</Text>
        <Text style={{ color: '#6b7280' }}>{showPasswordForm ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {showPasswordForm && (
        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <TextInput
            style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 15 }}
            placeholder="Current password"
            secureTextEntry value={currentPassword} onChangeText={setCurrentPassword}
          />
          <TextInput
            style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 15 }}
            placeholder="New password (min 6 chars)"
            secureTextEntry value={newPassword} onChangeText={setNewPassword}
          />
          <TextInput
            style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 15 }}
            placeholder="Confirm new password"
            secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword}
          />
          <TouchableOpacity
            style={{ backgroundColor: '#2563eb', borderRadius: 10, padding: 14, alignItems: 'center' }}
            onPress={handleChangePassword} disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Update Password</Text>}
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={{ backgroundColor: '#dc2626', borderRadius: 14, padding: 16, alignItems: 'center' }}
        onPress={() => Alert.alert('Logout', 'Sure?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Logout', style: 'destructive', onPress: logout },
        ])}
      >
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>🚪 Logout</Text>
      </TouchableOpacity>
      <Text style={{ textAlign: 'center', color: '#9ca3af', marginTop: 20, fontSize: 12 }}>SchoolTransport Driver v2.0.0</Text>
    </ScrollView>
  );
};

export default ProfileScreen;
