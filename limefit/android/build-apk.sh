#!/usr/bin/env bash
#
# Builds limefit/dist/LimeFit.apk from limefit/www/index.html + the tiny native
# WebView shell in this directory. No Gradle: the Android build tools are driven
# directly (aapt2 -> javac -> d8 -> zipalign -> apksigner), which keeps the image
# small and the build reproducible offline.
#
# Run it inside the SDK image:
#   docker compose -f docker-compose.base44.yml run --rm apk-builder
#
set -euo pipefail

REPO_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PROJ="$REPO_ROOT/limefit"
ANDROID_DIR="$PROJ/android"
WEB_DIR="$PROJ/www"
OUT_DIR="$PROJ/dist"
WORK="$ANDROID_DIR/build"

: "${ANDROID_HOME:?ANDROID_HOME is not set - run this inside limefit/Dockerfile.android}"
BUILD_TOOLS="$ANDROID_HOME/build-tools/34.0.0"
PLATFORM="$ANDROID_HOME/platforms/android-34/android.jar"

for tool in aapt2 d8 zipalign apksigner; do
  [ -x "$BUILD_TOOLS/$tool" ] || { echo "missing build tool: $BUILD_TOOLS/$tool" >&2; exit 1; }
done
[ -f "$PLATFORM" ] || { echo "missing android.jar: $PLATFORM" >&2; exit 1; }
[ -f "$WEB_DIR/index.html" ] || { echo "missing web app: $WEB_DIR/index.html" >&2; exit 1; }

echo "==> cleaning $WORK"
rm -rf "$WORK"
mkdir -p "$WORK/classes" "$WORK/dex" "$WORK/assets/www" "$OUT_DIR"

echo "==> copying web app into assets/www"
cp "$WEB_DIR/index.html" "$WORK/assets/www/index.html"

echo "==> compiling resources"
"$BUILD_TOOLS/aapt2" compile --dir "$ANDROID_DIR/res" -o "$WORK/res.zip"

echo "==> linking manifest, resources and assets"
"$BUILD_TOOLS/aapt2" link \
  -o "$WORK/base.apk" \
  -I "$PLATFORM" \
  --manifest "$ANDROID_DIR/AndroidManifest.xml" \
  -A "$WORK/assets" \
  --min-sdk-version 23 \
  --target-sdk-version 34 \
  --version-code 1 \
  --version-name 1.0 \
  "$WORK/res.zip"

echo "==> compiling java"
# shellcheck disable=SC2046
javac -nowarn -source 8 -target 8 -Xlint:-options \
  -classpath "$PLATFORM" \
  -d "$WORK/classes" \
  $(find "$ANDROID_DIR/src" -name '*.java')

echo "==> dexing"
# shellcheck disable=SC2046
"$BUILD_TOOLS/d8" --lib "$PLATFORM" --min-api 23 --output "$WORK/dex" \
  $(find "$WORK/classes" -name '*.class')

echo "==> packaging classes.dex"
(cd "$WORK/dex" && zip -q "$WORK/base.apk" classes.dex)

echo "==> aligning"
"$BUILD_TOOLS/zipalign" -f -p 4 "$WORK/base.apk" "$WORK/aligned.apk"

# The debug key must stay stable across builds so an already installed LimeFit
# can be updated in place. It is generated once into dist/ (never committed).
KEYSTORE="$OUT_DIR/debug.keystore"
if [ ! -f "$KEYSTORE" ]; then
  echo "==> creating debug keystore"
  keytool -genkeypair \
    -keystore "$KEYSTORE" \
    -alias androiddebugkey \
    -storepass android -keypass android \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Android Debug,O=Android,C=US" >/dev/null 2>&1
fi

echo "==> signing"
rm -f "$OUT_DIR/LimeFit.apk"
"$BUILD_TOOLS/apksigner" sign \
  --ks "$KEYSTORE" \
  --ks-key-alias androiddebugkey \
  --ks-pass pass:android \
  --key-pass pass:android \
  --min-sdk-version 23 \
  --out "$OUT_DIR/LimeFit.apk" \
  "$WORK/aligned.apk"

echo "==> verifying"
"$BUILD_TOOLS/apksigner" verify --print-certs "$OUT_DIR/LimeFit.apk" | head -4
"$BUILD_TOOLS/aapt2" dump badging "$OUT_DIR/LimeFit.apk" | grep -E "^(package|launchable-activity|application-label)"
echo "==> built $OUT_DIR/LimeFit.apk ($(du -h "$OUT_DIR/LimeFit.apk" | cut -f1))"
