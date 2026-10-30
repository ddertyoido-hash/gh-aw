# LimeFit (web app + Android APK)

LimeFit is a single-file fitness app. `www/index.html` is the whole UI (self-contained:
inline CSS, inline JS, no network calls), and `android/` is the native Android shell that
bundles that same file, so the web preview and the APK never drift apart.

```
limefit/
├─ www/index.html        the app (added download pill for the web preview)
├─ android/
│  ├─ AndroidManifest.xml
│  ├─ res/drawable/app_icon.xml      launcher icon
│  ├─ src/com/limefit/app/MainActivity.java   WebView shell
│  └─ build-apk.sh       the APK build (aapt2 -> javac -> d8 -> zipalign -> apksigner)
├─ Dockerfile.android    Android SDK image (JDK 17 + cmdline-tools + android-34 + build-tools 34.0.0)
├─ nginx.conf            serves the app plus the APK
└─ dist/                 build output (git-ignored): LimeFit.apk + debug.keystore
```

## Running

```bash
docker compose -f docker-compose.base44.yml up -d          # LimeFit on :3000, Cloud AI on :3100
curl -sI http://localhost:3000/                            # the app
curl -sI http://localhost:3000/LimeFit.apk                 # the installer
```

## Rebuilding the APK

The `apk-builder` service is a one-shot job that writes `limefit/dist/LimeFit.apk`; the
`limefit` service serves it at `/LimeFit.apk` and the app's "Download Android APK" pill
links to it.

```bash
docker compose -f docker-compose.base44.yml run --rm apk-builder
```

Run it again after any change to `www/index.html`, `android/` — it is also re-run by
`docker compose up`. There is no Gradle: the build tools are driven directly, which keeps
the image small (1.4 GB) and the build under ~10 s once the image exists.

Useful details:

- **Package name:** `com.limefit.app`, version `1.0` (version code `1`).
- **SDK levels:** minSdk 23, targetSdk 34.
- **Signing:** `dist/debug.keystore` is generated on the first build with the standard
  debug credentials (`androiddebugkey` / `android`). It is git-ignored; keep it if you want
  later builds to install as updates over an existing LimeFit install, otherwise Android
  refuses the upgrade. For a store release, replace it with your own release key.
- **Offline:** the WebView loads `file:///android_asset/www/index.html`; no INTERNET
  permission is requested and the app makes no network calls.

## Installing the APK on a phone

Download `LimeFit.apk` from the preview (`Download Android APK` pill, or `/LimeFit.apk`),
open it on the device and allow "install unknown apps" for the browser/file manager.
Android 7+ shows this as a one-time per-app permission.
