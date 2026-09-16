import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { locationAPI } from './api';

export const DRIVER_LOCATION_TASK = 'carribu-driver-background-location';
const ACTIVE_TRIP_KEY = 'background_location_trip_id';

TaskManager.defineTask(DRIVER_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('Background location task failed:', error.message);
    return;
  }

  const tripId = await AsyncStorage.getItem(ACTIVE_TRIP_KEY);
  const locations = data?.locations;
  const position = locations?.[locations.length - 1];
  if (!tripId || !position) return;

  const { latitude, longitude, speed, heading } = position.coords;
  try {
    await locationAPI.updateLocation({
      tripId,
      lat: latitude,
      lng: longitude,
      speed,
      heading,
    });
  } catch (err) {
    if (err?.response?.status === 404) {
      await stopBackgroundLocationAsync();
      return;
    }
    console.warn(
      'Background location update failed:',
      err?.response?.data || err?.message || err
    );
  }
});

export async function startBackgroundLocationAsync(tripId) {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    return { started: false, reason: 'foreground_permission_denied' };
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== 'granted') {
    return { started: false, reason: 'background_permission_denied' };
  }

  const storedTripId = await AsyncStorage.getItem(ACTIVE_TRIP_KEY);
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(
    DRIVER_LOCATION_TASK
  );

  if (alreadyStarted && storedTripId !== String(tripId)) {
    await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  } else if (alreadyStarted) {
    return { started: true };
  }

  await AsyncStorage.setItem(ACTIVE_TRIP_KEY, String(tripId));
  try {
    await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 10,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Carribu trip tracking is active',
        notificationBody: 'Your location is being shared for the active trip.',
        killServiceOnDestroy: false,
      },
    });
  } catch (err) {
    await AsyncStorage.removeItem(ACTIVE_TRIP_KEY);
    throw err;
  }

  return { started: true };
}

export async function stopBackgroundLocationAsync() {
  const started = await Location.hasStartedLocationUpdatesAsync(
    DRIVER_LOCATION_TASK
  );
  if (started) {
    await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  }
  await AsyncStorage.removeItem(ACTIVE_TRIP_KEY);
}
