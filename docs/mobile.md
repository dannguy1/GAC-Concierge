# Mobile App Design

## Stack

- **React Native** (Expo SDK 54)
- **Expo Go** for development/testing (iOS + Android)
- **EAS Build** for standalone Android APK releases
- JavaScript (no TypeScript)

## Directory Structure

```
mobile/
├── App.js                      Root component — all state and layout
├── app.json                    Expo config (EAS project, permissions, plugins)
├── eas.json                    EAS build profiles
├── index.js                    Expo entry point
├── build_apk.sh                Local Gradle build script
├── plugins/
│   └── withCleartextTraffic.js Custom Expo config plugin (Android HTTP fix)
├── services/
│   └── api.js                  All fetch() calls + AsyncStorage host config
└── components/
    ├── ChatInterface.js         Message thread, language picker, input
    ├── MenuVisualizer.js        FlatList card grid with category tabs
    ├── MenuCard.js              Single menu item card
    ├── OrderPad.js              Receipt-style order view with checkout
    ├── ItemDetailModal.js       Full-screen item detail overlay
    ├── SettingsModal.js         Server host configuration bottom sheet
    └── TableSetupModal.js       Table number + guest count bottom sheet
```

## State Architecture (`App.js`)

All state lives in `App.js`. Identical logical structure to web `App.jsx` with additions for mobile navigation and settings.

| State | Purpose |
|-------|---------|
| `messages` | Full conversation history including hidden system events |
| `cart` | Current order items |
| `mentionedItems` | Items referenced by agent |
| `generalNotes` | Order-level note |
| `orderConfirmed` | Unlocks kitchen send; reset to `false` when user manually modifies cart |
| `isLoading` | LLM request in flight |
| `thinkingSeconds` | Elapsed wait seconds |
| `language` | Selected response language |
| `allMenuItems` | Full menu from `/v1/menu` |
| `categories` | Sorted category list |
| `activeCategory` | Active category tab |
| `selectedItem` | Item open in detail modal |
| `tableNumber` | Set via TableSetupModal |
| `guestCount` | Set via TableSetupModal |
| `activeTab` | Portrait tab: `chat`, `menu`, `order` |
| `rightTab` | Landscape right panel: `menu`, `order` |
| `showSettings` | SettingsModal visibility |
| `showTableSetup` | TableSetupModal visibility |
| `menuError` | True if menu fetch fails |

## Layout System

### Portrait Mode

Three-tab bottom navigation:

```
┌─────────────────────────┐
│  Title Bar              │  ← ↺ New Session | 🪑 T5·4👥 | ⚙️
├─────────────────────────┤
│                         │
│   Active Tab Content    │  ← Chat / Menu / Order
│                         │
├─────────────────────────┤
│  💬 Chat │ 🍽 Menu │ 📋 Order │  ← Bottom tab bar
└─────────────────────────┘
```

### Landscape Mode

Two-panel split layout — Chat left, Menu/Order toggle right:

```
┌────────────────────────────────────────────────┐
│  ↺  |  🪑 T5·4👥  |  ⚙️  (full-width title bar) │
├──────────────────────┬─────────────────────────┤
│   Language Picker    │  🍽 Menu  │  📋 Order    │
├──────────────────────┼─────────────────────────┤
│                      │                         │
│   Chat Messages      │   Menu Cards / Order Pad│
│                      │                         │
├──────────────────────┤                         │
│   Input Bar          │                         │
└──────────────────────┴─────────────────────────┘
```

Orientation detection uses `useWindowDimensions()`: `isLandscape = width > height`.

## Language Picker

**Android**: Uses `@react-native-picker/picker` with `mode="dropdown"` — renders as native dropdown.

**iOS**: Uses `ActionSheetIOS.showActionSheetWithOptions()` — renders as native action sheet from bottom. This avoids the iOS `Picker` component's full-height wheel overflowing its container.

## Server Host Configuration (`SettingsModal`)

- Default host: `192.168.10.3:8000` (hardcoded fallback)
- Saved to `AsyncStorage` under key `@gac_server_host`
- Loaded on startup via `loadServerHost()` before first menu fetch
- Test button pings `/v1/health` with a 5-second timeout to verify connectivity
- Save triggers menu reload

