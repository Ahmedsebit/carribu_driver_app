const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');

const filename = path.join(__dirname, '..', 'src', 'services', 'backgroundLocation.js');
const { code } = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
  filename, babelrc: false, configFile: false,
  plugins: ['@babel/plugin-transform-modules-commonjs'],
});

function loadTask(error) {
  const calls = { stop: 0, sent: [], requested: [] };
  const storage = new Map([['background_location_trip_id', '2']]);
  let task;
  const modules = {
    '@react-native-async-storage/async-storage': {
      getItem: async key => storage.get(key),
      setItem: async (key, value) => storage.set(key, value),
      removeItem: async key => storage.delete(key),
    },
    'expo-location': {
      hasStartedLocationUpdatesAsync: async () => true,
      stopLocationUpdatesAsync: async () => { calls.stop += 1; },
      requestForegroundPermissionsAsync: async () => {
        calls.requested.push('foreground');
        return { status: 'granted' };
      },
      requestBackgroundPermissionsAsync: async () => {
        calls.requested.push('background');
        return { status: 'granted' };
      },
    },
    'expo-task-manager': { defineTask: (_, callback) => { task = callback; } },
    './api': {
      locationAPI: {
        updateLocation: async payload => {
          calls.sent.push(payload);
          if (error) throw error;
          return { data: { location: { source: 'phone' } } };
        },
      },
    },
  };
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: name => {
      if (!modules[name]) throw new Error(`Unexpected dependency: ${name}`);
      return modules[name];
    },
    console: { log() {}, warn() {} },
  }, { filename });
  return { task, calls, storage, exports };
}

const locationData = {
  data: { locations: [{ coords: { latitude: -1.2, longitude: 36.8, speed: 10, heading: 90 } }] },
};

test('stops phone GPS and removes the persisted trip when the backend selects Traccar', async () => {
  const { task, calls, storage } = loadTask({
    response: { status: 409, data: { code: 'TRACCAR_LOCATION_REQUIRED' } },
  });
  await task(locationData);
  assert.equal(calls.stop, 1);
  assert.equal(storage.has('background_location_trip_id'), false);
  await task(locationData);
  assert.equal(calls.sent.length, 1);
});

test('keeps sending phone GPS for an unlinked vehicle and converts speed to km/h', async () => {
  const { task, calls, storage } = loadTask();
  await task(locationData);
  assert.equal(calls.sent.length, 1);
  assert.equal(calls.sent[0].tripId, '2');
  assert.equal(calls.sent[0].speed, 36);
  assert.equal(calls.stop, 0);
  assert.equal(storage.has('background_location_trip_id'), true);
});

test('still stops a background task when its trip ends', async () => {
  const { task, calls, storage } = loadTask({ response: { status: 404 } });
  await task(locationData);
  assert.equal(calls.stop, 1);
  assert.equal(storage.has('background_location_trip_id'), false);
});

test('does not silently disable phone tracking on a temporary backend failure', async () => {
  const { task, calls, storage } = loadTask({ response: { status: 500 } });
  await task(locationData);
  assert.equal(calls.stop, 0);
  assert.equal(storage.has('background_location_trip_id'), true);
});
