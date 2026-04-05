#!/bin/bash
# GAC Concierge — Local Android APK Build Script
# Usage: ./build_apk.sh [debug|release]
# Output: android/app/build/outputs/apk/release/app-release.apk

set -e

MODE=${1:-release}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

export ANDROID_HOME=/home/danlnguyen/android-sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/build-tools/35.0.0
export JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java))))

echo "============================================"
echo " GAC Concierge — Local APK Build"
echo " Mode    : $MODE"
echo " Java    : $JAVA_HOME"
echo " SDK     : $ANDROID_HOME"
echo "============================================"

cd "$SCRIPT_DIR"

# Step 1: Generate native Android project from Expo config
echo ""
echo "[1/3] Running expo prebuild..."
npx expo prebuild --platform android --clean 2>&1

# Patch manifest — expo-build-properties does not reliably apply usesCleartextTraffic
MANIFEST="android/app/src/main/AndroidManifest.xml"
if ! grep -q "usesCleartextTraffic" "$MANIFEST"; then
    echo "    → Patching AndroidManifest with usesCleartextTraffic..."
    sed -i 's/android:enableOnBackInvokedCallback="false">/android:enableOnBackInvokedCallback="false" android:usesCleartextTraffic="true" android:networkSecurityConfig="@xml\/network_security_config">/' "$MANIFEST"
fi

# Create network security config if missing
NSC_DIR="android/app/src/main/res/xml"
mkdir -p "$NSC_DIR"
if [ ! -f "$NSC_DIR/network_security_config.xml" ]; then
    echo "    → Creating network_security_config.xml..."
    cat > "$NSC_DIR/network_security_config.xml" << 'NSCEOF'
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
NSCEOF
fi

# Step 2: Build APK with Gradle
echo ""
echo "[2/3] Building APK with Gradle..."
cd android

if [ "$MODE" = "debug" ]; then
    ./gradlew assembleDebug 2>&1
    APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
else
    ./gradlew assembleRelease 2>&1
    APK_PATH="app/build/outputs/apk/release/app-release.apk"
fi

cd ..

# Step 3: Copy to project root for easy access
echo ""
echo "[3/3] Copying APK..."
cp "android/$APK_PATH" "./gac-concierge-${MODE}.apk"

echo ""
echo "============================================"
echo " BUILD COMPLETE"
echo " APK: $SCRIPT_DIR/gac-concierge-${MODE}.apk"
SIZE=$(du -sh "./gac-concierge-${MODE}.apk" | cut -f1)
echo " Size: $SIZE"
echo "============================================"
