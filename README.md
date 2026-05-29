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
- **Build Service:** EAS Build (Expo Application Services)

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)
- [EAS CLI](https://docs.expo.dev/build/setup/) (included as dev dependency, or install globally with `npm install -g eas-cli`)
- [Expo Go](https://expo.dev/client) app on your physical device (iOS/Android), **or** an Android emulator / iOS simulator
- An [Expo account](https://expo.dev/signup) (required for EAS builds)
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

4. **Log in to Expo (for builds):**

   ```bash
   npx eas-cli login
   ```

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
├── scripts/
│   └── version-bump.js       # Semantic version bump utility
├── app.json                  # Expo configuration
├── eas.json                  # EAS Build profiles
├── babel.config.js           # Babel config for Expo
└── package.json              # Dependencies & scripts
```

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm start` | `expo start` | Start Expo dev server |
| `npm run android` | `expo start --android` | Launch on Android |
| `npm run ios` | `expo start --ios` | Launch on iOS |
| `npm run build:apk` | `eas build --platform android --profile preview` | Build distributable APK |
| `npm run build:apk:dev` | `eas build --platform android --profile development` | Build dev client APK |
| `npm run build:aab` | `eas build --platform android --profile production` | Build AAB for Google Play |
| `npm run build:ios` | `eas build --platform ios --profile production` | Build for iOS |
| `npm run build:all` | `eas build --platform all --profile production` | Build for all platforms |
| `npm run version:patch` | `node scripts/version-bump.js patch` | Bump patch version |
| `npm run version:minor` | `node scripts/version-bump.js minor` | Bump minor version |
| `npm run version:major` | `node scripts/version-bump.js major` | Bump major version |

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

# Connect the project (already done — project ID: deedde0b-7d63-4f67-a26f-be7d15a5c7b6)
npx eas-cli init --id deedde0b-7d63-4f67-a26f-be7d15a5c7b6
```

### Build commands

```bash
# Build an APK for internal testing
npm run build:apk

# Build a production AAB for Google Play
npm run build:aab

# Build and auto-submit to stores
npx eas-cli build --platform all --auto-submit
```

EAS Build runs in the cloud. Once the build completes, you'll receive a download link for the `.apk` file. You can also check build status at [expo.dev](https://expo.dev).

### Build profiles (eas.json)

| Profile | Output | Use case |
|---------|--------|----------|
| `development` | APK | Dev client with debugging tools |
| `preview` | APK | Internal testing / QA distribution |
| `production` | AAB | Google Play Store submission |

### iOS builds

iOS builds require Apple Developer credentials. Run the build command interactively (without `--non-interactive`) to set up:

```bash
npx eas-cli build --platform ios --profile production
```

You'll be prompted to log in with your Apple ID and select your team/provisioning profile.

## App Identifiers

| Platform | Identifier |
|----------|------------|
| Android  | `com.carribu.driver` |
| iOS      | `com.carribu.driver` |
| Expo Owner | `firstbodis-organization` |
| Expo Project ID | `deedde0b-7d63-4f67-a26f-be7d15a5c7b6` |

## Versioning

This project follows [Semantic Versioning](https://semver.org/) (MAJOR.MINOR.PATCH). Version bumps automatically sync `package.json` and `app.json`, then create a git tag.

### Commands

```bash
# Patch release (bug fixes): 2.0.0 → 2.0.1
npm run version:patch

# Minor release (new features): 2.0.0 → 2.1.0
npm run version:minor

# Major release (breaking changes): 2.0.0 → 3.0.0
npm run version:major
```

After bumping, push the commit and tag:

```bash
git push && git push --tags
```

## Environment Notes

- The app requires `ACCESS_FINE_LOCATION` permission on Android for GPS tracking
- Supported platforms: iOS, Android, and Web
- The backend server must be running for login and all features to work
- App versions are managed locally (`cli.appVersionSource: "local"` in eas.json)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Network errors on login | Verify the API base URL matches your setup (emulator vs physical device) and that the backend is running |
| Location not updating | Ensure location permissions are granted in device settings |
| Socket not connecting | Check that the socket URL in `src/services/socket.js` matches your backend address |
| EAS build fails | Run `npx eas-cli login` and ensure you're in the `firstbodis-organization` Expo org |
| iOS build credentials error | Run the build interactively (not with `--non-interactive`) to set up Apple credentials |
| "Expo Go not recommended" warning | Safe to ignore for dev; production builds use native runtime |

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.