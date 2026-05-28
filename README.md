# Carribu Driver App

A React Native (Expo) mobile application for school transport drivers. Part of the Carribu school transport platform, this app enables drivers to manage trips, track routes, communicate with parents/coordinators, and share real-time location updates.

## Features

- **Trip Management** – Start/end trips, log pickup and drop-off actions
- **Route Viewing** – View assigned routes and stops
- **Real-time Location** – Share live GPS location with parents via WebSocket
- **Messaging** – In-app chat with parents and coordinators
- **Authentication** – Secure JWT-based login for drivers and coordinators

## Tech Stack

- **Framework:** React Native with Expo SDK 55
- **Navigation:** React Navigation (bottom tabs + native stack)
- **State Management:** React Context API
- **HTTP Client:** Axios
- **Real-time:** Socket.IO client
- **Maps:** react-native-maps + Directions
- **Storage:** AsyncStorage for token/session persistence

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)
- [Expo Go](https://expo.dev/client) app on your physical device (iOS/Android), **or** an Android emulator / iOS simulator
- The Carribu backend API server running locally or accessible via network

## Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/Ahmedsebit/carribu_driver_app.git
   cd carribu_driver_app
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure the API base URL:**

   Edit `src/services/api.js` and `src/services/socket.js` to point to your backend server:

   - **Android Emulator:** Use `http://10.0.2.2:5000` (maps to host machine's localhost)
   - **iOS Simulator:** Use `http://localhost:5000`
   - **Physical Device:** Use your machine's LAN IP (run `ipconfig` on Windows or `ifconfig` on Mac/Linux to find it), e.g. `http://192.168.1.100:5000`

## Running Locally

Start the Expo development server:

```bash
npm start
```

This opens the Expo DevTools. From there you can:

- **Android Emulator:** Press `a` to open on a connected Android emulator
- **iOS Simulator:** Press `i` to open on the iOS simulator (macOS only)
- **Physical Device:** Scan the QR code with Expo Go

### Platform-specific shortcuts

```bash
# Launch directly on Android
npm run android

# Launch directly on iOS
npm run ios
```

## Project Structure

```
carribu_driver_app/
├── App.js                    # Root component, navigation setup
├── src/
│   ├── contexts/
│   │   └── AuthContext.js    # Authentication state & logic
│   ├── screens/
│   │   ├── LoginScreen.js    # Driver login
│   │   ├── TripScreen.js     # Active trip management
│   │   ├── RoutesScreen.js   # Assigned routes list
│   │   ├── ChatScreen.js     # Messaging interface
│   │   └── ProfileScreen.js  # Driver profile & settings
│   └── services/
│       ├── api.js            # Axios HTTP client & API methods
│       └── socket.js         # Socket.IO real-time connection
├── app.json                  # Expo configuration
├── babel.config.js           # Babel config for Expo
└── package.json              # Dependencies & scripts
```

## API Endpoints Used

| Module     | Endpoints                                              |
|------------|--------------------------------------------------------|
| Auth       | `POST /api/auth/login`, `GET /api/auth/me`, `PUT /api/auth/change-password` |
| Driver     | `GET /api/driver/my-routes`, `GET /api/driver/my-trips`, `GET /api/driver/active-trip` |
| Trips      | `PUT /api/trips/:id/start`, `PUT /api/trips/:id/end`, `POST /api/trips/:id/log` |
| Location   | `POST /api/location/update`                            |
| Messages   | `GET /api/messages/conversations`, `GET /api/messages/thread/:id`, `POST /api/messages` |

## WebSocket Events

| Event             | Direction | Description                         |
|-------------------|-----------|-------------------------------------|
| `join-trip`       | Emit      | Join a trip room for live updates   |
| `driver-location` | Emit      | Send driver GPS coordinates         |
| `chat-message`    | Emit      | Send a chat message                 |

## Building the APK

This project uses [EAS Build](https://docs.expo.dev/build/introduction/) (Expo Application Services) to produce Android APKs and app bundles.

### First-time setup

```bash
# Log in to your Expo account
npx eas-cli login

# (Optional) Reconfigure build settings
npx eas-cli build:configure
```

### Build commands

| Command | Description |
|---------|-------------|
| `npm run build:apk` | Build a distributable APK (preview profile) |
| `npm run build:apk:dev` | Build a dev client APK with debugging |
| `npm run build:aab` | Build a production AAB for Google Play |
| `npm run build:ios` | Build for iOS (production) |
| `npm run build:all` | Build for all platforms |

### Example: Build an APK

```bash
npm run build:apk
```

EAS Build runs in the cloud. Once the build completes, you'll receive a download link for the `.apk` file. You can also check build status at [expo.dev](https://expo.dev).

### Build profiles (eas.json)

| Profile | Output | Use case |
|---------|--------|----------|
| `development` | APK | Dev client with debugging tools |
| `preview` | APK | Internal testing / QA distribution |
| `production` | AAB | Google Play Store submission |

## Environment Notes

- The app requires `ACCESS_FINE_LOCATION` permission on Android for GPS tracking
- Supported platforms: iOS, Android, and Web
- The backend server must be running for login and all features to work

## Troubleshooting

- **Network errors on login:** Verify the API base URL matches your setup (emulator vs physical device) and that the backend server is running
- **Location not updating:** Ensure location permissions are granted in device settings
- **Socket not connecting:** Check that the socket URL in `src/services/socket.js` matches your backend address

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.