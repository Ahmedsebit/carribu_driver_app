import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AuthContext: Starting auth check');
    (async () => {
      try {
        const t = await AsyncStorage.getItem('token');
        const u = await AsyncStorage.getItem('user');
        console.log('AuthContext: Retrieved from storage', { hasToken: !!t, hasUser: !!u });
        if (t && u) {
          const parsedUser = JSON.parse(u);
          setUser(parsedUser);
          console.log('AuthContext: User set', parsedUser.email);
        }
      } catch (e) {
        console.error('AuthContext: Error during auth check', e);
      } finally {
        console.log('AuthContext: Setting loading to false');
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email, password) => {
    const { data } = await authAPI.login({ email, password });
    if (!['driver', 'coordinator', 'admin'].includes(data.user.role)) {
      throw new Error('This app is for drivers/coordinators only.');
    }
    await AsyncStorage.setItem('token', data.token);
    await AsyncStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const c = useContext(AuthContext);
  if (!c) throw new Error('useAuth must be within AuthProvider');
  return c;
};
