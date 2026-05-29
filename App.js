import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import TripScreen from './src/screens/TripScreen';
import RoutesScreen from './src/screens/RoutesScreen';
import ChatScreen from './src/screens/ChatScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { View, Text, ActivityIndicator } from 'react-native';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const icons = { Trip: '🚌', Routes: '🗺️', Chat: '💬', Profile: '👤' };

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: () => <Text style={{ fontSize: 22 }}>{icons[route.name]}</Text>,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: { height: 64, paddingBottom: 8, paddingTop: 4 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        headerStyle: { backgroundColor: '#1e3a5f' },
        headerTintColor: '#fff',
      })}
    >
      <Tab.Screen name="Trip" component={TripScreen} options={{ headerTitle: 'Trip Management' }} />
      <Tab.Screen name="Routes" component={RoutesScreen} options={{ headerTitle: 'My Routes' }} />
      <Tab.Screen name="Chat" component={ChatScreen} options={{ headerTitle: 'Messages' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ headerTitle: 'My Profile' }} />
    </Tab.Navigator>
  );
}

function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  console.log('AppContent: Render', { loading, isAuthenticated });

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e3a5f' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <AppContent />
    </AuthProvider>
  );
}
