// Web-only stub for react-native-maps.
// react-native-maps has no web support (it relies on codegenNativeComponent,
// which does not exist in react-native-web). This stub lets the app bundle and
// run on web for verification; map areas render a simple placeholder.
// Native (Android/iOS) builds never use this file — see metro.config.js.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = undefined;

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f0e8',
    borderWidth: 1,
    borderColor: '#c5d5c5',
  },
  text: { color: '#4b5563', fontSize: 13, textAlign: 'center', paddingHorizontal: 16 },
});

export default function MapView({ style, children }) {
  return (
    <View style={[styles.placeholder, style]}>
      <Text style={styles.text}>
        🗺️ Map preview is not available on web.{'\n'}
        Use the Android app or Expo Go to see live tracking.
      </Text>
      {children}
    </View>
  );
}

// Overlays render nothing on web.
export const Marker = () => null;
export const Polyline = () => null;
export const Circle = () => null;
export const Callout = () => null;
export const Polygon = () => null;
export const Overlay = () => null;

MapView.Marker = Marker;
MapView.Polyline = Polyline;
MapView.Circle = Circle;
MapView.Callout = Callout;