**Request timeouts:**
- Menu fetch (`fetchMenu`): **15-second** `AbortController` timeout
- Chat request: **90-second** `AbortController` timeout; "Cancel" button appears in UI at 20s
- Health check (SettingsModal): **5-second** fetch timeout

```javascript
// services/api.js
let _host = '192.168.10.3:8000';           // mutable at runtime
const baseUrl  = () => `http://${_host}/v1`;
const serverUrl = () => `http://${_host}`;
```

## Table Setup

Same logic as web: `TableSetupModal` bottom sheet with table number input and guest stepper (1–20). On save, injects a hidden system event and updates `tableNumber`/`guestCount` passed to `OrderPad`.

## TTS Playback (Mobile)

Uses `expo-av`:

```javascript
await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
const { sound } = await Audio.Sound.createAsync(
    { uri: `data:audio/wav;base64,${data.audio_base64}` },
    { shouldPlay: true }
);
```

Unloads sound on `didJustFinish` to free memory.

## FlatList / MenuVisualizer

- Portrait: `numColumns={2}`
- Landscape: `numColumns={3}`
- `key={numColumns}` forces FlatList remount on orientation change (RN requirement — numColumns cannot change dynamically)
- `keyExtractor={(item) => item.item_name}` — stable key by item name
- Category tab bar uses `flexGrow: 0, flexShrink: 0` to prevent ScrollView collapsing

## New Session

`↺` button in title bar triggers `Alert.alert` confirmation. On confirm, resets:
`messages`, `cart`, `mentionedItems`, `generalNotes`, `orderConfirmed`, `activeCategory`, `activeTab`, `rightTab`, `isLoading`, `tableNumber`, `guestCount`.

## Android APK — Cleartext HTTP Fix

Android 9+ blocks cleartext (HTTP) traffic in release APKs by default. Fixed via:

**`plugins/withCleartextTraffic.js`** — custom Expo config plugin:

```javascript
// Patches AndroidManifest.xml
application.$['android:usesCleartextTraffic'] = 'true';
application.$['android:networkSecurityConfig'] = '@xml/network_security_config';

// Creates res/xml/network_security_config.xml
<network-security-config>
    <base-config cleartextTrafficPermitted="true" />
</network-security-config>
```

This plugin runs automatically during `expo prebuild` (both EAS cloud and local builds).

The `expo-build-properties` plugin alone does **not** reliably apply this fix — the custom plugin using `@expo/config-plugins` `withAndroidManifest` is required.

## Local Build

`build_apk.sh` runs a local Gradle build:

```bash
./build_apk.sh [debug|release]
```

Steps:
1. `npx expo prebuild --clean` (generates `android/`)
2. Config plugin auto-patches `AndroidManifest.xml`
3. `./gradlew assembleRelease`
4. Copies APK to `mobile/gac-concierge-release.apk`

Requirements: Java 17, Android SDK at `~/android-sdk`, NDK 27.1.12297006.

## EAS Cloud Build

```bash
cd mobile
EXPO_TOKEN=<token> ./node_modules/.bin/eas build \
    --platform android --profile preview --non-interactive
```

Profile `preview` in `eas.json` produces an unsigned APK (not AAB). The `withCleartextTraffic` plugin ensures the manifest is patched in the cloud build environment.

EAS Project ID: `06794254-6b84-4d0e-8b79-5d87747823f6`
EAS Owner: `danlnguyen`

## Expo Go (Development)

Start Metro bundler:
```bash
cd mobile
EXPO_TOKEN=<token> npx expo start --lan
```

- iPad: Open Expo Go → "Enter URL manually" → `exp://192.168.10.3:8081`
- Android: Same URL, or scan QR from terminal via iOS Camera app

**Note**: `EXPO_TOKEN` is required after adding `extra.eas.projectId` to `app.json` to avoid interactive auth prompts in non-TTY environments.

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `expo` | SDK + build tooling |
| `expo-av` | Audio playback for TTS |
| `@react-native-async-storage/async-storage` | Persist server host |
| `@react-native-picker/picker` | Language dropdown (Android) |
| `expo-build-properties` | Android/iOS build config |
| `@expo/config-plugins` | Custom manifest patching |
| `react-native-safe-area-context` | Safe area insets |
| `react-native-screens` | Navigation performance |
